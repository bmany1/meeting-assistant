---
date: 2026-06-05
topic: meeting-assistant-enhancements
focus: the "more robust" insight / to-do / proactive-help layer, within hard artifact constraints
mode: repo-grounded
---

# Ideation: Meeting Assistant Enhancement Layer

Run a3f9c2e1. 6 ideation frames → 48 raw candidates → 6 survivors. The headline result is
**convergence**: independent frames repeatedly produced the same handful of directions, and those
directions form one coherent system with a clear build order, not a feature menu.

## Grounding Context

**Codebase context:** Single-file `.tsx` claude.ai artifact. No server/build. Keyless Claude calls
capped at ~1000 output tokens (model `claude-sonnet-4-6`, pending production verification).
`window.storage` KV only (~5MB/key, rate-limited, last-write-wins). No localStorage/forms/extra
libs. Baseline already specified: dashboard of recurring meetings, note paste → "Save and analyze"
→ JSON (todos w/ priority+due+source, decisions, completions, rolling summary), per-meeting chat,
"Brief me," cross-meeting Insights, Export+Import, schema_version. Data model:
`meetings:list`, `meeting:{id}` = {summary, notes, todos, decisions, talking_points, chat},
`app:insights`, `app:meta`.

**External context (web research):** Transcription + per-meeting summary are table stakes across
Granola/Fathom/Otter/Fireflies/Notion AI. The untouched gap is cross-meeting **prep & follow-through**
(Granola explicitly cannot reason across meetings; Fellow/Read.ai do pieces but server-side and
integration-heavy). Server-less toolkit available within constraints: CRM next-best-action staleness
math (`today - last_mentioned > cadence`), GTD weekly review + Waiting-For list, triage buckets,
spaced-repetition/Leitner decay, alert-fatigue dedup/escalate/acknowledge. Trust failure modes are
the binding constraint: hallucinated/"workslop" action items kill adoption → mitigate with verbatim
extraction, source-meeting-id tagging, one-tap dismiss, and write-time compaction to beat the token
cap. No prior `docs/solutions/` learnings (greenfield).

## Ranked Ideas

### 1. Write-Time Compact, Source-Tagged Fact Ledger (the substrate)
**Description:** At "Save and analyze," emit a compact per-meeting digest of atomic facts, each
tagged with a verbatim source quote + meeting id + date. All cross-meeting features read these
digests, never raw notes.
**Warrant:** `external:` research names write-time compaction (map-reduce) as the primary token-cap
mitigation; `direct:` extends the existing rolling-summary field.
**Rationale:** Solves token cap, hallucination, and provenance in one architectural move. Enabling
primitive for ideas 2–5; four frames independently said "build this first."
**Downsides:** Extra structure to maintain; a schema_version bump; migration risk if the digest
shape changes later.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 2. The Follow-Through Engine (owner-tagged commitments + deterministic resurfacing)
**Description:** Split todos into "I owe" vs "Waiting-For" (owed to me) via owner inference at write
time. Each carries `{last_mentioned, cadence, interval, status}`. Items past cadence resurface;
ignored ones Leitner-escalate; one-tap done/snooze/dismiss; dismissed never returns. Zero tokens to
detect staleness.
**Warrant:** `external:` Fellow (owner+deadline inference), GTD Waiting-For, CRM cadence, spaced
repetition; `reasoned:` pure KV arithmetic → no hallucination and no token cost on the most-run loop.
**Rationale:** Hits the market's untouched cross-meeting follow-through gap, and the highest-leverage
thing a solo operator drops: what others owe them. Strongest convergence (5 frames).
**Downsides:** Owner attribution must clear a trust bar (verbatim quote); escalation thresholds need
tuning to avoid nagging.
**Confidence:** 88%
**Complexity:** Medium-High
**Status:** Explored

### 3. Walk-In Prep Card (proactive, app-speaks-first)
**Description:** Per-meeting one-screen prep assembled deterministically from the ledger (open todos,
waiting-fors for attendees, unresolved decisions, talking points); one optional sub-1000-token call
phrases 3 talking points. Cached, invalidated only when new notes land. App-open variant shows
"since last visit" deltas.
**Warrant:** `external:` Fellow pre-meeting surfacing + Read.ai Monday Briefing; `direct:` extends
baseline "Brief me."
**Rationale:** Targets the acute 90-seconds-before-the-call moment; cost bounded by change not
history, so it stays under the token cap forever.
**Downsides:** Needs a notion of "the meeting I'm about to enter" without calendar access.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 4. Weekly Review Mode (the delivery ritual)
**Description:** A dedicated mode (not the dashboard) that batches every proactive nudge into one
guided, mostly-precomputed pass: triage stale items, confirm completions, scan waiting-fors, accept
one digest line per meeting. Snapshots state for a longitudinal record.
**Warrant:** `external:` GTD weekly review as a separate mode; "AI compresses review to minutes."
**Rationale:** Concentrating nudges into a chosen ritual is the alert-fatigue antidote; scattered
proactive help gets muted, a ritual gets used.
**Downsides:** A whole second UI surface; only earns its keep once 1–2 exist.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 5. Decision Drift Detector
**Description:** At write-time, compare new decisions against the ledger for contradictions/reversals;
surface a "needs reconciliation" card with both verbatim quotes + meeting ids, one-tap
confirm-supersede / dismiss. Never auto-edits.
**Warrant:** `reasoned:` value is the cross-temporal contradiction no single note reveals;
`external:` NTSB post-mortem analogy + source-tagging mitigation.
**Rationale:** Re-litigating settled decisions is a quiet recurring-meeting time sink no per-meeting
tool can catch.
**Downsides:** False-positive risk; depends on reliable decision extraction. Confirmation-gated.
**Confidence:** 72%
**Complexity:** Medium
**Status:** Unexplored

### 6. User-Authored Lenses / Recipes (cross-meeting, optionally self-improving)
**Description:** Saved named prompts run across all meetings ("scope creep watch," "promises to my
boss"), each run cited. Optional twist: capture user edits as few-shot exemplars so the lens sharpens
toward the user's voice.
**Warrant:** `external:` Granola Recipes + keyword-anchor (but Granola can't go cross-meeting — the
gap); `reasoned:` in-context few-shot fits the token cap.
**Rationale:** What counts as an "insight" is personal; let the user define the lens instead of
hard-coding categories. Compounds with use.
**Downsides:** Power-user feature; complexity-creep risk if over-built.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | One-Card Day | Display option within Review, not a standalone direction |
| 2 | Cadence-drift watchdog | Folds into #2/#4 (quiet meeting = stranded waiting-fors) |
| 3 | Auto-resolve detection | Largely baseline already; folds into ledger write step |
| 4 | App-interviews-user brief | Folds into #3/#4 confirm step |
| 5 | Tendency report (scouting) | Speculative, hallucination risk; brainstorm variant |
| 6 | Trend/emerging-theme surveillance | Term-frequency noisy, workslop risk near-term |
| 7 | Conflict/collision (ATC, portfolio margin-call) | Complex, false-positive-prone; defer |
| 8 | Entity/Person index (Person File) | Re-indexes #2's data; strong fast-follow, folded into #2 |
| 9 | Priority anchor per series | Folds into #6 lenses |
| 10 | Triage inbox (4 buckets) | The UI of #2 + #4 |
| 11 | SBAR/I-PASS handoff format | Implementation detail of #1's digest schema |
| 12 | Voice/brain-dump capture | Adjacent capture feature, outside the insight/todo focus |
| 13 | Self-auditing accept-rate governor | Premature; revisit after core ships |
| 14 | Momentum trend sparklines | Nice-to-have viz, folds into #4 once ledger exists |
