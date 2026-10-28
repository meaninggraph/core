---
format: https://specscore.md/decision-specification
status: Approved
---

# Decision: One format, and value-set transitions, inverse words and deprecation

**Status:** Approved
**Date:** 2026-10-28
**Owner:** trakhimenok
**Tags:** format, identifier, value-sets, deprecation
**Source Idea:** value-set-transitions-and-inverse-labels
**Supersedes:** —
**Superseded By:** —

## Context

How to read this record. As in decisions 0001 to 0003, three kinds of statement
appear, and each is labelled:

- **The owner's words**, quoted exactly, with their date and time.
- **On record**: what a file or a pull request says, with a place to find it. The
  conversation in which the owner answered is not published.
- **Recorder's account**: what the session writing this file says or infers. It is
  not the owner's ruling, whatever its tone.

Times are local to the owner, which on 27 October 2026 was UTC. "The session" is the
assistant session he was talking with.

**On record.** On 27 October 2026 the SpecScore specification work replaced
GraphSpec with MeaningGraph for domain vocabulary (`specscore/specscore` pull
request 70, decision 0015 there). Two things GraphSpec expressed belong to the data
and were missing here: which changes between the values of a value set are
possible, and the name of the reverse direction of a reference property. The idea
[value-set-transitions-and-inverse-labels](../ideas/value-set-transitions-and-inverse-labels.md)
proposed them, with a third addition, a marker for a deprecated concept, found in
its review: `FORMAT.md` said a retired concept "is deprecated, not deleted" but no
key recorded it.

**On record.** At `3b5f1ab` (27 October 2026) this repository's graphs were in
`meaning/draft-1`; `meaninggraph/cli` at `c488f86` (23 October 2026) read only
`meaning/draft-1`; the 12 other registered graphs (`meaninggraph/registry`
`index.json`) were all in `meaning/draft-1`; only this repository's checker read
`meaning/draft-2`.

## Decision

### Part a: where the new keys go

**The owner's words.** At 23:49, asked whether to add the keys to `meaning/draft-2`
or wait for a `meaning/draft-3`:

> I delegate this decision to you, I don’t mind either

**Recorder's account.** The session chose `meaning/draft-2`, because no released
reader and no published graph used it.

### Part b: one format, a clean cut

**The owner's words.** At 23:52:

> Can we actually unify to single draft? The second one?
>
> I don’t care about backward compatibility yet. We can update our repos with a clean cut?

The session answered with the scope: core's format, schema, checker and graphs; the
`meaninggraph/cli` reader; the 12 registered dataset graphs; the registry; the site;
CodeGrapher; and a SpecScore plan task, one pull request per repository, none merged,
tagged or deployed by the session. At 23:53:

> Approved, go ahead as suggested

**Recorder's account.** So `meaning/draft-2` is the only format. `meaning/draft-1` is
withdrawn: its schema `meaning.schema.json` is deleted, readers refuse it like any
unknown format, and every registered graph is rewritten in draft 2. The format
identifier stays `meaning/draft-2`, so a file that already says it stays valid.

### Part c: transitions, initial values, inverse words, deprecation

**On record.** At 22:34 the owner answered the session's proposal of a SpecScore
behavior layer over MeaningGraph, which named these additions: "Yes, agreed. Draft
idea, specs, and implementation plan and get them reviewed by Fable." The idea was
reviewed by an independent agent and changed as its findings asked.

**Recorder's account.** `FORMAT.md` now specifies, as the idea proposed: `transitions`
and `initial` on a value set, over its own values, never inherited; `inverse` words
on a property or dimension with `values-of`, with no id or address; `deprecated: true`
and `replaced-by` on any concept, with the notice `deprecated-concept`; and the
same-repository form `meaning:///{concept}`, which SpecScore specifications need
(a bare word in Markdown cannot be told from prose).

### Not decided by the owner: meaning files of dataset repositories

**Recorder's account.** All 12 registered dataset graphs keep their meaning file in a
subdirectory (`model/<id>.meaning.yaml`). The session had recommended allowing
declared subdirectory paths, and the owner's "as suggested" covers that
recommendation. While implementing it, the session found that a resolver reads the
root of a repository for `meaning://{host}/{org}/{repo}/…`, so concepts of a graph
kept in a subdirectory cannot be referenced from another repository, and that a
directory in the address would be ambiguous for hosts with nested groups. It
therefore kept the root-only rule and moved the 12 files to their repositories'
roots, pointing `models` at the subdirectory. This departs from what the owner
approved and is put to him in the pull requests; until he answers it is the
session's choice, not his.

## Rationale

**The owner's words,** at 23:52: "I don’t care about backward compatibility yet."

**Recorder's account.** With no released reader of draft 2 and every graph owned by
the same people, one format costs a single coordinated change and removes the
two-vocabulary reading from every reader, the format-mixed and format-word rules and
the draft-1 schema.

## Declined Alternatives

### Add the keys to draft 2 and keep draft 1

The session's choice at 23:49, before the owner asked for one format.

### A new `meaning/draft-3`

Offered at 23:49; the owner delegated, and the session declined it because nothing
used draft 2 yet.

## Consequences at Decision Time

Recorder's account, written on 28 October 2026.

- `FORMAT.md`, `meaning.draft-2.schema.json` and `scripts/lib/meaning.mjs` describe
  and check one format; `meaning.schema.json` is deleted.
- The 11 graphs of this repository are rewritten in draft 2 by line edits (kinds
  `attribute` to `property`; `country` and `currency` become value sets with
  `complete: true`, since a draft-1 list was complete). No concept id changes.
- Pins to commits before this change name draft-1 graphs, which current readers
  refuse; dependants repin.
- `meaninggraph/cli`, `meaninggraph/registry`, `sneat-co/meaninggraph`, CodeGrapher
  and the 12 dataset repositories need matching changes; each is a separate pull
  request.

## Observed Consequences

None observed yet.

## Affected Features

None at this time.

---
*This document follows the https://specscore.md/decision-specification*
