---
title: "Meeting Assistant — Surface interaction specs (design pass)"
date: 2026-06-13
type: design-brief
origin: docs/plans/2026-06-10-001-feat-intake-projects-follow-through-plan.md
design-system: DESIGN.md, .impeccable/design.json, PRODUCT.md
mockups: docs/design/2026-06-13-shaped-screens.html
---

# Meeting Assistant — Surface interaction specs

The output of the impeccable design pass: build-ready interaction specs for every surface, shaped
on the locked design system (`DESIGN.md`) and grounded in evidence-backed UX research.
Clickable mockups: `docs/design/2026-06-13-shaped-screens.html`. This brief defines behavior, states,
flows, copy, and the shared-component contract; it does not write the `.tsx`.

Sample domain used throughout: project **Atlas migration**, project **Hiring Q3**, meetings **Team
weekly** and **1:1 with Maria**, people **Priya / Maria / Dana**, today **Saturday June 13 2026**.

---

## Scope

Eight surfaces shaped here:

1. Navigation / IA (app shell)
2. Capture inbox + destination picker (U3)
3. Verification screen (U4b/U5) — the trust core
4. Cockpit + daily focus + quiet escalation (U6/U9/U10)
5. Per-project view (U8)
6. Empty states + first-run / progressive-trust onboarding
7. Meetings list (R17)
8. Meeting detail — the baseline source-oriented view (R17)

All eight reuse the shared component contract below; the meeting surfaces (7, 8) were shaped in a
follow-on pass after the coherence review flagged them as the one gap.

---

## Shared component contract (canonical)

The coherence pass found the surfaces highly consistent; these are the canonical definitions every
surface must build to. Where two specs diverged, the resolved winner is recorded.

### The commitment / item row (the central reused component)

Appears on Verification, Cockpit, and Per-project (and a degraded chip on Capture). Visually identical
across surfaces (consistency is a trust lever). Top to bottom:

1. **Control / pill row:** owner pill (left), project tag pill, inline quiet ghost actions (right).
2. **Item text** = the model paraphrase, Slate `#25262B`, body 16/1.6. **Slipping rows render the
   paraphrase in Secondary-text `#706C82`** — the only ink change urgency may make.
3. **Inferred fields** inline, Inferred Ink treatment when unconfirmed.
4. **Provenance Inset** directly beneath, **pre-expanded, never behind a click**, on every surface
   and breakpoint.

Behavior: rows keyed by stable item id; the stale-while-revalidate reconcile never reshuffles a
visible row; Done = strikethrough + Indigo check (no green); inline edits make zero AI calls.

**Canonical verbs (one name per operation across all surfaces):**
- Complete an item → **Done** (Per-project's "Complete" renamed to Done).
- Remove with a reason → **Dismiss** (Per-project must expose Dismiss too; its omission was a gap).
- Defer → **Snooze** (absent pre-commit on Verification, correct).
- Change owner → **Owner** inline flip.
- Action sets stay surface-specific: Verification = Edit + Dismiss; Cockpit = Done + Dismiss + Snooze;
  Per-project = Done + Dismiss + Snooze + Owner.

### Owner pills
- **I owe:** `#F2F3F4` fill + Slate-Dark text + down/inward icon, label **"I owe"**.
- **Waiting-for:** `#C6C2E0` (Indigo-6) fill + Indigo text + outward icon + person name, label
  **"Waiting on {name}"** (canonical everywhere; the bare-name variant is dropped).

### Project tag pill / link
`#F2F3F4` pill + small accent dot + name, clickable → project view. **The dot is a stable
per-project identity color**, assigned once and reused on every surface (Atlas = Plum `#CE5780`,
Hiring Q3 = Rose `#E96B6E`, etc). The picker distinguishes meetings from projects by **group header
+ metadata**, not dot color. `#C6C2E0` is reserved strictly for the waiting-for pill and must not
appear as a tag dot.

### Inferred mark (Inferred Ink rule)
Inferred-unconfirmed value = Secondary-text `#706C82` + dotted underline + lowercase **"inferred"**
tag. Confirmed = solid Slate + small Indigo check (no green). Graduation on human touch is the
single most important micro-interaction.

### Provenance Inset
Tinted `#F2F3F4` well, italic, Slate-Dark, the **deterministically anchored** span (not the
model's emitted quote text). Pre-expanded everywhere. Visible label **"From {source}, {date}"** on
cockpit/project, **"From your note:"** pre-commit at verification; both carry an SR-only association.
Length-bounded with a "show full quote" ghost expander, never collapsed by default. Unanchored
fallback (identical wording everywhere): **"Source not found in note. Check this before accepting."**

### Buttons
- **Primary:** Indigo `#2C2A4A` / white / 6px, hover `#423D6E`. Never Amber.
- **Secondary:** white / Indigo text / Slate-Light `#D2D4D7` border.
- **Ghost:** transparent / Slate-Dark.
- **Disabled:** Slate-Medium `#7F8186` text, no hover.
- **Rail Capture** is the one inversion variant (white fill / Indigo label, on the dark rail).

### Destination picker (combobox float)
Reused by Capture (primary) and Verification (project retag), identical:
- Float (`--float` shadow), white, 8px radius, `role=listbox`, internal type-to-filter input.
- **Manual selection: nothing highlighted on open (`aria-activedescendant` empty).** Commit requires
  explicit click or Arrow+Enter. Stray Enter does nothing. This is the structural no-inference
  guarantee.
- "Create new" rows are explicit-only (never create-on-Enter), seeded with the typed query.
- Degrades to a plain visible choice list under ~6 total destinations.
- Exact-name collision warns ("A meeting named 'Team weekly' already exists, use it?") rather than
  silently duplicating. Verification's retag picker inherits all of this verbatim.

### Section / group headers
Aptos 600 UPPERCASE 12px / +0.02em, **Secondary-text `#706C82`** (canonical; align
Verification's one-off Slate-Dark to this).

### Empty-state atom
Two layout variants only: **centered** (first-run whole-app, max ~560px) and **left-aligned in-
surface** (per-region empties). title (sans 600 18px) + reading-16px body + one Indigo primary
action. No surface invents a third empty pattern.

### Inline error / inline confirm / spinner
InlineError = Secondary-text styling, **never red**. InlineConfirm = neutral styling, two buttons,
focus-trapped. Spinner = 3-dot with a `prefers-reduced-motion` static-text fallback. Every failure
message **leads with the data-safety reassurance** ("Your note is saved." / "Your items are
unchanged." / "Your real data is not affected.") — a hard copy template.

---

## Surface 1 — Navigation / IA (app shell)

**What:** persistent chrome wrapping every screen. Desktop = a fixed 220px **Indigo left rail**
(wordmark, a white-filled **Capture** button, three destinations Cockpit / Meetings / Projects, and a
pinned Export / Import / Clear-sample cluster at the foot). Phone = a fixed **bottom tab bar** (three
destinations + a raised center Capture action) plus a slim top context bar.

**Decisions:** Capture is an action (a verb), not a destination — it is Indigo, so it reads as the
primary verb without spending the scarce Amber. The **active destination** is marked by exactly
one Amber dot + an Indigo/white full-weight label + `aria-current` (never color alone).
Drilling into a meeting/project keeps the **parent** destination marked and delegates item location to
a surface-owned breadcrumb (desktop) / back chevron (phone) — one section signal, one item signal.
Cockpit is the cold-open landing; the shell renders deterministically and never waits on data.

**Shell owns:** the app-global **"This is sample data / Clear sample"** strip while any sample record
exists (resolved from the empty-states open question), and the single Import entry that all import
paths route into.

**Key states:** default (per destination), inside-detail (parent active + breadcrumb), first-run
(shell renders instantly, Capture is the loudest control), boot loading (chrome instant, center
spinner), storage-read error (neutral InlineError in center, chrome intact), Capture-open (Capture
takes an Amber soft-tint, all destinations inactive), reduced-motion (instant token swaps).

**Microcopy:** Capture · Cockpit · Meetings · Projects · Export · Import · "Backup downloaded" ·
"Clear sample data" · "Could not load saved data. Your notes are safe. Retry." · breadcrumb "Projects
/ Atlas migration".

---

## Surface 2 — Capture inbox + destination picker (U3)

**Primary action:** paste a note, choose one destination (existing/new meeting or project) from a
picker with nothing selected by default, then "Save and analyze" persists the raw note (R3) and begins
extraction.

**Layout:** a centered ~720px column. A recessed `#F2F3F4` capture well is the gravity center; a
"Send to" destination row sits beneath it; "Save and analyze" (Indigo) is pushed right. The
picker is the only floating element (everything else flat). **Paste-then-route:** the textarea gates
nothing, the note is saved the instant Save is pressed, and the destination is the one required choice
— frictionless capture while routing stays an explicit human act.

**Picker:** type-to-filter combobox, grouped **Recent → Meetings → Projects → explicit "Create new
'<typed>'"**, each suggestion annotated with quiet metadata (cadence / last-met / parent / open-todo
count). Nothing highlighted by default. Create-new drops into lightweight inline setup (name
prefilled, rest optional, record written before the note attaches).

**Key states:** default · text-entered-no-destination (helper "Pick where this note belongs to save
it.") · picker open / filtering / no-match / loading · first-run (onboarding picker + "Try a sample
note") · destination chosen · saving ("Saving note") · analyzing ("Analyzing your note" / "Analyzing
part 2 of 4" with a determinate hairline) · analysis failure (neutral, "Your note is saved under
Atlas migration. Retry analysis.") · chunk partial failure ("Analyzed 3 of 4 parts. Part 2 could not
be read." → Retry part 2) · validation block.

**Binding:** uses **no Amber** (capture is not a "what's next" moment). All failures neutral, no
red. No-inference enforced structurally.

---

## Surface 3 — Verification screen (U4b/U5) — the trust core

**Primary action:** review each proposal against its pre-expanded source quote, correct in place
(edit text, flip owner, retag, confirm due date, dismiss), then **Accept** the set into truth. Inline
correction is primary; one conversational re-run is the secondary escape hatch.

**Layout:** a ~760px review column. Header ("Review extraction" + "Found these in your notes. Check
each before saving." + count "6 items from Team weekly, June 13. Nothing is saved until you accept.").
A ghosted suppressed-match affordance if present. Proposals grouped **To-dos → Decisions → Possible
completions**, each a flat white card carrying its control/pill row, paraphrase, inferred marks, and
**Provenance Inset** one glance below. Genuinely ambiguous / unanchored items sort to the top of their
group at **flat loudness** (no badge/red). Sticky bottom bar: "Add or fix something" (left) + "Accept
N items" (right). No per-item Accept — one clean commit boundary.

**Key micro-interaction:** touching an inferred field flips it from Inferred Ink → confirmed
(Indigo check). Accept never auto-confirms inference (R20).

**Key states:** default · first-run (sample banner) · chunked-loading (early proposals render, Accept
disabled) · partial-chunk failure · parse error ("The analysis came back unreadable. Your note is
saved. Try analyzing again.") · shape-warning (missing fields surfaced, never silently dropped) ·
empty extraction (calm, not error) · item-being-edited · unanchored ("Source not found in note.") ·
ghosted dismissed-match (Accept anyway / Dismiss again) · re-run in progress ("Looking again, keeping
your accepted edits.") · re-run failure · accepting ("Saving 6 items") · background summary failure
(items committed first; non-blocking note).

**Binding:** provenance pre-expanded on every item (the screen's reason to exist). Ghosted
dismissed-match suppression lives **only here** (centralized). Dismiss captures reason → tombstone.
Voice plain/mechanical.

---

## Surface 4 — Cockpit + daily focus + quiet escalation (U6/U9/U10)

**Primary action:** see the single true do-next item (the one Amber marker) and act inline (Done
/ Dismiss-with-reason / Snooze) without leaving, trusting the order because inputs were verified and
ranking is deterministic.

**Layout:** a calm ~760px scroll column. Header (serif greeting "Saturday, June 13" + meta "3 to
do next, 1 slipping" + a quiet "All projects" filter). The **daily focus** card (eyebrow "TODAY'S
FOCUS", sans reading prose doing **consequence framing**) or, when nothing slips, the **all-clear
inverted-alert banner** (Indigo check, Display size, "All commitments current, nothing slipping."
— the loudest positive thing, achieved by size/placement, not by spending Amber). Then four fixed
groups: **Do next → Due soon → Waiting on others → Slipping**. Order is the urgency channel; Slipping
sits at the bottom in Secondary-text gray with plain relative-time words. **Exactly one Amber dot
on the page** (the true do-next). Do-next hard-capped at 5 by deterministic ranking; overflow demotes
with a quiet "2 more in Due soon".

**Quiet escalation:** an ignored item changes **form** across visits at flat loudness — plain
restatement → question ("Still owe Priya the cutover plan?") → consequence/age ("Priya has waited 9
days for the cutover plan.") — on a back-off cadence, never louder/redder.

**Confirmed-truth gate:** an inferred due date may sit in **Due soon** (marked, with a "Confirm date"
nudge) but **never** in overdue/slipping until confirmed (R20). The cockpit's pressure groups are
always confirmed truth.

**Key states:** default · all-clear · empty/first-run · loading (groups paint instantly from cache;
"Refreshing from records" ambient) · focus recompute in progress / failed (last-cached + neutral
inline error, never blocks) · no-cache-and-failed · filtered-to-one-project · stale-escalated ·
post-dismiss 5s undo.

---

## Surface 5 — Per-project view (U8)

**Primary action:** read a project's full state in one place; act on an open commitment from its
provenance row. Comprehension-dominant.

**Layout:** a ~760px column of white cards. Back link → header card (serif name "Atlas migration",
quiet status pill, target date in tabular figures, contributing-meetings meta, Edit project) → summary
card (sans reading prose + quiet Regenerate) → **Open commitments** (I owe / Waiting for sub-sections
of the **same commitment row** as the cockpit) → Decisions log → Recent updates timeline →
Contributing meetings (tag links). Slipping items pull to the top of their sub-section in gray + plain
words. A done-project-with-open-items contradiction shows as one quiet line ("Marked done, but 2
commitments are still open below."), never an alarm. Zero-item sections collapse to a one-line
onboarding empty state so the lens reads complete.

**Reuse, not reinvent:** the commitment row, pills, inferred mark, provenance inset, and tag link are
the cockpit's components verbatim. The summary "narrative" is sans (serif is reserved for the name).
**No Amber** by default (do-next selection lives in the cockpit). The ghosted dismissed-match row
was **removed** from this surface (suppression is centralized at Verification).

**Key states:** default · loading (instant from cache, ambient refresh) · regenerate in progress /
error (prior summary preserved) · empty project · first-run sample · done-with-open · on-hold ·
single-slipping · reconcile error.

---

## Surface 6 — Empty states + first-run onboarding

**Primary action:** run the built-in **sample note** through extraction (a no-risk test drive on
throwaway data), or — for a returning user — Import from a previous version. One concrete next step,
framed as a beginning, never a deficit.

**First-run home (true zero-data):** a centered ~560px column. serif "Meeting Assistant" → one
plain sans sentence of what the app does → an **honest limitation line** ("The tool proposes items
from your notes. You review and confirm each one before it counts. It can be wrong, so review is
required.") → one sample card (a single Amber do-next dot beside "Try it on a sample note", body,
"Run the sample note") → a quiet "Import data from a previous version" link. No illustration pile, no
competing CTA.

**The sample drive** is the highest-leverage trust move: it runs the real extraction on a hard-coded
sample note (destination locked to "Team weekly (sample)", disclosed — not model inference), showing
provenance insets and inferred marks doing their job before the skeptic risks a real note. One-click
"Clear sample" (neutral confirm: "Remove the sample meeting and its items? Your real data is not
affected.") removes all sample records + tombstones/item_state and rebuilds the ledger.

**Per-surface empties** (cockpit, meetings list, project list, meeting view, project view) keep their
chrome and show a left-aligned teaching block (one sentence + one action), scoped to that surface,
never re-explaining the whole app. **Empty cockpit** ("Your day surfaces here") is distinct from
**all-clear cockpit** ("Nothing needs you right now." — open items exist, none do-next/slipping).
**No items found** is a calm outcome ("No clear to-dos or decisions in these notes. The note is saved
to Team weekly."), not an error — the branch is on call success, not item count.

---

## Surface 7 — Meetings list (R17)

**Primary action:** scan your recurring and one-off meetings, jump into one, or brief yourself before
the next instance.

**Layout:** a ~760px column. Header: a sans **headline** "Meetings" (sans, not serif — this is a list
page, serif is reserved for entity names), a quiet search field, and an Indigo "New meeting" button
right-aligned. Below, a clean **list** of meeting rows (not an identical icon-card grid — that is the
SaaS-slop pattern the brand rejects). Each row, in a flat white card:
- Meeting **name** in serif (clickable → meeting detail).
- A meta line (sans, tabular figures): cadence ("Weekly"), purpose, and **"Last met Jun 6 · Next
  Jun 15"**.
- The **open-todo count** as quiet plain text ("3 open"), Secondary-text — **never a red badge or
  climbing count**.
- A right-aligned ghost **"Brief me"** action (the one AI action on this surface).

**Key states:** default (list) · empty (the empty-state atom: "Recurring and one-off meetings live
here" / "Each meeting keeps its own notes, to-dos, decisions, and talking points. Create one, or
capture a note and point it at a new meeting." / "New meeting") · search active · no-results ("No
meetings match '{query}'.") · loading (instant scaffold, ambient refresh).

**Binding:** no Amber (not a what's-next surface); counts are quiet plain text; Brief me fails
gracefully (inline, never blocks the list); voice plain.

**Microcopy:** "Meetings" · "New meeting" · "Search meetings" · "Last met {date} · Next {date}" ·
"{N} open" · "Brief me" · "No meetings match '{query}'."

---

## Surface 8 — Meeting detail, the baseline source-oriented view (R17)

**Primary action:** see and run a single recurring meeting — read what it produced (notes, the
commitments, decisions, talking points), capture new notes into it, and prep for the next instance
with "Brief me". This is the **source** lens (by meeting), the complement to the project (theme) lens.

**Layout:** a ~760px column. Breadcrumb "Meetings / Team weekly" (Meetings as a link). Then, top to
bottom:
1. **Header card:** serif name "Team weekly"; a meta row (cadence "Weekly" · purpose ·
   "Next Mon Jun 15" · key people Priya, Maria, Dana). Actions right: **"Brief me"** (secondary),
   **"Ask"** (ghost), **"Edit"** (ghost overflow → the setup modal).
2. **Scoped capture well:** a recessed `#F2F3F4` well "Paste notes from this meeting" + "Save and
   analyze" (routes into the same U4a/U5 capture→verify flow, destination locked to this meeting).
3. **Summary** card: sans reading prose + quiet "Regenerate" (shared failure contract: prior summary
   preserved on failure).
4. **To-dos** card: the **same commitment rows** as the cockpit/project (owner pill, project tag,
   inferred/confirmed due, pre-expanded provenance), with create-todo and complete/owner inline;
   completed items collapse to a quiet "Completed (N)" expander.
5. **Talking points** card: a list of points, each with an inline "Mark discussed" toggle (discussed
   ones strike + demote); add-a-point inline.
6. **Decisions** card: the decisions log (paraphrase + provenance + source date).
7. **Notes** card: the raw notes list, reverse-chronological (timestamp in tabular figures + content),
   each view / edit / delete (delete behind an inline confirm).

**On-demand panels:**
- **Brief me** → a briefing rendered as sans reading prose in a panel/card with the four baseline
  sections: **Since last time · Open with you · Suggested talking points · Questions to ask**. One AI
  call; on failure a neutral inline error, the panel never blocks the page.
- **Ask** → a per-meeting chat over this meeting's context (summary, recent notes, open to-dos,
  talking points); a compact chat panel; AI, graceful failure.
- **Edit** → the setup modal (name, cadence, purpose, key people, next date) + **Delete meeting**
  behind a red destructive-confirm (the one place red appears on this surface).

**Key states:** default (populated) · empty meeting (focused capture well + one-line section stubs +
"Brief me" disabled with "Available after the first note") · analyzing · Brief me in progress / failure
· Ask in progress / failure · edit modal · delete confirm (red) · summary regenerate (prior preserved)
· note edit / delete confirm.

**Binding:** to-dos carry full provenance + inferred/confirmed marks (same contract); open-todo count
is quiet; Brief me and Ask are the AI actions (graceful, additive, never block); talking-points and
notes are non-AI CRUD; **Delete meeting** is the sole red destructive-confirm here; no Amber (this
is the source view, prioritization lives in the cockpit); voice plain, no first-person AI in the
briefing ("Since last time" framing, not "I noticed").

**Microcopy:** breadcrumb "Meetings / Team weekly" · "Brief me" · "Ask" · "Edit" · "Paste notes from
this meeting" · "Save and analyze" · "Regenerate" · "Mark discussed" · "Add a talking point" ·
"Completed (4)" · briefing sections "Since last time / Open with you / Suggested talking points /
Questions to ask" · "Delete meeting" · delete confirm "Delete Team weekly and all its notes, to-dos,
and decisions? This cannot be undone." (red — this IS destructive to real data, unlike Clear-sample).

---

## Cross-surface flows

- **Capture → Verification → source view:** raw note saved first (R3) → chunked/single extraction →
  Verification. Accept writes items → rebuilds ledger → fires summary in background → lands on the
  **source meeting/project view** (not the cockpit) with "Saved N items". The cockpit updates
  passively on its next open. **Boundary:** single-pass progress shows on Capture (user reaches
  Verification when done); chunked transitions to Verification early and shows remaining-chunk
  progress there.
- **Cockpit/project row → source:** every row's provenance link routes to the contributing meeting or
  project; the rail keeps the parent destination active + a breadcrumb. Round-trips back.
- **Verification project tag → project view:** the human-chosen tag is the only way items enter a
  project view (R14); membership derives from the tag on the source record.
- **Dismiss → tombstone → never resurfaces:** dismiss (reason: Done/Redundant/Wrong) → `app:
  followthrough` tombstone + source-item status mutation; exact-key matches silently suppressed; fuzzy
  matches render ghosted with restore **only at Verification**; ~5s in-memory undo before flush.
- **Snooze is global:** a snooze from any surface writes one `app:followthrough.item_state.snooze_
  until` and suppresses the item on the cockpit too.

---

## Terminology (canonical)

| Concept | Canonical | Never |
|---|---|---|
| Home / prioritization surface | **Cockpit** | "dashboard"/"home" in user copy |
| Top-priority group | **DO NEXT** | "Today" (that is the focus narrative eyebrow "TODAY'S FOCUS") |
| Aging items | **Slipping** group + plain words ("committed 9 days ago, no movement") | "overdue"/"stale" as a label, badge, or color |
| Owed-by-others | group "Waiting on others"/"Waiting for"; pill **"Waiting on {name}"** | bare name |
| Front door | **Capture** (verb) | "New note" except as the capture page title |
| Re-run | **"Add or fix something"** + **"Look again"** | — |
| Commit | **"Accept N items"** | — |
| Sample | hero **"Run the sample note"**; elsewhere **"Try a sample note"**; **"Clear sample"** | — |
| Background reconcile | **"Refreshing from records"** | — |

---

## Binding-constraint audit (result)

The coherence pass scanned all six specs against the locked rules and found **no hard violations**.
Notable confirmations: zero red/badge/count for stale anywhere; no confidence numbers; no green
(Done/all-clear use an Indigo check); provenance pre-expanded on every surface and breakpoint;
no em dashes in any shipped copy; no first-person AI voice; save-before-analyze and never-lose-input
honored on every failure path. Two edges were resolved conservatively: the single first-run Amber
dot (sanctioned exception) and the **neutral** (not red) Clear-sample confirm. Build-time guards to
keep: R20 gate enforced in the **ranking function** (not just the view); at most one Amber element
rendered at any time; an em-dash lint on user-facing string literals.

---

## Open questions for Bryan

1. **WAITING ON OTHERS vs WAITING FOR** group labels (cockpit vs project). Recommend keeping both with
   the unified "Waiting on {name}" pill. Want one uniform group label instead?
2. **Project tag dot = stable per-project identity color** (overriding the picker's type-encoding).
   Confirm — this is the one genuine component conflict.
3. **Ghosted dismissed-match centralized at Verification only** (removed from project view; never on
   cockpit). Confirm.
4. **Snooze is global** (a project-view snooze also suppresses on the cockpit). Confirm (else a bug).
5. ~~Missing Meetings-list / Meeting-detail spec~~ **RESOLVED 2026-06-13:** shaped as Surfaces 7 + 8
   above, to the same component contract.
6. **Sample-data banner owned by the shell** (app-global while a sample record exists). Confirm.
7. **Post-Accept lands on the source meeting/project view**, not the cockpit. Confirm intended.
8. **Clear-sample copy + styling:** neutral, "Remove the sample meeting and its items? Your real data
   is not affected." (over "This cannot be undone."). Confirm the softer framing.
9. **One Import flow (U11)** that rail Import, first-run Import, and any handoff all route into.
   Confirm no second path.

Plus carried forward from the surface specs: sample items counting toward cockpit counts before
clear; whether the project view needs its own Ask/chat (deferred with the people-lens); exact
picker-degrade threshold and RECENT cap (touch the data model — need sign-off); summary
last-regenerated timestamp.
