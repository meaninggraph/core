// The conformance cases of the meaning/draft-2 contract (sections 4.2, 4.3, 5.6 and 7), run against the reference
// checker. A test is named by its case id (F format and words, R roles, K kinds, V value sets, X graphs of
// different formats, D derived links, S stored values). An accepted case asserts that there is no problem and which
// notices there are; a refused case asserts that the rules it names are among the rules of its problems and does
// not look at its notices, except a refused S case (S-03, S-05, S-06, S-09), whose problems carry no rule: it
// asserts the number and the text of its problems, and S-03, S-06 and S-09 assert that there is no notice; a D case
// asserts the link list (the whole list in most; D-13 compares the links of one concept and field; D-14 and D-19
// assert that there is none). A few tests are not cases of the contract: one for the interface, one for 4.2, one for effectiveValues,
// one for a concepts that is no list, and V-20 to V-30 for the draft-1 originals of the twins. CC0-1.0.
//
// The Node checker has no severities: the four notices of the contract (earlier-format, earlier-role-name,
// unknown-value, retired-value) are its separate channel, and "Accept" means no problem and none of the four.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { checkCore, root } from './check.mjs';
import { checkMeaning, checkMeaningReport, effectiveValues, extendsCompatibility, indexConcepts, measureDimensionKinds, measureInputKinds, loadMeaningDir, pinsOf, valueCoverageProblems, valueCoverageReport, checkoutGit } from './lib/meaning.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'meaning-conformance-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const schemaPath = join(root, 'meaning.schema.json');
const d1 = 'meaning/draft-1';
const d2 = 'meaning/draft-2';
const self = 'example.test/org/shop';
const otherRepo = 'example.test/org/other';
const pin = 'a'.repeat(40);

// ---- the model `shop` (current ModelSpec spelling) ---------------------------------------------------------------

const shopHcl = `record "Customer" {
  key = ["Id"]
  field "Id" {
    type = "int"
    required = true
  }
  field "Name" {
    type = "string"
  }
}

record "Order" {
  key = ["Id"]
  field "Id" {
    type = "int"
    required = true
  }
  field "CustomerId" {
    record = "Customer"
  }
  field "Status" {
    type = "string"
  }
}
`;
const hclWith = (change) => change(shopHcl);

// ---- documents ---------------------------------------------------------------------------------------------------

const word = (format) => (format === d2
  ? { property: 'property', field: 'field', instances: 'instances', reference: 'reference' }
  : { property: 'attribute', field: 'property', instances: 'entity', reference: 'foreign-key' });
const concept = (id, kind, extra = {}) => ({ id, kind, labels: { en: id }, description: `The ${id}.`, ...extra });
const file = (format, concepts, { models = true, ...extra } = {}) => ({ format, id: 'shop', name: 'Shop', description: 'A fixture.', license: 'CC0-1.0', ...(models ? { models: models === true ? { shop: 'shop.modelspec.hcl' } : models } : {}), ...extra, concepts });
// A binding in the words of `format`; `role` is given in the current words and written in the format's own.
const bind = (format, record, field, role, extra = {}) => {
  const w = word(format);
  const written = { instances: w.instances, reference: w.reference }[role] ?? role;
  return { model: `modelspec:///shop.${record}`, ...(field ? { [w.field]: field } : {}), role: written, ...extra };
};
const base = (format, extraConcepts = [], { customer = [], order = [] } = {}) => [
  concept('customer', 'entity', { bindings: [bind(format, 'Customer', null, 'instances'), ...customer] }),
  concept('order', 'entity', { bindings: [bind(format, 'Order', null, 'instances'), ...order] }),
  ...extraConcepts,
];
const values = (...ids) => ids.map((id) => ({ id, labels: { en: id[0].toUpperCase() + id.slice(1) } }));

// ---- running the checker -----------------------------------------------------------------------------------------

function directory(files, hcl = shopHcl) {
  const dir = mkdtempSync(join(scratch, 'g-'));
  for (const [name, doc] of Object.entries(files)) writeFileSync(join(dir, name), stringifyYaml(doc, { lineWidth: 0 }));
  writeFileSync(join(dir, 'shop.modelspec.hcl'), hcl);
  return dir;
}
// files: one document, or { name: document }. supplied: files of the other graph (checked-graph references name it).
function run(files, { hcl, supplied, derive = false } = {}) {
  const docs = files.concepts !== undefined || files.format !== undefined ? { 'shop.meaning.yaml': files } : files;
  const local = loadMeaningDir(directory(docs, hcl), self);
  const other = supplied ? loadMeaningDir(directory(supplied.files ?? { 'other.meaning.yaml': supplied }), otherRepo) : null;
  const resolve = (repo, ref) => (other && repo === otherRepo && ref === pin ? other : { error: `no source for ${repo}` });
  return checkMeaningReport({ local, resolve, schemaPath, selfRepo: self, derive });
}
const other = (ref) => `meaning://${otherRepo}/${ref}?ref=${pin}`;
const rules = (list) => [...new Set(list.map((found) => found.rule))].sort();
const message = (list) => list.map((found) => found.message).join('\n');

function accept(report) {
  assert.deepEqual(report.problems, []);
  assert.deepEqual(rules(report.notices), [], message(report.notices));
}
function acceptWith(report, ...noticeRules) {
  assert.deepEqual(report.problems, []);
  assert.deepEqual(rules(report.notices), [...noticeRules].sort(), message(report.notices));
}
// A refusal is asserted by the rules of its problems; the notices of a refused file are not looked at.
function refuse(report, rule, ...also) {
  assert.ok(report.problems.length > 0, 'a problem was expected');
  for (const expected of [rule, ...also]) assert.ok(rules(report.problems).includes(expected), `${expected} expected, got ${rules(report.problems)}\n${message(report.problems)}`);
}

// ---- F: format and words ------------------------------------------------------------------------------------------

test('F-01: a draft-1 file, valid today, is accepted with the notice earlier-format', () => {
  const report = run(file(d1, [concept('thing', 'entity')], { models: false }));
  acceptWith(report, 'earlier-format');
  assert.equal(report.notices.length, 1);
  assert.match(report.notices[0].message, /shop.meaning.yaml: earlier-format: the file is in meaning\/draft-1, the earlier format; it is read in full/);
});
test('F-02: a draft-2 file, the smallest valid one, is accepted', () => accept(run(file(d2, [concept('thing', 'entity')], { models: false }))));
test('F-03: an identifier that does not exist is refused by the schema rule', () => {
  const report = run(file('meaning/draft-3', [concept('thing', 'entity')], { models: false }));
  refuse(report, 'schema');
  assert.match(message(report.problems), /shop.meaning.yaml: schema: format must be meaning\/draft-1 or meaning\/draft-2/);
});
test('F-04: a file with no format is refused by the schema rule', () => {
  const doc = file(d1, [concept('thing', 'entity')], { models: false });
  delete doc.format;
  const report = run(doc);
  refuse(report, 'schema');
  assert.match(message(report.problems), /schema: format must be meaning\/draft-1 or meaning\/draft-2/);
});
test('F-03 and F-04, in full: a file with an unknown or no format gets the one schema finding and nothing else, with or without a schema path', () => {
  // The same defects, each of which is reported when the format is known (the positive control below).
  const defects = [concept('thing', 'entity', { extends: 'ghost', source: 'undeclared' })];
  const control = run(file(d2, defects, { models: false }));
  refuse(control, 'unknown-concept', 'undeclared-source');
  for (const format of ['meaning/draft-3', undefined]) {
    const doc = file(format, defects, { models: false });
    if (format === undefined) delete doc.format;
    const local = loadMeaningDir(directory({ 'shop.meaning.yaml': doc }), self);
    const withSchema = checkMeaningReport({ local, resolve: () => ({ error: 'none' }), schemaPath, selfRepo: self });
    const withoutSchema = checkMeaningReport({ local, resolve: () => ({ error: 'none' }), selfRepo: self });
    for (const report of [withSchema, withoutSchema]) {
      assert.equal(report.problems.length, 1, `${format}: ${message(report.problems)}`);
      assert.equal(report.problems[0].rule, 'schema');
      assert.match(message(report.problems), /shop.meaning.yaml: schema: format must be meaning\/draft-1 or meaning\/draft-2/);
      assert.deepEqual(report.notices, [], 'a file that is not in meaning/draft-1 gets no earlier-format notice');
    }
  }
});
test('robustness: concepts that is a string or a set, in a draft-1 or a draft-2 file, is refused by the schema; the check does not throw', () => {
  for (const [name, text] of Object.entries({ string: 'concepts: nope\n', set: 'concepts: !!set {a, b}\n' })) {
    for (const format of [d1, d2]) {
      const dir = mkdtempSync(join(scratch, 'g-'));
      writeFileSync(join(dir, 'shop.meaning.yaml'), `format: ${format}\nid: shop\nname: Shop\ndescription: A fixture.\nlicense: CC0-1.0\n${text}`);
      const report = checkMeaningReport({ local: loadMeaningDir(dir, self), resolve: () => ({ error: 'none' }), schemaPath, selfRepo: self });
      assert.ok(report.problems.some((found) => found.rule === 'schema'), `${name} in ${format}: a schema problem was expected, got ${message(report.problems)}`);
    }
  }
});
test('F-05: two files of one graph in two formats are refused as format-mixed, naming each format and a file', () => {
  const report = run({ 'a.meaning.yaml': file(d1, [concept('one', 'entity')], { models: false }), 'b.meaning.yaml': file(d2, [concept('two', 'entity')], { models: false }) });
  refuse(report, 'format-mixed');
  assert.match(message(report.problems), /format-mixed: .*change format together.*meaning\/draft-1 \(.*a\.meaning\.yaml\).*meaning\/draft-2 \(.*b\.meaning\.yaml\)/);
  // each file is valid alone
  accept(run(file(d2, [concept('two', 'entity')], { models: false })));
  acceptWith(run(file(d1, [concept('one', 'entity')], { models: false })), 'earlier-format');
});

// Rows 10 to 16 of section 4.2: the schema of the file's format refuses the word, and format-word (N50) is reported beside it.
const wordRefused = (id, title, doc, expected) => test(`${id}: ${title}`, () => {
  const report = run(doc);
  refuse(report, 'format-word', 'schema');
  assert.match(message(report.problems.filter((found) => found.rule === 'format-word')), expected);
});
wordRefused('F-06', 'a draft-1 file with kind: property', file(d1, [concept('p', 'property')], { models: false }), /kind property belongs to meaning\/draft-2; in meaning\/draft-1 it is written attribute/);
wordRefused('F-07', 'a draft-1 file with field: on a binding', file(d1, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', field: 'Id', role: 'identifier' }] })]), /the binding key field belongs to meaning\/draft-2; in meaning\/draft-1 it is written property/);
wordRefused('F-08', 'a draft-1 file with kind: value-set', file(d1, [concept('vs', 'value-set', { values: values('a') })], { models: false }), /kind value-set belongs to meaning\/draft-2/);
wordRefused('F-09', 'a draft-1 file with complete: true on an entity that has values', file(d1, [concept('e', 'entity', { complete: true, values: values('a') })], { models: false }), /complete belongs to meaning\/draft-2/);
wordRefused('F-10', 'a draft-1 file with retired: true on a value', file(d1, [concept('e', 'entity', { values: [{ ...values('a')[0], retired: true }] })], { models: false }), /value a: format-word: retired belongs to meaning\/draft-2/);
wordRefused('F-11', 'a draft-2 file with kind: attribute', file(d2, [concept('a', 'attribute')], { models: false }), /kind attribute is written property in meaning\/draft-2/);
wordRefused('F-12', 'a draft-2 file with property: on a binding', file(d2, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', property: 'Id', role: 'identifier' }] })]), /the binding key property is written field in meaning\/draft-2/);
wordRefused('F-13', 'a draft-2 binding with both property: and field:', file(d2, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', property: 'Id', field: 'Id', role: 'identifier' }] })]), /both property: and field:; meaning\/draft-2 writes field/);
wordRefused('F-14', 'a draft-1 binding with both property: and field:', file(d1, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', property: 'Id', field: 'Id', role: 'identifier' }] })]), /both property: and field:; meaning\/draft-1 writes property/);
wordRefused('F-15', 'a draft-2 file with values on an entity', file(d2, [concept('e', 'entity', { values: values('a') })], { models: false }), /values belongs on a concept of kind value-set; name that concept with values-of/);
wordRefused('F-16', 'a draft-2 file with values on a property', file(d2, [concept('p', 'property', { values: values('a') })], { models: false }), /values belongs on a concept of kind value-set; name that concept with values-of/);
test('F-06 to F-16, everywhere: format-word looks at every concept, binding and value of the file, not at the first', () => {
  const words = (document) => run(document).problems.filter((found) => found.rule === 'format-word').map((found) => found.message);
  const inDraft1 = words(file(d1, [concept('fine', 'entity'), concept('p', 'property'), concept('v', 'value-set', { values: values('a') }), concept('c', 'entity', { values: [...values('a'), { ...values('b')[0], retired: true }] })], { models: false }));
  assert.equal(inDraft1.filter((text) => /concept p: format-word: kind property belongs/.test(text)).length, 1, inDraft1.join('\n'));
  assert.equal(inDraft1.filter((text) => /concept v: format-word: kind value-set belongs/.test(text)).length, 1, inDraft1.join('\n'));
  assert.equal(inDraft1.filter((text) => /concept c: value b: format-word: retired belongs/.test(text)).length, 1, inDraft1.join('\n'));
  const bindings = words(file(d1, [concept('customer', 'entity', { bindings: [bind(d1, 'Customer', null, 'instances'), { model: 'modelspec:///shop.Customer', field: 'Id', role: 'identifier' }] })]));
  assert.equal(bindings.length, 1, bindings.join('\n'));
  assert.match(bindings[0], /concept customer: binding modelspec:\/\/\/shop.Customer: format-word: the binding key field belongs to meaning\/draft-2/);
  const d2Words = words(file(d2, [concept('fine', 'entity'), concept('a', 'attribute'), concept('customer', 'entity', { bindings: [bind(d2, 'Customer', null, 'instances'), { model: 'modelspec:///shop.Customer', property: 'Id', role: 'identifier' }] })]));
  assert.equal(d2Words.length, 2, d2Words.join('\n'));
  assert.match(d2Words.join('\n'), /concept a: format-word: kind attribute is written property/);
  assert.match(d2Words.join('\n'), /binding modelspec:\/\/\/shop.Customer: format-word: the binding key property is written field/);
});
test('F-17: a draft-1 attribute that carries values and no values-of is accepted with the notice earlier-format', () => {
  acceptWith(run(file(d1, [concept('a', 'attribute', { values: values('a', 'b') }), concept('d', 'dimension', { values: values('x') })], { models: false })), 'earlier-format');
});

// ---- R: roles (D6 part b) -----------------------------------------------------------------------------------------

test('R-01: a draft-1 file may use instances and reference; only earlier-format is noticed', () => {
  // the two role names are written literally, in a draft-1 file: `bind` would write entity and foreign-key there
  const concepts = [
    concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', role: 'instances' }, { model: 'modelspec:///shop.Order', property: 'CustomerId', role: 'reference' }] }),
    concept('order', 'entity', { bindings: [{ model: 'modelspec:///shop.Order', role: 'instances' }] }),
  ];
  const text = stringifyYaml(file(d1, concepts), { lineWidth: 0 });
  assert.match(text, /role: instances/);
  assert.match(text, /role: reference/);
  assert.doesNotMatch(text, /role: (entity|foreign-key)/);
  acceptWith(run(file(d1, concepts)), 'earlier-format');
});
test('R-02: a draft-2 file with entity and foreign-key is accepted with the notice earlier-role-name', () => {
  const report = run(file(d2, base(d2, [], { customer: [{ model: 'modelspec:///shop.Order', field: 'CustomerId', role: 'foreign-key' }] })));
  // the base uses instances; make the earlier name appear on the instances line as well
  acceptWith(report, 'earlier-role-name');
  const earlier = base(d2, [], { customer: [{ model: 'modelspec:///shop.Order', field: 'CustomerId', role: 'foreign-key' }] });
  earlier[0].bindings[0].role = 'entity';
  const again = run(file(d2, earlier));
  acceptWith(again, 'earlier-role-name');
  assert.match(again.notices[0].message, /entity and foreign-key are the earlier spellings of instances and reference/);
  assert.equal(again.notices.length, 1, 'one notice per file');
});
test('R-03: entity on one record type and instances on another count together: entity-bindings', () => {
  const report = run(file(d2, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', role: 'entity' }, { model: 'modelspec:///shop.Order', role: 'instances' }] })]));
  refuse(report, 'entity-bindings');
  assert.match(message(report.problems), /has 2 instances bindings \(shop.Customer, shop.Order\)/);
});
test('R-04: role instances with field: is refused by the schema', () => {
  refuse(run(file(d2, [concept('customer', 'entity', { bindings: [{ model: 'modelspec:///shop.Customer', field: 'Id', role: 'instances' }] })])), 'schema');
});
test('R-05: role reference with no field: is refused by the schema', () => {
  refuse(run(file(d2, base(d2, [], { customer: [{ model: 'modelspec:///shop.Order', role: 'reference' }] }))), 'schema');
});
test('R-06: role reference on a field that is not a reference is a binding-role problem', () => {
  const report = run(file(d2, base(d2, [], { customer: [bind(d2, 'Order', 'Status', 'reference')] })));
  refuse(report, 'binding-role');
  assert.match(message(report.problems), /Order.Status has role reference but is not a reference \(it is a string\)/);
});
test('R-07: role reference under a concept bound to another record type is a binding-role problem', () => {
  const report = run(file(d2, base(d2, [], { order: [bind(d2, 'Order', 'CustomerId', 'reference')] })));
  refuse(report, 'binding-role');
  assert.match(message(report.problems), /Order.CustomerId references Customer, but the instances of order are Order rows/);
});
test('R-08: role reference under a property with no values-of is a binding-role problem', () => {
  const report = run(file(d2, base(d2, [concept('buyer', 'property', { bindings: [bind(d2, 'Order', 'CustomerId', 'reference')] })])));
  refuse(report, 'binding-role');
  assert.match(message(report.problems), /needs values-of/);
});
test('R-09: role value on a reference is a binding-role problem that advises role reference', () => {
  const report = run(file(d2, base(d2, [concept('buyer', 'property', { bindings: [bind(d2, 'Order', 'CustomerId', 'value')] })])));
  refuse(report, 'binding-role');
  assert.match(message(report.problems), /is a reference to Customer; bind it with role reference/);
});
test('R-10: role reference under an entity with no instances binding is a binding-role problem', () => {
  const report = run(file(d2, [concept('x', 'entity', { bindings: [bind(d2, 'Order', 'CustomerId', 'reference')] })]));
  refuse(report, 'binding-role');
  assert.match(message(report.problems), /no entity binding in this repository, so it cannot be checked/);
});
test('R-11: role instances on a property is refused by the schema', () => {
  refuse(run(file(d2, base(d2, [concept('buyer', 'property', { bindings: [{ model: 'modelspec:///shop.Order', role: 'instances' }] })]))), 'schema');
});

// ---- K: kinds and the four relations (D14 part a, D15 part c) --------------------------------------------------------

const vs = (id, extra = {}) => concept(id, 'value-set', { values: values('a', 'b'), ...extra });
const kinds = (...concepts) => run(file(d2, concepts, { models: false }));
const measure = (id, extra = {}, m = {}) => concept(id, 'measure', { measure: { formula: 'x', ...m }, ...extra });
test('K-01: a property may extend a dimension and a dimension a property', () => {
  accept(kinds(concept('d1', 'dimension'), concept('p1', 'property', { extends: 'd1' }), concept('p2', 'property'), concept('d2', 'dimension', { extends: 'p2' })));
});
test('K-02: a property extending an entity is an extends-kind problem', () => refuse(kinds(concept('e', 'entity'), concept('p', 'property', { extends: 'e' })), 'extends-kind'));
test('K-03: an entity may extend a value set', () => accept(kinds(vs('v'), concept('e', 'entity', { extends: 'v' }))));
test('K-04: a value set may extend a value set', () => accept(kinds(vs('v'), vs('w', { extends: 'v' }))));
test('K-05: a value set may extend an entity', () => accept(kinds(concept('e', 'entity'), vs('v', { extends: 'e' }))));
test('K-06: a measure extending a value set is an extends-kind problem', () => refuse(kinds(vs('v'), measure('m', { extends: 'v' })), 'extends-kind'));
test('K-07: a property extending a value set is an extends-kind problem', () => refuse(kinds(vs('v'), concept('p', 'property', { extends: 'v' })), 'extends-kind'));
test('K-08: of may name a value set', () => accept(kinds(vs('v'), concept('p', 'property', { of: 'v' }))));
test('K-09: of naming a property is a target-kind problem', () => {
  const report = kinds(concept('q', 'property'), concept('p', 'property', { of: 'q' }));
  refuse(report, 'target-kind');
  assert.match(message(report.problems), /of names q, which is a property, not an entity or a value-set/);
});
test('K-10: values-of may name a value set', () => accept(kinds(vs('v'), concept('p', 'property', { 'values-of': 'v' }))));
test('K-11: values-of naming a property is a target-kind problem', () => refuse(kinds(concept('q', 'property'), concept('p', 'property', { 'values-of': 'q' })), 'target-kind'));
const currency = (...codes) => vs('currency', { values: [{ id: 'usd', labels: { en: 'US dollar' }, codes: { alpha3: 'USD' } }, ...codes] });
test('K-12: units-of may name a value set, and unit names one of its values by code in another letter case', () => {
  accept(kinds(currency(), measure('money', { 'units-of': 'currency', unit: 'usd' })));
});
test('K-13: a unit that names no value of an open value set is a unit problem (N7)', () => {
  refuse(kinds(currency(), measure('money', { 'units-of': 'currency', unit: 'eur' })), 'unit');
});
test('K-14: a unit that is an alias of one value and a code of another names two: a unit problem', () => {
  const list = vs('currency', { values: [{ id: 'a', labels: { en: 'A' }, aliases: { en: ['X'] } }, { id: 'b', labels: { en: 'B' }, codes: { k: 'X' } }] });
  const report = kinds(list, measure('money', { 'units-of': 'currency', unit: 'x' }));
  refuse(report, 'unit');
  assert.match(message(report.problems), /names a, b/);
});
test('K-15: a measure computed from a property is accepted', () => accept(kinds(concept('p', 'property'), measure('m', {}, { inputs: ['p'] }))));
test('K-16: a measure computed from a value set is a measure-input problem', () => {
  const report = kinds(vs('v'), measure('m', {}, { inputs: ['v'] }));
  refuse(report, 'measure-input');
  assert.match(message(report.problems), /a measure is computed from properties and measures only/);
});
test('K-17: a measure grouped by a value set is a measure-dimension problem', () => refuse(kinds(vs('v'), measure('m', {}, { dimensions: ['v'] })), 'measure-dimension'));
test('K-18: a child may narrow values-of to an entity that extends the parent\'s value set', () => {
  accept(kinds(vs('v'), concept('e', 'entity', { extends: 'v' }), concept('parent', 'property', { 'values-of': 'v' }), concept('child', 'property', { extends: 'parent', 'values-of': 'e' })));
});
test('K-19: a child whose values-of names an unrelated value set is a narrowing problem', () => {
  refuse(kinds(vs('v'), vs('w'), concept('parent', 'property', { 'values-of': 'v' }), concept('child', 'property', { extends: 'parent', 'values-of': 'w' })), 'narrowing');
});

// ---- V: value sets (D15 parts a and b) --------------------------------------------------------------------------------

const withKey = (v, key, extra) => { const copy = { ...v }; if (extra === undefined) delete copy[key]; else copy[key] = extra; return copy; };
test('V-01: a value set with two values is accepted', () => accept(kinds(vs('v'))));
test('V-02: a value set with no values key is refused by the schema (N10)', () => refuse(kinds(withKey(vs('v'), 'values')), 'schema'));
test('V-03: a value set with values: [] is refused by the schema', () => refuse(kinds(vs('v', { values: [] })), 'schema'));
test('V-04: a value set with bindings is refused by the schema (N9)', () => refuse(run(file(d2, [vs('v', { bindings: [{ model: 'modelspec:///shop.Order', role: 'instances' }] })])), 'schema'));
test('V-05: a value set with values-of is refused by the schema (N11)', () => refuse(kinds(vs('w'), vs('v', { 'values-of': 'w' })), 'schema'));
test('V-06: a value set with units-of is refused by the schema (N11)', () => refuse(kinds(vs('w'), vs('v', { 'units-of': 'w' })), 'schema'));
test('V-07: a value set with unit is refused by the schema (N11)', () => refuse(kinds(vs('v', { unit: 'x' })), 'schema'));
test('V-08: a value set with a measure block is refused by the schema', () => refuse(kinds(vs('v', { measure: { formula: 'x' } })), 'schema'));
test('V-09: a value set with complete: true is accepted (N1)', () => accept(kinds(vs('v', { complete: true }))));
test('V-10: an entity with complete: true is refused by the schema', () => refuse(kinds(concept('e', 'entity', { complete: true })), 'schema'));
test('V-11: complete: yes-of-course is refused by the schema', () => refuse(kinds(vs('v', { complete: 'yes-of-course' })), 'schema'));
test('V-12: a value with retired: true is accepted (N2)', () => accept(kinds(vs('v', { values: [{ ...values('a')[0], retired: true }, ...values('b')] }))));
test('V-13: a value with retired: "soon" is refused by the schema', () => refuse(kinds(vs('v', { values: [{ ...values('a')[0], retired: 'soon' }] })), 'schema'));
test('V-14: a unit that names a retired value is accepted with the notice retired-value (N4)', () => {
  const list = vs('currency', { values: [{ id: 'usd', labels: { en: 'US dollar' }, codes: { alpha3: 'USD' }, retired: true }] });
  const report = kinds(list, measure('money', { 'units-of': 'currency', unit: 'USD' }));
  acceptWith(report, 'retired-value');
  assert.match(report.notices[0].message, /unit "USD" names the value usd of currency, which is retired/);
});
test('V-15: a retired value and a live value that share a label are a duplicate-value problem (N3)', () => {
  refuse(kinds(vs('v', { values: [{ id: 'a', labels: { en: 'Same' }, retired: true }, { id: 'b', labels: { en: 'same' } }] })), 'duplicate-value');
});

// V-20 to V-30: draft-2 twins of the draft-1 fixtures whose subject is a rule about values (the Go corpus keeps the
// draft-1 items, N40). The twin writes the list on a value set and the attributes as properties.
const twin = (yaml) => {
  const doc = parseYaml(yaml);
  doc.format = d2;
  for (const c of doc.concepts) { if (c.kind === 'attribute') c.kind = 'property'; else if (c.kind === 'entity' && c.values) c.kind = 'value-set'; }
  return doc;
};
const head = 'format: meaning/draft-1\nid: demo\nname: Demo\ndescription: A demo graph.\nconcepts:\n';
const twinCase = (id, title, body, verdict) => test(`${id}: ${title}`, () => {
  const report = run(twin(head + body));
  if (verdict === 'accept') accept(report); else refuse(report, verdict);
});
twinCase('V-20', 'twin of refuse-duplicate-value-id', '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: A}}, {id: a, labels: {en: B}}]}\n', 'duplicate-value');
twinCase('V-21', 'twin of refuse-duplicate-word', '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: A}, aliases: {en: [Shared]}}, {id: b, labels: {en: B}, aliases: {en: [shared]}}]}\n', 'duplicate-value');
twinCase('V-22', 'twin of refuse-duplicate-word-across-languages', '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: A}}, {id: b, labels: {en: B, ru: a}}]}\n', 'duplicate-value');
twinCase('V-23', 'twin of accept-same-word-in-two-languages', '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: Rat, de: rat}, aliases: {en: [RAT]}}]}\n', 'accept');
twinCase('V-24', 'twin of refuse-unit-names-no-value', '  - {id: currency, kind: entity, labels: {en: currency}, description: A currency., values: [{id: usd, labels: {en: US dollar}, codes: {iso: USD}}]}\n  - {id: amount, kind: attribute, labels: {en: amount}, description: A amount., units-of: currency, unit: franc}\n', 'unit');
twinCase('V-25', 'twin of refuse-unit-names-two-values', '  - {id: currency, kind: entity, labels: {en: currency}, description: A currency., values: [{id: a, labels: {en: A}, codes: {x: Z}}, {id: b, labels: {en: B}, codes: {x: Z}}]}\n  - {id: amount, kind: attribute, labels: {en: amount}, description: A amount., units-of: currency, unit: Z}\n', 'unit');
twinCase('V-26', 'twin of refuse-schema-value-id-uppercase', '  - {id: a, kind: entity, labels: {en: a}, description: A a., values: [{id: US, labels: {en: US}}]}\n', 'schema');
twinCase('V-27', 'twin of accept-narrowing-to-a-kind', '  - {id: country, kind: entity, labels: {en: country}, description: A country., values: [{id: us, labels: {en: US}}]}\n  - {id: region, kind: entity, labels: {en: region}, description: A region., extends: country}\n  - {id: base, kind: attribute, labels: {en: base}, description: A base., values-of: country}\n  - {id: narrow, kind: attribute, labels: {en: narrow}, description: A narrow., extends: base, values-of: region}\n', 'accept');
twinCase('V-28', 'twin of refuse-unit-inherited-units-of (the units-of is inherited through extends)', '  - {id: currency, kind: entity, labels: {en: currency}, description: A currency., values: [{id: usd, labels: {en: US dollar}}]}\n  - {id: amount, kind: attribute, labels: {en: amount}, description: A amount., units-of: currency}\n  - {id: price, kind: attribute, labels: {en: price}, description: A price., extends: amount, unit: franc}\n', 'unit');
twinCase('V-29', 'twin of accept-unit-matches-ignoring-case', '  - {id: currency, kind: entity, labels: {en: currency}, description: A currency., values: [{id: usd, labels: {en: US dollar}, codes: {iso: USD}}, {id: eur, labels: {en: euro}, codes: {iso: EUR}}]}\n  - {id: amount, kind: attribute, labels: {en: amount}, description: A amount., units-of: currency, unit: usd}\n', 'accept');
twinCase('V-30', 'twin of refuse-narrowing-changes-values-of', '  - {id: country, kind: entity, labels: {en: country}, description: A country., values: [{id: us, labels: {en: US}}]}\n  - {id: city, kind: entity, labels: {en: city}, description: A city.}\n  - {id: base, kind: attribute, labels: {en: base}, description: A base., values-of: country}\n  - {id: wrong, kind: attribute, labels: {en: wrong}, description: A wrong., extends: base, values-of: city}\n', 'narrowing');
test('V-20 to V-30: the draft-1 originals of the twins give the same verdicts (the fixtures stay, N40)', () => {
  // the twin function changes nothing but the words: a draft-1 body checked as draft-1 refuses or accepts alike
  const refused = run(parseYaml(head + '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: A}}, {id: a, labels: {en: B}}]}\n'));
  refuse(refused, 'duplicate-value');
  acceptWith(run(parseYaml(head + '  - {id: c, kind: entity, labels: {en: c}, description: A c., values: [{id: a, labels: {en: Rat, de: rat}}]}\n')), 'earlier-format');
});

// ---- X: graphs of different formats (section 4.3) ----------------------------------------------------------------------

const suppliedD2 = () => file(d2, [vs('status-list'), concept('some-property', 'property'), concept('dimension-of', 'dimension')], { models: false });
const checked1 = (concepts, supplied = suppliedD2()) => run(file(d1, concepts, { models: false }), { supplied });
test('X-01: a draft-1 attribute whose values-of names a value set of the other graph', () => {
  acceptWith(checked1([concept('a', 'attribute', { 'values-of': other('status-list') })]), 'earlier-format');
});
test('X-02: a draft-1 attribute that extends a property of the other graph', () => {
  acceptWith(checked1([concept('a', 'attribute', { extends: other('some-property') })]), 'earlier-format');
});
test('X-03: a draft-1 entity that extends a value set of the other graph', () => {
  acceptWith(checked1([concept('e', 'entity', { extends: other('status-list') })]), 'earlier-format');
});
test('X-04: a draft-1 attribute with of naming a value set of the other graph', () => {
  acceptWith(checked1([concept('a', 'attribute', { of: other('status-list') })]), 'earlier-format');
});
test('X-05: a draft-1 units-of naming the other graph\'s value set, with a unit that names one value', () => {
  const supplied = file(d2, [currency()], { models: false });
  acceptWith(checked1([concept('amount', 'attribute', { 'units-of': other('currency'), unit: 'USD' })], supplied), 'earlier-format');
});
test('X-06: a draft-1 measure whose inputs name a property of the other graph', () => {
  acceptWith(checked1([measure('m', {}, { inputs: [other('some-property')] })]), 'earlier-format');
});
test('X-07: a draft-1 measure whose inputs name a value set of the other graph is a measure-input problem', () => {
  const report = checked1([measure('m', {}, { inputs: [other('status-list')] })]);
  refuse(report, 'measure-input');
  assert.match(message(report.problems), /a measure is computed from attributes and measures only/, 'in the words of the file it is about');
});
test('X-08: a draft-2 property that extends an attribute of a draft-1 graph is accepted, with no notice (N22)', () => {
  const supplied = file(d1, [concept('old-attribute', 'attribute')], { models: false });
  accept(run(file(d2, [concept('p', 'property', { extends: other('old-attribute') })], { models: false }), { supplied }));
});
test('X-09: a draft-2 property whose values-of names a draft-1 entity that carries values is accepted (N22)', () => {
  const supplied = file(d1, [concept('old-list', 'entity', { values: values('a', 'b') })], { models: false });
  accept(run(file(d2, [concept('p', 'property', { 'values-of': other('old-list') })], { models: false }), { supplied }));
});
// X-10 and X-11: the Go checker refuses these as unresolved-graph, because it validates every supplied graph. The Node
// checker reads a graph it resolves without validating it, today and under the contract (section 4.2, row 9), so
// it reads the supplied graph in the single vocabulary and accepts.
test('X-10: a draft-1 graph referring into a graph with kind: attribute in a draft-2 file: the Node checker does not validate the supplied graph (row 9)', () => {
  const supplied = file(d2, [concept('stray', 'attribute')], { models: false });
  acceptWith(run(file(d1, [concept('a', 'attribute', { extends: other('stray') })], { models: false }), { supplied }), 'earlier-format');
});
test('X-11: a draft-2 graph referring into a graph of two files, one draft-1 and one draft-2: the Node checker does not validate the supplied graph (row 9)', () => {
  const supplied = { files: { 'a.meaning.yaml': file(d1, [concept('one', 'attribute')], { models: false }), 'b.meaning.yaml': file(d2, [concept('two', 'property')], { models: false }) } };
  accept(run(file(d2, [concept('p', 'property', { extends: other('one') })], { models: false }), { supplied }));
});
// The Node checker does not validate a graph it resolves, but it reads the kinds value-set and property only from a file
// that says meaning/draft-2: in a pinned file that says draft 1, or says nothing, they are no kind it knows, and the
// draft-1 graph that names them is refused as it was before draft 2.
test('X-13: a pinned file that says meaning/draft-1 or has no format is not read as holding a value set or a property', () => {
  const asks = [
    ['values-of', 'target-kind', (name) => concept('a', 'attribute', { 'values-of': other(name) }), 'status-list'],
    ['of', 'target-kind', (name) => concept('a', 'attribute', { of: other(name) }), 'status-list'],
    ['units-of', 'target-kind', (name) => concept('a', 'attribute', { 'units-of': other(name) }), 'status-list'],
    ['an entity extends a value set', 'extends-kind', (name) => concept('e', 'entity', { extends: other(name) }), 'status-list'],
    ['an attribute extends a property', 'extends-kind', (name) => concept('a', 'attribute', { extends: other(name) }), 'some-property'],
    ['a measure takes a property as input', 'measure-input', (name) => measure('m', {}, { inputs: [other(name)] }), 'some-property'],
    ['a measure is grouped by a property', 'measure-dimension', (name) => measure('m', {}, { dimensions: [other(name)] }), 'some-property'],
  ];
  const pinned = (format) => {
    const supplied = suppliedD2();
    if (format === undefined) delete supplied.format; else supplied.format = format;
    return supplied;
  };
  for (const [name, rule, build, target] of asks) {
    // the positive control: a file that says meaning/draft-2 holds the kind, and the same line is accepted
    acceptWith(checked1([build(target)]), 'earlier-format');
    for (const format of [d1, undefined]) refuse(checked1([build(target)], pinned(format)), rule);
  }
});

// The core graph of this repository, converted by hand the way stage F will convert it (all six files to draft-2, the
// attributes to properties, the two lists to value sets), is what X-12 and section 6.3, point 1 need.
function convertedCore() {
  const dir = mkdtempSync(join(scratch, 'core-'));
  for (const name of ['LICENSE', 'meaning.schema.json', 'meaning.draft-2.schema.json']) copyFileSync(join(root, name), join(dir, name));
  for (const name of readdirSync(root).filter((entry) => entry.endsWith('.meaning.yaml'))) {
    const doc = parseYaml(readFileSync(join(root, name), 'utf8'));
    doc.format = d2;
    for (const c of doc.concepts) { if (c.kind === 'attribute') c.kind = 'property'; else if (c.kind === 'entity' && c.values) c.kind = 'value-set'; }
    writeFileSync(join(dir, name), stringifyYaml(doc, { lineWidth: 0 }));
  }
  return dir;
}
test('X-12 and 6.3 point 1: the core graph converted by hand passes the check, and a draft-1 Chinook-shaped graph pinned to it is accepted with earlier-format', () => {
  const dir = convertedCore();
  const result = checkCore(dir);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.notices, []);
  const converted = loadMeaningDir(dir, 'github.com/meaninggraph/core');
  assert.equal(converted.concepts.get('country').concept.kind, 'value-set');
  assert.equal(converted.concepts.get('currency').concept.kind, 'value-set');
  const core = 'meaning://github.com/meaninggraph/core';
  const chinook = file(d1, [
    concept('customer-country', 'attribute', { of: 'customer', 'values-of': `${core}/country?ref=${pin}` }),
    concept('customer', 'entity', { extends: `${core}/customer?ref=${pin}` }),
    concept('invoice-total', 'attribute', { of: 'customer', 'units-of': `${core}/currency?ref=${pin}`, unit: 'USD' }),
    concept('country-region', 'entity', { extends: `${core}/country?ref=${pin}` }),
  ], { models: false });
  const local = loadMeaningDir(directory({ 'chinook.meaning.yaml': chinook }), 'example.test/org/chinook');
  const report = checkMeaningReport({ local, resolve: (repo, ref) => (repo === 'github.com/meaninggraph/core' && ref === pin ? converted : { error: 'no source' }), schemaPath, selfRepo: 'example.test/org/chinook' });
  acceptWith(report, 'earlier-format');
});

// ---- D: derived links (section 3) ----------------------------------------------------------------------------------------

const link = (concept_, record, field, role, extra = {}) => ({ concept: concept_, model: `modelspec:///shop.${record}`, ...(field ? { field } : {}), role, ...extra });
const derived = (concept_, record, field, role) => link(concept_, record, field, role, { derived: true });
const baseLinks = [
  link('customer', 'Customer', null, 'instances'),
  derived('customer', 'Customer', 'Id', 'identifier'),
  derived('customer', 'Order', 'CustomerId', 'reference'),
  link('order', 'Order', null, 'instances'),
  derived('order', 'Order', 'Id', 'identifier'),
];
const links = (doc, options) => run(doc, { derive: true, ...options });

test('D-01: nothing written (draft 2): the identifiers and the reference are derived', () => {
  const report = links(file(d2, base(d2)));
  accept(report);
  assert.deepEqual(report.links, baseLinks);
});
test('D-02: the same in draft 1 with role entity gives the same list with the current role names', () => {
  const report = links(file(d1, base(d1)));
  acceptWith(report, 'earlier-format');
  assert.deepEqual(report.links, baseLinks);
});
test('D-03: no concept bound to Customer: nothing is derived for Order.CustomerId', () => {
  const report = links(file(d2, [base(d2)[1]]));
  accept(report);
  assert.deepEqual(report.links, [link('order', 'Order', null, 'instances'), derived('order', 'Order', 'Id', 'identifier')]);
});
test('D-04: a second concept bound to Customer: both apply', () => {
  const report = links(file(d2, base(d2, [concept('buyer', 'entity', { bindings: [bind(d2, 'Customer', null, 'instances')] })])));
  accept(report);
  assert.deepEqual(report.links, [
    link('buyer', 'Customer', null, 'instances'),
    derived('buyer', 'Customer', 'Id', 'identifier'),
    derived('buyer', 'Order', 'CustomerId', 'reference'),
    ...baseLinks,
  ]);
});
const written = (list, index, replacement) => list.map((entry, i) => (i === index ? replacement : entry));
test('D-05: a written reference line with a note takes the place of the derived one and brings its note', () => {
  const report = links(file(d2, base(d2, [], { customer: [bind(d2, 'Order', 'CustomerId', 'reference', { note: 'Who placed the order.' })] })));
  accept(report);
  assert.deepEqual(report.links, written(baseLinks, 2, link('customer', 'Order', 'CustomerId', 'reference', { note: 'Who placed the order.' })));
});
test('D-06: the same in draft 1, with foreign-key and property:', () => {
  const report = links(file(d1, base(d1, [], { customer: [bind(d1, 'Order', 'CustomerId', 'reference', { note: 'Who placed the order.' })] })));
  acceptWith(report, 'earlier-format');
  assert.equal(report.links[2].role, 'reference');
  assert.deepEqual(report.links, written(baseLinks, 2, link('customer', 'Order', 'CustomerId', 'reference', { note: 'Who placed the order.' })));
  assert.match(JSON.stringify(file(d1, base(d1, [], { customer: [bind(d1, 'Order', 'CustomerId', 'reference')] }))), /"role":"foreign-key"/);
});
test('D-07: a written identifier line is one link, not derived', () => {
  const report = links(file(d2, base(d2, [], { customer: [bind(d2, 'Customer', 'Id', 'identifier')] })));
  accept(report);
  assert.deepEqual(report.links, written(baseLinks, 1, link('customer', 'Customer', 'Id', 'identifier')));
});
const orderLine = (change = (text) => text) => change(`${shopHcl}
record "OrderLine" {
  key = ["OrderId", "LineNo"]
  field "OrderId" {
    type = "int"
  }
  field "LineNo" {
    type = "int"
  }
}
`);
test('D-08: a key of several fields gives one identifier link per key field (N16)', () => {
  const report = links(file(d2, base(d2, [concept('order-line', 'entity', { bindings: [bind(d2, 'OrderLine', null, 'instances')] })])), { hcl: orderLine() });
  accept(report);
  assert.deepEqual(report.links, [
    ...baseLinks,
    link('order-line', 'OrderLine', null, 'instances'),
    derived('order-line', 'OrderLine', 'LineNo', 'identifier'),
    derived('order-line', 'OrderLine', 'OrderId', 'identifier'),
  ]);
});
test('D-09: a key field that is also a reference carries both links', () => {
  const hcl = orderLine((text) => text.replace('field "OrderId" {\n    type = "int"', 'field "OrderId" {\n    record = "Order"'));
  const report = links(file(d2, base(d2, [concept('order-line', 'entity', { bindings: [bind(d2, 'OrderLine', null, 'instances')] })])), { hcl });
  accept(report);
  assert.deepEqual(report.links, [
    link('customer', 'Customer', null, 'instances'),
    derived('customer', 'Customer', 'Id', 'identifier'),
    derived('customer', 'Order', 'CustomerId', 'reference'),
    link('order', 'Order', null, 'instances'),
    derived('order', 'Order', 'Id', 'identifier'),
    derived('order', 'OrderLine', 'OrderId', 'reference'),
    link('order-line', 'OrderLine', null, 'instances'),
    derived('order-line', 'OrderLine', 'LineNo', 'identifier'),
    derived('order-line', 'OrderLine', 'OrderId', 'identifier'),
  ]);
});
test('D-10: a record type with no key bound to a concept gets no identifier link', () => {
  const hcl = `${shopHcl}\nrecord "Note" {\n  field "Text" {\n    type = "string"\n  }\n}\n`;
  const report = links(file(d2, base(d2, [concept('note', 'entity', { bindings: [bind(d2, 'Note', null, 'instances')] })])), { hcl });
  accept(report);
  assert.deepEqual(report.links, [...baseLinks.slice(0, 3), link('note', 'Note', null, 'instances'), ...baseLinks.slice(3)]);
});
test('D-11: a reference to its own record type is derived', () => {
  const hcl = hclWith((text) => text.replace('  field "Name" {', '  field "ReferredBy" {\n    record = "Customer"\n  }\n  field "Name" {'));
  const report = links(file(d2, base(d2)), { hcl });
  accept(report);
  assert.deepEqual(report.links, [
    link('customer', 'Customer', null, 'instances'),
    derived('customer', 'Customer', 'Id', 'identifier'),
    derived('customer', 'Customer', 'ReferredBy', 'reference'),
    derived('customer', 'Order', 'CustomerId', 'reference'),
    link('order', 'Order', null, 'instances'),
    derived('order', 'Order', 'Id', 'identifier'),
  ]);
});
test('D-12: a named reference beside a derived one: two links on one field for different concepts', () => {
  const report = links(file(d2, base(d2, [concept('account-manager', 'property', { 'values-of': 'customer', bindings: [bind(d2, 'Order', 'CustomerId', 'reference')] })])));
  accept(report);
  assert.deepEqual(report.links, [link('account-manager', 'Order', 'CustomerId', 'reference'), ...baseLinks]);
});
test('D-13: another role on the same field and concept: the written display-name and the derived identifier both stand (N15)', () => {
  const hcl = hclWith((text) => text.replace('field "Id" {\n    type = "int"\n    required = true\n  }\n  field "Name"', 'field "Id" {\n    type = "string"\n    required = true\n  }\n  field "Name"'));
  const report = links(file(d2, base(d2, [], { customer: [bind(d2, 'Customer', 'Id', 'display-name')] })), { hcl });
  accept(report);
  assert.deepEqual(report.links.filter((entry) => entry.concept === 'customer' && entry.field === 'Id'), [link('customer', 'Customer', 'Id', 'display-name'), derived('customer', 'Customer', 'Id', 'identifier')]);
});
test('D-14: a written reference line under order on Order.CustomerId is refused, and no list is shown', () => {
  const report = links(file(d2, base(d2, [], { order: [bind(d2, 'Order', 'CustomerId', 'reference')] })));
  refuse(report, 'binding-role');
  assert.equal(report.links, null);
});
test('D-15: a reference written with the module name derives nothing (N17)', () => {
  const hcl = hclWith((text) => text.replace('record = "Customer"', 'record = "shop.Customer"'));
  const report = links(file(d2, base(d2)), { hcl });
  accept(report);
  assert.deepEqual(report.links, baseLinks.filter((entry) => entry.field !== 'CustomerId'));
});
test('D-16: a reference to a record type the model does not declare derives nothing', () => {
  const hcl = hclWith((text) => text.replace('record = "Customer"', 'record = "Ghost"'));
  const report = links(file(d2, base(d2)), { hcl });
  accept(report);
  assert.deepEqual(report.links, baseLinks.filter((entry) => entry.field !== 'CustomerId'));
});
test('D-17: the same written line twice: one link, with the first line\'s note', () => {
  const report = links(file(d2, base(d2, [], { customer: [bind(d2, 'Order', 'CustomerId', 'reference', { note: 'first' }), bind(d2, 'Order', 'CustomerId', 'reference', { note: 'second' })] })));
  accept(report);
  assert.deepEqual(report.links, written(baseLinks, 2, link('customer', 'Order', 'CustomerId', 'reference', { note: 'first' })));
});
test('D-18: a graph with no models map and no bindings has the empty list; with the instances lines and no models map it is refused', () => {
  const report = links(file(d2, [concept('customer', 'entity'), concept('order', 'entity')], { models: false }));
  accept(report);
  assert.deepEqual(report.links, []);
  const refused = links(file(d2, base(d2), { models: false }));
  refuse(refused, 'binding-model');
  assert.match(message(refused.problems), /module shop is not listed in models/);
  assert.equal(refused.links, null);
});
test('D-19: a model file that is missing is a models problem, and no list is shown', () => {
  const report = links(file(d2, base(d2), { models: { shop: 'missing.modelspec.hcl' } }));
  refuse(report, 'models');
  assert.equal(report.links, null);
});
test('D-20: a key that names a field the record type does not declare derives nothing for that name (N53)', () => {
  const hcl = hclWith((text) => text.replace('record "Customer" {\n  key = ["Id"]', 'record "Customer" {\n  key = ["Id", "Ghost"]'));
  const report = links(file(d2, base(d2)), { hcl });
  accept(report);
  assert.deepEqual(report.links, baseLinks);
});
test('D-21: a key that is not a list gives no key: nothing is derived from it, and a written identifier line on it is a binding-role problem', () => {
  // key = 5 threw a TypeError, and key = "Id" was read letter by letter (here the field I would have been the key)
  for (const key of ['5', '"Id"']) {
    const hcl = hclWith((text) => text.replace('record "Customer" {\n  key = ["Id"]', `record "Customer" {\n  key = ${key}`).replace('  field "Name" {', '  field "I" {\n    type = "int"\n  }\n  field "Name" {'));
    const report = links(file(d2, base(d2)), { hcl });
    accept(report);
    assert.deepEqual(report.links, baseLinks.filter((entry) => !(entry.concept === 'customer' && entry.role === 'identifier')), `key = ${key}`);
    const named = links(file(d2, base(d2, [], { customer: [bind(d2, 'Customer', 'Id', 'identifier')] })), { hcl });
    refuse(named, 'binding-role');
    assert.match(message(named.problems), /Customer.Id has role identifier but is not in the key of Customer \[\]/, `key = ${key}`);
  }
});
test('D-22: a written line keeps its match as well as its note', () => {
  const status = concept('status', 'property', { bindings: [bind(d2, 'Order', 'Status', 'value', { match: 'codes.k', note: 'By code.' })] });
  const report = links(file(d2, base(d2, [status])));
  accept(report);
  assert.deepEqual(report.links.filter((entry) => entry.concept === 'status'), [link('status', 'Order', 'Status', 'value', { match: 'codes.k', note: 'By code.' })]);
});
test('D-23: a model in the earlier ModelSpec spelling gives the same list', () => {
  const earlier = shopHcl.replaceAll('record = "', 'entity = "').replaceAll('record "', 'entity "').replaceAll('field "', 'property "');
  assert.doesNotMatch(earlier, /record|field/);
  const report = links(file(d2, base(d2)), { hcl: earlier });
  accept(report);
  assert.deepEqual(report.links, baseLinks);
});
test('D-24: the list is sorted by bytes, not by locale (capital letters first)', () => {
  const hcl = `record "Customer" {
  key = ["alpha", "Zeta"]
  field "alpha" {
    type = "int"
  }
  field "Zeta" {
    type = "int"
  }
}

record "Zed" {
  field "CustomerId" {
    record = "Customer"
  }
}

record "alpha" {
  field "CustomerId" {
    record = "Customer"
  }
}
`;
  const report = links(file(d2, [concept('customer', 'entity', { bindings: [bind(d2, 'Customer', null, 'instances')] })]), { hcl });
  accept(report);
  assert.deepEqual(report.links, [
    link('customer', 'Customer', null, 'instances'),
    derived('customer', 'Customer', 'Zeta', 'identifier'),
    derived('customer', 'Customer', 'alpha', 'identifier'),
    derived('customer', 'Zed', 'CustomerId', 'reference'),
    derived('customer', 'alpha', 'CustomerId', 'reference'),
  ]);
});

// ---- S: stored values (section 5.6) ---------------------------------------------------------------------------------------

const statusList = (extra = {}) => vs('order-status-list', { values: [...values('open', 'shipped'), { id: 'on-hold', labels: { en: 'On hold' }, retired: true }], ...extra });
const statusFile = (listExtra, bindingExtra = {}) => file(d2, [
  statusList(listExtra),
  concept('order-status', 'property', { 'values-of': 'order-status-list', bindings: [bind(d2, 'Order', 'Status', 'value', bindingExtra)] }),
  concept('order', 'entity', { bindings: [bind(d2, 'Order', null, 'instances')] }),
]);
const stored = (document, statuses, { supplied } = {}) => {
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': document }), self);
  const other = supplied ? loadMeaningDir(directory({ 'other.meaning.yaml': supplied }), otherRepo) : null;
  const resolve = (repo, ref) => (other && repo === otherRepo && ref === pin ? other : { error: 'no source' });
  return valueCoverageReport({ local, resolve, data: { Order: statuses.map((Status) => ({ Status })) } });
};
test('S-01: stored values that name known values (ignoring case) are accepted, open list', () => {
  const report = stored(statusFile(), ['Open', 'shipped']);
  assert.deepEqual(report, { problems: [], notices: [] });
});
test('S-02: a stored value that matches nothing in an open list is a notice, unknown-value', () => {
  const report = stored(statusFile(), ['open', 'lost']);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(rules(report.notices), ['unknown-value']);
  assert.match(report.notices[0].message, /value "lost" of Order.Status is unknown to order-status-list \(the list is open\)/);
});
test('S-03: the same value in a list marked complete is an error', () => {
  const report = stored(statusFile({ complete: true }), ['open', 'lost']);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0], /Order.Status value "lost" matches no value/);
  assert.deepEqual(report.notices, []);
});
test('S-04: a stored value that names a retired value is a notice, retired-value, open or complete', () => {
  for (const extra of [{}, { complete: true }]) {
    const report = stored(statusFile(extra), ['on hold']);
    assert.deepEqual(report.problems, []);
    assert.deepEqual(rules(report.notices), ['retired-value']);
  }
});
test('S-05: a stored value that equals one code of two values is an error, open or complete', () => {
  const list = { values: [{ id: 'a', labels: { en: 'A' }, codes: { k: 'Z' } }, { id: 'b', labels: { en: 'B' }, codes: { k: 'Z' } }] };
  for (const extra of [{}, { complete: true }]) {
    const report = stored(statusFile({ ...list, ...extra }, { match: 'codes.k' }), ['Z']);
    assert.equal(report.problems.length, 1);
    assert.match(report.problems[0], /matches 2 values \(a, b\) by codes.k/);
  }
});
test('S-06: a list on a draft-1 entity has no marker and is complete: an unknown value is an error', () => {
  const document = file(d1, [
    concept('order-status-list', 'entity', { values: values('open', 'shipped') }),
    concept('order-status', 'attribute', { 'values-of': 'order-status-list', bindings: [bind(d1, 'Order', 'Status', 'value')] }),
  ]);
  const report = stored(document, ['open', 'lost']);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0], /value "lost" matches no value/);
  assert.deepEqual(report.notices, []);
});
test('S-07: a binding in a draft-1 file against a draft-2 value set of a pinned graph: the list is open', () => {
  const document = file(d1, [concept('order-status', 'attribute', { 'values-of': other('order-status-list'), bindings: [bind(d1, 'Order', 'Status', 'value')] })]);
  const report = stored(document, ['open', 'lost'], { supplied: file(d2, [statusList()], { models: false }) });
  assert.deepEqual(report.problems, []);
  assert.deepEqual(rules(report.notices), ['unknown-value']);
});
test('S-08: only nulls are accepted, open or complete', () => {
  for (const extra of [{}, { complete: true }]) assert.deepEqual(stored(statusFile(extra), [null, undefined]), { problems: [], notices: [] });
});
test('S-09: a file whose format the check does not know is refused before any binding is read', () => {
  const unknown = statusFile();
  unknown.format = 'meaning/draft-3';
  const report = stored(unknown, ['open', 'lost', 'on hold']);
  assert.equal(report.problems.length, 1, 'refused once, and nothing was checked');
  assert.match(report.problems[0], /shop.meaning.yaml: format "meaning\/draft-3", but this check knows meaning\/draft-1 and meaning\/draft-2 only; no binding of the file was read/);
  assert.deepEqual(report.notices, []);
  const missing = statusFile();
  delete missing.format;
  assert.match(stored(missing, ['open']).problems[0], /format is missing/);
  // The positive control: the same file in draft 2 reads its field: bindings and reports.
  assert.deepEqual(rules(stored(statusFile(), ['lost']).notices), ['unknown-value']);
});
test('S-10: rows are found by the record type name among the data\'s own keys: a record type named constructor with no rows has no stored values', () => {
  const document = file(d2, [vs('v', { complete: true }), concept('p', 'property', { 'values-of': 'v', bindings: [{ model: 'modelspec:///shop.constructor', field: 'Status', role: 'value' }] })]);
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': document }), self);
  const resolve = () => ({ error: 'none' });
  assert.deepEqual(valueCoverageReport({ local, resolve, data: {} }), { problems: [], notices: [] });
  // the positive control: the same binding finds the rows of a record type that the data does have
  const own = valueCoverageReport({ local, resolve, data: { constructor: [{ Status: 'zzz' }] } });
  assert.equal(own.problems.length, 1);
  assert.match(own.problems[0], /constructor.Status value "zzz" matches no value/);
});

// ---- the interface the registry uses, and what draft-1 keeps ------------------------------------------------------------------

test('interface: the four functions meaninggraph/registry uses keep their shapes', () => {
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': file(d1, base(d1)) }), self);
  const resolve = () => ({ error: 'none' });
  const notices = [];
  const problems = checkMeaning({ local, resolve, schemaPath, selfRepo: self, notice: (text, rule) => notices.push({ rule, text }) });
  assert.ok(Array.isArray(problems) && problems.every((problem) => typeof problem === 'string'));
  assert.deepEqual(problems, []);
  assert.deepEqual(notices.map((found) => found.rule), ['earlier-format']);
  assert.deepEqual(checkMeaning({ local, resolve, schemaPath, selfRepo: self }), [], 'no notice channel given: the same list');
  for (const fn of [checkMeaning, checkoutGit, indexConcepts, pinsOf]) assert.equal(typeof fn, 'function');
  assert.equal(indexConcepts(local.files, self).concepts.size, 2);
  assert.deepEqual(pinsOf(parseYaml(`x: meaning://${otherRepo}/a?ref=${pin}`), otherRepo), [pin]);
  // schemaPath names the draft-1 schema; the draft-2 schema is found beside it, and the message prefix stays schema:
  const broken = file(d2, [concept('bad', 'attribute')], { models: false });
  const refused = checkMeaning({ local: loadMeaningDir(directory({ 'shop.meaning.yaml': broken }), self), resolve, schemaPath, selfRepo: self });
  assert.ok(refused.some((problem) => /^.*shop\.meaning\.yaml: schema: \/concepts\/0\/kind must be equal to one of the allowed values/.test(problem)), refused.join('\n'));
  // a list of strings is still what valueCoverageProblems returns
  assert.ok(Array.isArray(valueCoverageProblems({ local: loadMeaningDir(directory({ 'shop.meaning.yaml': statusFile() }), self), resolve, data: { Order: [{ Status: 'lost' }] } })));
});

test('interface: the exported tables are in draft-1 words, as they were before draft 2', () => {
  assert.deepEqual(extendsCompatibility, { entity: ['entity'], attribute: ['attribute', 'dimension'], dimension: ['dimension', 'attribute'], measure: ['measure'] });
  assert.deepEqual(measureInputKinds, ['attribute', 'measure']);
  assert.deepEqual(measureDimensionKinds, ['dimension', 'attribute']);
});
test('interface: valueCoverageProblems returns the problems only, and hands the notices to the notice channel', () => {
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': statusFile() }), self);
  const resolve = () => ({ error: 'none' });
  const data = { Order: [{ Status: 'lost' }, { Status: 'on hold' }] };
  const seen = [];
  assert.deepEqual(valueCoverageProblems({ local, resolve, data, notice: (text, rule) => seen.push({ rule, text }) }), []);
  assert.deepEqual(seen.map((found) => found.rule).sort(), ['retired-value', 'unknown-value']);
  assert.ok(seen.every((found) => typeof found.text === 'string'));
  assert.deepEqual(valueCoverageProblems({ local, resolve, data }), [], 'no notice channel given: the same list');
  const complete = loadMeaningDir(directory({ 'shop.meaning.yaml': statusFile({ complete: true }) }), self);
  const problems = valueCoverageProblems({ local: complete, resolve, data });
  assert.equal(problems.length, 1);
  assert.equal(typeof problems[0], 'string');
});
test('interface: checkMeaningReport lists no links unless derive: true is passed', () => {
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': file(d2, base(d2)) }), self);
  const resolve = () => ({ error: 'none' });
  assert.equal(checkMeaningReport({ local, resolve, schemaPath, selfRepo: self }).links, null);
  assert.equal(checkMeaningReport({ local, resolve, schemaPath, selfRepo: self, derive: false }).links, null);
  assert.deepEqual(checkMeaningReport({ local, resolve, schemaPath, selfRepo: self, derive: true }).links, baseLinks);
});
test('interface: a graph that cannot be read is reported under the rule unresolved-graph, with the resolver\'s own words', () => {
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': file(d1, [concept('a', 'attribute', { extends: other('x') })], { models: false }) }), self);
  const report = checkMeaningReport({ local, resolve: () => ({ error: 'no source for the other graph' }), schemaPath, selfRepo: self });
  assert.deepEqual(rules(report.problems), ['unresolved-graph']);
  assert.match(message(report.problems), /shop.meaning.yaml: concept a extends: no source for the other graph$/);
});
test('interface: the draft-2 schema is the file beside the schema given, not one in the working directory', () => {
  const copyOf = (...names) => {
    const dir = mkdtempSync(join(scratch, 'schemas-'));
    for (const name of names) copyFileSync(join(root, name), join(dir, name));
    return dir;
  };
  const alone = copyOf('meaning.schema.json');
  const both = copyOf('meaning.schema.json', 'meaning.draft-2.schema.json');
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': file(d2, [concept('thing', 'entity')], { models: false }) }), self);
  const check = (dir) => checkMeaningReport({ local, resolve: () => ({ error: 'none' }), schemaPath: join(dir, 'meaning.schema.json'), selfRepo: self });
  const before = process.cwd();
  try {
    process.chdir(root); // a draft-2 schema is here, and not beside the schema given
    const missing = check(alone);
    refuse(missing, 'schema');
    assert.match(message(missing.problems), /shop.meaning.yaml: schema: meaning\/draft-2 needs .*meaning\.draft-2\.schema\.json, which does not exist/);
    assert.ok(message(missing.problems).includes(alone));
    process.chdir(alone); // none here, and one beside the schema given
    accept(check(both));
  } finally { process.chdir(before); }
});
test('a draft-1 file is told in draft-1 words: the kinds a target may be, the kinds an extends may join', () => {
  const target = run(file(d1, [concept('q', 'attribute'), concept('p', 'attribute', { 'values-of': 'q', of: 'q' })], { models: false }));
  assert.match(message(target.problems), /concept p: of names q, which is an attribute, not an entity$/m);
  assert.match(message(target.problems), /concept p: values-of names q, which is an attribute, not an entity$/m);
  const joins = run(file(d1, [concept('e', 'entity'), concept('a', 'attribute', { extends: 'e' }), concept('f', 'entity', { extends: 'a' })], { models: false }));
  assert.match(message(joins.problems), /concept a: an attribute cannot extend e, which is an entity; extends means "is a kind of", and an attribute may extend only attribute or dimension$/m);
  assert.match(message(joins.problems), /concept f: an entity cannot extend a, which is an attribute; extends means "is a kind of", and an entity may extend only entity$/m);
  // and the same mistakes in a draft-2 file in draft-2 words
  const target2 = run(file(d2, [concept('q', 'property'), concept('p', 'property', { 'values-of': 'q' })], { models: false }));
  assert.match(message(target2.problems), /which is a property, not an entity or a value-set$/m);
  const joins2 = run(file(d2, [concept('e', 'entity'), concept('a', 'property', { extends: 'e' }), concept('f', 'entity', { extends: 'a' })], { models: false }));
  assert.match(message(joins2.problems), /a property may extend only property or dimension$/m);
  assert.match(message(joins2.problems), /an entity may extend only entity or value-set$/m);
});

test('4.2: a draft-1 file keeps what draft 1 allowed: nothing it allowed becomes a problem', () => {
  const cases = {
    'values on an entity': [concept('e', 'entity', { values: values('a') })],
    'values on an attribute': [concept('a', 'attribute', { values: values('a') })],
    'values on a dimension': [concept('d', 'dimension', { values: values('a') })],
    'an attribute and a dimension extend each other': [concept('a', 'attribute'), concept('d', 'dimension', { extends: 'a' }), concept('d2', 'dimension'), concept('a2', 'attribute', { extends: 'd2' })],
    'an entity extends an entity': [concept('e', 'entity'), concept('f', 'entity', { extends: 'e' })],
    'values-of and units-of name an entity that has values': [concept('e', 'entity', { values: values('a') }), concept('a', 'attribute', { 'values-of': 'e', 'units-of': 'e', unit: 'A' })],
    'a measure from attributes and a measure, grouped by a dimension and an attribute': [concept('a', 'attribute'), concept('d', 'dimension'), measure('m', {}, { inputs: ['a'], dimensions: ['d', 'a'] }), measure('r', {}, { inputs: ['m'], aggregation: 'none' })],
    'every word may repeat on one value': [concept('e', 'entity', { values: [{ id: 'a', labels: { en: 'Rat', de: 'rat' }, aliases: { en: ['RAT'] } }] })],
    'a list on an entity next to a bound display-name': [concept('c', 'entity', { values: values('a'), bindings: [bind(d1, 'Customer', null, 'instances'), bind(d1, 'Customer', 'Name', 'display-name', { match: 'labels' })] })],
    'foreign-key and entity role names': base(d1, [], { customer: [bind(d1, 'Order', 'CustomerId', 'reference')] }),
  };
  for (const [name, concepts] of Object.entries(cases)) {
    const report = run(file(d1, concepts, { models: concepts.some((c) => c.bindings) }));
    assert.deepEqual(report.problems, [], name);
    assert.deepEqual(rules(report.notices), ['earlier-format'], name);
  }
  const unchanged = valueCoverageProblems({ local: loadMeaningDir(directory({ 'shop.meaning.yaml': file(d1, [concept('e', 'entity', { values: values('a') }), concept('p', 'attribute', { 'values-of': 'e', bindings: [bind(d1, 'Order', 'Status', 'value')] })]) }), self), resolve: () => ({ error: 'none' }), data: { Order: [{ Status: 'a' }, { Status: 'zzz' }] } });
  assert.equal(unchanged.length, 1);
  assert.match(unchanged[0], /Order.Status value "zzz" matches no value$/);
});

test('effectiveValues is unchanged for draft-1 and reads a value set through values-of', () => {
  const document = file(d2, [vs('v'), concept('p', 'property', { 'values-of': 'v' })], { models: false });
  const local = loadMeaningDir(directory({ 'shop.meaning.yaml': document }), self);
  assert.deepEqual(effectiveValues(local.concepts.get('p').concept, local, () => ({ error: 'none' })).map((value) => value.id), ['a', 'b']);
});
