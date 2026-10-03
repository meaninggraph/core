// Checks this repository's meaning files, CC0-1.0 like everything else here.
//
//   node scripts/check.mjs [directory]     (default: the repository root)
//
// Every *.meaning.yaml directly in the directory (subdirectories are not
// searched, see FORMAT.md) is validated against meaning.schema.json, then the
// cross-concept rules of scripts/lib/meaning.mjs run over all of them as one
// repository: references resolve, extends joins compatible kinds without a
// cycle, values-of and units-of name entities, measures and ratios are
// consistent, ids and values are unique. On top of that come the rules of this
// repository alone: every file is CC0-1.0, there are no bindings (they belong to
// datasets), no meaning file hides in a subdirectory, and one word does not name
// two unrelated concepts.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMeaning, coreRepo, createResolver, lineage, loadMeaningDir } from './lib/meaning.mjs';

export const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Meaning files below the root are never read, so they would be silently dead.
function hiddenMeaningFiles(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...hiddenMeaningFiles(dir, path));
    else if (prefix && entry.name.endsWith('.meaning.yaml')) found.push(path);
  }
  return found;
}

export function checkCore(dir = root) {
  const local = loadMeaningDir(dir, coreRepo);
  const resolve = createResolver({ root: dir, sources: {} });
  const rel = (path) => relative(dir, path);
  const problems = [];
  if (local.files.length === 0) problems.push('no *.meaning.yaml file in the repository root');
  if (!existsSync(join(dir, 'LICENSE'))) problems.push('LICENSE is missing');
  problems.push(...hiddenMeaningFiles(dir).map((path) => `${path}: meaning files are read from the repository root only; move it there`));
  problems.push(...checkMeaning({ local, resolve, schemaPath: join(dir, 'meaning.schema.json'), selfRepo: coreRepo }).map((problem) => problem.replaceAll(`${dir}/`, '')));
  for (const { path, doc } of local.files) {
    if (doc?.license !== 'CC0-1.0') problems.push(`${rel(path)}: license must be CC0-1.0`);
    if (doc?.models) problems.push(`${rel(path)}: models belong in a dataset repository, not in the universal concepts`);
    for (const concept of doc?.concepts ?? []) {
      if (concept.bindings) problems.push(`${rel(path)}: concept ${concept.id}: bindings belong in a dataset repository, not in the universal concepts`);
    }
  }
  // One word names one concept: a label or synonym that two concepts share in a
  // language is ambiguous, unless one concept is a kind of the other. A
  // language counts when the concept has a label or synonyms in it.
  const owners = new Map();
  for (const { concept, path } of local.concepts.values()) {
    for (const language of new Set([...Object.keys(concept.labels ?? {}), ...Object.keys(concept.synonyms ?? {})])) {
      for (const word of [concept.labels?.[language], ...(concept.synonyms?.[language] ?? [])].filter(Boolean)) {
        const key = `${language}:${word.toLowerCase()}`;
        for (const other of owners.get(key) ?? []) {
          const related = lineage(concept, local, resolve).some((node) => node.concept === other.concept) || lineage(other.concept, local, resolve).some((node) => node.concept === concept);
          if (!related) problems.push(`${rel(path)}: concept ${concept.id}: "${word}" (${language}) is also a word of concept ${other.concept.id}; one word must name one concept`);
        }
        owners.set(key, [...(owners.get(key) ?? []), { concept, path }]);
      }
    }
  }
  return { problems, concepts: local.concepts.size, files: local.files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { problems, concepts, files } = checkCore(process.argv[2] ?? root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`error: ${problem}`);
    console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'} in ${files} files`);
    process.exit(1);
  }
  console.log(`ok: ${concepts} concepts in ${files} files`);
}
