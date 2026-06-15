---
title: "feat: Trustworthy Intake, Projects, and Follow-Through"
type: feat
status: active
date: 2026-06-10
origin: docs/brainstorms/2026-06-06-intake-projects-follow-through-requirements.md
---

# feat: Trustworthy Intake, Projects, and Follow-Through

## Summary

Build the Meeting Assistant as one `.tsx` claude.ai artifact in dependency order — foundation, then
trustworthy intake, then views and follow-through, then the cockpit, then durability. Per-source
records (`meeting:{id}`, `project:{id}`) are the single source of truth; a compact `app:ledger` index
is rebuilt wholesale from those records on each accept and powers cheap, token-bounded cockpit and
project reads. This is greenfield: the plan builds the baseline app and this feature together.

---

## Problem Frame

Bryan's meeting notes are fragmented across OneNote with no cross-meeting or cross-project view, and
he does not trust first-pass AI extraction. The full motivation, actors, and flows live in the origin
requirements doc (see Sources & References). This plan's job is the HOW: a single-file artifact that
captures notes through one inbox, lets him verify extraction, aggregates by meeting and project, and
surfaces a trustworthy "what's next / due / slipping" cockpit — all within the artifact's hard
constraints (one file, allowlist libraries, `window.storage`, keyless Claude calls capped at 1000
output tokens, no server or background jobs).

---

## Requirements

- R1. Single inbox; user picks destination (existing/new meeting or project); model never infers destination. (origin R1)
- R2. Meeting note stored on the meeting instance; project-destination note stored as a "project update" with no meeting. (origin R2)
- R3. Raw note persisted before analysis runs. (origin R3)
- R4. Analysis extracts to-dos (priority + inferred due date), decisions, and inferred completions (proposals, gated). The rolling summary is NOT part of the extraction response: it is updated by a separate bounded call at accept-time, so the full extraction output budget serves the item list. (origin R4, call shape narrowed — see Key Technical Decisions)
- R5. Meeting-sourced items get a proposed project tag (verified inline); project-destination items auto-tag, no proposal. (origin R5)
- R6. Every item carries a verbatim source quote + source reference (meeting instance or "direct update"+date), as clickable provenance. (origin R6)
- R7. Hybrid verification: inline edit/delete/re-tag (no AI); one conversational re-run that preserves accepted/edited items and only adds/revises flagged ones; items are proposals until accepted. (origin R7)
- R8. To-dos owner-classified "I owe" / "waiting-for"; ambiguous defaults to "I owe", flippable inline. (origin R8)
- R9. Deterministic staleness signal: overdue (past due date) or untouched for N days (N from the meeting's cadence, else default). Replaces per-item learned cadence. (origin R9, narrowed — see Key Technical Decisions)
- R10. On app open, stale commitments flagged (no AI); ignored items escalate; one-tap done/snooze/dismiss; dismissed never resurfaces (tombstone). (origin R10)
- R11. On every open, a locally-computed dashboard ranks open work across all meetings and projects, grouped do-next / due-soon / waiting-on-others / slipping. (origin R11)
- R12. Once-daily cached AI focus narrative over a bounded top-N slice; recompute on item-accept or day-roll; on failure show last cached focus + inline error, never block the cockpit. (origin R12)
- R13. Cockpit sliceable/filterable by project. (origin R13)
- R14. Projects are a cross-cutting tag; one optional tag per item. (origin R14)
- R15. Project has name, status (active/on-hold/done), optional target date that feeds the cockpit. (origin R15)
- R16. First-class per-project view aggregating across meetings + direct updates: open to-dos, waiting-fors, decisions, rolling summary (incremental at accept-time), recent updates, contributing meetings. (origin R16)
- R17. Per-meeting view + all baseline features preserved (notes, to-dos, decisions, talking points, per-meeting chat, Brief me). (origin R17)
- R18. Ship as schema v2; Export includes `schema_version`; Import validates and migrates v1 forward with defaults, then rebuilds the derived index. (origin R18)
- R19. Every AI/storage call wrapped to fail gracefully with a small inline message and never destroy data; AI text avoids em dashes. (origin R19)
- R20. Inferred fields (due date, owner, staleness interval) marked inferred-vs-confirmed in views; an item with only an inferred interval is not auto-flagged stale until confirmed or defaulted. (origin R20)
- R21. Extraction output bounded per call (item cap + length-bounded quotes); notes above a size threshold are auto-segmented into sequential extraction calls and merged (see Key Technical Decisions), so the per-call cap is an output guard, not the per-note recall ceiling. Truncated/invalid JSON and valid-JSON-with-missing-required-fields are both detected and surfaced as recoverable inline errors, never silent loss. (origin R21, extended by 2026-06-12 review)

**Origin actors:** A1 (Bryan / user-operator), A2 (extraction model — Claude in-artifact), A3 (deterministic engine — in-browser, no AI)
**Origin flows:** F1 (Capture and verify), F2 (View by project), F3 (Daily prioritization cockpit), F4 (Stale-commitment resurfacing)
**Origin acceptance examples:** AE1 (covers R1, R2), AE2 (covers R8), AE3 (covers R10), AE4 (covers R11, R12), AE5 (covers R6, R7)

---

## Scope Boundaries

- Visual/interaction design — navigation pattern across the three surfaces, the destination-picker UI, verification-screen layout, empty states, the stale-escalation visual ladder, filter affordances, creation forms — is **out of this plan** and goes to a dedicated impeccable design pass. This plan defines behavior, data, and component boundaries; it does not specify pixels.
- Deferred ideation survivors are not built: Decision Drift Detector, User-Authored Lenses/Recipes, per-person index, trend surveillance, cross-meeting conflict/collision detection.
- Many-to-many project tagging (one optional tag per item only).
- No MCP connectors, voice/audio capture, transcription, calendar/email integration.
- No AI synthesis of the dashboard on every open (cockpit is deterministic; AI runs once daily for the focus narrative only).

### Deferred to Follow-Up Work

- Per-person ("people") lens: intentionally the same tag/lens pattern as projects, a cheap follow-on once projects ship. Not in this plan.

---

## Context & Research

### Relevant Code and Patterns

- No code exists yet (greenfield). `meeting-assistant-spec.md` is the authoritative pattern source: `storage` wrapper, `callClaude` wrapper, `stripJSONFences` / `safeParseJSON`, `uid(prefix)`, `nowISO()`, the in-memory `window.storage` shim, inline-style `BRAND` token object + `SERIF` / `SANS` constants, small UI atoms (buttons, cards, inline confirm, inline error, spinner).
- Baseline data model from the spec: `meetings:list`, `meeting:{id}` (MeetingData), `app:insights`, `app:meta`. This plan extends it with project records and a derived ledger (see Key Technical Decisions).

### Institutional Learnings

- `docs/solutions/` is empty (greenfield). This work is a strong candidate for a `ce-compound` capture afterward — the artifact-specific patterns (write-time compaction under a token cap, derive-then-cache against last-write-wins, keyless in-artifact Claude calls) are exactly the non-obvious, environment-specific knowledge future sessions would benefit from.

### External References

- Domain prior art and failure modes were gathered during ideation (see origin doc's Grounding Context): Granola/Fellow/Read.ai post-meeting patterns; CRM next-best-action staleness math; GTD weekly review; triage buckets; spaced-repetition decay; alert-fatigue dedup; LLM hallucination/workslop mitigations. No further external research needed — the artifact constraints fix the technical patterns.

---

## Key Technical Decisions

- **Derive-then-cache data architecture (resolves the clobber hazard).** Per-source records are authoritative: `meeting:{id}` owns its notes + extracted items; `project:{id}` owns direct project updates + project metadata. The cockpit/project reads come from `app:ledger`, a compact denormalized index of all open items. `app:ledger` is **rebuilt wholesale from the authoritative records on each accept**, never read-modify-merged. Because it is regenerated from truth (which was just written), a stale read cannot drop data — worst case it is briefly stale and rebuilt on the next accept or open. This gives no clobber, one-key cockpit reads, and write-time compaction simultaneously. Chosen over both pure derive-at-read (blocking read fan-out on every open) and an incrementally-merged index (the clobber risk the review flagged). Recovery contract (stale-while-revalidate): on open the cockpit renders instantly from the cached ledger, then source records are re-read and the ledger rebuilt/reconciled quietly after first paint. Reconcile-application rule: pending in-memory triage mutations always win — the reconcile re-applies them on top of the rebuilt ledger before any swap; the rebuilt ledger replaces visible state in place only when it does not change the membership or order of currently rendered triage rows (rows keyed by stable item id, so untouched rows never shift under a descending thumb), otherwise its application defers until triage interaction quiesces; a failed background rebuild shows a small inline non-blocking error (R19). A failed ledger write at accept-time is retried inline — so an interrupted accept can never leave wrong state visible beyond one open. Burst triage is coalesced BY RECOVERABILITY: one-tap done/snooze/dismiss applies to in-memory state immediately; truth writes (source-record status changes, `app:followthrough` tombstones/item_state) flush eagerly with a sub-second per-key debounce — they are small, low-volume, and non-reconstructible — while only the derived `rebuildLedger()` write defers to a short quiescence window (a lost rebuild self-heals on the next open). The navigation/unload flush guard is a best-effort backstop, not the mechanism the guarantee rests on: unload events are unreliable in sandboxed and mobile contexts, and async storage writes started in unload handlers are routinely killed. Undo exception: a dismiss's truth write is held for a fixed in-memory undo deadline (~5 seconds) and flushes when it expires; undo before the deadline drops the pending write — undo is never a compensating write after the flush. The daily triage burst is the app's highest-frequency write moment; the per-key debounce is what batches it within rate limits. Source-record writes re-fetch the record and rebase the in-memory mutation immediately before writing (read-latest-modify-write) with a per-record `updated_at` drift check, because last-write-wins is only per-key-safe for a single active session (a stale desktop tab plus phone triage can otherwise clobber a truth record); the residual race window is an accepted, documented limitation.
- **Token budget via compaction + bounded slice.** `app:ledger` holds only compact item records (id, text, owner, due, status, project, source ref, short quote). The deterministic engine ranks locally; the daily AI focus pass (R12) is fed only the top-N ranked slice as input, with a truncation-safe output contract. The extraction call (R21) caps items per call and length-bounds quotes so each call stays within 1000 output tokens.
- **Chunked extraction for long notes (resolves the silent-omission hazard).** A note above a size threshold (named constant, calibrated at first paste-in) is auto-segmented at paragraph/blank-line boundaries into sequential extraction calls with modest overlap, all inside the single "Save and analyze" action with a visible "Analyzing part N of M" progress state. Proposals from all chunks are merged with normalized-key dedup (anchor position breaks ties within overlap regions) and presented in ONE unified verification screen. If a chunk's call fails, proposals from completed chunks are preserved, the inline error names the failed chunk, and retry re-runs only that chunk — partial failure never drops successfully-extracted proposals (R3/R21). Rationale: omission is a documented top error class in meeting extraction, missed items cluster mid-document (lost-in-the-middle), and the 1000-token output cap means a dense multi-page dump can carry more items than one response; the per-call item cap must never be the per-note recall ceiling.
- **Extraction call split from summary update.** The extraction call returns items, decisions, and completion proposals only. The rolling-summary update is a separate bounded call at accept-time (mirroring U8's incremental-at-accept project summary), so summary prose never competes with items for the output budget and the extraction prompt avoids multi-task instruction dilution.
- **Deterministic quote anchoring (provenance is checked, not trusted).** After parsing, each item's quote is substring-matched (then fuzzy-matched) against the saved raw note at zero AI cost. Anchored items render the matched span retrieved from the note itself (deterministic quoting — model-emitted quote text can itself be hallucinated); the anchor position also feeds dedup. Unanchored items are kept but visibly flagged as suspect in the verification screen, never auto-deleted. Post-parse field validation also runs: parsed objects missing required fields (text, kind, quote, source ref) surface as recoverable warnings, since valid-JSON-wrong-shape is a documented failure mode `safeParseJSON` cannot catch.
- **Cadence simplified to a deterministic staleness signal (narrows origin R9).** No per-item learned cadence. Staleness = `now > due_date` (if a CONFIRMED due date exists) OR `now - last_touched > N days`, where N derives from the source meeting's cadence (Weekly→7, Biweekly→14, Monthly→30, Ad hoc/none→14 default). Items with only an inferred interval are not auto-flagged until confirmed or defaulted (R20). Reduces inferred-signal surface and avoids a recurrence subsystem the goal never required. The R20 gate extends to due dates: an inferred, unconfirmed due date may place an item in due-soon (visibly marked inferred) but never in overdue/slipping and never satisfies the overdue staleness branch until confirmed or user-set — false-overdue from inferred dates is a documented task-manager abandonment driver. Accepting an item at verification does NOT auto-confirm its inferred fields; confirmation is per-field (editing or explicitly confirming a field flips it inferred→confirmed).
- **Daily AI narrative kept but sequenced last.** R12 is the final feature unit so the deterministic cockpit (R11) ships and proves its value first; the narrative is additive and cheap to cut without rework if it does not earn its place. Cache invalidates on item-accept or day-roll, not raw note save; cache key = {local date, last-accept marker}. The narrative's defined job is consequence framing — for each top item, why it comes first and what slips if it is deferred — explicitly NOT a restatement of the cockpit's rank order. Consequence framing at selection time is the one evidence-backed intervention that reverses the urgency bias and the one job the deterministic ranked list cannot do; a ranking-recap narrative is redundant by construction and would guarantee the unit gets cut.
- **Follow-through state is authoritative, not derived.** Tombstones and engine state live in their own authoritative key, `app:followthrough` = `{ tombstones: TombstoneRecord[], item_state: { [key]: { escalation, snooze_until, last_surfaced } } }` — NOT inside the disposable `app:ledger`. (Carrying tombstones forward from the old ledger would contradict the never-read-the-old-ledger rule, and Import — which rebuilds from records — would otherwise resurrect every dismissed item at the exact version handoff the migration exists for.) `rebuildLedger()` reads `app:followthrough` as an input like any other truth record; Export includes it; Import restores it before rebuilding. Write discipline: every `app:followthrough` write re-fetches and rebases first (the same read-latest-modify-write rule as source records), with shape-aware merge — `tombstones` merge by set-union (append-only, always safe), `item_state` merges per-key taking the later `snooze_until`/`last_surfaced` — never whole-key last-write-wins; the per-open engine sweep serializes behind any pending tap write. A triage burst's tombstone/item_state changes flush as one debounced write (see burst coalescing below); the sweep adds at most one more write per open. ENGINE state (escalation, snooze, last_surfaced) never lands in per-source records — but item STATUS is truth, not engine state: a dismiss also mutates the source item in the same flush (reason "done" → status completed; "redundant"/"wrong" → status dismissed — hidden from open lists, open-todo counts, and extraction-prompt context, visible in an archived state on the meeting view). Pruning: at sweep time, `item_state` entries whose key matches a tombstone or a completed item are dropped as dead weight; tombstones are retained indefinitely by design.
- **Dismissal tombstones (record shape + resurrection guards).** A dismissal writes a TombstoneRecord `{ key, original_text, source_ref, reason, dismissed_at }`. `key` = `ledgerItemKey(item)`; the originals are retained because normalization is a one-way lossy transform — the normalizer is schema-level, and changing it is a schema migration that re-keys tombstones from the stored originals. Dismiss captures a one-tap reason — done / redundant / wrong extraction (default "done" with undo) — because the three mean different things: "done" counts as a completion, "wrong" is extraction-quality feedback, "redundant" is a dedup signal; without the reason, completions go uncounted and the tombstone is unusable as any future signal. At proposal-merge time, new proposals are also fuzzy-matched (token-set similarity, same source ref) against tombstone originals so a model paraphrase cannot resurrect a dismissed item. Visibility contract: silent suppression is reserved for EXACT normalized-key matches only; every fuzzy match — above-threshold included — renders in the verification screen as a collapsed/ghosted row ("matches a dismissed item — tap to restore") with two actions: Accept anyway (restores it as a live proposal) and Dismiss again (re-tombstones, no undo, since it was already dismissed once). Suppression is therefore always visible and reversible at the one moment Bryan is already reviewing, and a similar-but-new commitment ("follow up with Maria about hiring" vs a dismissed "...about budget") can never vanish without a trace (R10/R21).
- **Single source of truth for project membership.** The project tag lives on the item under its source record; the project view and `app:ledger` derive membership by reading the tag. Project records never store a mutable copy of item lists that could clobber.
- **Testing posture.** Deterministic logic (ledger derivation, ranking, staleness, tombstones, migration) is pure and exercised via the local Vite dev harness with the in-memory storage shim. AI-dependent behavior (extraction, verification re-run, focus narrative) is verified manually inside the claude.ai artifact, since the shipped single file carries no test runner. Dev harness and tests live under `dev/` and are never pasted into the artifact.

---

## Open Questions

### Resolved During Planning

- Derive-at-read vs denormalized index (review split): resolved as derive-then-cache, wholesale rebuild (see Key Technical Decisions).
- Token budget for focus pass and cross-meeting reads: resolved via compaction + bounded top-N slice.
- Migration strategy (define mapping vs reject): resolved as migrate-v1-forward-with-defaults.
- Cadence inference: resolved by simplifying to the deterministic staleness signal.
- Cache-invalidation trigger: resolved as item-accept or day-roll.

### Resolved by 2026-06-12 deep research + doc review

(External grounding: `docs/research/2026-06-12-meeting-assistant-deep-research.md`.)

- Single-pass extraction recall ceiling on long notes: resolved by chunked sequential extraction with merge/dedup and defined progress/partial-failure states (U4a).
- Provenance trust: resolved by deterministic quote anchoring — matched spans render from the note itself; unanchored items flagged (U4b/U5).
- Tombstone durability: resolved by the authoritative `app:followthrough` key — records retain originals + a dismiss reason; fuzzy guard blocks paraphrase resurrection; included in Export/Import (U2/U6/U11).
- Escalation habituation: resolved by back-off spacing + polymorphic presentation + quiet styling, binding constraints handed to the design pass (U6).
- Ranking bias: resolved by Eisenhower-style importance-co-equal grouping + a do-next cap of 5 (U9).
- Inferred due dates: R20 gate extended — never overdue/slipping until confirmed; accepting an item does not auto-confirm its inferred fields.
- Extraction call shape: summary update split out to accept-time; meeting purpose/people injected as context; post-parse field validation added (U4a/U4b).
- Focus narrative job: consequence framing, not ranking recap; cache key {local date, last-accept marker} (U10).
- Rolling summaries: user-triggered "Regenerate summary" from raw notes on both meeting and project views (U7/U8).
- Import semantics: version-less exports classified v1; wholesale replace gated by confirm + backup offer; throttled sequential writes with per-write checks (U11).
- Ledger recovery + write discipline: stale-while-revalidate on open; coalesced triage writes; read-latest-modify-write with `updated_at` drift check (U2/U9).
- "Done" project's open items: surfaced in the cockpit (a contradiction worth seeing).

Round 2 (same day, post-application review): coalescing split by recoverability — truth writes flush eagerly debounced, only the derived rebuild defers, unload guard demoted to backstop; `app:followthrough` write discipline (rebase, tombstone set-union, per-key item_state merge, sweep serialized behind taps, pruning rule); `ledgerItemKey` gains an occurrence index so same-worded items get distinct keys; fuzzy-guard visibility contract (silent suppression = exact-key only, all fuzzy matches render ghosted with restore/dismiss-again); import validates the full payload before any destructive write and verifies the backup before enabling replace; dismiss undo is in-memory with a fixed deadline; dismiss also mutates source item status by reason; SWR reconcile stability rule (pending mutations win, no mid-triage reshuffle); overlap-region dedup keys on anchor spans; regenerate-summary failure contract; U4 split into U4a (chunk orchestration) and U4b (parse/validate/anchor).

### Deferred to Implementation

- Exact ranking weights within the Eisenhower-style groups (do-next ordering, urgency/importance boundary values) — tune against real data in the artifact, from the importance-co-equal baseline (U9).
- The "due-soon" window length (start at 3 days, adjust in use).
- Escalation back-off curve and thresholds (how fast the surface-every-Nth-open interval grows) — implementation-tuned within U6's binding constraints (spacing, polymorphic form, quiet styling); the visual ladder itself is design-pass.
- The chunking size threshold and overlap length for long-note extraction (named constants; calibrate at first paste-in alongside the MODEL check).
- The fuzzy-match similarity threshold for the tombstone resurrection guard (named constant).
- Whether the project rolling summary needs its own bounded re-summarization when a project grows very large (incremental-at-accept is the v2 approach; revisit only if it drifts).
- `MODEL` constant value verification in the work runtime (`claude-sonnet-4-6`, fallback `claude-sonnet-4-20250514`).

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Capture → accept → derive flow (the architecture spine):

```
paste note ──> pick destination (meeting|project)
                     │
                     ▼
            save raw note to meeting:{id} or project:{id}   (R3 — note safe before AI)
                     │
                     ▼
            callClaude extract (bounded output, verbatim quotes)   (R4/R5/R6/R21)
                     │
                     ▼
            verification UI: inline edits + optional one re-run    (R7)
                     │  user accepts
                     ▼
   write accepted items into their source record (authoritative)
                     │
                     ▼
   rebuild app:ledger WHOLESALE from all source records           (no merge → no clobber)
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
  cockpit (deterministic,     project view (derive by tag
  reads app:ledger, no AI)     from app:ledger + project:{id})
        │
        ▼
  once/day: focus pass over top-N slice of app:ledger (cached)     (R12)
```

`app:ledger` shape (compact, derived — directional):

```
app:ledger = {
  built_at,
  items: [ { id, text, kind: todo|decision|waiting_for, owner, priority,
             due_date|null, inferred: {due?,owner?,interval?}, status,
             project_id|null, source: {meeting_id|"direct", date}, quote } ]
}

app:followthrough = {   // authoritative, NOT derived — survives rebuilds, re-extraction, and Import
  tombstones: [ { key, original_text, source_ref, reason: done|redundant|wrong, dismissed_at } ],
  item_state: { [key]: { escalation, snooze_until, last_surfaced } }
}
```

Staleness (deterministic, no AI):

```
isStale(item) = item.status == open AND
  ( (due_is_confirmed(item) && now > item.due_date)               // inferred-only due dates never trip overdue (R20)
    || (now - item.last_touched > N_days(source.meeting.cadence)
        && interval_is_confirmed_or_defaulted(item)) )            // R20 guard scopes ONLY the untouched branch —
                                                                  // a confirmed past-due item always flags
```

---

## Output Structure

    meeting-assistant.tsx        # the single shipped artifact (all components, styles, logic)
    dev/                         # local-only Vite harness + tests; NEVER pasted into claude.ai
      index.html
      main.tsx                   # imports the default export from meeting-assistant.tsx
      vite.config.ts
      tests/                     # deterministic-logic tests (ledger, ranking, staleness, migration)

The single deliverable is `meeting-assistant.tsx`. Everything under `dev/` is scaffolding to see and
test the UI locally and must never contaminate the artifact (per CLAUDE.md).

---

## Implementation Units

### Phase 1 — Foundation

- U1. **App skeleton, plumbing, and design tokens**

**Goal:** Stand up the single-file artifact with all shared infrastructure so later units have a home.

**Requirements:** R19 (partial), R18 (scaffold)

**Dependencies:** None

**Files:**
- Create: `meeting-assistant.tsx`
- Create: `dev/index.html`, `dev/main.tsx`, `dev/vite.config.ts`
- Test: `dev/tests/storage-shim.test.ts`

**Approach:**
- One default-exported React functional component. Inline-style `BRAND` token object, `SERIF` / `SANS` constants, UI atoms (Button, Card, InlineConfirm, InlineError, Spinner).
- `storage` wrapper around `window.storage` (private flag `false`, getJSON, defensive try/catch); in-memory shim activated only when `window.storage` is absent (local dev).
- `callClaude(prompt, {systemHint})` with a single top-level `MODEL` constant (`claude-sonnet-4-6`), `max_tokens` 1000, content-block text join. `stripJSONFences`, `safeParseJSON(text, fallback)`. `uid(prefix)`, `nowISO()`.
- `app:meta` holds `{ schema_version: 2 }`. Export/Import shell (Export downloads JSON incl. `schema_version`; Import is wired in U11).
- Global inline-error surface helper so every AI/storage failure renders a small message without losing data.

**Patterns to follow:** `meeting-assistant-spec.md` (storage wrapper, callClaude, JSON helpers, shim, BRAND/SERIF/SANS).

**Test scenarios:**
- Happy path: `storage.set`/`getJSON` round-trips an object through the shim.
- Edge case: reading a missing key returns null (does not throw).
- Edge case: `safeParseJSON` recovers an object from fenced/preamble-wrapped text; returns fallback on garbage.
- Test expectation: `callClaude` itself is not unit-tested locally (no key); covered by manual artifact verification.

**Verification:** App renders locally via `dev/`; storage round-trips through the shim; `MODEL` is a one-line constant; no `<form>` tags, no `localStorage`.

- U2. **Data model + derived `app:ledger` (the architecture)**

**Goal:** Define authoritative records and the wholesale-rebuilt compact index that resolves the clobber hazard.

**Requirements:** R14, R16 (storage shape), R20 (inferred flags in shape), supports R11/R12/R13

**Dependencies:** U1

**Files:**
- Modify: `meeting-assistant.tsx`
- Test: `dev/tests/ledger.test.ts`

**Approach:**
- Extend the data model: `projects:list -> Project[]`, `project:{id}` (metadata + direct updates + items), item shape gains `owner`, `project_id`, `inferred` flags, `last_touched`, stable `key`. Meeting items keep their source meeting id.
- Implement `rebuildLedger()`: read all `meeting:{id}` + `project:{id}` records plus `app:followthrough` (authoritative tombstones + engine state), project open items into the compact `app:ledger` shape. Pure function over loaded records; called after any accept and reconciled quietly after first paint on open (stale-while-revalidate). Never merges into an existing ledger and never reads the old ledger — always rebuilt from source.
- `ledgerItemKey(item)` = `normalize(text) + "::" + sourceRef` (for tombstones and dedup), where `normalize` = lowercase, trim, collapse internal whitespace, strip punctuation. The normalizer is schema-level: changing it later is a schema migration that re-keys stored tombstones from their retained `original_text` (see Key Technical Decisions). The key also includes the anchored quote's occurrence index within the source note (the substring search advances past prior matches, so repeated phrasing anchors to distinct positions and two same-worded items in one source get distinct keys — otherwise dismissing one would silently tombstone both). If a rebuild finds multiple open items matching one tombstone key, the extras surface flagged in the next cockpit pass rather than all being silently excluded.
- Source-record write discipline: re-fetch the record and rebase the in-memory mutation immediately before each write; compare per-record `updated_at` to detect cross-session drift. On detected drift, proceed with the rebased write and show a small inline notice ("updated elsewhere — changes merged"); never block the write. Residual race window documented as accepted.

**Patterns to follow:** spec data-model section; read-modify-write whole object per record (last-write-wins safe because each write touches only its own record).

**Test scenarios:**
- Happy path: rebuild produces one ledger item per open source item across multiple meetings + projects.
- Edge case: a tombstoned key is excluded from the rebuilt ledger; tombstones and escalation/snooze state live in `app:followthrough` and survive a wholesale rebuild untouched.
- Edge case: completed/dismissed items are excluded; project_id carried through.
- Integration: two separate meeting records updated in sequence both appear after rebuild (proves no cross-record clobber).

**Verification:** Given seeded source records, `rebuildLedger()` is deterministic and idempotent; running it twice yields identical output.

### Phase 2 — Trustworthy Intake

- U3. **Capture inbox + destination routing**

**Goal:** One paste box; user selects an existing/new meeting or project; routing is explicit, never inferred.

**Requirements:** R1, R2

**Dependencies:** U1, U2

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/routing.test.ts`

**Approach:**
- Inbox component with a textarea (onChange, no `<form>`) and a destination selector (existing meeting, new meeting, existing project, new project). Creating a new meeting/project writes its record first.
- A meeting note attaches to `meeting:{id}`; a project note writes a "project update" to `project:{id}` with `source: {meeting:"direct", date}`.

**Patterns to follow:** spec meeting CRUD; inline create.

**Test scenarios:**
- Covers AE1. Happy path: project-destination note is stored as a project update with no meeting and appears under that project after rebuild.
- Happy path: meeting-destination note attaches to the chosen meeting instance.
- Edge case: choosing "new project" with an empty name is blocked with an inline message.

**Verification:** Routing writes to the correct record; the model is never asked which destination to use.

- U4a. **Chunked extraction orchestration**

**Goal:** Run the bounded extraction call(s) for a saved note — single-pass for short notes, segmented sequential calls for long ones — and assemble one unified proposal set.

**Requirements:** R3, R4 (call shape), R21, R19

**Dependencies:** U3

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/extraction-chunking.test.ts`

**Approach:**
- Save the raw note before calling the model (R3). Prompt instructs: strict JSON only (flat, simple schema — compliance collapses with schema depth and the runtime has no constrained decoding), no em dashes, verbatim source quotes, cap on items per call, length-bounded quotes; for meeting notes propose one `project_id` tag per item; infer owner ("I owe"/"waiting-for", ambiguous → "I owe") and an inferred due date; mark inferred fields.
- Context injection: the prompt includes the meeting's stored `purpose` and `people` fields (or the project's name/status for project notes) plus the current open-todo list — situational context improves the hard inferred fields (owner, project tag) more than added instructions.
- Long notes chunk (see Key Technical Decisions): above the size threshold, segment at paragraph boundaries with modest overlap into sequential calls within the one "Save and analyze" action — "Analyzing part N of M" progress state; a failed chunk preserves completed chunks' proposals and offers retry of that chunk only.
- Merge/dedup before the ONE unified verification screen: within overlap regions, overlapping anchored-quote spans are the primary merge signal (independent calls paraphrase the same item differently, so exact text keys cannot be relied on there); exact normalized-key dedup covers non-overlap regions; token-set similarity catches unanchored overlap proposals.
- The extraction call returns items/decisions/completions only — the rolling-summary update runs as a separate call at accept-time.

**Patterns to follow:** spec analyze prompt + JSON discipline; save-before-analyze ordering.

**Test scenarios:**
- Happy path: a short note runs single-pass; a note above the chunk threshold yields merged, deduped proposals across chunks.
- Edge case: the same commitment paraphrased by two chunk calls in an overlap region merges into one proposal (anchor-span overlap, not text equality).
- Error path: a simulated failed second chunk preserves chunk-one proposals, names the failed chunk, and retry re-runs only that chunk (no silent loss).
- Test expectation: live model output verified manually in the artifact (no local key).

**Verification:** A dense note never silently loses content; the per-call item cap is never the per-note recall ceiling.

- U4b. **Parse, validate, and anchor**

**Goal:** Turn raw model output into trustworthy typed proposals — parsed defensively, shape-validated, quote-anchored.

**Requirements:** R4, R5, R6, R8 (owner inference), R21, R19

**Dependencies:** U4a

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/extraction-parse.test.ts`

**Approach:**
- Parse with `safeParseJSON`, then validate required fields per item (text, kind, quote, source ref) — valid-JSON-wrong-shape surfaces as a recoverable warning. Truncated/invalid JSON surfaces a recoverable inline error (offer retry) without discarding the saved note.
- Anchor check: substring-match (then fuzzy-match) each quote against the raw note, occurrence-aware (the search advances past prior matches so a phrase appearing twice anchors to distinct positions); anchored quotes render the matched span from the note itself; unanchored items carry a visible suspect flag into verification, never auto-deleted.
- Ambiguous owner defaults to "I owe"; inferred due/owner flagged inferred.
- Project-destination items auto-tag to that project (no proposal).

**Patterns to follow:** U4a output contract; spec JSON helpers.

**Test scenarios:**
- Happy path (parse): a well-formed JSON response maps to typed proposals with quotes + source refs.
- Error path: truncated JSON yields a recoverable inline error and the saved note is intact (no data loss).
- Error path: valid JSON missing required fields surfaces a recoverable warning, never a silent pass.
- Edge case: ambiguous owner defaults to "I owe"; inferred due/owner flagged inferred.
- Edge case: a proposal whose quote does not appear in the note is flagged unanchored.
- Edge case: the same quoted phrase appearing twice in a note anchors to two distinct occurrences (occurrence disambiguation).
- Test expectation: live model output verified manually in the artifact (no local key).

**Verification:** Every proposal has a checked quote + source; nothing silently passes shape validation.

- U5. **Hybrid verification flow**

**Goal:** Let Bryan trust the captured data: inline correction (no AI) plus one additive conversational re-run; nothing commits until accepted.

**Requirements:** R7, R4 (completions gated), R5 (tag verified inline), R6 (provenance shown)

**Dependencies:** U2, U4a, U4b

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/verify-merge.test.ts`

**Approach:**
- Proposals render as editable items (edit text, delete, flip owner, change tag) — all local state, zero AI.
- One conversational re-run: user describes what was missed/wrong; re-extraction **preserves already-accepted/edited items** and only adds or revises flagged ones (never regenerates the whole set). The re-run prompt passes accepted/edited items as fixed context the model is instructed not to re-emit or modify. The re-run is always a single un-chunked call over the full note plus that fixed context — its output is adds/revises only, bounded by design, so the chunking machinery does not apply.
- Inferred completions of existing open to-dos are shown as proposals subject to the same accept gate — never auto-close.
- Unanchored items (quote not found in the note, from U4b's anchor check) render with a visible "source not found in note — check before accepting" state; they can still be accepted, but never silently.
- On accept: write items to their source record and `rebuildLedger()` first; then the meeting-summary call and one incremental call per distinct tagged project run sequentially in the background, each individually wrapped — a summary failure shows an inline note and leaves the stale summary in place, with Regenerate (U7/U8) as the recovery path. Accepting does NOT auto-confirm inferred fields — due date and owner stay marked inferred until individually edited or confirmed (R20).

**Patterns to follow:** U2 rebuild; spec inline-confirm atom.

**Test scenarios:**
- Covers AE5. Happy path: flipping an owner inline triggers no AI call; accepting commits to the source record.
- Covers AE2. Happy path: an ambiguous-owner extraction defaults to "I owe" flagged inferred; flipping it to waiting-for inline makes no AI call.
- Covers AE5. Integration: a conversational re-run adds a missed decision without discarding prior inline edits.
- Edge case: an inferred completion is declined → the existing to-do stays open.
- Integration: accept triggers a single ledger rebuild reflecting the committed set.

**Verification:** No item is committed before accept; the re-run is additive; completions never auto-apply.

### Phase 3 — Follow-Through and Views

- U6. **Owner classification + deterministic staleness**

**Goal:** Power follow-through with zero-token, non-hallucinating signals.

**Requirements:** R8, R9 (narrowed), R10, R20

**Dependencies:** U2

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/staleness.test.ts`

**Approach:**
- `isStale(item)` per the staleness rule (overdue requires a CONFIRMED due date; untouched-N-days with N from meeting cadence, gated by the R20 interval guard — guard scopes the untouched branch only).
- Escalation/snooze state persists in `app:followthrough.item_state` — never in per-source records (rate limits; truth records stay free of derived UI state) and never in the rebuilt ledger (wiped wholesale). At most one `app:followthrough` write per open plus explicit taps.
- Escalation behavior constraints, binding on the design pass: (1) after a snooze or an ignored surfacing the item does not resurface on the immediately-following open — snooze sets an explicit `snooze_until`, ignored items back off (surface every Nth open, N growing with escalation level); (2) escalation varies presentation FORM (wording, grouping, placement) as an item ages — never the identical element at higher intensity; (3) overdue/stale styling stays quiet — no red shouting, no badge counts. (Habituation evidence: identical repeated alerts train reflexive dismissal within days; varied, spaced presentation holds attention.)
- One-tap done/snooze/dismiss applies in-memory immediately; writes coalesce (batched per record + one rebuild after quiescence). Dismiss captures a one-tap reason — done / redundant / wrong extraction (default "done" with undo) — and writes a TombstoneRecord retaining the original text.
- Inferred-vs-confirmed marking carried on items and surfaced to the cockpit.

**Patterns to follow:** U2 ledger; tombstone set.

**Test scenarios:**
- Covers AE3. Happy path: an item past its confirmed due date is stale on open; dismiss (with reason) writes a TombstoneRecord and it never returns after a rebuild — including via a paraphrased re-extraction (fuzzy resurrection guard).
- Edge case: an item with only an inferred interval is NOT auto-flagged until confirmed/defaulted (R20); an item with only an inferred due date never lands in overdue/slipping.
- Edge case: a confirmed past-due item flags stale even when its interval is unconfirmed (guard scoping).
- Edge case: snooze sets `snooze_until` so the item is not stale next open; an ignored item backs off rather than surfacing every open.
- Edge case: cadence default (14d) applies when the meeting cadence is "Ad hoc"/unknown.
- Edge case: escalation/snooze state survives `rebuildLedger()` (lives in `app:followthrough`).

**Verification:** Staleness is pure/deterministic; dismissed items are durably suppressed.

- U7. **Per-meeting view + baseline features**

**Goal:** Preserve the full baseline meeting experience as the source-oriented view.

**Requirements:** R17

**Dependencies:** U3, U4a, U4b, U5, U6

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/meeting-view.test.ts`

**Approach:**
- Per-meeting view: notes list (view/edit/delete), to-dos (CRUD + priority + complete + owner), decisions log, talking points (CRUD + mark discussed), per-meeting chat ("Ask" over that meeting's context), "Brief me" markdown briefing (Since last time / Open with you / Suggested talking points / Questions to ask). Meeting setup modal (name, cadence, purpose, people, next date; delete with confirm).
- All edits write the meeting record then `rebuildLedger()` (coalesced under burst edits).
- A "Regenerate summary" action rebuilds the meeting's rolling summary from the last K raw notes in one bounded AI call — the incremental chain is a cache with a refresh path, never load-bearing (summarization drift is silent by nature; the user-triggered rebuild is the escape hatch). On failure, the existing summary is preserved and displayed unchanged with a small inline error beside the action (R19); the prior summary is never overwritten unless the new call succeeds — this failure contract is shared with U8's project summary.

**Patterns to follow:** spec functional requirements (meeting view, setup, briefing).

**Test scenarios:**
- Happy path: editing/completing a to-do updates the record and the ledger.
- Edge case: deleting a note with confirm removes it without affecting unrelated items.
- Test expectation: chat and Brief me (AI) verified manually in the artifact.

**Verification:** Baseline meeting features work and stay consistent with the ledger.

- U8. **Projects: entity, tagging, per-project view**

**Goal:** The cross-cutting lens — see a project's full state in one place.

**Requirements:** R14, R15, R16, R13 (data support)

**Dependencies:** U2, U5, U6

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/project-view.test.ts`

**Approach:**
- Project entity: name, status (active/on-hold/done), optional target date (feeds cockpit like a due date). Project CRUD.
- Per-project view derives membership by tag from `app:ledger` + reads `project:{id}` direct updates: open to-dos, waiting-fors, decisions, recent updates, contributing meetings.
- Rolling project summary maintained **incrementally at accept-time** from the prior summary + just-verified items (bounded input; no AI on view-open). A "Regenerate summary" action rebuilds it from the last K raw updates/notes on demand (drift escape hatch; failure contract shared with U7 — prior summary preserved + inline error).

**Patterns to follow:** U2 derive-by-tag; spec rolling-summary discipline.

**Test scenarios:**
- Happy path: items tagged to a project across two different meetings both appear in the project view.
- Edge case: a "done" project's still-open items remain surfaced in the cockpit (decided: a done project with open items is a contradiction worth seeing).
- Edge case: target date in the past surfaces in the cockpit.
- Test expectation: rolling-summary AI text verified manually in the artifact.

**Verification:** A project aggregates correctly from tags without storing a clobber-prone item copy.

### Phase 4 — Cockpit and Proactive Layer

- U9. **Deterministic prioritization cockpit**

**Goal:** The holy-grail surface — instant, trustworthy "what's next / due / slipping" on every open.

**Requirements:** R11, R13, R10 (surfacing), R15 (target dates), R20 (inferred marking)

**Dependencies:** U6, U8

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/cockpit-ranking.test.ts`

**Approach:**
- On open, render instantly from the cached `app:ledger`, then reconcile via a quiet rebuild after first paint (stale-while-revalidate). Compute ranking locally (no AI), group into do-next / due-soon / waiting-on-others / slipping. Cross-meeting and cross-project.
- Project filter (R13). Stale items surface here with escalation (spaced + polymorphic per U6); inferred fields visibly marked (R20). An inferred, unconfirmed due date may place an item in due-soon (marked) but never in overdue/slipping.
- Ranking starting heuristic: Eisenhower-style two-axis grouping with importance co-equal to urgency — urgent+important leads do-next; important-not-urgent also reaches do-next (distinct slot); urgent-not-important goes to due-soon; neither goes to slipping/waiting. (Urgency-strictly-first ordering replicates the documented mere-urgency bias, strongest in busy users — the cockpit must correct the bias, not amplify it.) Weights tunable; see deferred questions.
- Do-next is capped at 5 items; overflow lands in due-soon with a "more available" indicator. The cap is ranking-logic behavior, not a display choice — overstuffed today-views are a documented abandonment driver.

**Patterns to follow:** U2 ledger read; U6 staleness.

**Test scenarios:**
- Covers AE4 (deterministic half). Happy path: cockpit renders from the ledger with no AI call.
- Happy path: items group into the four buckets correctly; project filter narrows to one project.
- Edge case: an overdue project target date appears in the appropriate bucket.
- Edge case: a waiting-for item lands in waiting-on-others, not do-next.
- Edge case: an important-but-not-urgent item reaches do-next; do-next never exceeds 5 (overflow to due-soon); an inferred-due item appears in due-soon, never overdue/slipping.

**Verification:** Cockpit is instant, deterministic, and stable between opens (no AI variance).

- U10. **Daily AI focus narrative (cached, bounded, last)**

**Goal:** A cheap once-daily synthesis on top of the deterministic cockpit, cuttable without rework.

**Requirements:** R12

**Dependencies:** U9

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/focus-cache.test.ts`

**Approach:**
- Once per day (or when an item is accepted), feed the top-N ranked ledger slice to `callClaude` for a short focus narrative; cache under `app:focus` keyed by {local date, last-accept marker}.
- Prompt contract: consequence framing — for each top item, why it comes first and what slips if it is not done — explicitly NOT a restatement of the rank order; the prompt suppresses ranking recaps. No em dashes (project rule).
- Other opens read the cache (no AI). On recompute failure, show the last cached focus + a small inline error; never block the cockpit.
- Cache invalidates on item-accept or day-roll, not raw note save.

**Patterns to follow:** U9 ranking (for the slice); spec graceful-failure.

**Test scenarios:**
- Covers AE4 (cache half). Happy path (cache logic): with no new accepts and same day, the cached focus is returned without a recompute.
- Edge case (cache logic): an accept invalidates the cache; next open recomputes once.
- Error path: a simulated recompute failure surfaces the last cached focus + inline error (cockpit still renders).
- Test expectation: live narrative quality verified manually in the artifact.

**Verification:** AI runs at most once per day/state; failure degrades gracefully.

### Phase 5 — Durability

- U11. **Migration + Import/Export**

**Goal:** Data survives the artifact-version handoff.

**Requirements:** R18

**Dependencies:** U2 (final shape), U1 (export/import shell)

**Files:** Modify `meeting-assistant.tsx`; Test `dev/tests/migration.test.ts`

**Approach:**
- Export includes `schema_version: 2`, all records, and `app:followthrough` (tombstones + engine state — dismissals must survive the version handoff).
- Import validates `schema_version`; v2 loads directly; v1 migrates forward — add new fields with defaults (legacy to-dos → owner "I owe"/unclassified, no project, no interval), then `rebuildLedger()`. A payload with NO `schema_version` field but a recognizable v1 shape (meetings list + meeting records) is classified as v1 and migrated — real v1 exports predate the field entirely, so missing-version-means-reject would strand the only legacy data that exists. Only an explicitly unrecognized or newer version surfaces a clear inline error rather than corrupting data.
- Import order of operations: the ENTIRE payload is structurally validated (parse, version, per-record required fields) before the first destructive write — a bad file is rejected with existing data untouched. Import into a populated artifact is a wholesale replace behind a single inline confirm with two actions: "Export backup first" (default — runs Export, verifies every key was read into the backup, then returns to the same confirm with replace enabled) and "Replace without backup" (explicit opt-out). Backup-by-default with opt-out is informed consent, not enforcement (window.storage has no merge semantics; silent replace is the primary data-loss risk).
- Import writes records sequentially with throttling, checks each `storage.set` result, and on any failure reports exactly which records failed with a retry-remainder action (re-running an import is idempotent); then it restores `app:followthrough`, rebuilds the ledger, and resets the focus cache.

**Patterns to follow:** spec Export (`exportJSON`) + migration gotcha section.

**Test scenarios:**
- Happy path: exporting then importing v2 reproduces identical state, including tombstones and engine state (`app:followthrough` round-trips).
- Integration: importing a v1 export migrates to v2 with defaulted fields and a correct rebuilt ledger; a version-LESS v1-shaped export migrates rather than rejects.
- Error path: importing a malformed/newer-version file shows an inline error and leaves existing data intact.
- Error path: a simulated mid-import write failure reports exactly which records failed; retry completes the set; no record silently skipped.
- Edge case: importing into a populated artifact replaces wholesale only after confirmation (with the backup offer shown first).

**Verification:** Round-trip and v1→v2 migration both preserve data; no import path destroys existing data.

---

## System-Wide Impact

- **Interaction graph:** every accept (intake, inline edit, completion, project/meeting CRUD, import) funnels through one `rebuildLedger()` so the cockpit/project views stay consistent. This is the central seam.
- **Error propagation:** AI and storage calls are individually wrapped; a failure shows an inline message and never aborts a save or destroys data (save-before-analyze; cached-focus fallback).
- **State lifecycle risks:** dismissal tombstones and escalation/snooze state are authoritative in `app:followthrough` and survive rebuilds, re-extraction, and Import by construction; the ledger is always rebuilt from truth, never merged, and recovers from interrupted accepts via stale-while-revalidate on open. Burst triage writes coalesce to respect rate limits. `window.storage` ~5MB/key — the ledger is compact, but watch growth over long use (see Risks).
- **API surface parity:** N/A (single-user client artifact, no external API surface beyond the keyless Claude call).
- **Integration coverage:** the accept→rebuild→read path and the v1→v2 migration are the cross-cutting behaviors unit tests must prove, not just mock.
- **Unchanged invariants:** baseline storage keys (`meetings:list`, `meeting:{id}`, `app:meta`) keep their meaning; this plan adds keys and fields, it does not repurpose existing ones.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `MODEL` (`claude-sonnet-4-6`) rejected by the work runtime → all AI fails silently in production | One-line `MODEL` constant; verify on first paste-in (handoff checklist); fallback `claude-sonnet-4-20250514` |
| Token cap truncates extraction or focus output | Bounded items + length-capped quotes per call (R21); long notes chunked into sequential calls with merge/dedup; top-N slice for focus; truncation detected as recoverable error |
| Storage write rate limits under burst triage or import | Coalesced triage writes (one rebuild after quiescence); throttled sequential import with per-write result checks; probe burst-write behavior at first paste-in alongside the MODEL check |
| `app:ledger`, `app:followthrough`, or a `meeting:{id}` record approaches the ~5MB/key cap over long use | Ledger stores compact items only; raw notes live on meeting records; `app:followthrough` prunes dead `item_state` at sweep time (tombstones retained by design); revisit archival only if a real ceiling is hit (deferred) |
| Last-write-wins clobber across meeting+project on one intake | Derive-then-cache: ledger rebuilt wholesale from per-source truth, never merged (Key Technical Decisions) |
| Design/IA undefined could block UI build | Behavior/data boundaries defined here; visual/IA decisions go to the impeccable design pass (dependency, not blocker for logic units U1–U2, U6, U9–U11) |
| Dev scaffolding leaking into the artifact | `dev/` is local-only; pre-handoff check that `meeting-assistant.tsx` imports nothing outside the allowlist |

---

## Documentation / Operational Notes

- Handoff per CLAUDE.md: output the single `meeting-assistant.tsx`, paste into the work instance, **verify `MODEL` works first**, enable the AI capability, test AI + persistence in the artifact, Share + bookmark; carry data across versions via Export → Import.
- The impeccable design pass is a prerequisite for the visual layer of the intake/verification/cockpit/project surfaces; logic units can proceed in parallel.
- Strong `ce-compound` candidate after build — capture the artifact-specific patterns into `docs/solutions/`.

---

## Phased Delivery

### Phase 1 — Foundation (U1, U2)
Skeleton, plumbing, data model + derived ledger. Nothing user-visible ships value yet, but everything depends on it.

### Phase 2 — Trustworthy Intake (U3, U4a, U4b, U5)
The bedrock Bryan cares most about: capture → extract → verify → accept. First real value.

### Phase 3 — Follow-Through and Views (U6, U7, U8)
Owner/staleness signals, the baseline meeting view, and the project lens.

### Phase 4 — Cockpit and Proactive Layer (U9, U10)
The deterministic prioritization cockpit (the holy grail), then the cached daily focus narrative.

### Phase 5 — Durability (U11)
Migration + Import/Export so data survives version handoffs.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-06-intake-projects-follow-through-requirements.md](docs/brainstorms/2026-06-06-intake-projects-follow-through-requirements.md) (includes the 2026-06-10 doc-review Deferred / Open Questions resolved in this plan)
- **Constraints:** [CLAUDE.md](CLAUDE.md), [meeting-assistant-spec.md](meeting-assistant-spec.md)
- **Ideation:** [docs/ideation/2026-06-05-meeting-assistant-enhancements-ideation.md](docs/ideation/2026-06-05-meeting-assistant-enhancements-ideation.md)
