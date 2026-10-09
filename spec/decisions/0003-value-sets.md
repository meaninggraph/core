---
format: https://specscore.md/decision-specification
status: In Review
---

# Decision: Value sets

**Status:** In Review
**Date:** 2026-10-09
**Owner:** trakhimenok
**Tags:** format,value-sets
**Source Idea:** —
**Supersedes:** —
**Superseded By:** —

## Context

How to read this record. Three kinds of statement appear in it, and each is
labelled:

- **The owner's words**, quoted exactly, with their date and time.
- **On record**: what a card, a message, a decision or a file says, with a link or
  a place to find it. Where the source is not published, so that a reader cannot
  open it, the text says "not published".
- **Recorder's account**: what the session writing this file says or infers. It is
  not the owner's ruling, whatever its tone.

Times are UTC. The owner's clock was one hour ahead of UTC on these days; his local
date is given where it differs. The owner is the maintainer that the public registry
names for this repository's graph, `trakhimenok`. "The session" is the assistant
session he was talking with on 8 October 2026. "The lead" is the assistant session
that coordinated the work on 9 October 2026. The date in the header above is the day
this record was written, not the day of his answers.

This decision has three parts, a, b and c, as its card has. The owner answered part a
in conversation before the card existed, and parts b and c about two hours later. The
record keeps that order.

**On record, the format today.** [`FORMAT.md`](../../FORMAT.md) describes
`meaning/draft-1`. A concept may carry a list of known values under the key `values`.
The two lists in this repository sit on concepts of kind `entity`: `country` in
`geo.meaning.yaml` and `currency` in `assets.meaning.yaml`. The page says: "A dataset
check requires every distinct stored value (nulls aside) to name exactly one known
value."

**On record, the conversation that led to part a.** All on 8 October 2026, from the
stored record of that conversation (not published). At 20:57:41 UTC the owner wrote:

> I want the values to be described on top levels. Maybe have an analogies to enums. They should not be hidden under entity. As it raises question why modelspec has enum and meaninggraph does not

At 21:00:01 UTC the session replied. Its message, in full:

> Agreed, and I think it is the better design. MeaningGraph would get a fifth kind of concept, a top-level value set, next to entity, attribute, dimension and measure.
>
> The line between the two is simple: an entity's instances live in your data (customers), while a value set's instances are written in the graph itself (genders, countries, currencies).
>
> ```yaml
> - id: gender
>   kind: value-set
>   labels: {en: Gender}
>   values:
>     - id: male
>       labels: {en: Male}
>       aliases: {en: [M, man]}
>       codes: {iso5218: "1"}
>     - id: female
>       labels: {en: Female}
>       aliases: {en: [F, woman]}
>       codes: {iso5218: "2"}
>
> - id: customer-gender
>   kind: dimension
>   of: customer
>   values-of: gender
> ```
>
> Every ModelSpec construct then has a counterpart, which answers the "why does one have it and the other not" question:
>
> | ModelSpec (shape) | MeaningGraph (meaning) |
> |---|---|
> | record type | entity |
> | property | attribute, dimension |
> | enum | value set |
>
> How the pair works:
>
> - **Closed against open.** The enum is closed and says which spellings one model stores. The value set is open and says what the values mean, in every language and code.
> - **Bound like the other pairs.** An enum is bound to a value set the way a record type is bound to an entity, and each enum value must name exactly one value of the set.
> - **Optional.** An enum needs a value set only when its values matter outside its own model.
> - **Lookup tables fit too.** A `Gender` or `Country` table binds to the same value set.
> - **Nothing hidden.** `values` is allowed only on a value set, never on an entity.
>
> On the name, I would call it `value-set`, not `enum`. Using `enum` in both layers for two different things repeats the `entity` problem that issue #21 is about.
>
> The cost is small. The only two lists in real graphs are country (24 values) and currency (3), both in the core graph and both sitting on an entity today. They change kind and keep their ids. `values-of` and `units-of` would have to accept a value set where they require an entity today. About thirty test fixtures in the MeaningGraph CLI change too.
>
> The proposal document does not contain this yet; I have recorded your direction so it goes into the next revision.

**On record, the questions in chat for parts b and c.** At 22:55:07 UTC the session
wrote to the owner (the same stored record). The message asked:

> 1. Yes or no on four open questions in section 15:
>    - **D14a:** rename MeaningGraph's kind `attribute` to `property`.
>    - **D14b:** rename the binding key `property:` to `field:`.
>    - **D15b:** a value set is open, meaning it lists the values known so far.
>    - **D15c:** a value set may stand wherever an entity stands today.

The last two lines are this record's. The first two are recorded in
[decision 0002](0002-kind-property-binding-key-field-and-the-format-identifier.md).
"Section 15" is the section of the ModelSpec conceptual design proposal (not
published) that holds its decision cards; the message named the file of the
proposal's second revision. The message gave one reason, under "Here is why":

> 1. They hold only their own parts of Phase 3. Without D15c, country cannot become a value set, because it has a property and a measure of its own and two other graphs extend it.

And, under the heading "Corrections to things I told you in this conversation":

> - **Value sets reach further than I said.** I said only `values-of` and `units-of` must accept one; `of` and `extends` must as well. That is why D15c is a separate question and not covered by your "OK".

**On record, the card.** Card D15 of that revision is headed "Direction, three parts.
Added in revision 2". Its question reads:

> a. MeaningGraph gains a kind of concept for a list of values, value-set, the counterpart of ModelSpec's enum. values is allowed there and nowhere else. b. A value set is open: it lists the values known so far. c. A value set may stand wherever an entity stands today.

On the card the words `value-set` and `values` are set in code type. The card says
more about part b than the chat question did:

> Part b, three rules. A stored value that matches nothing is reported as unknown, not as an error, unless the set is marked complete. A value's id never changes meaning and is never deleted. A value can be marked retired.

And about part c it says what the other choice would mean:

> If you choose to keep them as entities, both keep their lists, "nowhere else" in part a then holds for new lists only, such as gender, and the core graph's two files that hold them stay in the old format.

The card offered three answers for each part. For part a: "Approve value-set",
"Another name" and "Leave lists as they are". For part b: "Approve the three rules",
"Change" and "Keep lists complete". For part c: "Approve", "Change" and "Keep country
and currency as entities".

**Recorder's account of the card.** The card was written after his answer to part a.
It is read from the copy of the proposal that is on disk, which was saved at 23:02
UTC on 8 October 2026, after his answers to parts b and c and with all his answers
already in it. The copy that was on disk when he answered is not kept, so the
recorder cannot say that the card read exactly this at that moment. Whether he opened
the file between the session's message of 22:55:07 UTC and his reply, five minutes
and 44 seconds later, is not known. What was put to him in chat is on record word for
word.

## Decision

### Part a: a kind for a list of values

**The owner's words.** On 8 October 2026 at 21:07:30 UTC (22:07:30 for him, the same
date), in reply to the session's message quoted in full above, the owner wrote a
message whose first line is:

> OK on value set.

The rest of that message is about another subject, ModelSpec's word for a member.

**Recorder's account.** So the decision of part a is a kind of concept for a list of
values, at the top level and not under an entity, named `value-set` as the session
proposed it. Two things were said to him in the message he replied to and are on
record there: "`values` is allowed only on a value set, never on an entity", and that
the two lists in the core graph "change kind and keep their ids". The card's words
"values is allowed there and nowhere else" were written afterwards. They are the
card's wording and not his. That his OK took the session's sentence about `values`
together with the kind is the lead's reading (N38 below). His later "D15b yes, D15c
yes" did not answer part a again.

### Parts b and c: a value set is open, and stands where an entity stands

**The owner's words.** On 8 October 2026 at 23:00:51 UTC (00:00:51 on 9 October for
him) the owner replied to the session's four questions with one message, read from
the same stored record (not published). It reads, in full:

> D14a yes, D14b yes, D15b yes, D15c yes

Its last two answers are this record's. The card, in the copy on disk, gives these two
answers the date 9 October 2026, which is his local date.

**Recorder's account.** So the decision of parts b and c is the two chat questions he
answered yes to: a value set is open, meaning it lists the values known so far; and a
value set may stand wherever an entity stands today. The three rules of part b are on
the card and were not in the chat question. The card's answer for part b is labelled
"Approve the three rules", and the copy on disk shows it chosen. Whether he read the
three rules before his yes is not known, as said above.

### What the approval authorises

**On record, the card,** in the copy saved after his answers:

> Approval authorises: a change to MeaningGraph's format document, schema and CLI in Phase 3, alongside D6, under a new format identifier, meaning/draft-2. The identifier was not part of what you first said OK to; your yes to D14 as written fixed it. With part c, the change of kind of the two lists in the core graph, by its maintainers. Section 5 has the example and the cost.

**Recorder's account.** The sentence is the proposal author's wording. The format
document is `FORMAT.md` in this repository and the schema is `meaning.schema.json`.
"D6" is [decision 0001](0001-derived-links-and-two-role-names.md). The identifier, and
whose reading it is that his yes fixed it, are in
[decision 0002](0002-kind-property-binding-key-field-and-the-format-identifier.md#the-format-identifier).
"The two lists in the core graph" are `country` and `currency` in this repository.
The card does not say what counts as the maintainers' consent (see N46 below).

### Takes effect

**On record, the card:** "in Phase 3, alongside D6". Phase 3 is the proposal's name
for the stage in which the formats and tools around ModelSpec follow ModelSpec's
change of words. ModelSpec's
[decision 0022](https://github.com/specscore/modelspec/blob/main/spec/decisions/0022-prose-now-format-change-on-the-owners-word.md)
lists the phases and says of Phase 3 that it starts "On the owner's word, after Phase
2."

**On record, the words on which Phase 3 started.** Decision 0022 records them under 9
October 2026. The owner's message: "Can you do other phases or do I need new session?
You don't need to depend on DataTug lifecycle". Decision 0022 says that the session
recording it "reads it as releasing Phase 2 and, after it, Phase 3". It also records a
later message of his that day: "proceed".

**Recorder's account.** Not in force when this record was written. `FORMAT.md` at
commit `dd5ce32` describes `meaning/draft-1`, which has no kind `value-set`, and
`country` and `currency` are concepts of kind `entity`. This record changes no word of
the format and no meaning file. The decision takes effect for the format when
`FORMAT.md` and the schema in this repository are changed to describe
`meaning/draft-2`, for each reader when that reader is changed, and for `country` and
`currency` when the core graph is converted. Whether the names may be published, and
when the core graph is converted, were put to the owner on 9 October 2026; his answers
are in
[decision 0002](0002-kind-property-binding-key-field-and-the-format-identifier.md#the-answers-of-9-october-2026-on-publishing-the-names).

### Not decided by the owner

Recorder's notes. The owner answered what is quoted above and nothing else. The
points below touch this decision and are not decided by him. Approving this record
approves none of them. Each note says whose recommendation or choice the point is, as
the implementation contract for this format and the packet of questions prepared for
him record it (both written on 9 October 2026, not published). The numbers are the
contract's, in its section "Not decided by the owner".

Who is who: the proposal's author is the session; the contract's author and the code
reviewer are two other assistant sessions that worked for the owner on 9 October
2026; the lead is named above.

About part a, the kind and where `values` may stand:

- **N38. That a property or a dimension may not carry a list of its own.** The
  session's sentence, put to him before his OK, speaks of a value set and an entity.
  The card's "and nowhere else" was written after. That his OK took the sentence with
  the kind is the lead's reading.
- **N10. Whether a value set must carry `values`.** The contract author's
  recommendation.
- **N11. Which other keys a value set may carry.** The contract author's
  recommendation.
- **N9. Whether a value set may carry bindings.** The contract author's
  recommendation. The proposal leaves open how the rows of a lookup table are tied to
  the values of a value set.
- **N13. Whether a checker compares a model's enum with a value set.** The card
  says that an enum's values "can then be checked against a value set"; it does not
  say that a checker does so. The contract's author leaves the check out for now; it
  is on the plan.
- **N12. How a project adds values of its own to a shared value set.** Left open by
  the proposal. Nobody's choice yet; it is on the plan.
- **N40. Whether the test files of the Go checker that carry `values` are changed.**
  The contract author's recommendation, which departs from the proposal's text.

About part b, the open list:

- **N1. How "complete" is spelled as a key.** The card says "marked complete" and
  names no key. The spelling is the contract author's recommendation; it is one of
  the names listed in decision 0002.
- **N2. How "retired" is spelled as a key, and whether a retired value points at its
  successors.** The card says "can be marked retired" and names no key. The contract
  author's recommendation; the spelling is one of the names listed in decision 0002.
- **N3. Whether a retired value still matches, and still counts for the rule that one
  word names one value.** The contract author's recommendation.
- **N4. What a checker says when a stored value, or a unit, names a retired value.**
  The contract author's recommendation.
- **N5. Whether a list in a `meaning/draft-1` file is open or complete.** The card
  speaks of a value set, which a file in the old format cannot contain. The contract
  author's recommendation.
- **N6. What "reported as unknown" is, technically.** The card says "not as an
  error". The form of the report is the contract author's recommendation.
- **N7. Whether a unit that names no value of an open list stays an error.** The
  card's rule is about stored values. The contract author's recommendation.
- **N14. Whether a checker enforces that "A value's id never changes meaning and is
  never deleted."** The contract author's recommendation.
- **N26 and N51. What the two new findings about values are called, and how severe
  they are.** The names are the contract author's recommendation and are listed in
  decision 0002. The severity is the lead's choice; no recommendation existed.
- **N57. Whether a dataset check that requires every stored value to match keeps
  that rule once the list it reads is open.** Nobody's choice yet; no recommendation
  existed. It is on the plan.

About part c, where a value set may stand:

- **N8. What a value set may extend.** The chat question and the card say "wherever
  an entity stands today". The contract's author reads that for both positions of
  `extends`; it is that author's recommendation.
- **N37. How a graph in the old format reads a value set of a graph in the new
  format that it pins.** The proposal author's text.
- **N31. The search kind and the page address of a value set.** The contract
  author's recommendation; the search kind is one of the names listed in decision
  0002.
- **N49. Whether the conversion of the core graph waits until the search service has
  been deployed with the new kinds.** The contract author's recommendation; it is on
  the plan.

About the core graph's two lists:

- **N46. Who the core graph's maintainers are, and what counts as their consent to
  the change of kind.** The card says "by its maintainers". On record: the record of
  the core graph in
  [`meaninggraph/registry`](https://github.com/meaninggraph/registry) (read at commit
  `ee2f5ba`) names one maintainer, `trakhimenok`, as do the other nine graph records.
  He was told in chat, before his "OK on value set.", that the two lists change kind
  and keep their ids, and before his "D15c yes", that "Without D15c, country cannot
  become a value set". That those two answers are the consent of the core graph's
  owner to the edit of the published core graph is the lead's reading. How a pull
  request that edits a graph is reviewed and landed is the lead's choice.
- **N61. When the core graph is converted.** Put to the owner on 9 October 2026 as
  the second of the format questions. His "5 - ok" and "2 - correct" are quoted in
  decision 0002: the core graph first, then each of the six dataset graphs.
- **N43. The identifier `meaning/draft-2`,** which the card names. The session's
  suggestion and the session's reading; see decision 0002.

About the work as a whole:

- **N30. Whether the owner's release of Phase 3 covers the work on this format.** No
  word of his of that release names this work. That the words quoted under "Takes
  effect" cover it is the lead's reading.
- **N27. Which checker decides when two checkers disagree.** The contract author's
  recommendation.
- **N47. When MeaningGraph's part of Phase 3 is done.** Nobody's choice yet; no
  recommendation existed. It is on the plan.
- **N60. The form of this record and its status.** The form, a SpecScore decision
  file in this repository, is the contract author's recommendation. The status, In
  Review until the owner approves this text, is the lead's choice.

## Rationale

**The owner's words,** from his message of 20:57:41 UTC quoted in the Context: "They
should not be hidden under entity. As it raises question why modelspec has enum and
meaninggraph does not".

**Recorder's account.** That is his reason for part a, given before the session
proposed the kind. His reply of 23:00:51 UTC gives no reason for parts b and c. The
session's reason for part c is quoted in the Context. The card's other reasons are
the proposal author's and are not repeated here.

## Declined Alternatives

On record, these are the card's other answers. For part a the card was written after
his answer, so they were not put to him as answers to choose from. For parts b and c
the chat asked for a yes or a no, and his reply does not mention them.

### Another name, or leave lists as they are

For part a the card lists "Approve value-set", "Another name" and "Leave lists as
they are". He had answered "OK on value set." to a message that proposed the name
`value-set`.

### Keep lists complete

For part b the card offered "Approve the three rules", "Change" and "Keep lists
complete". He answered "D15b yes" to the chat question.

### Keep country and currency as entities

For part c the card offered "Approve", "Change" and "Keep country and currency as
entities". He answered "D15c yes" to the chat question.

## Consequences at Decision Time

Recorder's account, written on 9 October 2026.

- This record changes no rule of the format. `FORMAT.md` gains one line that links
  to the three decision records.
- No meaning file is edited by it. `country` and `currency` stay concepts of kind
  `entity` until the core graph is converted.
- The points listed under "Not decided by the owner" stay open or stay somebody
  else's choice, as each note says.

## Observed Consequences

None observed yet.

## Affected Features

None at this time.

---
*This document follows the https://specscore.md/decision-specification*
