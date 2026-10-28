import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { createEffectiveModelResolver, ModelCapabilityError } from './lib/effective-model.mjs';
import { diagnosticText, modelDiagnosticBytes, modelMessage, modelMessageBytes } from './lib/model-diagnostic.mjs';
import { checkMeaningReport, deriveLinks, indexConcepts, parseModelRef } from './lib/meaning.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'effective-model-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const fixture = JSON.parse(readFileSync(join(root, 'scripts/fixtures/effective-fields.modelspec.json'), 'utf8'));
const fixtureHcl = readFileSync(join(root, 'scripts/fixtures/effective-fields.modelspec.hcl'), 'utf8');
const source = (records = {}, components = {}, module = 'm') => ({ modelspec: '1.0-draft-2', module: { id: module, name: module, version: '1' }, components, records });
// `draft` is kept in the helpers' signatures from when both formats were tested; meaning/draft-2 is the only one.
const binding = (_draft, record, field, role, module = 'm') => ({ model: `modelspec:///${module}.${record}`, ...(field === undefined ? {} : { field }), role });
const concept = (_draft, id, kind, bindings, extra = {}) => ({ id, kind, labels: { en: id }, description: `${id}.`, ...extra, bindings });
const document = (draft, concepts) => ({ format: `meaning/draft-${draft}`, id: 'fixture', name: 'Fixture', description: 'Effective field proof.', license: 'CC0-1.0', models: { m: 'model/m.modelspec.hcl' }, concepts });
const localFor = (doc) => indexConcepts([{ path: join(scratch, 'fixture.meaning.yaml'), doc }], 'github.com/example/semantic');
const report = (doc, models, derive = false) => checkMeaningReport({ local: localFor(doc), models, derive, schemaPath: join(root, 'meaning.draft-2.schema.json'), selfRepo: 'github.com/example/semantic', resolve: () => ({ error: 'unexpected foreign meaning dependency' }) });
const messages = (result) => result.problems.map((finding) => `${finding.rule}: ${finding.message}`).join('\n');
const baseConcepts = (draft) => [
  concept(draft, 'thing', 'entity', [binding(draft, 'Thing', undefined, 'instances'), binding(draft, 'Thing', 'id', 'identifier'), binding(draft, 'Thing', 'Name', 'display-name')]),
  concept(draft, 'target', 'entity', [binding(draft, 'Target', undefined, 'instances')]),
  concept(draft, 'target-ref', 'property', [binding(draft, 'Thing', 'target', 'reference')], { of: 'thing', 'values-of': 'target' }),
];

for (const draft of [2]) test(`effective fields: canonical Go-approved inherited keys/type/reference roles and derivation, draft ${draft}`, () => {
  const models = { m: structuredClone(fixture) };
  const before = JSON.stringify(models);
  const doc = document(draft, baseConcepts(draft));
  const result = report(doc, models, true);
  assert.deepEqual(result.problems, []);
  assert.equal(JSON.stringify(models), before, 'the original model AST is immutable');
  assert.ok(result.links.some((link) => link.concept === 'thing' && link.field === 'id' && link.role === 'identifier' && !link.derived), 'written inherited key is retained');
  for (const record of ['Thing', 'Override']) assert.ok(result.links.some((link) => link.concept === 'target' && link.model === `modelspec:///m.${record}` && link.field === 'target' && link.derived));
  assert.ok(!result.links.some((link) => link.field === 'self'), 'nested recursive component members are not flattened');
  // The default HCL loader must exercise the same fix, not only supplied JSON.
  const dir = join(scratch, `loader-${draft}`); mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model/m.modelspec.hcl'), fixtureHcl);
  const local = indexConcepts([{ path: join(dir, 'fixture.meaning.yaml'), doc }], 'github.com/example/semantic');
  assert.deepEqual(checkMeaningReport({ local, derive: true, schemaPath: join(root, 'meaning.draft-2.schema.json'), resolve: () => ({ error: 'unexpected' }) }).problems, []);
});

test('effective fields: own overrides, repeat origins, alias origins, ambiguity and nested values', () => {
  const model = source({ Thing: { use: ['Left', 'm.Left', 'Alias.Left', 'Right'], fields: { Name: { type: 'string' } } }, Conflict: { use: ['Left', 'Right'] } }, {
    Left: { fields: { Name: { type: 'int' }, nested: { component: 'Loop' } } }, Right: { fields: { Name: { type: 'int' } } }, Loop: { fields: { self: { component: 'Loop' } } },
  });
  const resolver = createEffectiveModelResolver({ m: model, Alias: model });
  const thing = resolver.record('m', 'Thing');
  assert.equal(resolver.field(thing, 'Name').member.type, 'string');
  assert.equal(resolver.field(thing, 'nested').member.component, 'Loop');
  assert.equal(resolver.view(thing).fields.size, 2);
  assert.equal(resolver.view(thing).complete, true);
  assert.equal(resolver.field(resolver.record('m', 'Conflict'), 'Name').status, 'ambiguous', 'identical payloads from distinct origins remain ambiguous');
  assert.equal(resolver.field(thing, 'self').status, 'absent');
  const conflicting = document(2, [concept(2, 'conflict', 'entity', [binding(2, 'Conflict', undefined, 'instances'), binding(2, 'Conflict', 'Name', 'display-name')])]);
  const result = report(conflicting, { m: model });
  assert.ok(result.problems.some((finding) => finding.rule === 'model-capability'));
  assert.ok(!messages(result).includes('has no property Name'));
});

for (const draft of [2]) test(`effective fields: unavailable uses retain own proofs and refuse unknown or complete proofs, draft ${draft}`, () => {
  const models = { m: source({ Thing: { use: ['Foreign.Common'], key: ['id'], fields: { id: { type: 'int' }, Name: { type: 'string' } } } }) };
  const doc = document(draft, [baseConcepts(draft)[0]]);
  assert.deepEqual(report(doc, models).problems, [], 'known own fields remain usable');
  const unknown = structuredClone(doc); unknown.concepts[0].bindings.push(binding(draft, 'Thing', 'Remote', 'value'));
  const unavailable = report(unknown, models);
  assert.ok(unavailable.problems.some((finding) => finding.rule === 'model-capability'));
  assert.ok(!messages(unavailable).includes('has no property Remote'));
  assert.throws(() => deriveLinks([{ doc, models }]), (error) => error instanceof ModelCapabilityError && error.code === 'MODEL_CAPABILITY_UNAVAILABLE');
  const deriving = report(doc, models, true);
  assert.equal(deriving.links, null);
  assert.ok(deriving.problems.some((finding) => finding.rule === 'model-capability'));
  // A known inherited name can still collide with an unavailable use's fields.
  models.m.components = { Common: { fields: { Remote: { type: 'string' } } } };
  models.m.records.Thing.use.push('Common');
  assert.ok(report(unknown, models).problems.some((finding) => finding.rule === 'model-capability'));
});

test('effective fields: originating model vocabulary and exact explicit/self aliases govern reference proofs', () => {
  const common = { modelspec: '1.0-draft', module: { name: 'Canonical' }, components: { Common: { fields: { target: { entity: 'Canonical.Target' }, Name: { type: 'string' } } } }, entities: { Target: { key: ['id'], properties: { id: { type: 'int' } } } } };
  const models = { m: source({ Thing: { use: ['c.Common'] }, Target: {} }), c: common };
  for (const draft of [2]) {
    const doc = document(draft, [
      concept(draft, 'thing', 'entity', [binding(draft, 'Thing', undefined, 'instances'), binding(draft, 'Thing', 'Name', 'display-name')]),
      concept(draft, 'target', 'entity', [binding(draft, 'Target', undefined, 'instances', 'c')]),
      concept(draft, 'ref', 'property', [binding(draft, 'Thing', 'target', 'reference')], { 'values-of': 'target' }),
    ]);
    assert.deepEqual(report(doc, models, true).problems, []);
    const wrong = structuredClone(doc); wrong.concepts[1].bindings[0] = binding(draft, 'Target', undefined, 'instances');
    assert.ok(report(wrong, models).problems.some((finding) => finding.rule === 'binding-role'));
    const unavailable = structuredClone(models); unavailable.c.components.Common.fields.target.entity = 'Unknown.Target';
    assert.ok(report(doc, unavailable).problems.some((finding) => finding.rule === 'model-capability'));
  }
});

test('effective fields: reference role/type constraints are unchanged for inherited fields', () => {
  for (const draft of [2]) {
    const doc = document(draft, baseConcepts(draft));
    doc.concepts[2].bindings[0] = binding(draft, 'Thing', 'target', 'value');
    assert.match(messages(report(doc, { m: fixture })), /is a reference to m.Target; bind it with role reference/);
    doc.concepts[2].bindings[0] = binding(draft, 'Thing', 'nested', 'reference');
    assert.match(messages(report(doc, { m: fixture })), /not a reference/);
    doc.concepts[0].bindings[2] = binding(draft, 'Thing', 'id', 'display-name');
    assert.match(messages(report(doc, { m: fixture })), /not a string/);
  }
});

test('effective fields: missing local/self references and malformed references preflight beyond view budgets', () => {
  for (const reference of ['Missing', 'm.Missing', '.Thing', 'm.', 'a.b.c']) {
    for (const attribute of ['record', 'component', 'enum']) {
      const model = source({ Thing: { fields: { Name: { type: 'string' } } } }, { Unused: { fields: { bad: attribute === 'enum' ? { type: 'string', enum: reference } : { [attribute]: reference } } } });
      const resolver = createEffectiveModelResolver({ m: model }, { maxWork: 0 });
      assert.ok(resolver.invalid.length, `${attribute}/${reference}`);
      assert.throws(() => resolver.assertValid(), (error) => error.code === 'MODEL_REFERENCE_INVALID');
    }
  }
});

test('effective fields: finite work, same-origin repetition, bounded diagnostics and own proof after exhaustion', () => {
  const model = source({ Thing: { use: ['Common', 'Other'], fields: { own: { type: 'string' } } } }, { Common: { fields: { inherited: { type: 'int' } } }, Other: { fields: { inherited: { type: 'string' } } } });
  const limited = createEffectiveModelResolver({ m: model }, { maxWork: 2, maxDiagnostics: 2 });
  const thing = limited.record('m', 'Thing');
  assert.equal(limited.field(thing, 'inherited').status, 'unavailable', 'exact budget boundary cannot hide remaining uses');
  assert.equal(limited.field(thing, 'own').status, 'known');
  assert.ok(limited.work <= 2);
  const repeated = source({ Thing: { use: Array(100).fill('Common') } }, { Common: { fields: { Name: { type: 'string' } } } });
  const finite = createEffectiveModelResolver({ m: repeated }, { maxWork: 105 });
  assert.equal(finite.view(finite.record('m', 'Thing')).complete, true);
  assert.equal(finite.view(finite.record('m', 'Thing')).fields.size, 1);
  const unknown = source({ Thing: { use: Array.from({ length: 100 }, (_, i) => `Foreign.C${i}`) } });
  const saturated = createEffectiveModelResolver({ m: unknown }, { maxWork: 20, maxDiagnostics: 2 });
  assert.equal(saturated.view(saturated.record('m', 'Thing')).complete, false);
  assert.equal(saturated.diagnostics().length, 3);
  assert.ok(saturated.diagnostics().at(-1).message.includes('omitted'));
  const doc = document(2, [concept(2, 'thing', 'entity', [binding(2, 'Thing', undefined, 'instances')])]);
  assert.throws(() => deriveLinks([{ doc, models: { m: fixture } }], { maxWork: 1 }), (error) => error.code === 'MODEL_CAPABILITY_UNAVAILABLE');
});


test('effective fields: source and proof diagnostic saturation is explicit, including standalone source preflight', () => {
  const components = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`Unused${i}`, { fields: { bad: { record: `Missing${i}` } } }]));
  const invalid = source({}, components);
  const resolver = createEffectiveModelResolver({ m: invalid }, { maxWork: 0, maxDiagnostics: 2 });
  assert.equal(resolver.invalid.length, 3);
  assert.match(resolver.invalid.at(-1).message, /98 additional invalid source reference diagnostics omitted/);
  assert.throws(() => deriveLinks([{ doc: document(2, []), models: { m: invalid } }]), (error) => error.code === 'MODEL_REFERENCE_INVALID');
  const model = source({ Thing: { use: ['Foreign.Common'] } });
  const doc = document(2, [concept(2, 'fields', 'property', Array.from({ length: 100 }, (_, i) => binding(2, 'Thing', `Remote${i}`, 'value')))]);
  const limited = report(doc, { m: model });
  assert.equal(limited.problems.length, 65);
  assert.match(limited.problems.at(-1).message, /36 additional model capability diagnostics omitted/);
});

test('effective fields: reference proofs preserve each meaning file model source identity', () => {
  const dir = join(scratch, 'source-scope'); mkdirSync(dir, { recursive: true });
  const targetHcl = 'record "Target" {\n field "id" {\n type = "int"\n }\n}\n';
  const refHcl = targetHcl + 'record "Thing" {\n field "target" {\n record = "Target"\n }\n}\n';
  writeFileSync(join(dir, 'shared.modelspec.hcl'), refHcl);
  writeFileSync(join(dir, 'other.modelspec.hcl'), targetHcl);
  for (const sameSource of [true, false]) {
    const owner = document(2, [concept(2, 'ref', 'property', [binding(2, 'Thing', 'target', 'reference')], { 'values-of': 'target' })]);
    owner.models = { m: 'shared.modelspec.hcl' };
    const target = document(2, [concept(2, 'target', 'entity', [binding(2, 'Target', undefined, 'instances')])]);
    target.models = { m: sameSource ? 'shared.modelspec.hcl' : 'other.modelspec.hcl' };
    const local = indexConcepts([{ path: join(dir, 'a.meaning.yaml'), doc: owner }, { path: join(dir, 'b.meaning.yaml'), doc: target }], 'github.com/example/semantic');
    const result = checkMeaningReport({ local, schemaPath: join(root, 'meaning.draft-2.schema.json'), resolve: () => ({ error: 'unexpected' }) });
    if (sameSource) assert.deepEqual(result.problems, []);
    else assert.ok(result.problems.some((problem) => problem.rule === 'binding-role'), 'a shared alias spelling cannot prove that two distinct source models are the same record');
  }
});

test('effective fields: unrelated unavailable or ambiguous fields do not block certain reference proofs', () => {
  const model = source({ Thing: { use: ['Foreign.Common'], fields: { target: { record: 'm.Target' } } }, Target: {} });
  const doc = document(2, [
    concept(2, 'target', 'entity', [binding(2, 'Target', undefined, 'instances')]),
    concept(2, 'ref', 'property', [binding(2, 'Thing', 'target', 'reference')], { 'values-of': 'target' }),
  ]);
  assert.deepEqual(report(doc, { m: model }).problems, []);
  const ambiguous = source({ Thing: { use: ['Left', 'Right'] } }, { Left: { fields: { conflict: { type: 'string' }, certain: { type: 'string' } } }, Right: { fields: { conflict: { type: 'int' } } } });
  const resolver = createEffectiveModelResolver({ m: ambiguous });
  const thing = resolver.record('m', 'Thing');
  assert.equal(resolver.field(thing, 'conflict').status, 'ambiguous');
  assert.equal(resolver.field(thing, 'certain').status, 'known');
});


const grammarFixture = JSON.parse(readFileSync(join(root, 'scripts/fixtures/binding-grammar-boundary.modelspec.json'), 'utf8'));
const assertCapability = (doc, models) => {
  const before = JSON.stringify(models);
  const checked = report(doc, models, true);
  assert.equal(checked.links, null);
  assert.ok(checked.problems.some((problem) => problem.rule === 'model-capability'), messages(checked));
  assert.ok(!checked.problems.some((problem) => problem.rule === 'binding-model'), 'a source-valid unrepresentable link is not an invalid model');
  assert.throws(() => deriveLinks([{ doc, models }]), (error) => error.code === 'MODEL_CAPABILITY_UNAVAILABLE' && error.diagnostics.some((finding) => finding.code === 'binding-representation-unavailable'));
  assert.equal(JSON.stringify(models), before);
};

for (const draft of [2]) test(`effective fields: required derived model/field identities fit the unchanged binding grammar, draft ${draft}`, () => {
  const doc = document(draft, [concept(draft, 'target', 'entity', [binding(draft, 'Target', undefined, 'instances')])]);
  for (const name of ['Order-Line', '_Record', 'Thing?ref=abc']) {
    const model = structuredClone(grammarFixture);
    model.records = { Target: model.records.Target, [name]: model.records[name] };
    assert.deepEqual(report(doc, { m: model }).problems, [], 'source language and known own binding still succeed without derived output');
    assertCapability(doc, { m: model });
  }
  for (const field of ['field-name', 'a.b', '部分', '\uFEFF']) {
    const model = structuredClone(grammarFixture);
    model.records = { Target: model.records.Target, IncomingFields: { fields: { [field]: model.records.IncomingFields.fields[field] } } };
    assertCapability(doc, { m: model });
    const keyModel = structuredClone(grammarFixture);
    keyModel.records = { InheritedKey: { use: ['KeyParts'], key: [field] } };
    const keyDoc = document(draft, [concept(draft, 'key', 'entity', [binding(draft, 'InheritedKey', undefined, 'instances')])]);
    assertCapability(keyDoc, { m: keyModel });
  }
  const unrelated = structuredClone(grammarFixture);
  unrelated.records = { Target: unrelated.records.Target, 'Unrelated-Broad': unrelated.records['Unrelated-Broad'] };
  const successful = report(doc, { m: unrelated }, true);
  assert.deepEqual(successful.problems, [], 'broad source without a required unrepresentable link stays valid');
  assert.ok(successful.links.every((link) => {
    const parsed = parseModelRef(link.model);
    return parsed && !parsed.repo && !parsed.ref && parsed.module === 'm' && parsed.name === 'Target';
  }));
});

test('effective fields: capability text is bounded in UTF-8 before assembly, including complete report/error messages', () => {
  const byteBound = (text, maximum) => {
    assert.ok(Buffer.byteLength(text) <= maximum, `${Buffer.byteLength(text)} exceeds ${maximum}`);
    assert.equal(Buffer.from(text).toString('utf8'), text, 'no truncated surrogate pair or UTF-8 code point');
  };
  for (const text of ['X'.repeat(10_000), '界😀'.repeat(10_000)]) {
    byteBound(diagnosticText(text), modelDiagnosticBytes);
    byteBound(modelMessage`prefix ${text} middle ${text} suffix`, modelMessageBytes);
    const models = { m: source({ Target: { use: ['Foreign.Common'] } }) };
    for (const draft of [2]) {
      const doc = document(draft, [concept(draft, 'target', 'entity', [binding(draft, 'Target', undefined, 'instances'), binding(draft, 'Target', text, 'display-name')])]);
      const checked = report(doc, models);
      assert.ok(checked.problems.some((problem) => problem.rule === 'model-capability'));
      for (const problem of checked.problems) byteBound(problem.message, modelMessageBytes);
    }
    const doc = document(2, [concept(2, 'target', 'entity', [binding(2, 'Target', undefined, 'instances')])]);
    const hugeSource = source({ Target: {}, [text]: { use: [`Foreign.${text}`] } });
    const before = JSON.stringify(hugeSource);
    assert.throws(() => deriveLinks([{ doc, models: { m: hugeSource } }]), (error) => {
      assert.equal(error.code, 'MODEL_CAPABILITY_UNAVAILABLE');
      byteBound(error.message, modelMessageBytes);
      for (const finding of error.diagnostics) byteBound(finding.message, modelDiagnosticBytes);
      return true;
    });
    assert.equal(JSON.stringify(hugeSource), before, 'diagnostic bounds never rewrite source identity');
  }
});
