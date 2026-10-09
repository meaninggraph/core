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
import { checkMeaning, createResolver, loadMeaningDir } from './lib/meaning.mjs';
import { parseHcl, serializeModel, toModelspecJson } from './lib/modelspec.mjs';

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

test('orders and invoices remain distinct while their line items share a common parent', () => {
  const files = Object.fromEntries(rootFiles.map((name) => [name, parseYaml(readFileSync(join(root, name), 'utf8'))]));
  const invoice = concept(files, 'invoice-line');
  const order = concept(files, 'order-line');
  assert.equal(concept(files, 'order').extends, undefined);
  assert.equal(concept(files, 'invoice').extends, undefined);
  assert.equal(order.of, 'order');
  assert.equal(order.extends, 'commercial-line-item');
  assert.equal(invoice.of, 'invoice');
  assert.equal(invoice.extends, 'commercial-line-item');
  assert.equal(concept(files, 'unit-price').of, 'invoice-line');
  assert.equal(concept(files, 'quantity').of, 'invoice-line');
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

test('a measure inherits its aggregation through extends, and a ratio may not inherit a sum', () => {
  const ratioOfRevenue = (aggregation) => (files) => {
    files['statistics.meaning.yaml'].concepts.push({ id: 'revenue-per-capita', kind: 'measure', extends: 'revenue', labels: { en: 'Revenue per capita' }, description: 'Revenue divided by the population.', measure: { formula: 'x / y', inputs: ['per-capita'], ...(aggregation && { aggregation }) } });
  };
  assert.match(problemsOf(ratioOfRevenue()), /concept revenue-per-capita: aggregation sum on a ratio \(it is computed from the measure per-capita\).*sum is inherited from revenue, state aggregation: none/);
  assert.equal(problemsOf(ratioOfRevenue('none')), '', 'its own none overrides the inherited sum');
  assert.equal(problemsOf((files) => { files['statistics.meaning.yaml'].concepts.push({ id: 'online-revenue', kind: 'measure', extends: 'revenue', labels: { en: 'Online revenue' }, description: 'Revenue from online sales.', measure: { formula: 'x' } }); }), '', 'a kind of a summing measure that is no ratio sums');
});

test('ids and values must be unique', () => {
  assert.match(problemsOf((files) => { files['calendar.meaning.yaml'].concepts.push({ ...concept(files, 'country') }); }), /concept country is declared twice \(calendar.meaning.yaml and geo.meaning.yaml\)/);
  assert.match(problemsOf((files) => { const us = concept(files, 'country').values.find((v) => v.id === 'us'); concept(files, 'country').values.push({ ...us }); }), /value us is declared twice/);
  assert.match(problemsOf((files) => { concept(files, 'country').values.find((v) => v.id === 'gb').aliases.en.push('USA'); }), /"USA" names both gb and us|"USA" names both us and gb/);
  assert.match(problemsOf((files) => { concept(files, 'country').values.find((v) => v.id === 'gb').aliases.ru = ['USA']; }), /"(USA|usa)" names both (us and gb|gb and us)/, 'a word names one value whatever the language');
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].sources = [{ id: 's', provider: 'p', dataset: 'd' }, { id: 's', provider: 'q', dataset: 'e' }]; }), /source s is declared twice/);
});

test('the rules of this repository fail: licence, bindings, models, hidden files, shared words', () => {
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].license = 'MIT'; }), /geo.meaning.yaml: license must be CC0-1.0/);
  assert.match(problemsOf((files) => { delete files['geo.meaning.yaml'].license; }), /geo.meaning.yaml: license must be CC0-1.0/);
  assert.match(problemsOf((files) => { concept(files, 'country').bindings = [{ model: 'modelspec:///x.Country', role: 'entity' }]; }), /concept country: bindings belong in a dataset repository/);
  assert.match(problemsOf((files) => { files['geo.meaning.yaml'].models = { x: 'x.hcl' }; }), /models belong in a dataset repository/);
  assert.match(problemsOf((files) => { concept(files, 'person').synonyms.en.push('people'); concept(files, 'population').synonyms.en.push('people'); }), /concept person: "people" \(en\) is also a word of concept population; one word must name one concept/);
  assert.equal(problemsOf((files) => { concept(files, 'employee').synonyms.en.push('individual'); }), '', 'a kind of a concept may share its parent\'s words');
  assert.equal(problemsOf((files) => { concept(files, 'employee').extends = 'meaning://github.com/meaninggraph/core/person'; concept(files, 'employee').synonyms.en.push('individual'); }), '', 'also when the parent is written with the repository\'s own address');
  assert.match(problemsOf((files) => { concept(files, 'person').synonyms.de = ['Leute']; concept(files, 'population').synonyms.de = ['Leute']; }), /concept person: "Leute" \(de\) is also a word of concept population/, 'a language with synonyms but no label counts');
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

// ---- bindings to a ModelSpec model, in either spelling ----------------------------------------------------------
// The universal concepts here carry no bindings (a dataset repository's meaning file has them), but the checker is
// shared with those repositories and reads their models: HCL in the current spelling (record, field, record =) or the
// earlier one (entity, property, entity =), and the JSON form of a model in either vocabulary.

const shopSelf = 'example.test/org/shop';
const shopHcl = `entity "Customer" {
  key = ["id"]
  property "id" {
    type = "int"
    required = true
  }
  property "name" {
    type = "string"
  }
}

entity "Order" {
  key = ["id"]
  property "id" {
    type = "int"
    required = true
  }
  property "customer" {
    entity = "Customer"
  }
  property "note" {
    type = "string"
  }
}
`;
const shopCurrentHcl = shopHcl.replace(/^entity "/gm, 'record "').replace(/^(\s*)property "/gm, '$1field "').replace(/^(\s*)entity =/gm, '$1record =');
const binding = (name, property, role) => ({ model: `modelspec:///shop.${name}`, ...(property ? { property } : {}), role });
const shopMeaning = (extra = []) => ({
  format: 'meaning/draft-1',
  id: 'shop',
  name: 'Shop',
  description: 'A fixture.',
  license: 'CC0-1.0',
  models: { shop: 'shop.modelspec.hcl' },
  concepts: [
    { id: 'customer', kind: 'entity', labels: { en: 'Customer' }, description: 'A buyer.', bindings: [binding('Customer', null, 'entity'), binding('Customer', 'id', 'identifier'), binding('Customer', 'name', 'display-name')] },
    { id: 'order', kind: 'entity', labels: { en: 'Order' }, description: 'A purchase.', bindings: [binding('Order', null, 'entity'), binding('Order', 'id', 'identifier')] },
    { id: 'buyer', kind: 'attribute', of: 'order', 'values-of': 'customer', labels: { en: 'Buyer' }, description: 'Who placed the order.', bindings: [binding('Order', 'customer', 'foreign-key')] },
    ...extra,
  ],
});
function shopProblems({ hcl, meaning = shopMeaning(), models }) {
  const dir = mkdtempSync(join(scratch, 'shop-'));
  writeFileSync(join(dir, 'shop.meaning.yaml'), stringifyYaml(meaning, { lineWidth: 0 }));
  writeFileSync(join(dir, 'shop.modelspec.hcl'), hcl);
  const local = loadMeaningDir(dir, shopSelf);
  return checkMeaning({ local, resolve: createResolver({ root: dir, sources: {} }), schemaPath: join(root, 'meaning.schema.json'), selfRepo: shopSelf, models }).map((problem) => problem.replaceAll(`${dir}/`, ''));
}

test('bindings are checked against a model in the earlier spelling and in the current one alike', () => {
  assert.deepEqual(shopProblems({ hcl: shopHcl }), []);
  assert.deepEqual(shopProblems({ hcl: shopCurrentHcl }), []);
  assert.notEqual(shopCurrentHcl, shopHcl);
  const broken = (extra) => shopMeaning(extra);
  const cases = [
    [[{ id: 'a1', kind: 'attribute', of: 'order', labels: { en: 'A1' }, description: 'x.', bindings: [binding('Order', 'nope', 'value')] }], /modelspec:\/\/\/shop.Order: entity Order has no property nope/],
    [[{ id: 'a2', kind: 'attribute', of: 'order', labels: { en: 'A2' }, description: 'x.', bindings: [binding('Nope', 'id', 'value')] }], /module shop has no entity Nope/],
    [[{ id: 'a3', kind: 'attribute', of: 'order', labels: { en: 'A3' }, description: 'x.', bindings: [binding('Order', 'customer', 'value')] }], /Order.customer has role value but is a reference to Customer; bind it with role foreign-key/],
    [[{ id: 'a4', kind: 'attribute', of: 'order', labels: { en: 'A4' }, description: 'x.', bindings: [binding('Order', 'customer', 'display-name')] }], /Order.customer has role display-name but is a reference to Customer, not a string/],
    [[{ id: 'a5', kind: 'attribute', of: 'order', 'values-of': 'customer', labels: { en: 'A5' }, description: 'x.', bindings: [binding('Order', 'note', 'foreign-key')] }], /Order.note has role foreign-key but is not a reference \(it is a string\)/],
    [[{ id: 'a6', kind: 'attribute', of: 'order', labels: { en: 'A6' }, description: 'x.', bindings: [binding('Order', 'note', 'identifier')] }], /Order.note has role identifier but is not in the key of Order \[id\]/],
  ];
  for (const [extra, pattern] of cases) {
    for (const hcl of [shopHcl, shopCurrentHcl]) assert.match(shopProblems({ hcl, meaning: broken(extra) }).join('\n'), pattern);
  }
  // A reference that points at another record type than the concept's values are is reported by the record's name.
  const wrongTarget = [{ id: 'a7', kind: 'attribute', of: 'order', 'values-of': 'order', labels: { en: 'A7' }, description: 'x.', bindings: [binding('Order', 'customer', 'foreign-key')] }];
  for (const hcl of [shopHcl, shopCurrentHcl]) assert.match(shopProblems({ hcl, meaning: broken(wrongTarget) }).join('\n'), /Order.customer references Customer, but the instances of order are Order rows/);
});

test('a model handed over as JSON is read in the vocabulary its identifier names', () => {
  const earlier = toModelspecJson(parseHcl(shopHcl), { id: 'shop', name: 'shop', version: '1' });
  const current = toModelspecJson(parseHcl(shopCurrentHcl), { id: 'shop', name: 'shop', version: '1' });
  assert.equal(earlier.modelspec, '1.0-draft');
  assert.equal(current.modelspec, '1.0-draft-2');
  for (const json of [earlier, current]) assert.deepEqual(shopProblems({ hcl: shopHcl, models: { shop: JSON.parse(serializeModel(json)) } }), []);
  // No identifier at all is read as it always was, in the earlier vocabulary.
  const { modelspec: _identifier, ...unmarked } = JSON.parse(serializeModel(earlier));
  assert.deepEqual(shopProblems({ hcl: shopHcl, models: { shop: unmarked } }), []);
  // An identifier that names one vocabulary over keys of the other finds no record types.
  const mixed = { ...JSON.parse(serializeModel(earlier)), modelspec: '1.0-draft-2' };
  assert.match(shopProblems({ hcl: shopHcl, models: { shop: mixed } }).join('\n'), /module shop has no entity Customer/);
});

test('a model in the earlier or the current spelling that declares a removed construct is refused when it is loaded', () => {
  for (const hcl of [shopHcl, shopCurrentHcl]) {
    assert.match(shopProblems({ hcl: `${hcl}\ncollection "c" {\n}\n` }).join('\n'), /shop.meaning.yaml: models: line \d+: the collection block was removed from ModelSpec/);
    assert.match(shopProblems({ hcl: `${hcl}\nindex "i" {\n}\n` }).join('\n'), /shop.meaning.yaml: models: line \d+: the index block is reserved by ModelSpec/);
  }
});

// ---- model members named like properties of Object.prototype ---------------------------------------------------
// Names are kept in objects without a prototype and asked with Object.hasOwn, so constructor, toString, __proto__ and
// the rest are ordinary names: a model may declare them, and a binding to one finds it only when the model does.

const prototypeHcl = (spelling) => {
  const [record, member, reference] = spelling === 'current' ? ['record', 'field', 'record'] : ['entity', 'property', 'entity'];
  return `${record} "constructor" {
  key = ["toString"]
  ${member} "toString" {
    type = "int"
    required = true
  }
  ${member} "__proto__" {
    type = "string"
  }
}

${record} "valueOf" {
  key = ["id"]
  ${member} "id" {
    type = "int"
    required = true
  }
  ${member} "hasOwnProperty" {
    ${reference} = "constructor"
  }
}

enum "isPrototypeOf" {
  values = ["a"]
  hasOwnProperty = true
}
`;
};
const prototypeMeaning = (bindings) => ({
  format: 'meaning/draft-1',
  id: 'shop',
  name: 'Shop',
  description: 'A fixture.',
  license: 'CC0-1.0',
  models: { shop: 'shop.modelspec.hcl' },
  concepts: [{ id: 'thing', kind: 'entity', labels: { en: 'Thing' }, description: 'A thing.', bindings }],
});

test('a model may declare members named like Object.prototype properties, and a binding finds them only when it declares them', () => {
  for (const spelling of ['earlier', 'current']) {
    const hcl = prototypeHcl(spelling);
    const declared = [binding('constructor', null, 'entity'), binding('constructor', 'toString', 'identifier'), binding('constructor', '__proto__', 'display-name')];
    assert.deepEqual(shopProblems({ hcl, meaning: prototypeMeaning(declared) }), [], spelling);
    const json = toModelspecJson(parseHcl(hcl), { id: 'shop', name: 'shop', version: '1' });
    assert.deepEqual(Object.keys(json[spelling === 'current' ? 'records' : 'entities']), ['constructor', 'valueOf']);
    assert.deepEqual(Object.keys(json.enums.isPrototypeOf), ['values', 'hasOwnProperty']);
    // The reference to the record type constructor is read like any other.
    assert.deepEqual(shopProblems({ hcl, meaning: prototypeMeaning([binding('valueOf', 'hasOwnProperty', 'value')]) }).join('\n').match(/is a reference to constructor; bind it with role foreign-key/)?.length, 1, spelling);
    // Not declared: a binding to the name of an Object.prototype property is refused, as it is for any other missing name.
    const notDeclared = (extra) => shopProblems({ hcl, meaning: prototypeMeaning(extra) }).join('\n');
    assert.match(notDeclared([binding('toString', null, 'entity')]), /modelspec:\/\/\/shop.toString: module shop has no entity toString/, spelling);
    assert.match(notDeclared([binding('constructor', 'valueOf', 'value')]), /entity constructor has no property valueOf/, spelling);
    assert.match(notDeclared([binding('valueOf', 'toString', 'value')]), /entity valueOf has no property toString/, spelling);
  }
});

test('a name declared twice is still a duplicate, whatever it is called', () => {
  for (const name of ['constructor', '__proto__', 'plain']) {
    assert.throws(() => toModelspecJson(parseHcl(`record "${name}" {\n}\nentity "${name}" {\n}\n`), { id: 'm', name: 'm', version: '1' }), new RegExp(`duplicate entity "${name}"`));
    assert.throws(() => parseHcl(`record "A" {\n  ${name} = 1\n  ${name} = 2\n}\n`), new RegExp(`duplicate attribute ${name}`));
    assert.throws(() => toModelspecJson(parseHcl(`record "A" {\n  field "${name}" {\n  }\n  property "${name}" {\n  }\n}\n`), { id: 'm', name: 'm', version: '1' }), new RegExp(`duplicate property "${name}" in record "A"`));
  }
});
