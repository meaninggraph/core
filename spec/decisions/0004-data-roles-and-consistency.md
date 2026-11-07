---
format: https://specscore.md/decision-specification
status: Approved
---

# Decision: Data roles and consistency

**Status:** Approved
**Date:** 2026-11-07
**Owner:** trakhimenok
**Tags:** format,data-roles,consistency
**Source Idea:** —
**Supersedes:** —
**Superseded By:** —

## Context

How to read this record. Three kinds of statement appear in it, and each is
labelled:

- **The owner's words**, quoted exactly, with their date.
- **On record**: what a message, a decision or a file says, with a link or a place
  to find it. Where the source is not published, so that a reader cannot open it,
  the text says "not published".
- **Recorder's account**: what the session writing this file says or infers. It is
  not the owner's ruling, whatever its tone.

The owner is the maintainer that the public registry names for this repository's
graph, `trakhimenok`. "The lead" is the assistant session that coordinated the work
on 7 November 2026 across this repository and the tools that read it. "The
recorder" is the session that wrote this file and the change to the format beside
it, working from the lead's brief (not published).

**On record, the format when this record was written.**
[`FORMAT.md` at commit `8d566d8`](https://github.com/meaninggraph/core/blob/8d566d811fc035190f6dac9308457441039b3f4d/FORMAT.md)
describes `meaning/draft-2` and `meaning/draft-1`. A concept says what data means:
labels, synonyms, a description, its kind and its relations. Nothing in either
format says whether the data of a concept is expected to be the same in two
datasets. All eleven meaning files of this repository are in `meaning/draft-1`.

**On record, the request.** On 7 November 2026 the owner gave the lead a written
mission about comparing the data of many databases of one application: databases
per factory, region or tenant. The lead's stored copy of it is not published, and
it carries no time of day; the date is the lead's. Most of it is about the tools
that compare. What it says about this repository is quoted under "The owner's
words" below. It also lists, as "Initial roles":

> | Reference | Lookup and controlled vocabulary data |
> | Master | Core business entities |
> | Configuration | Application or business configuration |
> | Transactional | Business transactions and operational records |
> | Event | Events, logs, and audit records |
> | Unknown | Not yet classified |

It gives two examples, a country that is `reference` with scope `global` and
expectation `identical`, and a product that is `master` with scope `application`
and expectation `partial`, and says of them: "These examples are conceptual." It
lists, for the lead to consider, scopes from global to a single instance and nine
expectations, among them subsets, supersets, selected fields and "Unknown", and
asks whether expectations "should be represented as a flexible rule model rather
than a large enumeration".

## Decision

**The owner's words**, 7 November 2026, from the mission described in the Context
(not published), each sentence where it stands there. From its description of
MeaningGraph:

> MeaningGraph should become the authoritative location for reusable semantic data classifications and consistency expectations.

> Distinguish between reusable definitions, application-specific policies, and instance-specific observations.

The first sentence of its section on data classification:

> Implement reusable data-role classification in MeaningGraph.

From the same section:

> Therefore, model data role and consistency expectations independently.

> Do not conflate scope with the identity of the authoritative source.

From its section on MeaningGraph:

> Avoid placing tenant-specific secrets or operational observations into globally shared MeaningGraph definitions.

**Recorder's account.** So the decision is that a meaning file can say, as reusable
meaning, what the data of a concept is and where it is expected to agree, as two
separate statements, and that it says nothing about any one deployment. The form
below is the lead's; the owner saw a summary of it, not this text (see Approval).
It is what `FORMAT.md` says in
[Data roles and consistency](../../FORMAT.md#data-roles-and-consistency):

- An entity or a value set may carry `data-role`: `reference`, `master`,
  `configuration`, `transactional` or `event`.
- An entity, a value set, a property or a dimension may carry `consistency`, with
  `scope` (`global` or `application`) and `expectation` (`identical`,
  `normalized`, `partial`, `instance-specific` or `unrestricted`). A property's
  expectation is about that one field and overrides its entity's; `partial` is
  not allowed on it.
- A measure carries neither. `extends` passes both on, each when the concept has
  none of its own.
- `consistency` never names an authoritative instance, a tenant, an environment
  or a database.
- Both keys are `meaning/draft-2` only.

### Approval

**On record**, 7 November 2026, a question in the lead's session (not published). It
summarised the two keys; gave `countries` (reference, global, identical) and `orders`
(transactional, instance-specific) as examples; said that a project's own rules
override these defaults; and said that only `meaning/draft-2` carries them. The owner
chose "Land as is", over converting the core graph now or holding the branch.

**Recorder's account.** That approves landing this branch as it stood, on the summary
the question gave. The owner did not read this record or `FORMAT.md`. The choices
listed below were accepted by that landing as a whole, not reviewed one by one; several
of them (for example that the fields of a `partial` entity are `identical`) were not in
the question. The question showed no `partial` entity; the record and `FORMAT.md` use
`product` (master, application, partial), which it did not show.

### Not decided by the owner

Recorder's notes. The owner wrote what is quoted above and nothing else about this
repository. The points below were chosen by the lead or the recorder, not by him. Each
says whose choice it is.

- **The key names and the spellings of their values.** `data-role`,
  `consistency`, `scope`, `expectation` and every value are the lead's choice. The
  mission writes `dataRole`; the format's keys are lowercase words joined by
  hyphens (`values-of`, `units-of`), so `data-role`.
- **No value for "Unknown".** The mission lists `Unknown` as a role, "Not yet
  classified". The lead's choice is that a concept without `data-role` is not
  classified, so the format has no value for it; a tool that reads the format can
  still show "unknown".
- **Two scopes.** The mission lists scopes down to a tenant, an environment and
  one instance. The lead's choice is to keep `global` and `application` only: the
  others name parts of a deployment, which the owner's last two sentences above
  keep out of shared definitions. Which databases are instances of one
  application is the tool's to say.
- **Five expectations.** Of the mission's list, selected fields are expressed by
  giving a property its own expectation, and subsets, supersets and selected
  records by `partial` with the tool's own rules; "Unknown" is an absent key. The
  lead's choice.
- **The fields of a `partial` entity are `identical`.** A property with no
  consistency of its own follows its entity's, and the lead's brief says that on a
  `partial` entity "shared properties follow their own expectations". What a
  property with none follows there is the recorder's choice: `identical`, so that
  `partial` is about which records exist and not about their values.
- **What `normalized` does.** Trimming, collapsing whitespace and folding case are
  from the lead's brief; that case is folded as labels are compared, and that a
  value which is not text is compared as it is, is the recorder's.
- **Draft 2 only, and no annotation of the core graph yet.** The lead's brief asks
  for `country`, `currency` and `product` to be annotated. They are in
  `meaning/draft-1` files, whose schema has no such keys; adding the keys there
  would make the released readers, which validate this graph with the draft-1
  schema, refuse it. The recorder's choice is that both keys belong to
  `meaning/draft-2`, as `complete` and `retired` do, and that the annotations wait
  for the conversion of the core graph. `FORMAT.md` shows them, and a test checks
  them on converted copies of those concepts.
- **The rule names.** `data-role` and `consistency`, reported beside the schema's
  refusal, are the recorder's choice.
- **The status.** In Review until the owner approved it, then Approved
  (see Approval above).

## Rationale

**The owner's words,** quoted under "Decision": "Therefore, model data role and
consistency expectations independently."

**Recorder's account.** The mission's own reason, in the sentence before that one,
is that reference data is not always the same everywhere and master data is
sometimes shared. Regional reference data is `reference` with
`expectation: instance-specific`; a role that implied an expectation could not say
so. Keeping deployment facts out keeps a meaning file the same for every dataset
that pins it: a commit of this repository cannot know a reader's factories.

## Declined Alternatives

Recorder's account: these were not put to the owner as answers to choose from.
They are declined by the lead's brief, on the owner's words quoted under
"Decision".

### One enumeration combining role and expectation

A single key such as `reference-identical`, or a role that implies its
expectation. Declined on "model data role and consistency expectations
independently".

### Authority, tenants and environments in meaning files

`consistency` naming the authoritative instance, the tenants or environments it
holds for, or scopes such as `tenant` and `instance`. Declined on "Do not conflate
scope with the identity of the authoritative source." and on "Avoid placing
tenant-specific secrets or operational observations into globally shared
MeaningGraph definitions.": those are facts of one deployment, kept by the tool
that compares, with a project's own rules and every result.

### The keys in `meaning/draft-1` as well

Adding both keys to the draft-1 schema in place, so that the core graph's files
can carry them now. Declined by the recorder, as the notes above say: the released
readers validate those files with the draft-1 schema and would refuse them.

## Consequences at Decision Time

Recorder's account, written on 7 November 2026.

- `FORMAT.md` gains the section "Data roles and consistency" and the rows and
  sentences that point at it; `meaning.draft-2.schema.json` gains both keys and
  the kinds that may carry them; `meaning.schema.json` is unchanged.
- The reference checker refuses `data-role` and `consistency` on the wrong kinds,
  and `expectation: partial` on a property or a dimension, with the rules
  `data-role` and `consistency`, and reports either key in a `meaning/draft-1` file
  as `format-word`. It exports `effectiveDataRole` and `effectiveConsistency`,
  which apply the inheritance rules.
- No meaning file is edited. `country`, `currency` and `product` carry the keys
  when the core graph is converted to `meaning/draft-2`.
- **Open: `instance-specific` and `unrestricted`.** A tool that reads both as "a
  difference is not a finding" cannot tell them apart. A field with no consistency of
  its own takes its entity's, so every field of an `instance-specific` entity is
  "expected to differ", codes included. What each means to a comparing tool is to be
  settled before DataTug reads these defaults.

## Observed Consequences

None observed yet.

## Affected Features

None at this time.

---
*This document follows the https://specscore.md/decision-specification*
