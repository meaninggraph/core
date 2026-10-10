---
format: https://specscore.md/decision-specification
status: Approved
---

# Decision: Derived links and the two role names

**Status:** Approved
**Date:** 2026-10-09
**Owner:** trakhimenok
**Tags:** format,links,roles
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
this record was written, not the day of his answer.

**On record, the format when this record was written.**
[`FORMAT.md` at commit `dd5ce32`](https://github.com/meaninggraph/core/blob/dd5ce32c4554c0833c59925bbea1e7a7e5ed01e7/FORMAT.md)
describes `meaning/draft-1`. A binding line of a meaning file says that a ModelSpec
entity, or one property of it, holds a concept in a role. Two of the roles are
`entity` ("the rows of the entity are instances of the concept") and `foreign-key`
("the property references the entity whose rows are the concept's instances"). That
page has no rule by which a reader works out a link that nobody wrote.

**On record, the question.** It was put to the owner as card D6 of the ModelSpec
conceptual design proposal (not published), in the proposal's first version. The card
is headed "Direction, two parts". Its question reads:

> a. The link from a property to a concept is derived from the model's reference or key, by one rule written into MeaningGraph's format. A binding line that only restates the model becomes optional. b. Rename two binding roles: foreign-key to reference and entity to instances, with the old names accepted.

On the card the four role names are set in code type. The card offered three answers
for each part. For part a: "Approve", "Change" and "Keep requiring the lines". For
part b: "Rename both", "Rename one" and "Rename neither". It also had a field for a
note.

**On record, a later rewording.** The proposal's second revision, saved after his
answer, has the same card with the word "field" where the first version says
"property" in part a. That revision says that what he approved is the earlier wording.
The earlier wording is the one quoted above.

## Decision

**The owner's words.** On 8 October 2026 at 21:18:56 UTC (22:18:56 for him, the same
date) the owner sent one message with his answers to the proposal's cards, read here
from the stored record of that conversation (not published). It opens:

> Here is my answers to your questions. Check if they still actual taking into account our conversation after your presented the questions.

Two of its lines answer this card:

```text
D6a: Approve
D6b: Rename both
```

**On record, the check he asked for.** The session replied at 21:22:24 UTC. Its reply
opens: "All seventeen answers still hold: nothing we discussed afterwards contradicts
any of them".

**Recorder's account.** His two lines use the card's own labels: "Approve" is the
first answer offered for part a, and "Rename both" the first offered for part b. His
message has no note for this card. So the decision is the card's question as quoted, both
parts: a link from a property to a concept is derived from the model by one rule of
this format, a binding line that only restates the model becomes optional, and the
roles `foreign-key` and `entity` get the names `reference` and `instances`, with the
old names accepted.

### What the approval authorises

**On record, the card:**

> Approval authorises: a change to MeaningGraph's format document and to the readers that derive links, in Phase 3. No published graph is edited without its owner.

**Recorder's account.** The sentence is the proposal author's wording, on the card he
answered. The format document is `FORMAT.md` in this repository. The card does not
say who a graph's owner is, or what counts as that owner's consent (see N46 below).

### Takes effect

**On record, the card:** "in Phase 3". Phase 3 is the proposal's name for the stage in
which the formats and tools around ModelSpec follow ModelSpec's change of words.
ModelSpec's
[decision 0022](https://github.com/specscore/modelspec/blob/main/spec/decisions/0022-prose-now-format-change-on-the-owners-word.md)
lists the phases and says of Phase 3 that it starts "On the owner's word, after Phase
2."

**On record, the words on which Phase 3 started.** Decision 0022 has this entry:

> 2026-10-09 — The owner lifted the condition that the format change wait for the launch. His message: "Can you do other phases or do I need new session? You don't need to depend on DataTug lifecycle". The session recording this reads it as releasing Phase 2 and, after it, Phase 3. Phase 2 started the same day.

**On record, the word "proceed".** A later entry of decision 0022, under the same
date, is about another answer of his, on making the old spelling an error, and about
the session's reading of that answer. That entry ends:

> His next message was "proceed", which does not say whether the reading is right.

**On record, the card, about the old role names:** "The old names stay until no
registered graph uses them; removing them then needs its own approval."

**Recorder's account.** Not in force when this record was written. `FORMAT.md` at
commit `dd5ce32` describes `meaning/draft-1` with the roles `entity` and
`foreign-key` and with no derived links, and this record changes no word of the
format. The decision takes effect for the format when `FORMAT.md` and the schema in
this repository are changed to match it, and for each reader when that reader is
changed. Whether anything that publishes the new names may land was put to the owner
on 9 October 2026; his answers are in
[decision 0002](0002-kind-property-binding-key-field-and-the-format-identifier.md#the-answers-of-9-october-2026-on-publishing-the-names).

### Not decided by the owner

Recorder's notes. The owner answered the card's question and nothing else. The points
below touch this decision and are not decided by him. Approving this record approves
none of them. Each note says whose recommendation or choice the point is, as the
implementation contract for this format and the packet of questions prepared for him
record it (both written on 9 October 2026, not published). The numbers are the
contract's, in its section "Not decided by the owner". The notes give the state on 9
October 2026, when this record was written.

Who is who: the proposal's author is the session; the contract's author and the code
reviewer are two other assistant sessions that worked for the owner on 9 October
2026; the lead is named above.

About derived links:

- **N33. The exact wording of the derivation rule.** The card says only "by one rule
  written into MeaningGraph's format". The rule's wording is the proposal author's
  text, made exact by the contract's author.
- **N15. Whether the role is part of what makes two links the same link.** The
  contract author's recommendation.
- **N16. What a key of several fields derives.** The contract author's
  recommendation.
- **N48. What a reference to a key of several fields derives.** Nobody's separate
  choice: it follows from the rule of N33, and the contract's author states it.
- **N17. What a reference written with a module name, or into another repository,
  derives.** The contract author's recommendation, which departs from the proposal's
  text. The part about other repositories is on the plan and is not due.
- **N53. What a key derives when it names a field that the record type does not
  declare.** The code reviewer's recommendation.
- **N18. How a derived link is marked in tool output, and a command of the Go checker
  that prints links.** The contract author's recommendation. The mark is one of the
  names listed in decision 0002.
- **N19. The derived links of a graph that fails its check.** The contract author's
  recommendation.
- **N56. Whether a reader that runs no checker may derive links.** The lead's choice;
  no recommendation existed.
- **N20. Whether a written line that only restates the model is reported.** The
  contract author's recommendation.
- **N62. Whether a line that only restates the model is removed when a graph is
  converted.** The card makes such a line optional and does not say that any is
  removed. The lead put the point on the plan; until it falls due every line is kept.
- **N42. Whether links are derived for a `meaning/draft-1` file as well.** The
  contract author's recommendation.
- **N39. Which readers must derive links.** The proposal author's list.
- **N45. The mark on a derived entry, and the change of the role words, in the public
  index of the OpenVaultDB Directory.** The lead's choice.

About the two role names:

- **N34. Whether the two new role names are valid in a `meaning/draft-1` file as
  well, so that they need no new format identifier.** The card says "with the old
  names accepted" and names no format. The proposal author's text.
- **N35. Whether the old role names are accepted in a file of the new format too.**
  The proposal author's text.
- **N23, N26 and N51. Whether a file that uses an old role name gets a notice, what
  the notice is called, and how severe it is.** The notice and its name are the
  contract author's recommendation. Its severity is the lead's choice; no
  recommendation existed.
- **N29. When the old role names stop being accepted.** Not decided. The card says
  that removing them "needs its own approval". The lead put the point on the plan;
  the owner is asked when no registered graph uses the old names.
- **N61. Whether the role words of a published graph are rewritten when the graph is
  converted to the new format.** It is part of the second question recorded in
  decision 0002.

About the work as a whole:

- **N30. Whether the owner's release of Phase 3 covers the work on this format.** No
  word of his names this work. That the words quoted under "Takes effect" cover it is
  the lead's reading.
- **N46. Who "its owner" is in the card's sentence "No published graph is edited
  without its owner", and what counts as that owner's consent.** The card does not
  say. On record: each of the ten graph records in
  [`meaninggraph/registry`](https://github.com/meaninggraph/registry) (read at commit
  `ee2f5ba`) names one maintainer, `trakhimenok`. When his graphs are converted was
  put to him as the second question recorded in decision 0002. How a pull request
  that edits a graph is reviewed and landed is the lead's choice.
- **N27. Which checker decides when two checkers disagree.** The contract author's
  recommendation.
- **N47. When MeaningGraph's part of Phase 3 is done.** Nobody's choice yet; no
  recommendation existed. It is on the plan.
- **N60. The form of this record and its status.** The form, a SpecScore decision
  file in this repository, is the contract author's recommendation. The status, In
  Review until the owner approves this text, is the lead's choice.

### His approval of this text

Recorder's account. His answers on this card, "D6a: Approve" and "D6b: Rename both",
were not approval of this text, which was written afterwards. The text was put to him
separately, at a named commit, and the status stayed In Review until he answered.

**On record, what was put to him** (the stored record of the coordinating session's
conversation with him, not published). On 2026-10-10 at 04:14:26 UTC that session's
message to him had a section "Needed from you" with three numbered items. The third
read, exactly:

> 3. **Four decision texts to approve:** MeaningGraph records 0002, 0001 and 0003 on `meaninggraph/core` `main`, and OpenVaultDB decision 0012 on `openvaultdb/openvaultdb` `main` at `385ca56`.

**The owner's words**, 2026-10-10 at 05:30:31 UTC, the third line of one message of
three lines that answers the three items by number (its other two lines answer items
1 and 2, which are not part of this decision):

> 3 all approved

Recorder's account. What he approved is this file as it stood on `main` of
`meaninggraph/core` at commit `e57f57e786047745ba5f2b735d9e2fd3516c2b69`, the tip of
`main` when he answered. The three records of this repository, 0001, 0002 and 0003,
were added to `main` by commit `d412889be157a56715b83c345b619018158527ef` and are
unchanged since. His answer approves this text as it stood there. As the section "Not
decided by the owner" says, approving this record approves none of the points it
lists, and his answer is not an answer to any of them. The commit that records his
approval changes the status, adds this section and changes this record's row in the
index; it changes nothing else in this file.

## Rationale

**On record.** The owner's two lines give no reason. The card gives reasons; they are
the proposal author's and are not repeated here.

## Declined Alternatives

On record, these are the card's other answers. He did not choose them, and his
message gives no reason.

### Keep requiring the lines

For part a the card offered "Approve", "Change" and "Keep requiring the lines". He
answered "D6a: Approve".

### Rename one, or rename neither

For part b the card offered "Rename both", "Rename one" and "Rename neither". He
answered "D6b: Rename both".

## Consequences at Decision Time

Recorder's account, written on 9 October 2026.

- This record changes no rule of the format. `FORMAT.md` gains one short paragraph
  that links to the three decision records.
- No meaning file is edited by it, here or in any other repository.
- The points listed under "Not decided by the owner" stay open or stay somebody
  else's choice, as each note says.

## Observed Consequences

None observed yet.

## Affected Features

None at this time.

---
*This document follows the https://specscore.md/decision-specification*
