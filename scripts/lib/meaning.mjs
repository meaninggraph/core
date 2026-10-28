// Checks for meaning files (format meaning/draft-2, the only format; the schema is meaning.draft-2.schema.json from
// the pinned meaninggraph/core checkout): JSON Schema validation of each file, then the rules a schema cannot express.
// Every concept reference must resolve; extends joins compatible kinds only, without a cycle; values-of and units-of
// name entities or value sets (a child may narrow its parent's, never change it); measures are computed from
// properties and measures and grouped by dimensions and properties; a ratio is never summed; every modelspec://
// binding must name an existing record type and field that fits its role (identifier and display-name on the
// concept's own record type, one instances binding per concept, a reference to the record type of its target
// concept); transitions and initial values name a value set's own values; inverse words sit on a property with
// values-of; replaced-by goes with deprecated; and values must cover the data they describe. Links that the model
// already states are derived (deriveLinks), never written.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { parseHcl, toModelspecJson } from './modelspec.mjs';
import { createEffectiveModelResolver, ModelCapabilityError } from './effective-model.mjs';
import { diagnosticText, modelMessage, modelMessageBytes } from './model-diagnostic.mjs';

// Where meaning:// repositories are read from, keyed by {host}/{org}/{repo}.
// `git` fetches the repository at the ?ref= pin that the references carry (see
// checkoutGit); `dir` reads a local directory (relative to the repository
// root). The universal concepts and the meaning-file schema both come from
// the one pinned checkout of github.com/meaninggraph/core: the resolver
// returns its `dir`, and nothing else names a path inside it.
export const coreRepo = 'github.com/meaninggraph/core';
export const meaningSources = {
  [coreRepo]: { git: 'https://github.com/meaninggraph/core' },
};

const conceptId = '[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*';
const bareRefPattern = new RegExp(`^${conceptId}$`);
const conceptRefPattern = new RegExp(`^meaning://([A-Za-z0-9.-]+(?:/[A-Za-z0-9._-]+)+)/(${conceptId})(?:\\?ref=([A-Za-z0-9._/-]+))?$`);
const ownRefPattern = new RegExp(`^meaning:///(${conceptId})$`);
const modelRefPattern = /^modelspec:\/\/((?:[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._-]+)+)?)\/([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)(?:\?ref=([A-Za-z0-9._/-]+))?$/;

// A bare id or meaning:///{id} is a concept in the same repository; meaning://{host}/{org}/{repo}/{id}
// is a concept in another one. The last path segment is the concept id.
export function parseConceptRef(ref) {
  if (bareRefPattern.test(ref)) return { id: ref };
  const own = ownRefPattern.exec(ref);
  if (own) return { id: own[1] };
  const match = conceptRefPattern.exec(ref);
  if (!match) return null;
  return { repo: match[1], id: match[2], ref: match[3] };
}

// modelspec:///{module}.{Name} (same repository) or modelspec://{host}/{org}/{repo}/{module}.{Name}.
export function parseModelRef(ref) {
  const match = modelRefPattern.exec(ref);
  if (!match) return null;
  return { repo: match[1] || undefined, module: match[2], name: match[3], ref: match[4] };
}

export const draft2 = 'meaning/draft-2';
export const schemaName = 'meaning.draft-2.schema.json';

const compiled = new Map();
export function schemaValidator(schemaPath) {
  if (!compiled.has(schemaPath)) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    addFormats(ajv);
    compiled.set(schemaPath, ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8'))));
  }
  return compiled.get(schemaPath);
}

export function schemaProblems(doc, schemaPath) {
  const validate = schemaValidator(schemaPath);
  if (validate(doc)) return [];
  return validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}${error.params?.allowedValues ? ` (${error.params.allowedValues.join(', ')})` : ''}${error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : ''}`);
}

// Loads every *.meaning.yaml file directly in `dir` (the repository root; subdirectories are not
// searched) as one repository's concepts. The result also carries `dir` and, when
// given, the repository's own `address` ({host}/{org}/{repo}): a meaning://
// reference to that address inside it is a reference to itself, like a bare id.
export function loadMeaningDir(dir, address) {
  const files = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.meaning.yaml')).map((entry) => entry.name).sort().map((name) => {
    const path = join(dir, name);
    return { path, doc: parseYaml(readFileSync(path, 'utf8')) };
  });
  return { ...indexConcepts(files, address), dir };
}

export function indexConcepts(files, address) {
  const concepts = new Map();
  const problems = [];
  for (const file of files) {
    for (const concept of file.doc?.concepts ?? []) {
      if (concepts.has(concept.id)) problems.push(`concept ${concept.id} is declared twice (${concepts.get(concept.id).path} and ${file.path})`);
      else concepts.set(concept.id, { concept, path: file.path, doc: file.doc });
    }
  }
  return { files, concepts, problems, address };
}

// Every meaning:// reference written anywhere in a meaning file, parsed.
export function conceptReferences(doc) {
  const found = [];
  const walk = (value) => {
    if (typeof value === 'string') { const parsed = value.startsWith('meaning://') && parseConceptRef(value); if (parsed?.repo) found.push(parsed); }
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(doc);
  return found;
}

// The distinct ?ref= pins that a meaning file's references to `repo` carry.
export const pinsOf = (doc, repo) => [...new Set(conceptReferences(doc).filter((ref) => ref.repo === repo).map((ref) => ref.ref ?? ''))].sort();

const commit = /^[0-9a-f]{40}$/;
// Errors that another attempt cannot fix (the ref or repository is not there).
const permanentFailure = /couldn't find remote ref|not our ref|invalid refspec|not found|does not appear to be a git repository|could not read from remote|authentication failed/i;
const gitFailure = (error) => String(error.stderr ?? error.message).trim().split('\n').filter(Boolean).pop() ?? 'git failed';
const defaultRun = (command, args) => execFileSync(command, args, { stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).toString();
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Fetches `ref` of the git repository at `url` and returns { dir, release }.
// A full commit id is immutable, so with a `cacheDir` the checkout is kept
// there under that id (a CI cache may restore it) and reused only after it has
// been made that commit again: tracked files are rewritten from the commit,
// every untracked or ignored file is removed (whatever the exclude rules say),
// and a checkout that still differs (hidden index flags such as
// assume-unchanged or skip-worktree, a sparse checkout) is thrown away and
// fetched anew; `release` then does nothing. Any other ref, or no cacheDir,
// uses a temporary clone that `release` removes (in `tempDir`). A failed fetch
// is retried (`retries` attempts, a growing pause between them) and never
// leaves a clone behind. Two processes filling the same cache entry both end
// up with the same verified directory. `run(command, args)` runs git; tests
// replace it.
export function checkoutGit(url, ref, { cacheDir, tempDir = tmpdir(), run = defaultRun, retries = 3, retryDelayMs = 1000 } = {}) {
  const git = (dir, ...args) => run('git', ['-C', dir, ...args]);
  // Makes `dir` exactly the commit `expected` again; false when it cannot be
  // trusted. git is pointed at dir/.git explicitly, so that a directory that is
  // not a repository of its own (inside the cache, inside the project's own
  // repository) is never reset or cleaned by mistake.
  const pristine = (dir, expected) => {
    try {
      if (!statSync(join(dir, '.git')).isDirectory()) return false;
      const own = (...args) => run('git', ['--git-dir', join(dir, '.git'), '--work-tree', dir, ...args]);
      if (own('rev-parse', 'HEAD').trim() !== expected) return false;
      own('read-tree', '--reset', '-u', 'HEAD');
      own('checkout-index', '--all', '--force');
      own('clean', '-ffdxq');
      return own('status', '--porcelain').trim() === ''
        && own('ls-files', '--others').trim() === ''
        && own('ls-files', '-v').split('\n').filter(Boolean).every((line) => line.startsWith('H '));
    } catch { return false; }
  };
  const kept = cacheDir && commit.test(ref) ? join(cacheDir, ref) : null;
  if (kept && existsSync(kept)) {
    if (pristine(kept, ref)) return { dir: kept, release() {} };
    rmSync(kept, { recursive: true, force: true });
  }
  const parent = kept ? cacheDir : tempDir;
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(join(parent, '.meaning-source-'));
  let done = false;
  try {
    run('git', ['init', '-q', work]);
    for (let attempt = 1; ; attempt++) {
      try { git(work, 'fetch', '-q', '--depth', '1', url, ref); break; } catch (error) {
        if (attempt >= retries || permanentFailure.test(gitFailure(error))) throw new Error(`cannot fetch ${ref} from ${url}: ${gitFailure(error)}`);
        pause(retryDelayMs * attempt);
      }
    }
    git(work, 'checkout', '-q', 'FETCH_HEAD');
    if (commit.test(ref) && !pristine(work, ref)) throw new Error(`${url} at ${ref} did not check out that commit`);
    if (kept) {
      try { renameSync(work, kept); } catch (error) {
        // Another process filled the entry first: use its directory once it is verified.
        if (!['ENOTEMPTY', 'EEXIST'].includes(error.code) || !pristine(kept, ref)) throw error;
      }
    }
    done = true;
  } finally {
    if (!done || kept) rmSync(work, { recursive: true, force: true });
  }
  return kept ? { dir: kept, release() {} } : { dir: work, release: () => rmSync(work, { recursive: true, force: true }) };
}

// The cache for checkouts of immutable commits: MEANING_CACHE_DIR, or .cache/meaning-sources
// under the repository root (git-ignored; CI restores it keyed by the meaning files).
export const defaultCacheDir = (root) => process.env.MEANING_CACHE_DIR || join(root, '.cache', 'meaning-sources');

// Resolves meaning:// repositories through `sources` (see meaningSources) to
// { dir, files, concepts, problems, address } or { error }. Call `.dispose()` when done:
// it removes the temporary clones of refs that are not immutable commits.
export function createResolver({ root, sources = meaningSources, cacheDir = defaultCacheDir(root), run } = {}) {
  const cache = new Map();
  const releases = [];
  const resolve = (repo, ref) => {
    const source = sources[repo];
    if (!source) return { error: `no source configured for meaning://${repo}` };
    if (source.git && !ref) return { error: `meaning://${repo} is read from git and needs a ?ref= pin` };
    const key = `${repo}@${ref ?? ''}`;
    if (!cache.has(key)) {
      try {
        if (source.dir) cache.set(key, loadMeaningDir(join(root, source.dir), repo));
        else {
          const checkout = checkoutGit(source.git, ref, { cacheDir, run });
          releases.push(checkout.release);
          cache.set(key, loadMeaningDir(checkout.dir, repo));
        }
      } catch (error) {
        cache.set(key, { error: `meaning://${repo}?ref=${ref} cannot be read: ${error.message}` });
      }
    }
    return cache.get(key);
  };
  resolve.dispose = () => { for (const release of releases.splice(0)) release(); cache.clear(); };
  return resolve;
}

function loadModels(file, doc, origins) {
  const models = {};
  for (const [module, relative] of Object.entries(doc.models ?? {})) {
    const source = join(dirname(file), relative);
    const text = readFileSync(source, 'utf8');
    models[module] = toModelspecJson(parseHcl(text), { id: module, name: module, version: 'unversioned' });
    origins?.set(models[module], source);
  }
  return models;
}

// ---- the format ----------------------------------------------------------------------------------------------------
// meaning/draft-2 is the only format. A file in any other format (meaning/draft-1 included) is refused; a concept of
// such a file in a graph that is only resolved has no kind this check knows and matches no rule below.

export const isKnownFormat = (format) => format === draft2;
const formatError = 'format must be meaning/draft-2';
const formatOf = (concept, repo) => repo?.concepts?.get(concept.id)?.doc?.format;
const kindOf = (concept, format) => (format === draft2 ? concept?.kind : undefined);
const kindIn = ({ concept, repo }) => kindOf(concept, formatOf(concept, repo));
const isEntityLike = (found) => ['entity', 'value-set'].includes(kindIn(found));

// extends means "is a kind of", so it joins concepts of compatible kinds only: a concept's kind -> the kinds it may
// extend, in the current words. A property and a dimension are both a property of an entity (a dimension is one
// that answers are grouped by), so they may extend each other; an entity and a value set are one class here.
const extendsKinds = {
  entity: ['entity', 'value-set'],
  'value-set': ['value-set', 'entity'],
  property: ['property', 'dimension'],
  dimension: ['dimension', 'property'],
  measure: ['measure'],
};
// What a measure may be computed from, and what it may be grouped by.
const measureInputs = ['property', 'measure'];
const measureDimensions = ['dimension', 'property'];
export const extendsCompatibility = extendsKinds;
export const measureInputKinds = measureInputs;
export const measureDimensionKinds = measureDimensions;
// Aggregations that are wrong for a ratio: it is recomputed per group.
const ratioAggregations = ['sum', 'count', 'average'];
// Binding roles whose stored values name the concept's known values.
const valueRoles = ['value', 'display-name'];
const an = (kind) => `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;

// Resolves `ref` as written inside `repo` (a repository index from
// loadMeaningDir or indexConcepts): bare ids resolve in that repository, and so
// does a meaning:// reference to the repository's own address (no ?ref=), the
// rest through `resolve`. Returns { concept, repo } or null.
export function resolveConcept(ref, repo, resolve) {
  const parsed = ref && parseConceptRef(ref);
  if (!parsed) return null;
  const own = !parsed.repo || (parsed.ref === undefined && parsed.repo === repo.address);
  const target = own ? repo : resolve(parsed.repo, parsed.ref);
  if (!target || target.error) return null;
  const found = target.concepts.get(parsed.id);
  return found ? { concept: found.concept, repo: target } : null;
}

// The concept and its ancestors through extends, nearest first. Stops at a
// repeat, so a cycle (reported by checkMeaning) cannot loop.
export function lineage(concept, repo, resolve) {
  const chain = [];
  for (let node = { concept, repo }; node && chain.length < 50; node = resolveConcept(node.concept.extends, node.repo, resolve)) {
    if (chain.some((seen) => seen.concept === node.concept)) break;
    chain.push(node);
  }
  return chain;
}

// The nearest concept along the lineage that sets `key`, with the repository
// it is written in (bare ids in its value resolve there), or null.
export function inherited(concept, repo, key, resolve) {
  return lineage(concept, repo, resolve).find((node) => node.concept[key] !== undefined) ?? null;
}

// A ratio is a measure computed from another measure, or a kind of a ratio.
// Returns the measure input that makes it one, or null.
export function ratioInput(concept, repo, resolve) {
  for (const node of lineage(concept, repo, resolve)) {
    for (const input of node.concept.measure?.inputs ?? []) {
      if (resolveConcept(input, node.repo, resolve)?.concept.kind === 'measure') return input;
    }
  }
  return null;
}

// How a measure's values combine when grouped: its own aggregation, else the
// nearest one along extends (like unit), else none. Returns { aggregation, from }
// where `from` is the concept that states it (null when none does).
export function effectiveAggregation(concept, repo, resolve) {
  const node = lineage(concept, repo, resolve).find((entry) => entry.concept.measure?.aggregation !== undefined);
  return node ? { aggregation: node.concept.measure.aggregation, from: node.concept } : { aggregation: 'none', from: null };
}

// The known values of a concept and the concept that holds the list: its own list (a value set), or that of the
// value set (or entity) named by its values-of (its own or inherited through extends).
// extends never passes values themselves: a kind of country attribute holds countries, but an entity that
// extends another is not a list of the parent's instances.
function knownValues(concept, local, resolve) {
  if (concept.values) return { values: concept.values, holder: { concept, repo: local } };
  const domain = inherited(concept, local, 'values-of', resolve);
  if (!domain) return { values: [], holder: null };
  const holder = resolveConcept(domain.concept['values-of'], domain.repo, resolve);
  return { values: holder?.concept.values ?? [], holder };
}
export const effectiveValues = (concept, local, resolve) => knownValues(concept, local, resolve).values;

// A list is open unless its value set says `complete: true`.
const isComplete = ({ concept }) => concept.complete === true;

// The known values that a stored value names. `match` is labels (labels and
// aliases in any language, ignoring case) or codes.<code> (that code, exactly).
export function matchValues(values, stored, match = 'labels') {
  if (match.startsWith('codes.')) {
    const code = match.slice('codes.'.length);
    return values.filter((value) => value.codes?.[code] === String(stored));
  }
  const key = String(stored).toLowerCase();
  return values.filter((value) => [...Object.values(value.labels ?? {}), ...Object.values(value.aliases ?? {}).flat()].some((word) => word.toLowerCase() === key));
}

// A record type's key as a list. A model that gives it as anything else (key = 5, key = "Id") has no key to read.
const keyOf = (record) => (Array.isArray(record?.key) ? record.key : []);

// ---- derived links ----------------------------------------------------------------------------------------------
// FORMAT.md, "Derived links". `files` is [{ doc, models }]: a parsed meaning file and its models (module short name ->
// the model as toModelspecJson returns it). The result is the written and the derived links of the graph, sorted.
const compareBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
export function deriveLinks(files, limits = {}) {
  const resolvers = new Map();
  const resolverFor = (models, supplied) => {
    if (supplied) return supplied;
    if (!resolvers.has(models)) resolvers.set(models, createEffectiveModelResolver(models, limits));
    return resolvers.get(models);
  };
  const links = new Map();
  const identity = (concept, module, record, field, role) => JSON.stringify([concept, module, record, field ?? null, role]);
  const instances = [];
  const link = (concept, module, record, field, role, extra = {}) => ({ concept, model: `modelspec:///${module}.${record}`, ...(field === undefined ? {} : { field }), role, ...extra });
  // Written links, in file order; a line that repeats the five parts of an earlier one adds nothing.
  for (const { doc, models, resolver } of files) {
    resolverFor(models, resolver).assertValid();
    for (const concept of Array.isArray(doc?.concepts) ? doc.concepts : []) {
      for (const binding of Array.isArray(concept?.bindings) ? concept.bindings : []) {
        const parsed = typeof binding?.model === 'string' ? parseModelRef(binding.model) : null;
        if (!parsed || parsed.repo) continue;
        const role = binding.role;
        const field = role === 'instances' ? undefined : binding.field;
        const id = identity(concept.id, parsed.module, parsed.name, field, role);
        if (!links.has(id)) links.set(id, link(concept.id, parsed.module, parsed.name, field, role, { ...(binding.note ? { note: binding.note } : {}), ...(binding.match ? { match: binding.match } : {}) }));
        if (role === 'instances') instances.push({ concept: concept.id, module: parsed.module, record: parsed.name, resolver: resolverFor(models, resolver) });
      }
    }
  }
  // Derived links: the references to a record type bound with role instances, and its key.
  const derived = (concept, module, record, field, role, resolver) => {
    // Source names are broader than the existing binding DSL. A required link
    // must be representable without changing that grammar or dropping the fact.
    const uriName = /^[A-Za-z][A-Za-z0-9_]*$/;
    const fieldName = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!uriName.test(module) || !uriName.test(record) || field !== undefined && !fieldName.test(field)) {
      resolver.capability('binding-representation-unavailable', modelMessage`cannot derive complete links: ${module}.${record} field ${field ?? '(record)'} is not representable by the existing binding grammar`);
    }
    const address = `modelspec:///${module}.${record}`;
    const parsed = parseModelRef(address);
    if (!parsed || parsed.module !== module || parsed.name !== record || parsed.repo !== undefined || parsed.ref !== undefined) resolver.capability('binding-representation-unavailable', modelMessage`cannot derive complete links: ${module}.${record} is not representable by the existing model reference grammar`);
    const id = identity(concept, module, record, field, role);
    if (!links.has(id)) links.set(id, link(concept, module, record, field, role, { derived: true }));
  };
  for (const { concept, module, record, resolver } of instances) {
    resolver.assertValid();
    const target = resolver.record(module, record);
    if (!target) resolver.capability('record-unavailable', modelMessage`cannot derive complete links: ${module}.${record} is unavailable`);
    const seen = new Map();
    for (const [alias, owner] of resolver.aliases) {
      if (!seen.has(owner.identity)) seen.set(owner.identity, new Set());
      for (const name of Object.keys(owner.records)) {
        if (seen.get(owner.identity).has(name)) continue;
        seen.get(owner.identity).add(name);
        if (!resolver.spend()) resolver.capability('model-work-limit', 'derived link work limit reached');
        const candidate = resolver.record(alias, name);
        for (const [field, info] of resolver.requireComplete(candidate)) {
          if (!resolver.spend()) resolver.capability('model-work-limit', 'derived link work limit reached');
          const reference = resolver.recordReference(info);
          if (reference?.status === 'unavailable') resolver.capability('reference-unavailable', modelMessage`cannot derive complete links for ${alias}.${name}.${field}: ${reference.message}`);
          if (reference?.status === 'known' && reference.owner.identity === target.owner.identity && reference.name === target.name) derived(concept, owner.identity === target.owner.identity ? module : alias, name, field, 'reference', resolver);
        }
      }
    }
    for (const key of keyOf(target.definition)) {
      if (!resolver.spend()) resolver.capability('model-work-limit', 'derived link work limit reached');
      const field = resolver.field(target, key);
      if (field.status === 'absent') continue; // known absence is the existing key/field intersection rule
      if (field.status !== 'known') resolver.capability('key-unavailable', modelMessage`cannot derive complete identifier links for ${module}.${record}.${key}: ${field.message ?? 'key field is absent'}`);
      derived(concept, module, record, key, 'identifier', resolver);
    }
  }
  return [...links.values()].sort((a, b) => compareBytes(a.concept, b.concept) || compareBytes(a.model, b.model) || compareBytes(a.field ?? '', b.field ?? '') || (a.field === undefined ? 0 : 1) - (b.field === undefined ? 0 : 1) || compareBytes(a.role, b.role));
}

// Checks one repository's meaning files: `local` is the result of
// loadMeaningDir (or indexConcepts), `resolve` reads other repositories.
// `selfRepo` is the repository's own {host}/{org}/{repo}: a meaning://
// reference to it is a reference to `local`. Returns a list of problems; empty
// means the files are consistent. `notice(text, rule)`, when given, receives
// the findings that are not problems (a retired value, a reference to a
// deprecated concept); see checkMeaningReport for the structured result.
export function checkMeaning({ notice, ...rest }) {
  const report = checkMeaningReport(rest);
  if (notice) for (const found of report.notices) notice(found.message, found.rule);
  return report.problems.map((problem) => problem.message);
}

// The same check with the rule of every finding: { problems, notices, links } where problems and notices are
// lists of { rule, message } (the rule ids of the Go checker, plus retired-value and deprecated-concept) and `links` is the derived-link list of deriveLinks when `derive` is set
// and there is no problem, else null (the links of a graph that fails the check are not defined).
export function checkMeaningReport({ local, resolve: resolveOther, schemaPath, models: givenModels, selfRepo, derive = false }) {
  const problems = [];
  const notices = [];
  let capabilityFindings = 0;
  let omittedCapabilities = 0;
  const add = (rule, message) => {
    if (rule === 'model-capability') {
      if (capabilityFindings++ >= 64) { omittedCapabilities++; return; }
      message = diagnosticText(message, modelMessageBytes);
    }
    problems.push({ rule, message });
  };
  const note = (rule, message) => notices.push({ rule, message });
  for (const message of local.problems) add('duplicate-concept', message);
  const resolve = (repo, ref) => (selfRepo !== undefined && repo === selfRepo ? local : resolveOther(repo, ref));
  // One pin per referenced repository across all of this repository's files:
  // the repository resolves against one version of each dependency.
  const pins = new Map();
  const deprecatedNotice = (concept, ref, where) => {
    if (concept.deprecated === true) note('deprecated-concept', `${where}: deprecated-concept: ${ref} is deprecated${concept['replaced-by'] ? `; use ${concept['replaced-by']}` : ''}`);
  };
  const lookup = (ref, where) => {
    const parsed = parseConceptRef(ref);
    if (!parsed) { add('reference-syntax', `${where}: ${ref} is not a concept reference`); return null; }
    if (!parsed.repo || parsed.repo === selfRepo) {
      if (parsed.repo && parsed.ref !== undefined) add('self-pin', `${where}: ${ref} pins this repository's own concept; a reference to the repository itself cannot carry ?ref=`);
      const found = local.concepts.get(parsed.id);
      if (!found) add('unknown-concept', `${where}: concept ${parsed.id} is not declared in this repository`);
      else deprecatedNotice(found.concept, ref, where);
      return found ? { concept: found.concept, repo: local } : null;
    }
    const seen = pins.get(parsed.repo);
    if (seen !== undefined && seen !== (parsed.ref ?? '')) add('pin-mismatch', `${where}: meaning://${parsed.repo} is pinned to both "${seen}" and "${parsed.ref ?? ''}"; use one pin per repository`);
    pins.set(parsed.repo, parsed.ref ?? '');
    const remote = resolve(parsed.repo, parsed.ref);
    if (remote.error) { add('unresolved-graph', `${where}: ${remote.error}`); return null; }
    const found = remote.concepts.get(parsed.id);
    if (!found) add('unknown-concept', `${where}: concept ${parsed.id} does not exist in meaning://${parsed.repo}`);
    else deprecatedNotice(found.concept, ref, where);
    return found ? { concept: found.concept, repo: remote } : null;
  };
  // ModelSpec record types whose rows are instances of a concept (role instances, written entity or instances).
  const entityBindings = (concept) => (concept.bindings ?? []).filter((b) => b.role === 'instances').map((b) => parseModelRef(b.model)).filter(Boolean);
  const loaded = [];
  const byDocument = new Map();
  const modelOrigins = new WeakMap();
  const referenceProofs = [];
  for (const file of local.files) {
    const { path, doc } = file;
    const format = doc?.format;
    // A mapping with no format or an unknown one is refused with that one finding, whether or not a schema path is given,
    // and no other rule is applied to it (FORMAT.md, "Files and discovery"): its words belong to no format. Its concepts
    // stay in the index, so a duplicate id is still reported and another file may name them.
    if (!isKnownFormat(format) && doc && typeof doc === 'object' && !Array.isArray(doc)) {
      add('schema', `${path}: schema: ${formatError}`);
      continue;
    }
    if (schemaPath) {
      if (!existsSync(schemaPath)) add('schema', `${path}: schema: ${schemaPath} does not exist`);
      else for (const problem of schemaProblems(doc, schemaPath)) add('schema', `${path}: schema: ${problem}`);
    }
    if (!Array.isArray(doc?.concepts)) continue;
    let models = givenModels;
    try { models ??= loadModels(path, doc, modelOrigins); } catch (error) { add('models', `${path}: models: ${error.message}`); models = {}; }
    const modelResolver = createEffectiveModelResolver(models, { identityFor: (model) => modelOrigins.get(model) ?? model });
    for (const invalid of modelResolver.invalid) add('binding-model', modelMessage`${path}: models: ${invalid.message}`);
    const modelContext = { doc, models, resolver: modelResolver };
    loaded.push(modelContext);
    byDocument.set(doc, modelContext);
    const sourceIds = new Set();
    for (const source of doc.sources ?? []) {
      if (sourceIds.has(source.id)) add('duplicate-source', `${path}: source ${source.id} is declared twice`);
      sourceIds.add(source.id);
    }
    for (const concept of doc.concepts) {
      const where = modelMessage`${path}: concept ${concept.id}`;
      const entityLike = 'an entity or a value-set';
      if (concept.of) {
        const owner = lookup(concept.of, `${where} of`);
        if (owner && !isEntityLike(owner)) add('target-kind', `${where}: of names ${concept.of}, which is ${an(owner.concept.kind)}, not ${entityLike}`);
      }
      if (concept.extends) {
        const parent = lookup(concept.extends, `${where} extends`);
        const allowed = Object.hasOwn(extendsKinds, kindOf(concept, format)) ? extendsKinds[kindOf(concept, format)] : [];
        if (parent && !allowed.includes(kindIn(parent))) add('extends-kind', `${where}: ${an(concept.kind)} cannot extend ${concept.extends}, which is ${an(parent.concept.kind)}; extends means "is a kind of", and ${an(concept.kind)} may extend only ${allowed.join(' or ')}`);
        // The chain of extends, through any repository, comes back to a concept it has passed.
        const seen = [concept];
        for (let node = resolveConcept(concept.extends, local, resolve); node; node = resolveConcept(node.concept.extends, node.repo, resolve)) {
          if (seen.includes(node.concept)) { add('extends-cycle', `${where}: extends forms a cycle (${[...seen, node.concept].map((c) => c.id).join(' -> ')})`); break; }
          seen.push(node.concept);
        }
      }
      for (const key of ['values-of', 'units-of']) {
        if (!concept[key]) continue;
        const target = lookup(concept[key], `${where} ${key}`);
        if (target && !isEntityLike(target)) add('target-kind', `${where}: ${key} names ${concept[key]}, which is ${an(target.concept.kind)}, not ${entityLike}`);
      }
      // A kind of an attribute whose values are instances of X holds instances
      // of X, or of a kind of X; a kind of an amount in units that are instances
      // of Y has units that are instances of Y, or of a kind of Y: values-of and
      // units-of may narrow an inherited one, never change it.
      for (const key of ['values-of', 'units-of']) {
        if (!concept[key] || !concept.extends) continue;
        const parent = resolveConcept(concept.extends, local, resolve);
        const domain = parent && inherited(parent.concept, parent.repo, key, resolve);
        const required = domain && resolveConcept(domain.concept[key], domain.repo, resolve);
        const own = resolveConcept(concept[key], local, resolve);
        if (required && own && !lineage(own.concept, own.repo, resolve).some((node) => node.concept === required.concept)) add('narrowing', `${where}: ${key} ${concept[key]} is neither ${domain.concept[key]} nor a kind of it, which ${concept.extends} requires`);
      }
      // With units-of (own or inherited) the unit names one value of that entity or value set.
      const unitDomain = concept.unit && inherited(concept, local, 'units-of', resolve);
      if (unitDomain) {
        const entity = resolveConcept(unitDomain.concept['units-of'], unitDomain.repo, resolve);
        if (entity) {
          const unit = concept.unit.toLowerCase();
          const named = (entity.concept.values ?? []).filter((value) => [...Object.values(value.labels ?? {}), ...Object.values(value.aliases ?? {}).flat(), ...Object.values(value.codes ?? {})].some((word) => word.toLowerCase() === unit));
          if (named.length !== 1) add('unit', `${where}: unit "${concept.unit}" must name exactly one value of ${unitDomain.concept['units-of']} (units-of), but names ${named.length === 0 ? 'none' : named.map((value) => value.id).join(', ')}`);
          else if (named[0].retired === true) note('retired-value', `${where}: retired-value: unit "${concept.unit}" names the value ${named[0].id} of ${unitDomain.concept['units-of']}, which is retired`);
        }
      }
      const inputsWord = 'properties and measures';
      const dimensionsWord = 'dimensions or properties';
      for (const ref of concept.measure?.inputs ?? []) {
        const input = lookup(ref, `${where} measure.inputs`);
        if (input && !measureInputs.includes(kindIn(input))) add('measure-input', `${where}: measure.inputs names ${ref}, which is ${an(input.concept.kind)}; a measure is computed from ${inputsWord} only`);
      }
      for (const ref of concept.measure?.dimensions ?? []) {
        const dimension = lookup(ref, `${where} measure.dimensions`);
        if (dimension && !measureDimensions.includes(kindIn(dimension))) add('measure-dimension', `${where}: measure.dimensions names ${ref}, which is ${an(dimension.concept.kind)}; a measure is grouped by ${dimensionsWord} only`);
      }
      // A kind of a measure inherits its aggregation, so a ratio that extends a measure which sums is wrong too.
      const { aggregation, from } = concept.kind === 'measure' ? effectiveAggregation(concept, local, resolve) : {};
      if (ratioAggregations.includes(aggregation)) {
        const ratio = ratioInput(concept, local, resolve);
        if (ratio) add('ratio-aggregation', `${where}: aggregation ${aggregation} on a ratio (it is computed from the measure ${ratio}); a ratio is recomputed per group from its inputs, so its aggregation is none${from !== concept ? `; ${aggregation} is inherited from ${from.id}, state aggregation: none` : ''}`);
      }
      if (concept.source && !sourceIds.has(concept.source)) add('undeclared-source', `${where}: source ${concept.source} is not declared in sources`);
      const valueIds = new Set();
      // A word names one value whatever the language: stored values are matched against every language.
      // A retired value still counts here, so a stored word never names two values.
      const names = new Map();
      for (const value of concept.values ?? []) {
        if (valueIds.has(value.id)) add('duplicate-value', `${where}: value ${value.id} is declared twice`);
        valueIds.add(value.id);
        for (const word of [...Object.values(value.labels ?? {}), ...Object.values(value.aliases ?? {}).flat()]) {
          const key = word.toLowerCase();
          if (names.has(key) && names.get(key) !== value.id) add('duplicate-value', `${where}: "${word}" names both ${names.get(key)} and ${value.id}`);
          names.set(key, value.id);
        }
      }
      // Transitions and initial values name the value set's own values (FORMAT.md, "Transitions and initial values").
      if (concept.transitions !== undefined || concept.initial !== undefined) {
        const own = new Set((concept.values ?? []).map((value) => value.id));
        const unknown = (id, at) => { if (!own.has(id)) add('transition', `${where}: ${at} names ${id}, which is not a value of ${concept.id}`); };
        for (const id of Array.isArray(concept.initial) ? concept.initial : []) unknown(id, 'initial');
        const froms = new Set();
        for (const transition of Array.isArray(concept.transitions) ? concept.transitions : []) {
          if (!transition || typeof transition !== 'object') continue;
          unknown(transition.from, 'transitions.from');
          if (froms.has(transition.from)) add('transition', `${where}: transitions list from ${transition.from} twice; give it one item`);
          froms.add(transition.from);
          const targets = new Set();
          for (const to of Array.isArray(transition.to) ? transition.to : []) {
            unknown(to, `transitions from ${transition.from} to`);
            if (to === transition.from) add('transition', `${where}: transition from ${to} to itself; a transition is a change of value`);
            if (targets.has(to)) add('transition', `${where}: transitions from ${transition.from} name ${to} twice`);
            targets.add(to);
          }
        }
      }
      // Inverse words need a relation to reverse, and must not repeat the concept's own words.
      if (concept.inverse !== undefined) {
        if (!inherited(concept, local, 'values-of', resolve)) add('inverse', `${where}: inverse needs values-of (own or inherited): it names the reverse direction of that relation`);
        const ownWords = new Map();
        for (const [language, label] of Object.entries(concept.labels ?? {})) ownWords.set(`${language}:${String(label).toLowerCase()}`, label);
        for (const [language, words] of Object.entries(concept.synonyms ?? {})) for (const word of words) ownWords.set(`${language}:${word.toLowerCase()}`, word);
        const inverseWords = [...Object.entries(concept.inverse?.labels ?? {}).map(([language, label]) => [language, label]), ...Object.entries(concept.inverse?.synonyms ?? {}).flatMap(([language, words]) => words.map((word) => [language, word]))];
        for (const [language, word] of inverseWords) if (ownWords.has(`${language}:${String(word).toLowerCase()}`)) add('inverse', `${where}: inverse word "${word}" (${language}) repeats a label or synonym of ${concept.id}`);
      }
      // replaced-by goes with deprecated, resolves, and names another concept that is not deprecated.
      if (concept['replaced-by'] !== undefined) {
        if (concept.deprecated !== true) add('deprecation', `${where}: replaced-by needs deprecated: true`);
        const successor = lookup(concept['replaced-by'], `${where} replaced-by`);
        if (successor && successor.concept === concept) add('deprecation', `${where}: replaced-by names the concept itself`);
        else if (successor && successor.concept.deprecated === true) add('deprecation', `${where}: replaced-by names ${concept['replaced-by']}, which is deprecated too; name the concept to use`);
      }
      const entities = entityBindings(concept);
      if (entities.length > 1) add('entity-bindings', `${where}: has ${entities.length} instances bindings (${entities.map((e) => `${e.module}.${e.name}`).join(', ')}); a concept binds one entity`);
      for (const binding of concept.bindings ?? []) {
        const parsed = parseModelRef(binding.model);
        if (!parsed) { add('binding-model', `${where}: ${binding.model} is not a modelspec:// reference`); continue; }
        if (parsed.repo) { add('binding-model', `${where}: ${binding.model} points at another repository; this check resolves same-repository models only`); continue; }
        if (!modelResolver.aliases.has(parsed.module)) { add('binding-model', `${where}: ${binding.model}: module ${parsed.module} is not listed in models`); continue; }
        const record = modelResolver.record(parsed.module, parsed.name);
        if (!record) { add('binding-model', `${where}: ${binding.model}: module ${parsed.module} has no entity ${parsed.name}`); continue; }
        const entity = record.definition;
        const field = binding.field;
        if (!field) continue;
        const fact = modelResolver.field(record, field);
        if (fact.status === 'absent') { add('binding-model', `${where}: ${binding.model}: entity ${parsed.name} has no property ${field}`); continue; }
        if (fact.status !== 'known') { add('model-capability', modelMessage`${where}: ${binding.model}: cannot prove property ${field}: ${fact.message}`); continue; }
        const member = fact.member;
        const at = modelMessage`${where}: ${parsed.name}.${field}`;
        const reference = member[fact.owner.words.record];
        const memberType = member.type ?? (member.component ? `component ${member.component}` : 'unknown value');
        // identifier and display-name describe the rows of the concept's own entity.
        if (binding.role === 'identifier' || binding.role === 'display-name') {
          if (entities.length === 0) add('binding-role', `${at} has role ${binding.role}, but ${concept.id} has no entity binding, so it cannot be checked which entity the property must sit on`);
          else if (entities.length === 1 && !(() => {
            const owner = modelResolver.record(entities[0].module, entities[0].name);
            return entities[0].repo === parsed.repo && owner && owner.owner.identity === record.owner.identity && owner.name === record.name;
          })()) add('binding-role', `${at} has role ${binding.role}, but ${concept.id} is bound to the entity ${entities[0].name}; the property must be on that entity`);
        }
        if (binding.role === 'identifier' && !keyOf(entity).includes(field)) add('binding-role', `${at} has role identifier but is not in the key of ${parsed.name} [${keyOf(entity).join(', ')}]`);
        if (binding.role === 'display-name' && member.type !== 'string') add('binding-role', `${at} has role display-name but is ${reference ? `a reference to ${reference}` : an(memberType)}, not a string`);
        if (binding.role === 'value' && reference) add('binding-role', `${at} has role value but is a reference to ${reference}; bind it with role reference`);
        if (binding.role === 'reference') {
          if (!reference) { add('binding-role', `${at} has role ${binding.role} but is not a reference (it is ${an(memberType)})`); continue; }
          // The reference must point at the entity whose rows are the instances:
          // this concept's own (an entity) or those of its values-of entity.
          let target = null;
          if (kindOf(concept, format) === 'entity') target = { concept, repo: local };
          else {
            const domain = inherited(concept, local, 'values-of', resolve);
            if (!domain) { add('binding-role', `${at} has role ${binding.role}, so ${concept.id} needs values-of: the entity its references point at`); continue; }
            target = resolveConcept(domain.concept['values-of'], domain.repo, resolve);
          }
          if (!target) continue; // an unresolvable values-of is reported above
          // Only this repository's own bindings name models this check can read.
          const expected = target.repo === local ? entityBindings(target.concept) : [];
          if (expected.length === 0) add('binding-role', `${at} has role ${binding.role}, but ${target.concept.id} has no entity binding in this repository, so it cannot be checked that ${reference} holds its instances; bind ${target.concept.id} (or a concept of this repository that extends it) to its entity`);
          else referenceProofs.push(() => {
            const referenceFact = modelResolver.recordReference(fact);
            if (referenceFact.status !== 'known') {
              if (referenceFact.status === 'unavailable') add('model-capability', modelMessage`${at}: cannot prove reference target ${reference}: ${referenceFact.message}`);
              return; // known malformed/local-missing references were preflighted
            }
            const targetDocument = local.concepts.get(target.concept.id)?.doc;
            const targetResolver = byDocument.get(targetDocument)?.resolver;
            const matches = expected.some((binding) => {
              const destination = binding.repo ? null : targetResolver?.record(binding.module, binding.name);
              return destination && destination.owner.identity === referenceFact.owner.identity && destination.name === referenceFact.name;
            });
            if (!matches) add('binding-role', `${at} references ${reference}, but the instances of ${target.concept.id} are ${expected.map((e) => e.name).join(', ')} rows`);
          });
        }
      }
    }
  }
  for (const prove of referenceProofs) prove();
  let links = null;
  if (derive && problems.length === 0) {
    try { links = deriveLinks(loaded); }
    catch (error) {
      if (!(error instanceof ModelCapabilityError)) throw error;
      add('model-capability', modelMessage`${error.code}: ${error.message} (${error.diagnostics.length} diagnostics; first: ${error.diagnostics[0]?.message ?? 'none'})`);
    }
  }
  if (omittedCapabilities) problems.push({ rule: 'model-capability', message: modelMessage`${omittedCapabilities} additional model capability diagnostics omitted` });
  return { problems, notices, links };
}

// Checks that every distinct value stored in a column bound with role value
// or display-name names exactly one of the concept's known values (see
// effectiveValues), matched as the binding's `match` says. `data` is rows
// keyed by entity name. A file whose format is not one this check knows is
// refused before any of its bindings is read: its binding keys may not be the
// ones read here, and nothing would be checked. A stored value that names no
// value of an open list (a value set without `complete: true`) is a notice,
// `unknown-value`, not a problem; a retired value that is named is a notice,
// `retired-value`.
export function valueCoverageReport({ local, resolve, data }) {
  const problems = [];
  const notices = [];
  const refused = new Set();
  const refuse = (path, format) => {
    if (refused.has(path)) return;
    refused.add(path);
    problems.push(`${path}: format ${format === undefined ? 'is missing' : JSON.stringify(format)}, but this check knows meaning/draft-2 only; no binding of the file was read`);
  };
  for (const { path, doc } of local.files ?? []) if (!isKnownFormat(doc?.format)) refuse(path, doc?.format);
  for (const { concept, path, doc } of local.concepts.values()) {
    if (!isKnownFormat(doc?.format)) refuse(path, doc?.format);
    if (refused.has(path)) continue;
    const { values, holder } = knownValues(concept, local, resolve);
    if (values.length === 0) continue;
    const complete = isComplete(holder);
    for (const binding of concept.bindings ?? []) {
      const field = binding.field;
      if (!field || !valueRoles.includes(binding.role)) continue;
      const match = binding.match ?? 'labels';
      const entity = parseModelRef(binding.model)?.name;
      const stored = new Set((Object.hasOwn(data, entity) ? data[entity] ?? [] : []).map((row) => row[field]).filter((value) => value !== null && value !== undefined));
      for (const value of stored) {
        const matches = matchValues(values, value, match);
        if (matches.length === 1) {
          if (matches[0].retired === true) notices.push({ rule: 'retired-value', message: `${path}: concept ${concept.id}: retired-value: value "${value}" of ${entity}.${field} names ${matches[0].id} of ${holder.concept.id}, which is retired` });
        } else if (matches.length === 0 && !complete) {
          notices.push({ rule: 'unknown-value', message: `${path}: concept ${concept.id}: unknown-value: value "${value}" of ${entity}.${field} is unknown to ${holder.concept.id} (the list is open)` });
        } else problems.push(`${path}: concept ${concept.id}: ${entity}.${field} value "${value}" matches ${matches.length === 0 ? 'no value' : `${matches.length} values (${matches.map((m) => m.id).join(', ')})`}${match === 'labels' ? '' : ` by ${match}`}`);
      }
    }
  }
  return { problems, notices };
}

export function valueCoverageProblems({ notice, ...rest }) {
  const report = valueCoverageReport(rest);
  if (notice) for (const found of report.notices) notice(found.message, found.rule);
  return report.problems;
}
