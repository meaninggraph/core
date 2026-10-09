# MeaningGraph core concepts

Concepts that are not specific to any dataset, in the meaning-file format
`meaning/draft-1`. [`FORMAT.md`](FORMAT.md) is the format reference: it describes
the current format, `meaning/draft-2` (JSON Schema:
[`meaning.draft-2.schema.json`](meaning.draft-2.schema.json)), and says exactly
how the earlier `meaning/draft-1` (JSON Schema:
[`meaning.schema.json`](meaning.schema.json)) differs. The files here are still
in `meaning/draft-1`. A dataset's
meaning file reuses these concepts by address, for example
`meaning://github.com/meaninggraph/core/country?ref=<commit>`, and binds its own
columns to them.

| File | Concepts |
|---|---|
| `geo.meaning.yaml` | country (a starter subset with ISO 3166-1 codes, English and Russian names, aliases such as "USA"), country-code, city, population |
| `assets.meaning.yaml` | currency (USD, EUR, GBP), money-amount, fx-reference-quote, fx-reference-date, fx-base-currency, fx-quote-currency, indicative-fx-reference-rate |
| `commerce.meaning.yaml` | customer, order, order-line, commercial-line-item, invoice, invoice-line, invoice-total, price, unit-price, quantity, revenue |
| `identity.meaning.yaml` | person, organization, employee, manager |
| `calendar.meaning.yaml` | date |
| `statistics.meaning.yaml` | per-capita (a pattern for ratios) |

## Which files are read

A repository's concepts are the `*.meaning.yaml` files **directly in the
repository root**. Subdirectories do not count: a meaning file in one is never
read, and the checks here fail on it. The file a concept sits in is packaging,
not part of its address, so concept ids are unique across the whole root: a
reference names the repository and the concept, never the file.

## Using a concept: pin a commit

Refer to a concept as `meaning://github.com/meaninggraph/core/<concept-id>` and
pin the version with `?ref=` and a full commit id:

```yaml
- id: customer
  kind: entity
  extends: meaning://github.com/meaninggraph/core/customer?ref=4214bc73cbfcc706c0ea9c8873eba991d9ddbb91
```

- Use one pin for every reference to this repository, across all your files; a
  tool reads one version of it.
- Prefer a commit id to a branch or tag: a commit never changes, so a tool can
  cache the checkout under its id.
- To take newer concepts, change the id in every reference at once and re-run
  your checks.
- The schemas are in the same checkout, so `meaning.schema.json` (draft 1) and
  `meaning.draft-2.schema.json` (draft 2) at your pin are the schemas your concepts
  were written against.

A concept's meaning never changes under the same id; a different meaning gets
a new id, and old concepts are deprecated, not deleted, so pinned references
keep resolving. [`FORMAT.md`](FORMAT.md) has the rest: required fields, case and
default rules, uniqueness, bindings and what a checker reports.

Draft: the format may change before `meaning/1`, and the value lists are starter
subsets, not the full ISO lists.

## Checks

```sh
npm ci
npm run check   # every *.meaning.yaml against the schema of its format, then the cross-concept rules
npm test        # the checks fail on each kind of broken file; the conformance cases of both formats; the ModelSpec reader reads both spellings
```

CI runs both on every pull request (`.github/workflows/check.yml`). Besides the
schema and the cross-concept rules in `FORMAT.md`, this repository requires
`license: CC0-1.0` in every file, no `bindings` or `models` (they belong to
datasets), no meaning file outside the root, and no label or synonym shared by
two concepts in a language unless one is a kind of the other.

`scripts/lib/meaning.mjs` and `scripts/lib/modelspec.mjs` began as byte-for-byte
copies of the checker in [`datatug/chinookdb`](https://github.com/datatug/chinookdb)
(`scripts/lib/`, commit `ae1f505db35fcecf1ff16c8ba3dbb293b7d50dda`). They are
not copies any more, and neither repository is the source of the other:

- `scripts/lib/meaning.mjs` is maintained here. Where it checks a binding
  against a model it reads the model's record types, members and references in
  the vocabulary the model's format identifier names. It reads both meaning
  formats, `meaning/draft-1` and `meaning/draft-2` (see `FORMAT.md`); the
  functions it exported before (`checkMeaning`, `checkoutGit`, `indexConcepts`,
  `pinsOf`, and the rest) keep their shapes, and `checkMeaningReport`,
  `deriveLinks` and `valueCoverageReport` are added. chinookdb keeps its own, older copy of
  the file and checks its meaning file with the `meaninggraph` command-line
  tool, so the two no longer move together.
- `scripts/lib/modelspec.mjs` is the ModelSpec reader of the
  [ModelSpec registry](https://github.com/modelspec-org/registry)
  (`scripts/lib/modelspec.mjs`), ported: it reads both spellings of ModelSpec
  (`record`, `field`, `record =`, format `1.0-draft-2`; and the earlier `entity`,
  `property`, `entity =`, format `1.0-draft`), refuses the removed and reserved
  constructs, and keeps names in objects without a prototype, so a name such as
  `constructor` or `toString` is an ordinary name. Only the functions this
  repository calls are taken, plus a comparison with published data that the
  registry does not have. The dataset repositories
  [`demo-db/chinook`](https://github.com/demo-db/chinook) and
  [`demo-db/northwind`](https://github.com/demo-db/northwind) carry the same
  code; the files differ only in their header comments, and
  `scripts/test-modelspec.mjs` is the same file in each.

There is no mechanical sync. A change to how ModelSpec is read is made in the
registry's reader first, then ported to this file and to the dataset copies in
the same way, with `scripts/test-modelspec.mjs` run in each repository. The files are
copied rather than imported because the checker has no package of its own yet.

## Licence

Everything in this repository, the schema, the checks and `FORMAT.md` included,
is dedicated to the public domain under [CC0-1.0](LICENSE): copy it, vendor it
and change it without attribution. ISO codes are facts; names and descriptions
are original. The two checker files that began as copies of chinookdb's (MIT
there) are CC0-1.0 here, as their author's dedication, and the ModelSpec reader
ported into one of them comes from the registry, which is CC0-1.0. A vendored copy of the concept
files keeps this README and the `LICENSE` file byte for byte.
