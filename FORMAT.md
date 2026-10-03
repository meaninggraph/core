# Meaning file format, draft 1

`meaning/draft-1`. A draft: it may change before `meaning/1`. This page is
what a second implementation needs beyond the JSON Schema
([`meaning.schema.json`](meaning.schema.json)), including everything the schema
cannot say. Where the schema and this page disagree, the schema wins and this
page has a bug. The reference checker is [`scripts/lib/meaning.mjs`](scripts/lib/meaning.mjs);
[`scripts/check.mjs`](scripts/check.mjs) runs it on this repository.

A meaning file says what the data in a dataset means: concepts with labels per
language, synonyms, a description, and bindings to ModelSpec entities and
properties.

## Files and discovery

- A meaning file is YAML and its name ends in `.meaning.yaml`.
- A repository's meaning files are the `*.meaning.yaml` files **directly in the
  repository root**. Subdirectories are not searched: a meaning file in a
  subdirectory is not part of the repository's concepts, and `scripts/check.mjs`
  fails on one rather than leave it silently unread.
- All files of a repository are one set of concepts. A file is packaging: its
  name and `id` are not part of any concept's address.
- Every file starts with `format: meaning/draft-1`.
- File `id`s are not checked for uniqueness; give each file in a repository a
  different one.

## Addresses and pinning

| Reference | Means |
|---|---|
| `country` | The concept `country` in the same repository |
| `meaning://github.com/meaninggraph/core/country` | The concept `country` in the repository `github.com/meaninggraph/core`: the host, then `{org}/{repo}`, and the last segment is the concept id |
| `meaning://github.com/meaninggraph/core/country?ref=<commit>` | The same, pinned |
| `modelspec:///chinook.Invoice` | The ModelSpec entity `Invoice` of module `chinook`, declared in the file's `models` (same repository), with `property:` beside it for a property |

**Pin by commit.** Write `?ref=` followed by the full 40-character commit id of
the version you read, on every reference to another repository:

```yaml
extends: meaning://github.com/meaninggraph/core/invoice?ref=<40-character commit id>
```

- A tool resolves the reference by fetching that commit of
  `https://{host}/{org}/{repo}` and reading the `*.meaning.yaml` files in its
  root. A commit never changes, so a result can be cached under its id.
- All references from one repository to another carry the **same** pin, across
  all the referring repository's files: the repository then reads one version
  of the other (as a `go.mod` does). Two pins, or a pinned and an unpinned
  reference, are an error.
- A branch or tag is accepted by the grammar and fetched the same way, but it
  can move; use a commit.
- To move to a newer version, change the id in every reference at once and
  re-run the checks.
- A reference to the repository's own address
  (`meaning://github.com/meaninggraph/core/person` inside this repository) is
  the same as the bare id and cannot carry `?ref=`.
- Concept ids in a published repository never change meaning. A different
  meaning is a new id; a retired concept is deprecated, not deleted, so pinned
  references keep resolving.

## Required fields

| Where | Required |
|---|---|
| file | `format`, `id`, `name`, `description`, `concepts` (at least one) |
| concept | `id`, `kind`, `labels` (with `en`), `description` |
| concept of kind `measure` | `measure`, with `formula` inside it |
| binding | `model`, `role`; and `property` for every role except `entity` |
| known value (`values`) | `id`, `labels` (with `en`) |
| source (`sources`) | `id`, `provider`, `dataset` |

Everything else is optional. `description` is plain English: what the concept
is and when to use it rather than a similar one. Unknown keys are errors
(`additionalProperties: false` throughout).

## Ids and case

- File ids and value ids: lowercase letters, digits and hyphens, at most 80
  characters. Concept ids: words of lowercase letters and digits joined by
  single hyphens, each word starting with a letter (`billing-country`, never
  `line-2`), at most 80 characters. Ids are compared exactly; there is no
  uppercase to fold.
- Host, `{org}/{repo}` and ModelSpec names in references are compared exactly as
  written, case included. Write hosts, orgs and repositories in lowercase.
- Labels and aliases are matched **ignoring case** (per Unicode lower-casing of
  the whole string; no trimming, no accent folding, no other normalisation),
  in any language. A dataset value matches by labels by default
  (`match: labels`).
- `match: codes.<code>` compares **exactly**, as strings: the stored value
  `840` equals the code `"840"`, but `32` does not equal `"032"`. Quote codes
  that start with a zero in YAML.
- A concept's `unit`, when `units-of` applies, is matched ignoring case against
  every label, alias and code of the unit entity's values.

## Kinds and the three relations

Kinds: `entity` (a thing with instances), `attribute` (a property of an
entity), `dimension` (an attribute that answers are grouped by), `measure` (a
number computed over many instances). Where data comes from is provenance
(`source:`, allowed on any kind), not a kind.

- **`of`**: the entity this concept belongs to (an attribute, dimension or
  measure of it; for an entity, a part of it). It must name an entity.
- **`extends`**: "is a kind of". It joins compatible kinds only: an entity
  extends an entity, a measure a measure, an attribute or a dimension an
  attribute or a dimension. A chain of `extends` may not return to a concept it
  passed (checked through any repository the chain reaches). It inherits
  synonyms (the parent's labels count as synonyms), `unit`, `values-of` and
  `units-of`, each only when the concept has none of its own. It never inherits
  `values`: an entity that extends another is not a list of its parent's
  instances.
- **`values-of`**: the values of this attribute or dimension are instances of
  that entity (`billing-country` has `values-of: country`). The entity must
  exist and be an entity. The known values come from `values-of` only: a
  concept's own `values`, or the `values` of the entity it names, never both
  (`values` with `values-of` is an error).
- **`units-of`**: amounts are expressed in a unit that is an instance of that
  entity (`money-amount` has `units-of: currency`). With it (own or inherited),
  `unit` must name exactly one value of that entity, by label, alias or code
  (`unit: USD`); a unit that names none, or two, is an error. The named entity's
  own `values` are searched.
- **Narrowing.** A concept that sets `values-of` or `units-of` while its parent
  already has one (own or inherited) must name the same entity or a kind of it
  (`manager` holds Chinook employees, a kind of the universal employee). It may
  narrow its parent's, never change it.

## Measures

- `inputs` are attributes or measures, never entities; `dimensions` are
  dimensions or attributes.
- `aggregation` (`sum`, `count`, `average`, `min`, `max`, `none`) says how
  values combine when grouped. **When it is absent it means `none`**: a tool
  must not combine the values across groups; it may list them. State `sum` for
  a measure that adds up.
- A **ratio** is a measure with a measure among its inputs, or one that extends
  a ratio. A ratio is recomputed per group from its inputs, so `sum`, `count`
  and `average` on one is an error; `none` (or absent), `min` and `max` are
  allowed.

## Uniqueness

- Concept ids are unique across all files of a repository; a duplicate is an
  error naming both files.
- Value ids are unique within a concept.
- One word does not name two values of a concept: a label or alias, compared
  ignoring case within a language, may appear on only one value.
- Source ids are unique within a file, and a concept's `source` names a source
  declared in the **same file**.
- Binding roles: a concept has at most one `entity` binding (see below).

Whether two concepts may share a synonym is not part of the format. This
repository does not allow it, unless one concept is a kind of the other.

## Words: synonyms and aliases

A word that names one thing in the world names it here: no bare `people` for
both person and population, no `dollar` or `$` for the US dollar (several
countries have a dollar) but `US dollar` or `US$`, no `pound` for the pound
sterling. A tool matches the words in a question against labels, synonyms and
aliases; an ambiguous word makes it guess.

## Bindings

A binding says where a concept's data is, in a ModelSpec model. `model` names
an entity (`modelspec:///{module}.{Entity}`), `property` one of its properties,
`role` what it holds. The module is one of the file's `models` (module short
name to source path, relative to the file).

| Role | Property | Means | Checked |
|---|---|---|---|
| `entity` | none | the rows of the entity are instances of the concept | entity exists |
| `identifier` | required | the property is the entity's key | on the concept's own entity; in the key |
| `display-name` | required | the name people know an instance by | on the concept's own entity; a string |
| `foreign-key` | required | the property references the entity whose rows are the concept's instances (its own `entity` binding, or that of its `values-of` entity) | a reference, to that entity |
| `value` | required | the property holds the concept's value | not a reference |

- Allowed roles by kind: entity: `entity`, `identifier`, `display-name`,
  `foreign-key`; attribute and dimension: `value`, `foreign-key` (a
  foreign-key attribute needs `values-of`); measure: `value`.
- **One entity binding per concept.** `identifier` and `display-name` must be on
  that entity; with no entity binding they cannot be checked, which is an
  error.
- A `foreign-key` is checked against the entity binding of its target concept
  (the concept itself for an entity, otherwise the concept named by `values-of`).
  A target with no entity binding **in this repository** cannot be checked,
  which is an error: bind the target, or a concept of this repository that
  extends it.
- **Same-repository models only.** The schema accepts
  `modelspec://{host}/{org}/{repo}/{module}.{Entity}` so that the address
  grammar is stable, but draft 1 defines no way to fetch another repository's
  model: a conforming checker reports a binding to another repository as an
  error.
- `match` (roles `value` and `display-name` only): how stored values name the
  concept's known values, `labels` (default) or `codes.<code>`. A dataset check
  requires every distinct stored value (nulls aside) to name exactly one known
  value.
- A measure's `inputs` name what it is computed from; they are not bindings.
  Bind a measure only to a column that stores the measure itself.
- Universal concepts, such as the ones in this repository, carry no bindings:
  they are dataset-specific and belong in the dataset's repository.

## What a checker reports

1. a file that breaks the schema;
2. a reference that does not resolve (unknown concept, unknown repository, a
   pin that cannot be fetched, a remote repository without a pin);
3. mixed pins for one repository;
4. `of`, `values-of` or `units-of` naming a concept that is not an entity;
5. `extends` joining incompatible kinds, or forming a cycle;
6. `values-of` or `units-of` that changes what its parent names;
7. a unit that does not name exactly one value of its `units-of` entity;
8. `inputs` that are not attributes or measures; `dimensions` that are not
   dimensions or attributes;
9. `sum`, `count` or `average` on a ratio;
10. a duplicate concept id, value id, source id, or a word naming two values;
11. a `source` that is not declared in the file;
12. a binding to an unlisted module, a missing entity or property, another
    repository, or one whose role does not fit the model.
