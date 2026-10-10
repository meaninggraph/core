---
format: https://specscore.md/decision-specification
status: Approved
---

# Decision: The kind property, the binding key field and the format identifier

**Status:** Approved
**Date:** 2026-10-09
**Owner:** trakhimenok
**Tags:** format,vocabulary,identifier
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
describes `meaning/draft-1`: "Every file starts with `format: meaning/draft-1`." One
of the four kinds of concept is `attribute` ("a property of an entity"). A binding
line names a member of a ModelSpec entity with the key `property`. Since 9 October
2026 ModelSpec calls that member a field
([decision 0020](https://github.com/specscore/modelspec/blob/main/spec/decisions/0020-field-is-the-member-word.md)
in the ModelSpec repository).

**On record, the question in chat.** On 8 October 2026 at 22:55:07 UTC the session
wrote to the owner (the stored record of that conversation, not published). The
message asked:

> 1. Yes or no on four open questions in section 15:
>    - **D14a:** rename MeaningGraph's kind `attribute` to `property`.
>    - **D14b:** rename the binding key `property:` to `field:`.
>    - **D15b:** a value set is open, meaning it lists the values known so far.
>    - **D15c:** a value set may stand wherever an entity stands today.

The first two lines are this record's. The other two are recorded in
[decision 0003](0003-value-sets.md). "Section 15" is the section of the ModelSpec
conceptual design proposal (not published) that holds its decision cards; the message
named the file of the proposal's second revision.

**On record, the card as it stood when he answered.** The session wrote the
proposal's second revision to disk at 22:54:21 UTC and kept a copy of what it wrote
(not published). The stored record shows one and the same checksum for the file on
disk at 22:54:21 UTC, at 23:01:11 UTC, which is 20 seconds after his reply, and at
23:02:43 UTC, just before the session overwrote the file. The kept copy has that
checksum. So the kept copy is, byte for byte, the file that was on disk when he
answered, and the card is quoted from it. Card D14 is headed "Open. Vocabulary, two
parts. Added in revision 2". Its question reads:

> a. Rename MeaningGraph's kind attribute to property. b. Rename the binding key property: to field:.

On the card the words `attribute`, `property`, `property:` and `field:` are set in
code type. The card offered two answers for each part. For part a: "Rename to
property" and "Keep attribute". For part b: "Rename to field:" and "Keep property:".
None was marked as chosen. Below its sentence about what approval would authorise,
which is quoted under "What the approval authorises", the card said "Not answered
yet. I recommend both renames." The card had a field for a note, and its sentence
about what approval would authorise points to that field.

**On record, what the session changed on the card after his answer.** At 23:02 UTC the
session rewrote the card to record his answer and overwrote the file. The script that
made the changes is kept (not published), and the file that was on disk when this
record was written is that later copy. On this card the heading became "Vocabulary,
two parts. Added in revision 2"; "Approval would authorise:" became "Your approval
authorises:"; "Approving as written also fixes one detail, the identifier
meaning/draft-2; change it in the note." became "Approving as written also fixed one
detail, the identifier meaning/draft-2."; the line "Not answered yet. I recommend both
renames." became a line that gives his answer; a sentence of the card's reasons that
said he had not answered was changed to say that he had; and the answers "Rename to
property" and "Rename to field:" were marked as chosen. The later wording is the
session's. It was not put to him.

**Recorder's account.** Whether he opened the file between the session's message and
his reply, five minutes and 44 seconds later, is not known. What was put to him in
chat is on record word for word.

## Decision

**The owner's words.** On 8 October 2026 at 23:00:51 UTC (00:00:51 on 9 October for
him) the owner replied with one message, read from the same stored record (not
published). It reads, in full:

> D14a yes, D14b yes, D15b yes, D15c yes

Its first two answers are this record's. The later copy of the card gives his answer
the date 9 October 2026, which is his local date.

**Recorder's account.** So the decision is the two chat questions he answered yes to:
MeaningGraph's kind `attribute` is renamed to `property`, and the binding key
`property:` is renamed to `field:`.

### The format identifier

**On record,** all on 8 October 2026 and all from the same stored record (not
published):

- 22:55:07 UTC, the session, in the message that put the four questions, under the
  heading "Corrections to things I told you in this conversation":

  > - **MeaningGraph's format needs a new identifier** for value sets and the two renames; I suggest `meaning/draft-2`. I had not mentioned it. The role renames you approved in D6 do not need it.

- 23:00:51 UTC, the owner: the message quoted above. It names no identifier.
- 23:03:04 UTC, the session:

  > Your yes to D14 also fixes the new MeaningGraph format identifier as `meaning/draft-2`, because the card said approving it as written does so. That reading is mine; say so if you want another string.

- The two cards, as they stood when he answered. Card D14: "Both renames need a new
  format identifier, meaning/draft-2, which D15 needs as well", and, in its sentence
  about what approval would authorise, "Approving as written also fixes one detail,
  the identifier meaning/draft-2; change it in the note." Card D15
  ([decision 0003](0003-value-sets.md)): "The identifier was not part of what you
  said OK to; confirm it or change the string in the note."

**Recorder's account.** The string `meaning/draft-2` was the session's suggestion,
made to him before his yes. Each card, as it stood when he answered, spoke of the
identifier in its own way. The D14 card said that approving as written fixes it, and
that he could change it in the note. The D15 card said that it was not part of what
he had said OK to, and asked him to confirm it or to change the string in the note.
He answered "D14a yes, D14b yes, D15b yes, D15c yes" in chat. That message has no
note and no word about the identifier. Whether a yes with no note means "as written"
is a reading and not a word of his. The session made that reading at 23:03:04 UTC.
Nothing of his that the recorder read confirms it, on that day or later. What he did
on 9 October 2026 is another thing: he answered a question that put the identifier
itself to him, by name, as the next section quotes. The session's words "because the
card said approving it as written does so" match the D14 card as it stood; the card's
next words, "change it in the note", are not in the session's sentence. After his
answer the session rewrote both cards to say that his yes had fixed the identifier,
as set out above and in decision 0003. That wording is the session's too.

The recorder read his messages of 8 October 2026 after 23:03:04 UTC and his messages
of 9 October 2026 from 06:47 UTC to 15:43 UTC in the stored records (not published);
none names another string. His messages between those two stretches were not read.
The identifier was put to him again on 9 October 2026, in the question recorded next.

### The answers of 9 October 2026 on publishing the names

All times in this section are on 9 October 2026, and all quotations are from the
stored record of the lead's conversation with the owner (not published).

**On record, the question.** At 13:39:56 UTC the lead sent the owner a list of five
points that waited on him. Its fifth point reads, in full:

> 5. **The three format questions**: whether `meaning/draft-2` may be published with the listed names, when the seven graphs are converted, and the converted manifest's format line.

**The owner's words.** At 15:21:03 UTC (16:21:03 for him) he replied with one message
of four lines, numbered 2 to 5. Its last line:

> 5 - ok

**On record, the reading put back to him.** The point did not restate the options. At
15:28:33 UTC the lead wrote to him, in a message that also reported other work:

> **How I read your "5 - ok"**
>
> I take it as the recommended option on each of the three format questions:
> - `meaning/draft-2` may be published with the names as listed.
> - The core graph is converted first, then each of the six dataset graphs, one pull request each.
> - A converted manifest's format line is `ovdb-manifest/draft-2`.
>
> Say so if you meant something else. I am starting the reader-side work now; nothing that publishes either format name lands before your next message.

At 15:32:29 UTC the lead sent another message about work in progress. It ends with a
list headed "Open with you:", whose second point reads, in full:

> 2. **My reading of "5 - ok"**: the names as listed, the core graph then the six dataset graphs, and `ovdb-manifest/draft-2`. A word from you that this is right lets the three pieces above land once reviewed.

At 15:38:18 UTC, in its last message before his reply, the lead named the same two
open points again, in the same order and without numbers: "Still open with you: the
GeoNames and ROR guard edits, and that reading."

**The owner's words.** At 15:43:05 UTC (16:43:05 for him) he replied with one message
of two lines and nothing else. Its first line is "1 - ok, approved" (followed by one
space in the message as stored); it answers the list's first point, which is about
another matter. Its second line answers the point quoted above:

> 2 - correct

**Recorder's account.** With "2 - correct" the reading is no longer only the lead's:
the owner says it is right. The third part of the reading is about the manifest of
OpenVaultDB, another project's format, and is not a matter of this repository. The
other two parts are set out below: what had been listed to him, then the names, then
the graphs.

**On record, what had been listed to him before "5 - ok".** Five messages, in order.

At 09:37:05 UTC the lead put the question "may the format `meaning/draft-2` be
published with these names?" to him with a table. Its rows named `meaning/draft-2`;
`property` (kind) and `field:` (binding key); `value-set`; `instances` and
`reference`; `complete: true` and `retired: true`; and, in one row, "`"derived": true`,
six rule ids, `meaning.draft-2.schema.json`, search kinds `meaning_property` and
`meaning_value_set`, a `meaninggraph rewrite` command". Its recommended option began
"**Yes, as listed (my recommendation).**" The same message put the question "when are
your seven graphs converted?", named the seven, "the core graph and Chinook,
Northwind, Pubs, Employees, Sakila and AdventureWorks", and recommended "**A: the core
graph, then each of the six (my recommendation).**" It said that the full packet of
questions was a file on disk (not published).

At 09:39:43 UTC the lead sent its next message, which was about another question. Its
last section is headed "Everything now waiting on you" and holds a list, whose second
point reads, in full:

> 2. `meaning/draft-2`: may the format be published with the listed names, and when are your seven graphs converted? (Previous message.)

That is the first use of the words "the listed names". It points at the message
before it, so at that moment the words meant the table of 09:37:05 UTC.

At 11:58:12 UTC a message of his had the line "3. What 2 questions?".

At 12:01:14 UTC the lead answered that line with a short form of the two questions,
under the heading "3. MeaningGraph: two yes/no-style questions". That part of its
message, in full:

> Background: you approved renaming MeaningGraph's words (`attribute` → `property`, `property:` → `field:`, lists become `value-set`). That needs a new file format, `meaning/draft-2`. Nothing of it is public yet.
>
> **3a. May I publish the new format under these names?**
>
> A file would change like this (real line, `geo.meaning.yaml` in `meaninggraph/core`):
>
> ```yaml
> format: meaning/draft-1      # today
> format: meaning/draft-2      # after
> ```
>
> The other new names are `property`, `field:`, `value-set`, `instances`, `reference` (yours or from cards you answered), plus `complete: true` and `retired: true` on a list.
>
> - **Yes** (my recommendation), or
> - **Yes, but rename X**, or
> - **Not yet.**
>
> **3b. When do I convert your own seven graphs to it?**
>
> The seven are the core graph and Chinook, Northwind, Pubs, Employees, Sakila, AdventureWorks. Example, Chinook's meaning file:
>
> ```yaml
> kind: attribute   →   kind: property
> property: Country →   field: Country
> ```
>
> - **A: all seven** (my recommendation): core first, then each dataset.
> - **B: core only for now.**
> - **C: none yet.**

At 12:46:14 UTC the lead listed what waited on him. The third point of that list
began:

> 3. **The three format questions** I restated after your "What 2 questions?" and "4 what?" are still open:
>    - whether `meaning/draft-2` may be published with the listed names;

That is the second use of the words "the listed names", this time in a point about
the questions as restated in the short form. He sent no message between the short
form of 12:01:14 UTC and the list of 13:39:56 UTC whose fifth point he answered "5 -
ok"; that point is the third use of the words.

*The names.* The table below lists the names as the packet's table lists them, with
where the packet says each comes from, and whether the short form of 12:01:14 UTC
named it. The table is the recorder's listing, not the owner's words:

| Name | What it is | Where it comes from | In the short form |
|---|---|---|---|
| `meaning/draft-2` | The format's identifier, on the `format:` line of every file | The session's suggestion (above) | Yes |
| `property` | The kind that is `attribute` in `meaning/draft-1` | The owner's "D14a yes" | Yes |
| `field:` | The binding key that is `property:` in `meaning/draft-1` | The owner's "D14b yes" | Yes |
| `value-set` | A kind for a list of values | The session's name; the owner's "OK on value set." (decision 0003) | Yes |
| `instances`, `reference` | The new names of the roles `entity` and `foreign-key`, with the old names accepted | Card D6; the owner's "D6b: Rename both" ([decision 0001](0001-derived-links-and-two-role-names.md)) | Yes |
| `complete: true` | Says that a list of values is complete | The word is card D15's; the key and its spelling are the contract author's (N1) | Yes |
| `retired: true` | Marks one value as retired | The word is card D15's; the key and its spelling are the contract author's (N2) | Yes |
| `"derived": true` | The mark on a link that a reader worked out from the model, in tool output and in the public index of the OpenVaultDB Directory | The contract author's (N18); writing it into the public index is the lead's choice (N45) | No |
| `format-mixed`, `format-word`, `earlier-format`, `earlier-role-name`, `unknown-value`, `retired-value` | Names of six new findings of the checkers | The contract author's (N26) | No |
| `meaning.draft-2.schema.json` | The name of a second schema file | The contract author's (N25) | No |
| How findings are reported | A file refused for a word of the wrong format is reported as `format-word` beside the existing `schema` finding; the four new notices are warnings | The code reviewer's recommendation (N50); the lead's choice (N51) | No |
| `meaning_property`, `meaning_value_set` | Search kinds; and the page of a value set goes under `concepts/`, with the address it had under `entities/` when this record was written kept as a redirect | `meaning_property` is card D14's word; the rest is the contract author's (N31) | No |
| `meaninggraph rewrite` | A command that rewrites a hand-written meaning file; a second new command prints links, and its name is left to its pull request | The contract author's (N24, N18) | No |

Four limits of his confirmation, on the recorder's account.

- His "5 - ok" and his "2 - correct" follow a listing of eight names, the short form
  of 12:01:14 UTC: `meaning/draft-2`, `property`, `field:`, `value-set`, `instances`,
  `reference`, `complete: true` and `retired: true`. The short form did not name
  `"derived": true`, the finding names, `meaning.draft-2.schema.json`, the two search
  kinds or `meaninggraph rewrite`. Those stood in one row of the table of 09:37:05
  UTC, and the lead's list of 12:46:14 UTC called the three questions the ones it had
  restated after his "What 2 questions?".
- The six finding names, the way findings are reported, the page of a value set and
  the second command were spelled out only in the packet file. The table of 09:37:05
  UTC said "six rule ids" and did not mention the other three.
- Whether he opened the packet file is not known.
- The words "the listed names" do not settle which listing is meant. At their first
  use, at 09:39:43 UTC, they pointed at the table of 09:37:05 UTC, the wider listing.
  At their second use, at 12:46:14 UTC, they stood in a point about the questions as
  restated in the short form. The point he answered "5 - ok" uses them a third time
  and points at no message, and the reading he called correct says "the names as
  listed" and points at none either. So the message of 09:39:43 UTC cuts towards the
  wider listing, the last listing put to him is the shorter one, and the record
  cannot say which he had in mind. For the rows marked "No", what is on record is one
  row of the table of 09:37:05 UTC and the packet. Each of those names stays the
  choice of whoever the table and the notes below name, and his "2 - correct" is not
  a separate decision of his on any one of them.

*The graphs.* Both listings recommended the same order. At 09:37:05 UTC: "**A: the
core graph, then each of the six (my recommendation).**" In the short form: "**A: all
seven** (my recommendation): core first, then each dataset." So the reading he
confirmed is: the core graph of this repository is converted to the new format first,
and then each of the six dataset graphs Chinook, Northwind, Pubs, Employees, Sakila
and AdventureWorks, one pull request each.

**Recorder's account of what had been published,** as it stood when this record was
written on 9 October 2026. `main` of this repository (commit `dd5ce32`) describes
`meaning/draft-1` only and does not contain the string `meaning/draft-2`. The newest
release of the Go checker ([`meaninggraph/cli`](https://github.com/meaninggraph/cli))
is v0.3.0; its repository holds the string in one test case only, as the format line
of a file that the checker refuses. `main` of the registry (commit `ee2f5ba`) does
not contain it. Two pull requests of this repository named the new words; both were
open and neither was merged: the one that adds these three records, and
[#7](https://github.com/meaninggraph/core/pull/7), which changes the format reference
and the checker for `meaning/draft-2`. This record was written after his "2 -
correct".

### What the approval authorises

**On record, the card as it stood when he answered:**

> Approval would authorise: the two renames in MeaningGraph's format document, schema, CLI and readers, and the search kind, in Phase 3, with the old format read until no registered graph uses it. Approving as written also fixes one detail, the identifier meaning/draft-2; change it in the note. No published graph is edited without its owner.

**Recorder's account.** The sentence is the proposal author's wording. The format
document is `FORMAT.md` in this repository and the schema is `meaning.schema.json`.
"The search kind" refers to another sentence of the card: "The search gateway's kind
meaning_field, shown as "Fields", becomes meaning_property with one reindex." The
sentence about the identifier told him that he could change the string in the card's
note. What follows from his sending no note is set out under "The format identifier".
The card does not say who a graph's owner is, or what counts as that owner's consent
(see N46 below).

### Takes effect

**On record, the card:** "in Phase 3, with the old format read until no registered
graph uses it". Phase 3 is the proposal's name for the stage in which the formats and
tools around ModelSpec follow ModelSpec's change of words. ModelSpec's
[decision 0022](https://github.com/specscore/modelspec/blob/main/spec/decisions/0022-prose-now-format-change-on-the-owners-word.md)
lists the phases and says of Phase 3 that it starts "On the owner's word, after Phase
2."

**On record, the words on which Phase 3 started.** Decision 0022 has this entry:

> 2026-10-09 — The owner lifted the condition that the format change wait for the launch. His message: "Can you do other phases or do I need new session? You don't need to depend on DataTug lifecycle". The session recording this reads it as releasing Phase 2 and, after it, Phase 3. Phase 2 started the same day.

**On record, the word "proceed".** A later entry of decision 0022, under the same
date, is about another answer of his, on making the old spelling an error, and about
the session's reading of that answer. That entry ends:

> His next message was "proceed", which does not say whether the reading is right.

**Recorder's account.** Not in force when this record was written. `FORMAT.md` at
commit `dd5ce32` describes `meaning/draft-1` with the kind `attribute` and the binding
key `property`, and this record changes no word of the format. The decision takes
effect for the format when `FORMAT.md` and the schema in this repository are changed
to describe `meaning/draft-2`, and for each reader when that reader is changed. A file
in `meaning/draft-1` keeps its words and stays readable. A published graph takes the
new words only when it is converted, in the order he confirmed above.

### Not decided by the owner

Recorder's notes. The owner answered the two chat questions and, on 9 October 2026,
the question about publishing and converting. The points below touch this decision
and are not decided by him. Approving this record approves none of them. Each note
says whose recommendation or choice the point is, as the implementation contract for
this format and the packet of questions prepared for him record it (both written on 9
October 2026, not published). The numbers are the contract's, in its section "Not
decided by the owner". The notes give the state on 9 October 2026, when this record
was written.

Who is who: the proposal's author is the session; the contract's author and the code
reviewer are two other assistant sessions that worked for the owner on 9 October
2026; the lead is named above.

About the identifier and the words:

- **N43. The identifier `meaning/draft-2`.** The session's suggestion. The D14 card
  as it stood said that approving as written fixes it and that he could change it in
  the note; the D15 card asked him to confirm it or to change the string in the note.
  He answered yes in chat, with no note. That a yes with no note fixed it is the
  session's reading (above), and nothing of his that the recorder read confirms that
  reading. On 9 October 2026 the identifier itself was in the question he answered
  "5 - ok", in the reading he called correct and in every listing put to him.
- **N34. Which changes need the new identifier.** The card says that both renames
  need it. That the two role names of decision 0001 do not is the proposal author's
  text.
- **N44. Whether the old words, `kind: attribute` and `property:` on a binding, are
  errors in a file of the new format.** The card says "Rename". That they are errors
  is the contract author's recommendation.
- **N41. Whether a reader checks that `format` is the first line of a file.** The
  contract author's recommendation, which departs from the proposal's text.

About reading the two formats:

- **N21. The verdict for a graph whose files are in two formats.** The contract
  author's recommendation.
- **N59. What "one graph" is for that rule.** The code reviewer's recommendation.
- **N36. That the files of one graph change format together.** The proposal author's
  text.
- **N22. A graph in the new format that pins a graph in the old one.** The contract
  author's recommendation.
- **N37. How a graph in the old format reads a graph in the new format that it
  pins.** The proposal author's text.
- **N23, N26 and N51. Whether a file in the old format gets a notice, what the new
  findings are called, and how severe they are.** The notices and the names are the
  contract author's recommendation. The severity is the lead's choice; no
  recommendation existed.
- **N50. How a file refused for a word of the wrong format is reported.** The code
  reviewer's recommendation.
- **N52. The shape of the checker's JSON report when one run checks graphs of two
  formats.** Nobody's choice yet; no recommendation existed. It is left to the pull
  request that changes the checker.
- **N25. How the two schemas are packaged, and the name of the second file.** The
  contract author's recommendation.
- **N58. Whether the dataset repositories may take up the new Go checker before their
  pins move.** The contract author's choice, as a consequence of N25.
- **N24. A command that rewrites a meaning file, and its name.** The contract
  author's recommendation. The proposal names no such command.
- **N31. The search kinds.** `meaning_property` is the card's word. The rest is the
  contract author's recommendation; the part about value sets is in decision 0003.
- **N49. Whether the conversion of the core graph waits until the search service has
  been deployed with the new kinds.** The contract author's recommendation; it is on
  the plan.

About the old format:

- **N29. When `meaning/draft-1` stops being read.** Not decided. The card says "with
  the old format read until no registered graph uses it" and does not say who decides
  that it is then dropped. The lead put the point on the plan; the owner is asked
  when no registered graph uses the old format.
- **N55. Whether a graph that is not registered counts for "no registered graph uses
  it".** Nobody's choice yet; no recommendation existed. It is on the plan.
- **N28. Whether a representation contract of OpenVaultDB, formats 1 to 3, may name a
  meaning file in the new format.** Not decided. OpenVaultDB's
  [decision 0011](https://github.com/openvaultdb/openvaultdb/blob/main/spec/decisions/0011-representation-contracts-may-point-at-a-model-in-either-modelspec-vocabulary.md)
  is about the ModelSpec vocabulary of a model and sets no rule for meaning files.
  The point is on the plan. Until it is decided, the two graphs that such a contract
  names stay in `meaning/draft-1`; that is the contract author's recommendation.

About converting graphs:

- **N61. Which graphs are converted, and when.** Put to the owner as the second of
  the format questions. His "5 - ok" and "2 - correct" are quoted above: the core
  graph, then each of the six dataset graphs. No word of his covers the three other
  registered graphs, GeoNames, ROR and ECB daily; they are not part of that question.
- **N32. How many pull requests move the dataset graphs, and in what order.** The
  reading he confirmed says "one pull request each". The order among the six, and the
  pull requests in the registries, are the contract author's recommendation, drawn by
  inference from an answer of his to a neighbouring question.
- **N54. How the graphs written by a generator are converted.** The code reviewer's
  recommendation.

About the work as a whole:

- **N30. Whether the owner's release of Phase 3 covers the work on this format.** No
  word of his of that release names this work. That the words quoted under "Takes
  effect" cover it is the lead's reading. His answers of 9 October 2026 above are
  about this format by name.
- **N46. Who "its owner" is in the card's sentence "No published graph is edited
  without its owner", and what counts as that owner's consent.** The card does not
  say. On record: each of the ten graph records in
  [`meaninggraph/registry`](https://github.com/meaninggraph/registry) (read at commit
  `ee2f5ba`) names one maintainer, `trakhimenok`. The question he answered was "when
  are your seven graphs converted?"; it did not ask for consent in that word. That his
  answers above are the consent of the owner of the seven graphs to their conversion
  is the lead's reading. How a pull request that edits a graph is reviewed and landed
  is the lead's choice.
- **N27. Which checker decides when two checkers disagree.** The contract author's
  recommendation.
- **N47. When MeaningGraph's part of Phase 3 is done.** Nobody's choice yet; no
  recommendation existed. It is on the plan.
- **N60. The form of this record and its status.** The form, a SpecScore decision
  file in this repository, is the contract author's recommendation. The status, In
  Review until the owner approves this text, is the lead's choice.

### His approval of this text

Recorder's account. His answers quoted above, "D14a yes, D14b yes" and, on 9 October
2026, "5 - ok" and "2 - correct", were not approval of this text, which was written
afterwards. The text was put to him separately, and the status stayed In Review until
he answered.

**On record, what was put to him** (the stored record of the lead's conversation with
him, not published). On 2026-10-10 at 04:14:26 UTC the lead's message to him had a
section "Needed from you" with three numbered items. The third read, exactly:

> 3. **Four decision texts to approve:** MeaningGraph records 0002, 0001 and 0003 on `meaninggraph/core` `main`, and OpenVaultDB decision 0012 on `openvaultdb/openvaultdb` `main` at `385ca56`.

**On record, in the same stored record.** For the three records of this repository
that item names the branch and no commit. An earlier message of the lead's, on
2026-10-09 at 22:11:22 UTC, had given him a link to each of the three files at commit
`d412889be157a56715b83c345b619018158527ef`.

**The owner's words**, 2026-10-10 at 05:30:31 UTC, the third line of one message of
three lines that answers the three items by number (its other two lines answer items
1 and 2, which are not part of this decision):

> 3 all approved

Recorder's account. What he approved is this file as it stood on `main` of
`meaninggraph/core` at commit `e57f57e786047745ba5f2b735d9e2fd3516c2b69`, the tip of
`main` when he answered. The three records of this repository, 0001, 0002 and 0003,
were added to `main` by commit `d412889be157a56715b83c345b619018158527ef` and were
not changed between that commit and his answer. His answer approves this text as it
stood there. As the section "Not decided by the owner" says, approving this record
approves none of the points it lists, and his answer is not an answer to any of them.
The commit that records his approval changes the status, adds this section and
changes this record's row in the index; it changes nothing else in this file.

## Rationale

**The owner's words,** said earlier the same evening, on 8 October 2026 at 21:09:31
UTC, before the two questions were put to him (the stored record, not published). The
message in full, with his spelling as typed:

```text
My original idea was to use different member names on each level.

Like
MeaningGraph - preoprty
MOdelSpec - field
OVDB - column

So when you name field "Gender" you know what level it is
```

In the stored message the line "Like" is followed by one space.

**Recorder's account.** In that message he names the member word for each of three
levels himself. For MeaningGraph he typed "preoprty", which the recorder reads as
"property"; D14a gives that word to MeaningGraph's kind. The card quotes the first
sentence of the message. His reply of 23:00:51 UTC gives no reason of its own. The
card's other reasons are the proposal author's and are not repeated here.

## Declined Alternatives

On record, these are the card's other answers. His reply does not mention them, and
the chat asked for a yes or a no.

### Keep attribute

For part a the card offered "Rename to property" and "Keep attribute". He answered
"D14a yes" to the chat question that proposed the rename.

### Keep property: as the binding key

For part b the card offered "Rename to field:" and "Keep property:". He answered
"D14b yes" to the chat question that proposed the rename.

## Consequences at Decision Time

Recorder's account, written on 9 October 2026.

- This record changes no rule of the format. `FORMAT.md` gains one short paragraph
  that links to the three decision records.
- No meaning file is edited by it, here or in any other repository.
- When this record was written, no file on `main` of this repository named the new
  words.
- The points listed under "Not decided by the owner" stay open or stay somebody
  else's choice, as each note says.

## Observed Consequences

None observed yet.

## Affected Features

None at this time.

---
*This document follows the https://specscore.md/decision-specification*
