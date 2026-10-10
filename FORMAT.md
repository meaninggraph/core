# Meaning file format, draft 2

`meaning/draft-2`. A draft: it may change before `meaning/1`. This page is
what a second implementation needs beyond the JSON Schema
([`meaning.draft-2.schema.json`](meaning.draft-2.schema.json)), including
everything the schema cannot say. Where the schema and this page disagree, the
schema wins and this page has a bug. The reference checker is
[`scripts/lib/meaning.mjs`](scripts/lib/meaning.mjs);
[`scripts/check.mjs`](scripts/check.mjs) runs it on this repository.

There are two formats, and a reader that knows both reads both:

- `meaning/draft-2` (this page) is the newer one: the kind `property`, the
  binding key `field:`, the roles `instances` and `reference`, and the kind
  `value-set`.
- `meaning/draft-1` is the earlier one, with its own schema,
  [`meaning.schema.json`](meaning.schema.json). [How draft 1 differs](#how-draft-1-differs)
  says exactly where. A reader reads it in full and reports one notice for each
  draft-1 file of the graph it checks, and none for a graph that is only pinned.

At this commit only this repository's checker reads `meaning/draft-2`; no
released reader does yet. At the time of writing (10 October 2026) the newest
release of `meaninggraph/cli`, `v0.3.0`, validates against a schema whose
`format` is the one value `meaning/draft-1` and expects a refusal for a file that
says `meaning/draft-2`, and the registry still checks graphs with the checker of
an earlier commit of this repository. Published graphs stay in `meaning/draft-1`
until the readers are released.

A meaning file says what the data in a dataset means: concepts with labels per
language, synonyms, a description, and bindings to ModelSpec record types and
fields.

Decisions about this format are recorded in
[`spec/decisions/`](spec/decisions/README.md):
[0001](spec/decisions/0001-derived-links-and-two-role-names.md),
[0002](spec/decisions/0002-kind-property-binding-key-field-and-the-format-identifier.md)
and [0003](spec/decisions/0003-value-sets.md). A decision changes this page only
when the page is changed to match it. The approval of draft 1 is recorded in the
draft-1 format proposal in the repository `sneat-co/meaninggraph` (not
published).

## Files and discovery

- A meaning file is YAML and its name ends in `.meaning.yaml`.
- A repository's meaning files are the `*.meaning.yaml` files **directly in the
  repository root**. Subdirectories are not searched: a meaning file in a
  subdirectory is not part of the repository's concepts, and `scripts/check.mjs`
  fails on one rather than leave it silently unread.
- All files of a repository are one set of concepts, which is one **graph** (the
  files one reader loads as one graph). A file is packaging: its name and `id`
  are not part of any concept's address.
- Every file carries `format: meaning/draft-1` or `format: meaning/draft-2`. The
  key's value decides, wherever the key stands in the file. A file with no `format`,
  or with another value, is an error: `format must be meaning/draft-1 or
  meaning/draft-2`. The reference checker reports that error alone for such a
  file (rule `schema`, whether or not it is given a schema to validate with):
  the words of a file with no known format belong to no format, so it reads
  nothing else in the file and gives it no `earlier-format` notice.
- **One graph, one format.** The files of one graph refer to each other by bare
  id, so they change format together. A graph whose files are in two formats is
  an error (`format-mixed`). Two graphs may differ: a graph in one format may
  pin a graph in the other ([Reading both formats](#reading-both-formats)).
- File `id`s are not checked for uniqueness; give each file in a repository a
  different one.

## Addresses and pinning

| Reference | Means |
|---|---|
| `country` | The concept `country` in the same repository |
| `meaning://github.com/meaninggraph/core/country` | The concept `country` in the repository `github.com/meaninggraph/core`: the host, then `{org}/{repo}`, and the last segment is the concept id |
| `meaning://github.com/meaninggraph/core/country?ref=<commit>` | The same, pinned |
| `modelspec:///chinook.Invoice` | The ModelSpec record type `Invoice` of module `chinook`, declared in the file's `models` (same repository), with `field:` beside it for a field |

**Pin by commit.** Write `?ref=` followed by the full 40-character commit id of
the version you read, on every reference to another repository:

```yaml
extends: meaning://github.com/meaninggraph/core/invoice?ref=<40-character commit id>
```

- A tool resolves the reference by fetching that commit of
  `https://{host}/{org}/{repo}` and reading the `*.meaning.yaml` files in its
  root. A commit never changes, so a result can be cached under its id. A tool
  may restrict which sources it fetches (an allow-list of hosts or
  repositories, say) and report the rest as unresolvable; the grammar accepts
  any `{host}` followed by one or more path segments before the concept id,
  deeper paths included.
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
  the same as the bare id and cannot carry `?ref=`. This holds when another
  repository reads that one too: inside a pinned repository, a reference to its
  own address (without `?ref=`) names a concept of that same pinned version, so
  inheritance, cycles and ratios follow it. Within a repository, prefer bare
  ids.
- Concept ids in a published repository never change meaning. A different
  meaning is a new id; a retired concept is deprecated, not deleted, so pinned
  references keep resolving.

## Required fields

| Where | Required |
|---|---|
| file | `format`, `id`, `name`, `description`, `concepts` (at least one) |
| concept | `id`, `kind`, `labels` (with `en`), `description` |
| concept of kind `measure` | `measure`, with `formula` inside it |
| concept of kind `value-set` | `values` (at least one) |
| binding | `model`, `role`; and `field` for every role except `instances` |
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
  every label, alias and code of the named concept's values.

## Kinds and the four relations

Kinds: `entity` (a thing with instances), `property` (a property of an
entity), `dimension` (a property that answers are grouped by), `measure` (a
number computed over many instances), `value-set` (a list of known values, the
counterpart of ModelSpec's enum). Where data comes from is provenance
(`source:`, allowed on any kind), not a kind.

For `of`, `values-of`, `units-of` and `extends`, an `entity` and a `value-set`
are one class: wherever this page says "an entity" for the target of one of
them, a value set is allowed too.

- **`of`**: the entity or value set this concept belongs to (a property,
  dimension or measure of it; for an entity, a part of it). It must name an
  entity or a value set.
- **`extends`**: "is a kind of". It joins compatible kinds only: an entity or a
  value set extends an entity or a value set, a measure a measure, a property
  or a dimension a property or a dimension. A chain of `extends` may not return
  to a concept it passed (checked through any repository the chain reaches). It
  inherits synonyms (the parent's labels count as synonyms), `unit`,
  `values-of`, `units-of` and a measure's `aggregation`, each only when the
  concept has none of its own. It never inherits `values`: an entity that
  extends a value set is not a list of the value set's values.
- **`values-of`**: the values of this property or dimension are instances of
  that entity or value set (`billing-country` has `values-of: country`). It
  must exist and be an entity or a value set. The known values of a concept are
  the `values` of the concept its `values-of` names (its own, or the nearest
  one inherited through `extends`). A property or a dimension carries no list of
  its own.
- **`units-of`**: amounts are expressed in a unit that is an instance of that
  entity or value set (`money-amount` has `units-of: currency`). With it (own
  or inherited), `unit` must name exactly one value of the named concept, by
  label, alias or code (`unit: USD`); a unit that names none, or two, is an
  error, whether the list is open or not. The named concept's own `values` are
  searched.
- **Narrowing.** A concept that sets `values-of` or `units-of` while its parent
  already has one (own or inherited) must name the same concept or a kind of it
  (`manager` holds Chinook employees, a kind of the universal employee). It may
  narrow its parent's, never change it.

## Value sets

A value set is a concept of kind `value-set` that carries `values`: the list of
the values known so far. `values` is allowed on a value set and nowhere else.

```yaml
- id: order-status-list
  kind: value-set
  labels: {en: Order status}
  description: The states an order passes through.
  values:
    - {id: open, labels: {en: Open}}
    - {id: shipped, labels: {en: Shipped}}
    - {id: on-hold, labels: {en: On hold}, retired: true}
```

- A value has `id` and `labels` (with `en`), and optionally `aliases`, `codes`
  and `retired`. A value set has at least one value. It may also carry
  `synonyms`, `source`, `of`, `extends` and `complete`. It may not carry
  `values-of`, `units-of`, `unit`, `measure` or `bindings`.
- A value set **extends** a value set or an entity, and an entity may extend a
  value set. A value set is not a property, a dimension or a measure: a
  measure's `inputs` and `dimensions` may not name it.
- **A value set is open.** Its list means "values known so far", never "all
  values allowed". A stored value that matches no known value is reported as
  unknown, not as an error, unless the set is marked `complete: true`. A
  complete set (the days of the week) says so; for it an unmatched stored value
  is an error.
- **A value's id never changes meaning and is never deleted.** A value that
  splits in two gets two new ids, and the old one is marked `retired: true`.
  This is an obligation on whoever edits a published value set; no checker
  enforces it, because that needs two commits of a graph.
- A **retired** value keeps its entry and its id. It still matches a stored
  value or a `unit` (reported as a notice, `retired-value`), and its words still
  count for the rule that one word names one value.
- A list on an entity, an attribute or a dimension in a `meaning/draft-1` file has
  no marker and is complete.
- Tying the rows of a lookup table to the values of a value set is not part of
  the format: a lookup table is a concept of kind `entity` that extends the
  value set and is bound to the record type. A project cannot add values of its
  own to a value set that another graph owns, and no checker compares the
  values of a model's enum with a value set.

## Measures

- `inputs` are properties or measures, never entities or value sets;
  `dimensions` are dimensions or properties.
- `aggregation` (`sum`, `count`, `average`, `min`, `max`, `none`) says how
  values combine when grouped. **When it is absent it means `none`**: a tool
  must not combine the values across groups; it may list them. State `sum` for
  a measure that adds up. A measure that extends another and states no
  aggregation of its own **inherits the nearest one** along `extends`, as
  `unit` does (it means `none` only when no measure on the chain states one),
  so a ratio that extends a measure which sums must say `aggregation: none`.
- A **ratio** is a measure with a measure among its inputs, or one that extends
  a ratio. A ratio is recomputed per group from its inputs, so `sum`, `count`
  and `average` on one is an error; `none` (or absent), `min` and `max` are
  allowed.

## Uniqueness

- Concept ids are unique across all files of a repository; a duplicate is an
  error naming both files.
- Value ids are unique within a concept.
- One word does not name two values of a concept: a label or alias, compared
  ignoring case and **across languages** (values are matched in any language),
  may appear on only one value, retired or not. One value may repeat its own
  word.
- Source ids are unique within a file, and a concept's `source` names a source
  declared in the **same file**.
- Binding roles: a concept has at most one `instances` binding, counted under
  both names of the role (see below).

Whether two concepts may share a synonym is not part of the format. This
repository does not allow it within a language, unless one concept is a kind of
the other; a language counts when the concept has a label or synonyms in it.

## Words: synonyms and aliases

A word that names one thing in the world names it here: no bare `people` for
both person and population, no `dollar` or `$` for the US dollar (several
countries have a dollar) but `US dollar` or `US$`, no `pound` for the pound
sterling. A tool matches the words in a question against labels, synonyms and
aliases; an ambiguous word makes it guess.

## Bindings

A binding says where a concept's data is, in a ModelSpec model. `model` names
a record type (`modelspec:///{module}.{Record}`), `field` one of its fields,
`role` what it holds. The module is one of the file's `models` (module short
name to source path, relative to the file).

| Role | Field | Means | Checked |
|---|---|---|---|
| `instances` | none | the rows of the record type are instances of the concept | record type exists |
| `identifier` | required | the field is the record type's key | on the concept's own record type; in the key |
| `display-name` | required | the name people know an instance by | on the concept's own record type; a string |
| `reference` | required | the field references the record type whose rows are the concept's instances (its own `instances` binding, or that of its `values-of` concept) | a reference, to that record type |
| `value` | required | the field holds the concept's value | not a reference |

The earlier names `entity` (for `instances`) and `foreign-key` (for
`reference`) are accepted in both formats, in every place the current names are.

- Allowed roles by kind: entity: `instances`, `identifier`, `display-name`,
  `reference`; property and dimension: `value`, `reference` (a `reference`
  needs `values-of`); measure: `value`; value set: none (a value set carries no
  bindings).
- **One instances binding per concept.** `identifier` and `display-name` must
  be on that record type; with no `instances` binding they cannot be checked,
  which is an error.
- A `reference` is checked against the `instances` binding of its target concept
  (the concept itself for an entity, otherwise the concept named by `values-of`).
  A target with no `instances` binding **in this repository** cannot be checked,
  which is an error: bind the target, or a concept of this repository that
  extends it. A written line never overrides the model: a `reference` on a field
  that is not a reference, a `reference` to another record type than the
  concept's instances, an `identifier` that is not in the key and a `value` on a
  reference are all errors.
- **Same-repository models only.** The schema accepts
  `modelspec://{host}/{org}/{repo}/{module}.{Record}` so that the address
  grammar is stable, but the format defines no way to fetch another repository's
  model: a conforming checker reports a binding to another repository as an
  error.
- `match` (roles `value` and `display-name` only): how stored values name the
  concept's known values, `labels` (default) or `codes.<code>`. A dataset check
  requires every distinct stored value (nulls aside) to name exactly one known
  value, with the difference that a value set is open: see [Value sets](#value-sets),
  above. In a draft-1 file an entity that carries `values` is checked against its
  own list; in a draft-2 file an entity that extends a value set is not checked
  against it.
- A measure's `inputs` name what it is computed from; they are not bindings.
  Bind a measure only to a column that stores the measure itself.
- Universal concepts, such as the ones in this repository, carry no bindings:
  they are dataset-specific and belong in the dataset's repository.

### Derived links

A *link* is one fact of the form "this record type, or this field, holds this
concept in this role". A *written link* comes from a binding line. A *derived
link* is computed from the model and is never written. A binding line that only
restates what the model already says is therefore optional, in both formats.

The rule in short: for a field that refers to a record type, each concept bound
to that record type with role instances applies to the field, with role
reference, marked as derived. If no concept is bound to the target, nothing is
derived; if two are, both apply. In the same way, the key of a record type bound
to a concept identifies that concept, with role identifier. A hand-written line
for the same field and concept takes the place of the derived one, and brings
its note.

Made exact:

1. **Inputs.** One graph that passes the check, and, for each meaning file with a
   `models` map and each module in it, the model at that path. The rule needs
   from a model the record types by name; for each record type its key (the
   field names in written order, empty when there is none); and for each field
   whether it is a reference and, if so, the target exactly as written. Nothing
   else is an input: no data, no other graph, no model of another repository.
   For a graph that does not pass the check the result is not defined, and a
   reader must not show derived links for it.
2. **Identity.** A link is identified by the concept id, the module short name,
   the record type name, the field name (absent for `instances`) and the role,
   with the earlier role names replaced by the current ones.
3. **Written links.** Each binding line gives one written link, keeping its
   `note` and `match`. A line that repeats the five parts of an earlier line of
   the same concept adds nothing; the earlier line's note stands.
4. **Derived references.** For each written link with role `instances`, with
   concept C, module m and record type T: for every record type R of the model
   of m (R may be T) and every field X of R that is a reference whose target, as
   written, is exactly the name T, the link (C, m, R, X, `reference`) is a
   candidate.
5. **Derived identifiers.** For the same C, m and T, and every field name K in
   the key of T that T declares, the link (C, m, T, K, `identifier`) is a
   candidate: a key of several fields gives one per field, a record type with no
   key gives none, and a key name that T does not declare gives none.
6. **Replacement.** A candidate whose five parts equal those of a written link
   is dropped: the written link stands in its place, with its note. Every other
   candidate is a derived link, with no note and no `match`.
7. **Order.** The written and the derived links together, sorted by concept id,
   then module, then record type, then field (absent first), then role,
   comparing bytes.

Consequences: a reference written with the module name in front (`shop.Customer`)
derives nothing, nor does a reference to a record type the model does not
declare; only a concept with an `instances` binding receives derived links, so a
property that names a reference through `values-of` keeps needing its written
line; two concepts bound to one record type both apply; another role on the same
field and concept does not replace the derived link.

A reader that shows links marks a derived one. The reference checker's canonical
form (`deriveLinks`, and `links` of `checkMeaningReport`, which is `null` when
the caller does not pass `derive: true` or the check found a problem) is a JSON array of
objects with `concept`, `model` (`modelspec:///module.Name`), `field` (unless
the role is `instances`), `role` (always the current name), `note` and `match`
when the written line has them, and `"derived": true` on a derived link only.

## Reading both formats

A reader validates a file against the schema of the file's own format, then
reads the earlier words as the current ones before it applies any rule that
looks at more than one concept:

| As written | Read as |
|---|---|
| `kind: attribute` (draft 1 only) | `property` |
| `property:` on a binding (draft 1 only) | `field` |
| `role: entity` (either format) | `instances` |
| `role: foreign-key` (either format) | `reference` |

After that one set of rules serves both formats. A graph that is draft-1
throughout is accepted or refused as it was before draft 2, the two new role
names aside. The reference checker does not validate a graph it merely resolves
(below), so it reads the kinds `value-set` and `property` only from a file that
says `meaning/draft-2`: in a file that says `meaning/draft-1`, or says nothing,
they are no kind it knows, and a draft-1 graph that names such a concept (with
`of`, `values-of`, `units-of`, `extends`, `inputs` or `dimensions`) is refused as
it was before draft 2.

When a graph of one format pins a graph of the other, the single vocabulary
means: `extends` between an `attribute` in one and a `property` or a `dimension`
in the other is allowed, in both directions; a measure's `inputs` and
`dimensions` may name the other format's properties or attributes; `of`,
`values-of`, `units-of` and `extends` in a draft-1 file may name a value set of a
draft-2 graph; and a draft-2 file may name, with `values-of` or `units-of`, a
draft-1 entity that carries `values`, whose list is the known values. Each file
is validated against the schema of its own format, whichever graph it belongs
to. Whether a list is open or complete is decided by the file that holds it. The
reference checker does not validate a graph it merely resolves.

## How draft 1 differs

Draft 2 is draft 1 with the changes below. Everything else is the same.

| | `meaning/draft-1` | `meaning/draft-2` |
|---|---|---|
| Format line | `format: meaning/draft-1` | `format: meaning/draft-2` |
| Schema | `meaning.schema.json` | `meaning.draft-2.schema.json` |
| Kind of a property | `attribute` | `property` (`attribute` is an error) |
| Binding key | `property:` | `field:` (`property:` is an error) |
| Kind for a list of values | none: `values` on an `entity`, `attribute` or `dimension` | `value-set`; `values` is allowed on it and nowhere else |
| `of`, `values-of`, `units-of`, `extends` | name, within one graph, an entity (`extends`: an entity only extends an entity) | name an entity or a value set (an entity may extend a value set; a value set may extend a value set or an entity) |
| `values` together with `values-of` on one concept | an error | an error (`values` is allowed only on a value set, which may not carry `values-of`) |
| Display names of a bound entity | an entity that carries `values` has its stored display names matched against that list | an entity carries no `values`; one that extends a value set is not compared with it (no problem, no notice) |
| Stored values against a list | every stored value must name exactly one known value | a value set is open: an unmatched stored value is a notice unless `complete: true`; `retired: true` on a value |
| Role names | `entity`, `foreign-key`; `instances` and `reference` are also accepted | `instances`, `reference`; `entity` and `foreign-key` are also accepted (a notice) |
| Derived links | the rule above applies | the rule above applies |
| Measure `inputs` | attributes and measures | properties and measures |

The two role names `instances` and `reference` are valid in a draft-1 file too:
they are new spellings no old file uses, so draft 1 gained them in place.
`meaning.schema.json` accepts them and is otherwise the draft-1 schema. A reader
takes its schema and its rule code from the same release; a reader that does not
know `instances` must not validate with a schema that does.

A file uses the word *property* in one sense only, and its `format` says which:
a draft-1 file says `kind: attribute` and `property:`, a draft-2 file says
`kind: property` and `field:`. A word of the other format is refused by the
schema and reported beside it, with the rule `format-word`, naming the format the
word belongs to (`kind property belongs to meaning/draft-2; in meaning/draft-1 it
is written attribute`).

## What a checker reports

Errors:

1. a file that breaks the schema of its format, or whose `format` is neither
   identifier (rule `schema`);
2. a word of the other format (`format-word`), and files of one graph in two
   formats (`format-mixed`);
3. a reference that does not resolve (unknown concept, unknown repository, a
   pin that cannot be fetched, a remote repository without a pin);
4. mixed pins for one repository;
5. `of`, `values-of` or `units-of` naming a concept that is not an entity or a
   value set;
6. `extends` joining incompatible kinds, or forming a cycle;
7. `values-of` or `units-of` that changes what its parent names;
8. a unit that does not name exactly one value of its `units-of` concept;
9. `inputs` that are not properties or measures; `dimensions` that are not
   dimensions or properties;
10. `sum`, `count` or `average` on a ratio, stated or inherited through
    `extends`;
11. a duplicate concept id, value id, source id, or a word naming two values
    (in any language);
12. a `source` that is not declared in the file;
13. a binding to an unlisted module, a missing record type or field, another
    repository, or one whose role does not fit the model.

Notices, which never change a verdict: `earlier-format` (one for each file of
the checked graph that is in `meaning/draft-1`, none for a pinned graph; the file
is read in full), `earlier-role-name` (one per
draft-2 file that uses `entity` or `foreign-key`), `unknown-value` (a stored
value that matches no value of an open list), `retired-value` (a stored value or
a `unit` that names a retired value).

A dataset check of stored values refuses a file whose format it does not know
before it reads any binding, so that it cannot pass a file with nothing checked.
