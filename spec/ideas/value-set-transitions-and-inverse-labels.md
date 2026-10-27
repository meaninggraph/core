---
format: https://specscore.md/idea-specification
status: Draft
---

# Idea: Value-set transitions, inverse labels and concept deprecation

**Status:** Draft
**Date:** 2026-10-27
**Owner:** trakhimenok
**Promotes To:** —
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

How might a meaning file say which moves between the values of a value set are possible, what the reverse direction of a reference property is called, and that a concept is deprecated, without the format describing system behavior?

## Context

The owner agreed on 2026-10-27 (in conversation, not published) that GraphSpec, SpecScore's earlier domain-modelling language, is replaced by MeaningGraph for vocabulary, and that its behavior — commands, events, policies — stays in SpecScore. The split uses one test: would someone reading the data, without the system that produced it, need this? Two things GraphSpec expressed pass that test and have no place in `meaning/draft-2`:

- **Which state changes are possible.** A value set lists the states an order can be in (`open`, `shipped`, `on-hold`) but not that `shipped` never returns to `open`. Someone reading an order history needs that to tell a valid history from a corrupt one.
- **The name of the reverse direction.** `parent` is a property of `contact` whose values are contacts; nothing names the other direction ("children"), so a question phrased that way cannot be matched.

Who would use them: SpecScore's proposed domain-behavior artifacts check that a command's declared transition is one the value set allows (`specscore/specscore` PR #70, feature `domain-behavior`); registry search and question matching could use inverse labels; DataTug could check status histories (to be confirmed with DataTug).

- **That a concept is deprecated.** FORMAT.md says a retired concept "is deprecated, not deleted, so pinned references keep resolving", but no key says so: only values carry `retired`. A reader — or a spec that references the concept — cannot tell.

Endpoint roles, which GraphSpec labelled on relationships, need no change: in MeaningGraph each role is already a property concept of its own (`guardianship` has `guardian` and `ward`, each `values-of: contact`).

## Recommended Direction

**Transitions on value sets.** A value set MAY carry `transitions`, a list of `{from, to}` items naming its own values, and MAY carry `initial`, the values a first recorded state may take:

```yaml
- id: order-status-list
  kind: value-set
  labels: {en: Order status}
  description: The states an order passes through.
  values:
    - {id: open, labels: {en: Open}}
    - {id: shipped, labels: {en: Shipped}}
    - {id: on-hold, labels: {en: On hold}}
  initial: [open]
  transitions:
    - {from: open, to: [shipped, on-hold]}
    - {from: on-hold, to: [open]}
```

- `from` is one value id; `to` is a non-empty list of value ids; every id is one of the set's own values. A duplicate `from`, an unknown id, or a self-transition is an error: a transition is a change of value, and an edit that keeps the value is not one.
- With `transitions`, a move not listed is not allowed. A value with no outgoing transition is terminal. Without `transitions`, the format says nothing about moves.
- Retired values may appear, so that old histories stay valid.
- Like `values`, `transitions` and `initial` are never inherited through `extends`.
- A value set is still open: a stored value that matches no known value is still reported as unknown, and transitions say nothing about it.
- The format declares transitions; checking a dataset's history against them needs ordered rows and is left to tools.

**Inverse labels on reference properties.** A property or dimension concept with `values-of` (an entity or a value set — FORMAT.md treats them as one class there) MAY carry `inverse`, with `labels` (with `en`) and optional `synonyms`, naming the reverse direction:

```yaml
- id: parent
  kind: property
  of: contact
  values-of: contact
  labels: {en: Parent}
  description: A contact's parent.
  inverse:
    labels: {en: Children}
```

- `inverse` has no id and no address: it is words for matching and display, not a concept. A tool that needs to point at the reverse direction names the property and the direction (SpecScore's proposed policy clauses write `{inverse: meaning://…/parent}`), so no address is needed.
- Its words follow the repository's synonym rule: they may not repeat another concept's label or synonym in the same language unless one concept is a kind of the other, nor the property's own labels or synonyms.

**Concept deprecation.** Any concept MAY carry `deprecated: true`, optionally with `replaced-by`, a reference to the concept to use instead. A deprecated concept still resolves and keeps every rule it had; a reader reports a reference to it as a notice, and a deprecated concept never becomes undeprecated under the same id.

Schema: like `values` and `complete`, `transitions` and `initial` are allowed only when `kind` is `value-set`, and `inverse` only on a property or dimension with `values-of`.

## Alternatives Considered

- **Leave transitions to SpecScore.** Possible moves are a fact about the data, not about one system; keeping them only in a SpecScore spec hides them from everyone who reads the data without SpecScore.
- **Transitions with triggers (which command or automation causes a move).** That is behavior; it stays in SpecScore's command and event artifacts, which reference the value set.
- **Inverse as a second property concept.** Two concepts for one fact, which can drift apart and which a binding cannot both hold.

## MVP Scope

`transitions`, `initial`, `inverse` and `deprecated` specified in `FORMAT.md` and the schema, checked by `scripts/lib/meaning.mjs` with conformance cases in `scripts/test-conformance.mjs`, and read by the `meaninggraph/cli` parser in one release. This repository's universal graphs carry no value sets yet, so the first real use is a converted backstage lifecycle.

## Not Doing (and Why)

- Triggers, guards or actors on transitions — behavior, kept in SpecScore.
- A checker that validates dataset histories — needs ordered data and belongs to tools such as DataTug.
- Ids or addresses for inverse directions — they are words, not concepts; a property plus a direction addresses them.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | Every GraphSpec lifecycle in `sneat-co/backstage` fits from/to lists over one value set | Convert them and compare with the GraphSpec states |
| Should-be-true | Inverse labels improve question matching without new ambiguity | Run the existing word-uniqueness rule over a converted backstage graph |
| Might-be-true | DataTug would validate status histories against transitions | Ask the DataTug side for one concrete use |

## SpecScore Integration

- **New Features this would create:** TBD at design time
- **Existing Features affected:** none
- **Dependencies:** a format identifier decision (see Open Questions); `meaninggraph/cli` release

## Open Questions

- Should these keys be added to `meaning/draft-2` — which, per `FORMAT.md` (10 October 2026), no released reader reads yet — or wait for a `meaning/draft-3`? This repository's decisions 0002 and 0003 set the precedent for how a format change is recorded.
