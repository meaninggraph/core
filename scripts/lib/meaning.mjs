// Checks for meaning files (formats meaning/draft-1 and meaning/draft-2; the schemas are
// meaning.schema.json (draft 1) and meaning.draft-2.schema.json (draft 2) from the pinned
// meaninggraph/core checkout): JSON Schema validation of each file against the schema of its own
// format, then the rules a schema cannot express. Every concept reference must resolve;
// extends joins compatible kinds only, without a cycle; values-of and units-of name entities or
// value sets (a child may narrow its parent's, never change it); measures are computed from
// properties and measures and grouped by dimensions and properties; a ratio is never summed;
// every modelspec:// binding must name an existing record type and field that fits its role
// (identifier and display-name on the concept's own record type, one instances binding per
// concept, a reference to the record type of its target concept); and values must cover the
// data they describe.
//
// Both formats are read through one vocabulary (FORMAT.md, "Reading both formats"): the kind
// attribute is read as property, the binding key property as field, the role entity as
// instances and the role foreign-key as reference, once a file has been validated against the
// schema of its own format. The files of one graph must be in one format. Links that the model
// already states are derived (deriveLinks), never written.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { parseHcl, toModelspecJson, vocabularies, vocabularyOf } from './modelspec.mjs';

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
const modelRefPattern = /^modelspec:\/\/((?:[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._-]+)+)?)\/([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)(?:\?ref=([A-Za-z0-9._/-]+))?$/;

// A bare id is a concept in the same repository; meaning://{host}/{org}/{repo}/{id}
// is a concept in another one. The last path segment is the concept id.
export function parseConceptRef(ref) {
  if (bareRefPattern.test(ref)) return { id: ref };
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

export const draft1 = 'meaning/draft-1';
export const draft2 = 'meaning/draft-2';
export const draft2SchemaName = 'meaning.draft-2.schema.json';
// The draft-2 schema is found beside the schema `checkMeaning` is given (meaning.schema.json, draft 1).
export const draft2SchemaPath = (schemaPath) => join(dirname(schemaPath), draft2SchemaName);

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
    if (typeof value === 'string') { const parsed = value.startsWith('meaning://') && parseConceptRef(value); if (parsed) found.push(parsed); }
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

function loadModels(file, doc) {
  const models = {};
  for (const [module, relative] of Object.entries(doc.models ?? {})) {
    const text = readFileSync(join(dirname(file), relative), 'utf8');
    models[module] = toModelspecJson(parseHcl(text), { id: module, name: module, version: 'unversioned' });
  }
  return models;
}

// ---- the formats, and one vocabulary inside the reader ------------------------------------------------------------
// A file is validated against the schema of its own format, and the earlier words are then read as the current
// ones: the kind attribute as property, the binding key property as field, the role entity as instances and the
// role foreign-key as reference. After that one set of rules serves both formats.

const knownFormats = [draft1, draft2];
export const isKnownFormat = (format) => knownFormats.includes(format);
const formatError = 'format must be meaning/draft-1 or meaning/draft-2';
const kindOf = (concept) => (concept?.kind === 'attribute' ? 'property' : concept?.kind);
function roleOf(binding) {
  switch (binding?.role) {
    case 'entity': return 'instances';
    case 'foreign-key': return 'reference';
    default: return binding?.role;
  }
}
// The binding's field under the key its file's format uses, else under the other (a file the schema refuses).
const fieldOf = (binding, format) => (format === draft2 ? binding.field ?? binding.property : binding.property ?? binding.field);
const isEntityLike = (concept) => ['entity', 'value-set'].includes(kindOf(concept));

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
// The kinds in the words a file's format uses: draft 1 has no value-set and calls a property an attribute.
const wordsOf = (kinds, format) => (format === draft2 ? kinds : kinds.filter((kind) => kind !== 'value-set').map((kind) => (kind === 'property' ? 'attribute' : kind)));
// The tables above in draft-1 words, as they were exported before draft 2.
export const extendsCompatibility = {
  entity: wordsOf(extendsKinds.entity, draft1),
  attribute: wordsOf(extendsKinds.property, draft1),
  dimension: wordsOf(extendsKinds.dimension, draft1),
  measure: wordsOf(extendsKinds.measure, draft1),
};
export const measureInputKinds = wordsOf(measureInputs, draft1);
export const measureDimensionKinds = wordsOf(measureDimensions, draft1);
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

// The known values of a concept and the concept that holds the list: its own list (a draft-1 entity, attribute or
// dimension), or that of the entity or value set named by its values-of (its own or inherited through extends).
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

// A list is open when it is a value set that does not say `complete: true` (draft 2). A list in a draft-1 file has
// no marker and is read as complete, as every reader has always read it.
const formatOf = (concept, repo) => repo?.concepts?.get(concept.id)?.doc?.format;
const isComplete = ({ concept, repo }) => formatOf(concept, repo) !== draft2 || concept.complete === true;

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

// ---- words that belong to the other format ----------------------------------------------------------------------
// The schema of a file's format refuses these as well; the finding says which format the word belongs to.
function formatWordFindings(doc, format) {
  const found = [];
  const other = format === draft2 ? draft1 : draft2;
  for (const concept of Array.isArray(doc?.concepts) ? doc.concepts : []) {
    if (!concept || typeof concept !== 'object') continue;
    const where = `concept ${concept.id}`;
    if (format === draft1) {
      if (concept.kind === 'property') found.push({ where, message: `kind property belongs to ${other}; in ${format} it is written attribute` });
      if (concept.kind === 'value-set') found.push({ where, message: `kind value-set belongs to ${other}` });
      if (Object.hasOwn(concept, 'complete')) found.push({ where, message: `complete belongs to ${other}` });
      for (const value of Array.isArray(concept.values) ? concept.values : []) {
        if (value && typeof value === 'object' && Object.hasOwn(value, 'retired')) found.push({ where: `${where}: value ${value.id}`, message: `retired belongs to ${other}` });
      }
    } else {
      if (concept.kind === 'attribute') found.push({ where, message: `kind attribute is written property in ${format}` });
      if (Object.hasOwn(concept, 'values') && concept.kind !== 'value-set') found.push({ where, message: 'values belongs on a concept of kind value-set; name that concept with values-of' });
    }
    for (const binding of Array.isArray(concept.bindings) ? concept.bindings : []) {
      if (!binding || typeof binding !== 'object') continue;
      const at = `${where}: binding ${binding.model}`;
      const hasProperty = Object.hasOwn(binding, 'property');
      const hasField = Object.hasOwn(binding, 'field');
      if (hasProperty && hasField) found.push({ where: at, message: `the binding has both property: and field:; ${format} writes ${format === draft2 ? 'field' : 'property'}` });
      else if (format === draft1 && hasField) found.push({ where: at, message: `the binding key field belongs to ${other}; in ${format} it is written property` });
      else if (format === draft2 && hasProperty) found.push({ where: at, message: `the binding key property is written field in ${format}` });
    }
  }
  return found;
}

// ---- derived links ----------------------------------------------------------------------------------------------
// FORMAT.md, "Derived links". `files` is [{ doc, models }]: a parsed meaning file and its models (module short name ->
// the model as toModelspecJson returns it). The result is the written and the derived links of the graph, sorted.
const compareBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
export function deriveLinks(files) {
  const links = new Map();
  const identity = (concept, module, record, field, role) => JSON.stringify([concept, module, record, field ?? null, role]);
  const instances = [];
  const link = (concept, module, record, field, role, extra = {}) => ({ concept, model: `modelspec:///${module}.${record}`, ...(field === undefined ? {} : { field }), role, ...extra });
  // Written links, in file order; a line that repeats the five parts of an earlier one adds nothing.
  for (const { doc, models } of files) {
    for (const concept of Array.isArray(doc?.concepts) ? doc.concepts : []) {
      for (const binding of Array.isArray(concept?.bindings) ? concept.bindings : []) {
        const parsed = typeof binding?.model === 'string' ? parseModelRef(binding.model) : null;
        if (!parsed || parsed.repo) continue;
        const role = roleOf(binding);
        const field = role === 'instances' ? undefined : fieldOf(binding, doc.format);
        const id = identity(concept.id, parsed.module, parsed.name, field, role);
        if (!links.has(id)) links.set(id, link(concept.id, parsed.module, parsed.name, field, role, { ...(binding.note ? { note: binding.note } : {}), ...(binding.match ? { match: binding.match } : {}) }));
        if (role === 'instances') instances.push({ concept: concept.id, module: parsed.module, record: parsed.name, models });
      }
    }
  }
  // Derived links: the references to a record type bound with role instances, and its key.
  const derived = (concept, module, record, field, role) => {
    const id = identity(concept, module, record, field, role);
    if (!links.has(id)) links.set(id, link(concept, module, record, field, role, { derived: true }));
  };
  for (const { concept, module, record, models } of instances) {
    const model = models?.[module];
    if (!model) continue;
    const words = vocabularyOf(model) ?? vocabularies.earlier;
    const records = model[words.records] ?? {};
    for (const name of Object.keys(records)) {
      const fields = records[name]?.[words.fields] ?? {};
      for (const field of Object.keys(fields)) {
        if (fields[field]?.[words.record] === record) derived(concept, module, name, field, 'reference');
      }
    }
    if (Object.hasOwn(records, record)) {
      const fields = records[record][words.fields] ?? {};
      for (const key of records[record].key ?? []) if (Object.hasOwn(fields, key)) derived(concept, module, record, key, 'identifier');
    }
  }
  return [...links.values()].sort((a, b) => compareBytes(a.concept, b.concept) || compareBytes(a.model, b.model) || compareBytes(a.field ?? '', b.field ?? '') || (a.field === undefined ? 0 : 1) - (b.field === undefined ? 0 : 1) || compareBytes(a.role, b.role));
}

// Checks one repository's meaning files: `local` is the result of
// loadMeaningDir (or indexConcepts), `resolve` reads other repositories.
// `selfRepo` is the repository's own {host}/{org}/{repo}: a meaning://
// reference to it is a reference to `local`. Returns a list of problems; empty
// means the files are consistent. `notice(text, rule)`, when given, receives
// the findings that are not problems (an earlier format, an earlier role name,
// a retired value); see checkMeaningReport for the structured result.
export function checkMeaning({ notice, ...rest }) {
  const report = checkMeaningReport(rest);
  if (notice) for (const found of report.notices) notice(found.message, found.rule);
  return report.problems.map((problem) => problem.message);
}

// The same check with the rule of every finding: { problems, notices, links } where problems and notices are
// lists of { rule, message } (the rule ids of the Go checker, plus format-mixed, format-word, earlier-format,
// earlier-role-name and retired-value) and `links` is the derived-link list of deriveLinks when `derive` is set
// and there is no problem, else null (the links of a graph that fails the check are not defined).
export function checkMeaningReport({ local, resolve: resolveOther, schemaPath, models: givenModels, selfRepo, derive = false }) {
  const problems = [];
  const notices = [];
  const add = (rule, message) => problems.push({ rule, message });
  const note = (rule, message) => notices.push({ rule, message });
  for (const message of local.problems) add('duplicate-concept', message);
  const resolve = (repo, ref) => (selfRepo !== undefined && repo === selfRepo ? local : resolveOther(repo, ref));
  // One format per graph: the files one reader loads as one graph change format together.
  const formats = new Map();
  for (const { path, doc } of local.files) if (isKnownFormat(doc?.format) && !formats.has(doc.format)) formats.set(doc.format, path);
  if (formats.size > 1) add('format-mixed', `format-mixed: the meaning files of one graph change format together, and these are in ${[...formats].map(([format, path]) => `${format} (${path})`).join(' and ')}`);
  // One pin per referenced repository across all of this repository's files:
  // the repository resolves against one version of each dependency.
  const pins = new Map();
  const lookup = (ref, where) => {
    const parsed = parseConceptRef(ref);
    if (!parsed) { add('reference-syntax', `${where}: ${ref} is not a concept reference`); return null; }
    if (!parsed.repo || parsed.repo === selfRepo) {
      if (parsed.repo && parsed.ref !== undefined) add('self-pin', `${where}: ${ref} pins this repository's own concept; a reference to the repository itself cannot carry ?ref=`);
      const found = local.concepts.get(parsed.id);
      if (!found) add('unknown-concept', `${where}: concept ${parsed.id} is not declared in this repository`);
      return found ? { concept: found.concept, repo: local } : null;
    }
    const seen = pins.get(parsed.repo);
    if (seen !== undefined && seen !== (parsed.ref ?? '')) add('pin-mismatch', `${where}: meaning://${parsed.repo} is pinned to both "${seen}" and "${parsed.ref ?? ''}"; use one pin per repository`);
    pins.set(parsed.repo, parsed.ref ?? '');
    const remote = resolve(parsed.repo, parsed.ref);
    if (remote.error) { add('unresolved-graph', `${where}: ${remote.error}`); return null; }
    const found = remote.concepts.get(parsed.id);
    if (!found) add('unknown-concept', `${where}: concept ${parsed.id} does not exist in meaning://${parsed.repo}`);
    return found ? { concept: found.concept, repo: remote } : null;
  };
  // ModelSpec record types whose rows are instances of a concept (role instances, written entity or instances).
  const entityBindings = (concept) => (concept.bindings ?? []).filter((b) => roleOf(b) === 'instances').map((b) => parseModelRef(b.model)).filter(Boolean);
  const sameEntity = (a, b) => a.repo === b.repo && a.module === b.module && a.name === b.name;
  const loaded = [];
  for (const file of local.files) {
    const { path, doc } = file;
    const format = doc?.format;
    if (format === draft1) note('earlier-format', `${path}: earlier-format: the file is in ${draft1}, the earlier format; it is read in full`);
    // A mapping with no format or an unknown one is refused with that one finding, whether or not a schema path is given,
    // and nothing else in it is read (FORMAT.md, "Files and discovery"): its words belong to no format.
    if (!isKnownFormat(format) && doc && typeof doc === 'object' && !Array.isArray(doc)) {
      add('schema', `${path}: schema: ${formatError}`);
      continue;
    }
    if (schemaPath) {
      if (isKnownFormat(format)) {
        const schema = format === draft2 ? draft2SchemaPath(schemaPath) : schemaPath;
        if (format === draft2 && !existsSync(schema)) add('schema', `${path}: schema: ${format} needs ${schema}, which does not exist`);
        else for (const problem of schemaProblems(doc, schema)) add('schema', `${path}: schema: ${problem}`);
      } else for (const problem of schemaProblems(doc, schemaPath)) add('schema', `${path}: schema: ${problem}`);
    }
    if (isKnownFormat(format)) for (const { where, message } of formatWordFindings(doc, format)) add('format-word', `${path}: ${where}: format-word: ${message}`);
    if (format === draft2) {
      const earlier = [...new Set((Array.isArray(doc.concepts) ? doc.concepts : []).flatMap((c) => (Array.isArray(c?.bindings) ? c.bindings : [])).map((b) => b?.role).filter((role) => role === 'entity' || role === 'foreign-key'))];
      if (earlier.length > 0) note('earlier-role-name', `${path}: earlier-role-name: the role names entity and foreign-key are the earlier spellings of instances and reference (this file uses ${earlier.join(' and ')})`);
    }
    if (!Array.isArray(doc?.concepts)) continue;
    let models = givenModels;
    try { models ??= loadModels(path, doc); } catch (error) { add('models', `${path}: models: ${error.message}`); models = {}; }
    loaded.push({ doc, models });
    const sourceIds = new Set();
    for (const source of doc.sources ?? []) {
      if (sourceIds.has(source.id)) add('duplicate-source', `${path}: source ${source.id} is declared twice`);
      sourceIds.add(source.id);
    }
    for (const concept of doc.concepts) {
      const where = `${path}: concept ${concept.id}`;
      const entityLike = format === draft2 ? 'an entity or a value-set' : 'an entity';
      if (concept.of) {
        const owner = lookup(concept.of, `${where} of`);
        if (owner && !isEntityLike(owner.concept)) add('target-kind', `${where}: of names ${concept.of}, which is ${an(owner.concept.kind)}, not ${entityLike}`);
      }
      if (concept.extends) {
        const parent = lookup(concept.extends, `${where} extends`);
        const allowed = Object.hasOwn(extendsKinds, kindOf(concept)) ? extendsKinds[kindOf(concept)] : [];
        if (parent && !allowed.includes(kindOf(parent.concept))) add('extends-kind', `${where}: ${an(concept.kind)} cannot extend ${concept.extends}, which is ${an(parent.concept.kind)}; extends means "is a kind of", and ${an(concept.kind)} may extend only ${wordsOf(allowed, format).join(' or ')}`);
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
        if (target && !isEntityLike(target.concept)) add('target-kind', `${where}: ${key} names ${concept[key]}, which is ${an(target.concept.kind)}, not ${entityLike}`);
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
      const inputsWord = format === draft2 ? 'properties and measures' : 'attributes and measures';
      const dimensionsWord = format === draft2 ? 'dimensions or properties' : 'dimensions or attributes';
      for (const ref of concept.measure?.inputs ?? []) {
        const input = lookup(ref, `${where} measure.inputs`);
        if (input && !measureInputs.includes(kindOf(input.concept))) add('measure-input', `${where}: measure.inputs names ${ref}, which is ${an(input.concept.kind)}; a measure is computed from ${inputsWord} only`);
      }
      for (const ref of concept.measure?.dimensions ?? []) {
        const dimension = lookup(ref, `${where} measure.dimensions`);
        if (dimension && !measureDimensions.includes(kindOf(dimension.concept))) add('measure-dimension', `${where}: measure.dimensions names ${ref}, which is ${an(dimension.concept.kind)}; a measure is grouped by ${dimensionsWord} only`);
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
      const entities = entityBindings(concept);
      if (entities.length > 1) add('entity-bindings', `${where}: has ${entities.length} ${format === draft2 ? 'instances' : 'entity'} bindings (${entities.map((e) => `${e.module}.${e.name}`).join(', ')}); a concept binds one entity`);
      for (const binding of concept.bindings ?? []) {
        const parsed = parseModelRef(binding.model);
        if (!parsed) { add('binding-model', `${where}: ${binding.model} is not a modelspec:// reference`); continue; }
        if (parsed.repo) { add('binding-model', `${where}: ${binding.model} points at another repository; this check resolves same-repository models only`); continue; }
        const model = models[parsed.module];
        if (!model) { add('binding-model', `${where}: ${binding.model}: module ${parsed.module} is not listed in models`); continue; }
        // A model is read in the vocabulary its identifier names (1.0-draft: entities, properties; 1.0-draft-2: records, fields);
        // one with no identifier is read in the earlier one, as it always was.
        const words = vocabularyOf(model) ?? vocabularies.earlier;
        const entity = model[words.records]?.[parsed.name];
        if (!entity) { add('binding-model', `${where}: ${binding.model}: module ${parsed.module} has no entity ${parsed.name}`); continue; }
        const field = fieldOf(binding, format);
        if (!field) continue;
        const member = entity[words.fields]?.[field];
        if (!member) { add('binding-model', `${where}: ${binding.model}: entity ${parsed.name} has no property ${field}`); continue; }
        const at = `${where}: ${parsed.name}.${field}`;
        const reference = member[words.record];
        // identifier and display-name describe the rows of the concept's own entity.
        if (binding.role === 'identifier' || binding.role === 'display-name') {
          if (entities.length === 0) add('binding-role', `${at} has role ${binding.role}, but ${concept.id} has no entity binding, so it cannot be checked which entity the property must sit on`);
          else if (entities.length === 1 && !sameEntity(entities[0], parsed)) add('binding-role', `${at} has role ${binding.role}, but ${concept.id} is bound to the entity ${entities[0].name}; the property must be on that entity`);
        }
        if (binding.role === 'identifier' && !(entity.key ?? []).includes(field)) add('binding-role', `${at} has role identifier but is not in the key of ${parsed.name} [${(entity.key ?? []).join(', ')}]`);
        if (binding.role === 'display-name' && member.type !== 'string') add('binding-role', `${at} has role display-name but is ${reference ? `a reference to ${reference}` : an(member.type)}, not a string`);
        if (binding.role === 'value' && reference) add('binding-role', `${at} has role value but is a reference to ${reference}; bind it with role reference`);
        if (roleOf(binding) === 'reference') {
          if (!reference) { add('binding-role', `${at} has role ${binding.role} but is not a reference (it is ${an(member.type)})`); continue; }
          // The reference must point at the entity whose rows are the instances:
          // this concept's own (an entity) or those of its values-of entity.
          let target = null;
          if (kindOf(concept) === 'entity') target = { concept, repo: local };
          else {
            const domain = inherited(concept, local, 'values-of', resolve);
            if (!domain) { add('binding-role', `${at} has role ${binding.role}, so ${concept.id} needs values-of: the entity its references point at`); continue; }
            target = resolveConcept(domain.concept['values-of'], domain.repo, resolve);
          }
          if (!target) continue; // an unresolvable values-of is reported above
          // Only this repository's own bindings name models this check can read.
          const expected = target.repo === local ? entityBindings(target.concept) : [];
          if (expected.length === 0) add('binding-role', `${at} has role ${binding.role}, but ${target.concept.id} has no entity binding in this repository, so it cannot be checked that ${reference} holds its instances; bind ${target.concept.id} (or a concept of this repository that extends it) to its entity`);
          else if (!expected.some((e) => e.module === parsed.module && e.name === reference)) add('binding-role', `${at} references ${reference}, but the instances of ${target.concept.id} are ${expected.map((e) => e.name).join(', ')} rows`);
        }
      }
    }
  }
  return { problems, notices, links: derive && problems.length === 0 ? deriveLinks(loaded) : null };
}

// Checks that every distinct value stored in a column bound with role value
// or display-name names exactly one of the concept's known values (see
// effectiveValues), matched as the binding's `match` says. `data` is rows
// keyed by entity name. A file whose format is not one this check knows is
// refused before any of its bindings is read: its binding keys may not be the
// ones read here, and nothing would be checked. A stored value that names no
// value of an open list (a value set without `complete: true`) is a notice,
// `unknown-value`, not a problem; a retired value that is named is a notice,
// `retired-value`. A list in a draft-1 file is complete.
export function valueCoverageReport({ local, resolve, data }) {
  const problems = [];
  const notices = [];
  const refused = new Set();
  const refuse = (path, format) => {
    if (refused.has(path)) return;
    refused.add(path);
    problems.push(`${path}: format ${format === undefined ? 'is missing' : JSON.stringify(format)}, but this check knows meaning/draft-1 and meaning/draft-2 only; no binding of the file was read`);
  };
  for (const { path, doc } of local.files ?? []) if (!isKnownFormat(doc?.format)) refuse(path, doc?.format);
  for (const { concept, path, doc } of local.concepts.values()) {
    if (!isKnownFormat(doc?.format)) refuse(path, doc?.format);
    if (refused.has(path)) continue;
    const { values, holder } = knownValues(concept, local, resolve);
    if (values.length === 0) continue;
    const complete = isComplete(holder);
    for (const binding of concept.bindings ?? []) {
      const field = fieldOf(binding, doc.format);
      if (!field || !valueRoles.includes(binding.role)) continue;
      const match = binding.match ?? 'labels';
      const entity = parseModelRef(binding.model)?.name;
      const stored = new Set((data[entity] ?? []).map((row) => row[field]).filter((value) => value !== null && value !== undefined));
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
