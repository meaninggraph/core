// Finite semantic field facts beside the original ModelSpec AST. This is not a
// source serializer or a replacement for canonical ModelSpec validation.
import { vocabularies, vocabularyOf } from './modelspec.mjs';
import { diagnosticText, modelMessage, modelMessageBytes } from './model-diagnostic.mjs';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key);
const entries = (value) => object(value) ? Object.entries(value) : [];

export class ModelCapabilityError extends Error {
  constructor(message, diagnostics = [], code = 'MODEL_CAPABILITY_UNAVAILABLE') {
    super(diagnosticText(message, modelMessageBytes));
    this.name = 'ModelCapabilityError';
    this.code = code;
    this.diagnostics = diagnostics.map((finding) => ({ ...finding, message: diagnosticText(finding.message) }));
  }
}

export function createEffectiveModelResolver(models, { maxWork = 100_000, maxDiagnostics = 64, identityFor = (model) => model } = {}) {
  if (!Number.isSafeInteger(maxWork) || maxWork < 0 || !Number.isSafeInteger(maxDiagnostics) || maxDiagnostics < 1) throw new TypeError('invalid effective-model bounds');
  const aliases = new Map();
  const byModel = new Map();
  const originsByIdentity = new Map();
  for (const [alias, model] of entries(models)) {
    if (!object(model)) continue;
    let owner = byModel.get(model);
    if (!owner) {
      const words = vocabularyOf(model) ?? vocabularies.earlier;
      const identity = identityFor(model);
      if (!originsByIdentity.has(identity)) originsByIdentity.set(identity, new Map());
      owner = { model, identity, words, aliases: new Set(), records: model[words.records] ?? {}, components: model.components ?? {}, enums: model.enums ?? {}, views: new Map(), origins: originsByIdentity.get(identity) };
      byModel.set(model, owner);
    }
    owner.aliases.add(alias);
    aliases.set(alias, owner);
  }
  let work = 0;
  const spend = () => work < maxWork ? (++work, true) : false;
  const diagnostics = [];
  const invalid = [];
  let omitted = 0;
  const diagnose = (destination, code, message) => {
    const finding = { code, message: diagnosticText(message) };
    if (diagnostics.length < maxDiagnostics) { diagnostics.push(finding); destination?.push(finding); }
    else omitted++;
  };
  const report = () => [...diagnostics, ...(omitted ? [{ code: 'diagnostics-omitted', message: modelMessage`${omitted} additional diagnostics omitted` }] : [])];
  const resolveReference = (owner, reference, kind) => {
    if (typeof reference !== 'string') return { status: 'invalid', reference, message: modelMessage`${kind} reference must be a string` };
    const parts = reference.split('.');
    if (parts.length > 2 || parts.length === 2 && parts.some((part) => part === '')) return { status: 'invalid', reference, message: modelMessage`${reference} is not a bare name or a <module>.<Name> reference` };
    const qualified = parts.length === 2;
    const target = !qualified || owner.aliases.has(parts[0]) || parts[0] === owner.model.module?.name ? owner : aliases.get(parts[0]);
    if (!target) return { status: 'unavailable', reference, message: modelMessage`exact module ${parts[0]} is unavailable for ${reference}` };
    const name = parts.at(-1);
    if (!own(target[kind], name)) return { status: 'invalid', reference, message: modelMessage`unknown ${kind.slice(0, -1)} ${reference} in a known model` };
    return { status: 'known', owner: target, name, definition: target[kind][name], reference };
  };
  const record = (alias, name) => {
    const owner = aliases.get(alias);
    return owner && own(owner.records, name) ? { status: 'known', owner, name, definition: owner.records[name] } : null;
  };
  const fieldInfo = (owner, member) => ({ owner, member });
  const recordReference = (info) => own(info.member, info.owner.words.record) ? resolveReference(info.owner, info.member[info.owner.words.record], 'records') : null;
  // Source reference integrity is checked once, independently of expansion work.
  // A budget cannot hide a malformed/local-missing reference in an unused component.
  for (const owner of byModel.values()) {
    for (const [group, fieldsKey] of [['records', owner.words.fields], ['components', 'fields']]) {
      for (const [name, declaration] of entries(owner[group])) {
        const validate = (reference, kind, where) => {
          const result = resolveReference(owner, reference, kind);
          if (result.status === 'invalid') diagnose(invalid, 'model-reference-invalid', modelMessage`${where}: ${result.message}`);
        };
        if (group === 'records' && declaration?.use !== undefined) {
          if (!Array.isArray(declaration.use)) diagnose(invalid, 'model-reference-invalid', modelMessage`${name}: use must be a list of component references`);
          else for (const reference of declaration.use) validate(reference, 'components', modelMessage`${name} use`);
        }
        for (const [field, member] of entries(declaration?.[fieldsKey])) {
          for (const [attribute, kind] of [[owner.words.record, 'records'], ['component', 'components'], ['enum', 'enums']]) {
            if (own(member, attribute) && !(attribute === 'enum' && Array.isArray(member.enum))) validate(member[attribute], kind, modelMessage`${name}.${field}`);
          }
        }
      }
    }
  }
  if (omitted && invalid.length) invalid.push({ code: 'diagnostics-omitted', message: modelMessage`${omitted} additional invalid source reference diagnostics omitted` });
  const view = (target) => {
    const { owner, name, definition } = target;
    if (owner.views.has(name)) return owner.views.get(name);
    const direct = object(definition?.[owner.words.fields]) ? definition[owner.words.fields] : {};
    const fields = new Map(entries(direct).map(([name, member]) => [name, fieldInfo(owner, member)]));
    const inherited = new Map();
    const unavailable = [];
    const ambiguous = new Set();
    const visited = new Set();
    const result = { fields, unavailable, ambiguous, complete: true };
    owner.views.set(name, result);
    const fail = (code, message) => {
      result.complete = false;
      if (unavailable.length < maxDiagnostics) unavailable.push({ code, message: diagnosticText(message) });
      diagnose(null, code, modelMessage`${name}: ${message}`);
    };
    for (const reference of Array.isArray(definition?.use) ? definition.use : []) {
      if (!spend()) { fail('model-work-limit', 'effective field work limit reached'); break; }
      const component = resolveReference(owner, reference, 'components');
      if (component.status !== 'known') { fail('component-unavailable', component.message); continue; }
      let origin = component.owner.origins.get(component.name);
      if (!origin) { origin = {}; component.owner.origins.set(component.name, origin); }
      if (visited.has(origin)) continue;
      visited.add(origin);
      for (const [field, member] of entries(component.definition?.fields)) {
        if (!spend()) { fail('model-work-limit', 'effective field work limit reached'); break; }
        if (own(direct, field)) continue;
        if (!inherited.has(field)) inherited.set(field, new Map());
        inherited.get(field).set(origin, fieldInfo(component.owner, member));
      }
      if (unavailable.some((finding) => finding.code === 'model-work-limit')) break;
    }
    for (const [field, origins] of inherited) {
      if (origins.size === 1) fields.set(field, origins.values().next().value);
      else { ambiguous.add(field); result.complete = false; diagnose(null, 'field-ambiguous', modelMessage`${name}.${field}: distinct inherited component origins`); }
    }
    return result;
  };
  const field = (target, name) => {
    const direct = target.definition?.[target.owner.words.fields];
    // Own fields remain certain even when unrelated composition is unavailable.
    if (own(direct, name)) return { status: 'known', ...fieldInfo(target.owner, direct[name]) };
    const effective = view(target);
    if (effective.ambiguous.has(name)) return { status: 'ambiguous', message: modelMessage`field ${name} has distinct inherited origins` };
    if (effective.unavailable.length) return { status: 'unavailable', message: modelMessage`field ${name} cannot be proved from the available component closure (${effective.unavailable[0].message})` };
    return effective.fields.has(name) ? { status: 'known', ...effective.fields.get(name) } : { status: 'absent' };
  };
  const assertValid = () => {
    if (invalid.length) throw new ModelCapabilityError('invalid known ModelSpec references', report(), 'MODEL_REFERENCE_INVALID');
  };
  const capability = (code, message) => {
    diagnose(null, code, message);
    throw new ModelCapabilityError(message, report());
  };
  const requireComplete = (target) => {
    const effective = view(target);
    if (!effective.complete) throw new ModelCapabilityError(modelMessage`cannot derive complete links for ${target.name}: effective fields are unavailable or ambiguous`, report());
    return effective.fields;
  };
  return { aliases, record, field, view, recordReference, resolveReference, spend, capability, assertValid, requireComplete, invalid, diagnostics: report, limits: { maxWork, maxDiagnostics }, get work() { return work; } };
}
