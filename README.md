# MeaningGraph core concepts

Concepts that are not specific to any dataset, in the meaning-file format
`meaning/draft-1`: [`meaning.schema.json`](meaning.schema.json) is its JSON
Schema and [`FORMAT.md`](FORMAT.md) is the format reference. A dataset's
meaning file reuses these concepts by address, for example
`meaning://github.com/meaninggraph/core/country?ref=<commit>`, and binds its own
columns to them.

| File | Concepts |
|---|---|
| `geo.meaning.yaml` | country (a starter subset with ISO 3166-1 codes, English and Russian names, aliases such as "USA"), country-code, city, population |
| `assets.meaning.yaml` | currency (USD, EUR, GBP), money-amount |
| `commerce.meaning.yaml` | customer, invoice, invoice-line, invoice-total, price, unit-price, quantity, revenue |
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
- The schema is in the same checkout, so `meaning.schema.json` at your pin is the
  schema your concepts were written against.

A concept's meaning never changes under the same id; a different meaning gets
a new id, and old concepts are deprecated, not deleted, so pinned references
keep resolving. [`FORMAT.md`](FORMAT.md) has the rest: required fields, case and
default rules, uniqueness, bindings and what a checker reports.

Draft: the format may change before `meaning/1`, and the value lists are starter
subsets, not the full ISO lists.

## Checks

```sh
npm ci
npm run check   # every *.meaning.yaml against the schema, then the cross-concept rules
npm test        # the checks fail on each kind of broken file
```

CI runs both on every pull request (`.github/workflows/check.yml`). Besides the
schema and the cross-concept rules in `FORMAT.md`, this repository requires
`license: CC0-1.0` in every file, no `bindings` or `models` (they belong to
datasets), no meaning file outside the root, and no label or synonym shared by
two concepts in a language unless one is a kind of the other.

`scripts/lib/meaning.mjs` and `scripts/lib/modelspec.mjs` are byte-for-byte
copies of the checker in [`datatug/chinookdb`](https://github.com/datatug/chinookdb)
(`scripts/lib/`, commit `ae1f505db35fcecf1ff16c8ba3dbb293b7d50dda`),
which checks its own meaning file with the same code. They are copied rather
than imported because the checker has no package of its own yet and chinookdb
reads this repository at a pinned commit, so a dependency the other way would be
circular; once a pinned commit of this repository contains them, chinookdb can
read them from its pin and drop its copy. Change them there and copy them back
whole.

## Licence

Everything in this repository, the schema, the checks and `FORMAT.md` included,
is dedicated to the public domain under [CC0-1.0](LICENSE): copy it, vendor it
and change it without attribution. ISO codes are facts; names and descriptions
are original. The two checker files copied from chinookdb (MIT there) are
CC0-1.0 here, as their author's dedication. A vendored copy of the concept
files keeps this README and the `LICENSE` file byte for byte.
