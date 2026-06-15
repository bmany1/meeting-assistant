---
date: 2026-06-06
topic: intake-projects-follow-through
---

# Trustworthy Intake, Projects, and Follow-Through

## Summary

A note-intake-to-action loop for the Meeting Assistant: paste a note dump into one inbox and point
it at a meeting or a project, the model extracts to-dos/decisions/updates that you verify (inline
fixes plus a conversational redo), and everything aggregates two ways — by meeting and by project —
feeding a daily prioritization cockpit that shows, instantly on every open, what to work on next,
what is due, and what is slipping, plus a once-daily AI focus narrative, backed by owner-tagged
commitments that resurface as they go stale.

---

## Problem Frame

Bryan's meeting notes live fragmented across OneNote notebooks. Recurring meetings exist as dated
instances, but nothing connects across them, and even within a notebook the entries are
disconnected. Project context is the worst case: a single project surfaces across several different
meetings, so its true state is scattered and never visible in one place. The result is that there is
no single trustworthy answer to "what should I work on next, what is due, what is slipping," and
reconstructing that answer means re-reading scattered notebooks and holding prioritization in his
head.

A second, equally important pain: Bryan does not trust AI to extract his notes correctly on the
first pass. Any system that silently ingests notes and presents results as fact loses his trust
immediately, and every downstream to-do, insight, and nudge inherits whatever the extraction got
wrong. Trust in the captured data is the precondition for trusting anything built on top of it.

This runs inside the hard constraints of a claude.ai artifact (see `CLAUDE.md` and
`meeting-assistant-spec.md`): one file, allowlist libraries only, `window.storage` key-value
persistence, keyless Claude calls capped at 1000 output tokens, and no server or background jobs, so
anything proactive must be computed when the app is opened, not pushed.

---

## Actors

- A1. Bryan (user/operator): pastes notes, chooses the destination, verifies and corrects
  extraction, acts on the cockpit. Opens the app multiple times per day.
- A2. Extraction model (Claude, in-artifact): proposes structured items, project tags, and the
  once-daily focus narrative. Bounded by the 1000-token output cap; never trusted on first pass.
- A3. Deterministic engine (in-browser, no AI): ranks the cockpit and computes staleness and
  resurfacing on app open, spending zero tokens.

---

## Key Flows

- F1. Capture and verify
  - **Trigger:** Bryan pastes a note dump into the inbox.
  - **Actors:** A1, A2
  - **Steps:** Pick a destination (existing/new meeting, or existing/new project) → note is saved →
    model extracts structured items (with proposed project tags for meeting notes) each carrying a
    verbatim source quote → Bryan fixes routine errors inline with no AI call, or triggers one
    conversational re-run when the model missed or misread → Bryan accepts the verified set.
  - **Outcome:** Verified items are committed to the ledger; the raw note is preserved regardless.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R7

- F2. View by project (lens)
  - **Trigger:** Bryan opens a project.
  - **Actors:** A1
  - **Steps:** Open the project view → see open to-dos, waiting-fors, decisions, a rolling summary,
    recent updates, and which meetings contributed, all gathered across meetings plus direct project
    updates.
  - **Outcome:** A project's full state is visible in one place without re-reading source meetings.
  - **Covered by:** R15, R16, R17

- F3. Daily prioritization cockpit
  - **Trigger:** Bryan opens the app (any time).
  - **Actors:** A1, A3, A2 (focus pass only)
  - **Steps:** Deterministic ranking across all meetings and projects renders instantly, grouped
    into do-next / due-soon / waiting-on-others / slipping → a cached once-daily AI focus line
    appears, recomputed only when new notes land or the day rolls.
  - **Outcome:** Bryan sees, at a glance, what to prioritize next.
  - **Covered by:** R12, R13, R14

- F4. Stale-commitment resurfacing
  - **Trigger:** Bryan opens the app.
  - **Actors:** A1, A3
  - **Steps:** The engine flags commitments past their cadence as stale (no AI call) → repeatedly
    ignored items escalate → Bryan taps done / snooze / dismiss.
  - **Outcome:** Open loops resurface on a near-daily rhythm; dismissed items never return.
  - **Covered by:** R9, R10, R11

---

## Requirements

**Capture and routing**
- R1. A single inbox accepts a pasted note dump; the user selects the destination — an existing
  meeting, a new meeting, an existing project, or a new project. The model never infers the
  destination.
- R2. A note sent to a meeting is stored as a note on that meeting instance; a note sent to a
  project is stored as a "project update" with no associated meeting.

**Extraction and verification**
- R3. The raw note is persisted before analysis runs, so a failed analysis never loses the note.
- R4. Analysis extracts structured items — to-dos (with priority and an inferred due date),
  decisions, inferred completions of existing open to-dos, and an updated rolling summary —
  preserving the baseline analysis behavior. Inferred completions are proposals subject to the same
  R7 acceptance gate as new items; an already-accepted to-do is never silently auto-closed without
  confirmation.
- R5. For meeting-sourced items, analysis also proposes a single project tag per item, chosen from
  existing projects or suggested as a new one; proposed tags are verified inline under R7 like any
  other extracted field. When the destination is a project (R2), items are auto-tagged to that
  project and no tag is proposed.
- R6. Every extracted item carries a verbatim source quote and a source reference (a meeting
  instance, or "direct update" with a date), surfaced as clickable provenance.
- R7. Verification is hybrid: the user can edit, delete, or re-tag any extracted item inline with no
  AI call; and can trigger a single conversational re-run (describing what the model got wrong) that
  re-extracts incorporating the feedback. The re-run preserves items the user has already accepted or
  edited and only adds or revises the items the user flagged, never regenerating the whole set.
  Extracted items are proposals until the user accepts them.

**Owner-tagged follow-through**
- R8. To-dos carry an owner classification of "I owe" or "waiting-for" (owed to the user by a named
  person), inferred at intake with the verbatim quote. Ambiguous ownership defaults to "I owe" and
  is flippable inline.
- R9. Each commitment carries an inferred cadence/interval (from its due date or the meeting's
  cadence) and a status; the cadence is correctable.
- R10. On app open, the deterministic engine flags commitments past their cadence as stale with no AI
  call; repeatedly ignored items escalate in prominence; one-tap done / snooze / dismiss is
  available; a dismissed item never resurfaces.

**Prioritization cockpit**
- R11. On every app open, a dashboard computed locally (no AI call) ranks open work across all
  meetings and projects, grouped into do-next / due-soon / waiting-on-others / slipping.
- R12. Once per day, a single AI focus pass produces a short narrative of what to tackle first and
  why; it is cached and recomputed only when new notes/updates land or the day rolls. When the focus
  recompute fails, the most-recent cached focus is shown alongside a small inline error, and the
  failure never blocks the deterministic cockpit.
- R13. The cockpit can be sliced/filtered by project.

**Projects (lens)**
- R14. Projects are a cross-cutting tag over extracted items; each item may carry one optional
  project tag.
- R15. A project has a name, a status (for example active / on-hold / done), and an optional target
  date; project target dates feed the cockpit like any other due date.
- R16. A first-class per-project view aggregates, across all meetings plus direct project updates:
  open to-dos, waiting-fors, decisions, a rolling project summary, recent updates, and which meetings
  contributed.

**Views and baseline**
- R17. The per-meeting view is preserved (notes, to-dos, decisions, talking points, per-meeting chat,
  Brief me) as the source-oriented view; all baseline features remain working.

**Migration and compatibility**
- R18. The expanded data shape bumps `schema_version`; Export includes it; Import validates the
  version and migrates or accepts prior versions so data carries across artifact versions.
- R19. Every AI and storage call is wrapped to fail gracefully with a small inline message and never
  destroys user data; every AI prompt that produces user-facing text avoids em dashes.

**Inferred-signal trust and output bounds**
- R20. Inferred fields that drive the cockpit — due date, owner, and cadence — are visibly marked as
  inferred versus confirmed in every view. An item whose cadence is only inferred is not auto-flagged
  as stale until its cadence is confirmed or an explicit default is applied, so unverified inference
  cannot masquerade as a trusted signal.
- R21. Extraction output is bounded so a single pass stays within the 1000-token output budget: a cap
  on items per pass and length-bounded source quotes. Truncated or invalid JSON is detected and
  surfaced as a recoverable inline error, never silent data loss.

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given a project update that came from a Slack thread, when Bryan pastes it
  and selects the project as the destination, then it is stored as a project update with no meeting
  and its items appear in that project's view.
- AE2. **Covers R8.** Given a note line where it is unclear who owns a task, when analysis runs, then
  the to-do defaults to "I owe" and Bryan can flip it to waiting-for inline without an AI call.
- AE3. **Covers R10.** Given an open commitment that has passed its cadence, when Bryan opens the
  app, then it surfaces as stale; when he taps dismiss, then it never resurfaces.
- AE4. **Covers R11, R12.** Given no new notes since the last focus pass, when Bryan opens the app,
  then the cockpit renders instantly and shows the cached focus with no AI call; given a new note was
  just added, when he reopens, then the focus is recomputed once.
- AE5. **Covers R6, R7.** Given the model misattributed a to-do, when Bryan flips its owner inline,
  then no AI call is made; given the model missed a decision entirely, when Bryan triggers the
  conversational re-run describing the miss, then re-extraction adds it.

---

## Success Criteria

- Bryan can open the app at any moment and instantly see a trustworthy, ranked view of what is next,
  what is due, and what is slipping across every meeting and project — and he trusts it because he
  verified the inputs.
- A project's full state (to-dos, decisions, updates, contributing meetings) is visible in one place
  rather than scattered across separate meetings.
- `ce-plan` can sequence implementation (trustworthy intake plus the aggregation ledger first, then
  projects, then the cockpit, then the follow-through engine) without having to invent product
  behavior, and the data-model extension and migration path are defined enough to plan the
  `schema_version` change.

---

## Scope Boundaries

- Other ideation survivors are deferred: Decision Drift Detector, User-Authored Lenses/Recipes,
  per-person index, trend surveillance, cross-meeting conflict/collision detection.
- The model does not auto-route notes to meetings or projects; the user always picks the destination.
- The dashboard is not synthesized by AI on every open (rejected for cost and ranking stability).
- An item carries at most one project tag; many-to-many tagging is out for v1.
- No MCP connectors (Jira/Atlassian, Context7), no voice/audio capture, no transcription, no
  calendar or email integration.
- Per-person ("people") views are out for v1, but are intentionally the same tag/lens pattern as
  projects so they are a cheap follow-on later.

---

## Key Decisions

- User-controlled capture destination (meeting or project): sidesteps the most error-prone AI task
  (routing) and respects Bryan's distrust of first-pass extraction; the model only reasons about what
  is in a note, never where it goes.
- Deterministic cockpit plus cached daily focus (Approach C): the only shape that stays instant and
  token-cheap under multiple-times-daily usage while still giving a generative "here's your focus"
  insight; AI is paid once per day, not per glance.
- Hybrid verification (inline edit plus conversational redo): routine corrections are instant,
  token-free, and cannot regress; the conversational re-run is reserved for genuine misses, where it
  adds value.
- Projects as a cross-cutting lens, not a container: one inbox, one extraction path, one ledger;
  capture once, view by meeting (source) or by project (theme). Avoids a second filing system.
- Meeting-less updates handled by pointing the inbox at a project: generalizes the destination rather
  than adding a parallel capture surface.
- Provenance (verbatim quote plus source) on every item: the primary defense against bad extraction
  and false "stale" flags, and the thing that lets Bryan trust the system.
- Deliver the complete feature as one finished `.tsx` — the single delivered artifact, tested in the
  work instance, with no partial releases. "Build order dependency-first" (intake + ledger → projects
  → cockpit → follow-through) refers to internal implementation sequencing, not a release boundary;
  it does not contradict the single-artifact delivery.

---

## Dependencies / Assumptions

- The baseline app described in `meeting-assistant-spec.md` is being built from scratch (per
  `CLAUDE.md`); this feature extends that baseline and assumes its data model and helpers exist.
- Hard runtime constraints from `CLAUDE.md` hold: single `.tsx`, allowlist libraries, `window.storage`
  (~5MB/key, rate-limited, last-write-wins), keyless Claude calls at `max_tokens` 1000, no server or
  cron, no `<form>` tags, inline styles.
- AI and real persistence only run inside claude.ai; local development uses the in-memory storage
  shim and cannot exercise AI behavior.
- The model id (`claude-sonnet-4-6`) is pending production verification in the work instance; a
  failure there falls back to `claude-sonnet-4-20250514`.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R10][Technical] The exact staleness scoring and escalation thresholds (interval growth,
  what counts as "ignored," when an item escalates) need tuning.
- [Affects R11][Technical] How the cockpit's deterministic ranking is computed and how "due-soon"
  windows are defined.
- [Affects R4, R12][Technical] The write-time compact/ledger shape that keeps cross-meeting and
  project reads (cockpit, focus pass, project summaries) inside the 1000-token cap, including whether
  a project's rolling summary is generated at intake or on demand.
- [Affects R18][Technical] The concrete migration from the baseline schema to the expanded shape and
  how Import handles older exports.

---

## Deferred / Open Questions

### From 2026-06-10 review

- **Cross-meeting/project data architecture + last-write-wins clobber hazard** — R3/R5/R16 (P1, feasibility, adversarial, confidence 100)

  A single intake writes a meeting and also contributes items to a project aggregate; under `window.storage` last-write-wins, a read-modify-write of a project record can silently drop a contribution. Reviewers split on the fix: maintain a denormalized open-work/ledger index updated on accept, versus store the tag on the item under its meeting and derive the project view at read time. This is the load-bearing architecture decision for planning; it also determines how the cockpit reads cross-meeting data cheaply.

  <!-- dedup-key: section="r3r5r16" title="crossmeetingproject data architecture lastwritewins clobber hazard" evidence="for meeting-sourced items, analysis also proposes a single project tag per item" -->

- **Daily focus pass must be fed a bounded slice to scale under the token cap** — R12 (P1, feasibility, adversarial, confidence 100)

  The daily focus pass reasons over open work across all meetings and projects, but output is capped near 1000 tokens and the input grows unbounded with use; at scale the narrative truncates or covers only a sliver with no signal to the user. Feed the pass only a bounded top-N slice pre-selected by the deterministic engine, with a truncation-safe output contract that degrades to fewer items rather than a cut-off string.

  <!-- dedup-key: section="r12" title="daily focus pass must be fed a bounded slice to scale under the token cap" evidence="Once per day, a single AI focus pass produces a short narrative of what to tackle first and why" -->

- **Migration field-mapping: define v1 to v2 defaults now vs minimal version-check** — R18 (P1, adversarial, scope-guardian, confidence 100)

  Import is the only way data survives a new artifact version, yet field-level migration is fully deferred. Reviewers split: define the v1 to v2 field mapping and defaults now (owner, cadence, and project on legacy to-dos) so Import deterministically upgrades old exports, versus scope Import to version-check-and-reject and defer real migration until a schema break occurs with field data. Resolve before or within planning.

  <!-- dedup-key: section="r18" title="migration fieldmapping define v1 to v2 defaults now vs minimal versioncheck" evidence="Import validates the version and migrates or accepts prior versions" -->

- **Whether to drop cadence inference for a simpler staleness trigger** — R9 (P1, scope-guardian, confidence 75)

  Inferring and storing a per-commitment cadence is a recurrence subsystem the stated goal never asks for; R10 staleness only needs a due date or a last-touched timestamp. Consider replacing cadence inference with a simpler "due-passed or untouched-N-days" trigger. This also shrinks the inferred-signal surface that R20 now requires marking and gating.

  <!-- dedup-key: section="r9" title="whether to drop cadence inference for a simpler staleness trigger" evidence="Each commitment carries an inferred cadence/interval" -->

- **Whether the daily AI narrative earns its place over the deterministic cockpit** — R11/R12 (P2, product-lens, confidence 75)

  R11's deterministic ranking already answers "what to work on next"; the once-daily AI narrative (R12) layers additional AI surface whose marginal value over the ranked groups is unstated. Decide what specific decision the narrative supports that the deterministic cockpit cannot, or defer R12 and validate that R11 alone answers the question in real use first.

  <!-- dedup-key: section="r11r12" title="whether the daily ai narrative earns its place over the deterministic cockpit" evidence="Once per day, a single AI focus pass produces a short narrative" -->

- **Project rolling-summary generation trigger and cost** — R16 (P2, feasibility, scope-guardian, adversarial, confidence 100)

  Whether the per-project rolling summary is generated at intake or on demand is undefined; on-demand means an AI call on project-view open plus an input that can exceed the budget for a long-running project. Recommend generating it incrementally at accept-time from the prior summary plus the just-verified items, keeping cost bounded and respecting the zero-AI-on-open posture.

  <!-- dedup-key: section="r16" title="project rollingsummary generation trigger and cost" evidence="a rolling project summary" -->

- **Precise cache-invalidation trigger for the daily focus** — R12 (P2, scope-guardian, confidence 75)

  "Recomputed only when new notes land" is ambiguous — saved, verified, or accepted? Without a precise definition the focus cache can be invalidated by, or run against, unverified proposals, violating the deterministic and trust posture. Specify recompute on item acceptance (or day-roll), not on raw save.

  <!-- dedup-key: section="r12" title="precise cacheinvalidation trigger for the daily focus" evidence="recomputed only when new notes/updates land or the day rolls" -->

- **Information architecture, navigation, and the UI design cluster** — Key Flows (P0, design-lens, confidence 100)

  Navigation and information architecture across the three surfaces (cockpit, meeting view, project view) are unspecified, and the verification screen, destination picker, empty states, stale-escalation visual ladder, cockpit filter affordance, owner-flip control, focus loading/stale states, and new-meeting/project creation flow have no defined interaction model. These are design-stage decisions for the impeccable design pass and ce-plan, not requirements-doc edits, but they must be resolved before UI implementation.

  <!-- dedup-key: section="key flows" title="information architecture navigation and the ui design cluster" evidence="Navigation now spans: a dashboard/cockpit, per-meeting views, and per-project views" -->
