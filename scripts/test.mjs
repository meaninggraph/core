// Tests for scripts/check.mjs: the repository passes, and each kind of break
// (a file the schema rejects, a rule across concepts, a rule of this
// repository) fails with a clear message. CC0-1.0.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { checkCore, root } from './check.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'meaning-core-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const rootFiles = readdirSync(root).filter((name) => name.endsWith('.meaning.yaml'));
let counter = 0;

// A copy of the repository's data files with `change(files)` applied, where
// files maps a file name to its parsed document. Returns the directory.
function variant(change = () => {}) {
  const dir = join(scratch, `v${counter++}`);
  mkdirSync(dir);
  for (const name of ['LICENSE', 'meaning.schema.json']) copyFileSync(join(root, name), join(dir, name));
  const files = Object.fromEntries(rootFiles.map((name) => [name, parseYaml(readFileSync(join(root, name), 'utf8'))]));
  change(files, dir);
  for (const [name, doc] of Object.entries(files)) if (doc) writeFileSync(join(dir, name), stringifyYaml(doc, { lineWidth: 0 }));
  return dir;
}
const problemsOf = (change) => checkCore(variant(change)).problems.join('\n');
const concept = (files, id) => Object.values(files).flatMap((doc) => doc?.concepts ?? []).find((c) => c.id === id);

test('every meaning file in the repository passes the schema and the cross-concept checks', () => {
  const { problems, concepts, files } = checkCore();
  assert.deepEqual(problems, []);
  assert.equal(files, 6);
  assert.ok(concepts >= 20);
  assert.equal(problemsOf(), '', 'a copy of the files through the YAML round trip passes too');
});

test('a file the schema rejects fails', () => {
  assert.match(problemsOf((files) => { delete concept(files, 'country').description; }), /geo.meaning.yaml: schema: \/concepts\/0 must have required property 'description'/);
  assert.match(problemsOf((files) => { concept(files, 'country').kind = 'thing'; }), /schema: \/concepts\/0\/kind must be equal to one of the allowed values/);
  assert.match(problemsOf((files) => { delete files['geo.meaning.yaml'].format; }), /schema: \/ must have required property 'format'/);
  assert.match(problemsOf((files) => { concept(files, 'country').id = 'Country'; }), /concepts\/0\/id must match pattern/);
});

test('a rule across concepts fails', () => {
  assert.match(problemsOf((files) => { concept(files, 'employee').extends = 'revenue'; }), /concept employee: an entity cannot extend revenue, which is a measure/);
  assert.match(problemsOf((files) => { concept(files, 'per-capita').measure.aggregation = 'sum'; }), /aggregation sum on a ratio/);
  assert.match(problemsOf((files) => { concept(files, 'invoice-line').of = 'no-such-concept'; }), /concept no-such-concept is not declared in this repository/);
  assert.match(problemsOf((files) => { concept(files, 'manager')['values-of'] = 'revenue'; }), /values-of names revenue, which is a measure, not an entity/);
  assert.match(problemsOf((files) => { concept(files, 'person').extends = 'employee'; concept(files, 'employee').extends = 'person'; }), /extends forms a cycle \(person -> employee -> person\)/);
  assert.match(problemsOf((files) => { concept(files, 'person').extends = 'meaning://github.com/meaninggraph/core/person'; }), /extends forms a cycle \(person -> person\)/, 'a cycle through the repository\'s own address');
});

test('ids and values must be unique', () => {
  assert.match(problemsOf((files) => { files['calendar.meaning.yaml'].concepts.push({ ...concept(files, 'country') }); }), /concept country is declared twice \(calendar.meaning.yaml and geo.meaning.yaml\)/);
  assert.match(problemsOf((files) => { const us = concept(files, 'country').values.find((v) => v.id === 'us'); concept(files, 'country').values.push({ ...us }); }), /value us is declared twice/);
  assert.match(problemsOf((files) => { concept(files, 'country').values.find((v) => v.id === 'gb').aliases.en.push('USA'); }), /"USA" names both gb and us|"USA" names both us and gb/);
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].sources = [{ id: 's', provider: 'p', dataset: 'd' }, { id: 's', provider: 'q', dataset: 'e' }]; }), /source s is declared twice/);
});

test('the rules of this repository fail: licence, bindings, models, hidden files, shared words', () => {
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].license = 'MIT'; }), /geo.meaning.yaml: license must be CC0-1.0/);
  assert.match(problemsOf((files) => { delete files['geo.meaning.yaml'].license; }), /geo.meaning.yaml: license must be CC0-1.0/);
  assert.match(problemsOf((files) => { concept(files, 'country').bindings = [{ model: 'modelspec:///x.Country', role: 'entity' }]; }), /concept country: bindings belong in a dataset repository/);
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].models = { x: 'x.hcl' }; }), /models belong in a dataset repository/);
  assert.match(problemsOf((files) => { concept(files, 'person').synonyms.en.push('people'); concept(files, 'population').synonyms.en.push('people'); }), /concept person: "people" \(en\) is also a word of concept population; one word must name one concept/);
  assert.equal(problemsOf((files) => { concept(files, 'employee').synonyms.en.push('individual'); }), '', 'a kind of a concept may share its parent\'s words');
  assert.match(problemsOf((files, dir) => { mkdirSync(join(dir, 'more')); writeFileSync(join(dir, 'more', 'extra.meaning.yaml'), 'format: meaning/draft-1\n'); }), /more\/extra.meaning.yaml: meaning files are read from the repository root only/);
  const none = variant((files) => { for (const name of Object.keys(files)) files[name] = null; });
  assert.match(checkCore(none).problems.join('\n'), /no \*.meaning.yaml file in the repository root/);
});

test('the command line exits 0 on the repository and 1 with the problems on a broken copy', () => {
  const script = join(root, 'scripts', 'check.mjs');
  assert.match(execFileSync('node', [script], { encoding: 'utf8' }), /^ok: \d+ concepts in 6 files/);
  const broken = variant((files) => { delete concept(files, 'country').description; concept(files, 'person').synonyms.en.push('people'); concept(files, 'population').synonyms.en.push('people'); });
  const run = spawnSync('node', [script, broken], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /error: geo.meaning.yaml: schema: \/concepts\/0 must have required property 'description'/);
  assert.match(run.stderr, /"people" \(en\) is also a word of concept population/);
  assert.match(run.stderr, /\d+ problems in 6 files/);
});
