# Personal Assistant (Meeting Assistant) — Project Guide

This file is the durable context for every session on this project. Read it first.
The authoritative requirements live in `meeting-assistant-spec.md`; this file summarizes,
adds decisions we've made, and records workflow. When the two disagree, the spec wins on
constraints — but check this file for decisions that intentionally override it (e.g. model ID).

---

## What we're building

A personal assistant that ingests Bryan's meeting notes and lets him chat with the app, then
surfaces insights, to-dos, and reminders that help him run his day-to-day. Under the hood it's
Claude doing the analysis.

The deliverable is **one `.tsx` file** that runs as a **claude.ai Artifact** — not a normal
web app. The build/refine work happens here in Claude Code; the finished single file gets pasted
into Bryan's *work* instance of Claude, rendered as an artifact, and shared as a bookmarkable link.

**North-star vision is still being defined** via a compound-engineering brainstorm (see "Current
status"). The spec's "Functional requirements" are the baseline foundation; new insight/to-do
features get defined in that brainstorm, not invented ad hoc.

---

## Deployment model (this is the unusual part)

1. We build/refine locally in Claude Code.
2. Output is a single `.tsx` (one default-exported React component).
3. Bryan pastes it into a new chat in his work Claude instance → rendered as an artifact.
4. The artifact runs in claude.ai's sandbox. **No Node server, no build step, no hosting in
   production. The sandbox is the runtime.**
5. Bryan clicks Share → copies link → bookmarks it.

Two consequences that drive every constraint below:
- The app cannot use anything needing a server or a secret (no env vars, no `process.env`, no
  backend routes, no API keys in code).
- The two most important features — **AI calls** and **saved data** — only work *inside claude.ai*.
  They will not run locally. That is expected, not a bug.

---

## Hard constraints (non-negotiable — build to these from line one)

1. **Single file.** All components, styles, helpers, data logic in one `.tsx`. No modules, no
   separate CSS. (Dev scaffolding is the one exception — see "Local dev loop"; it never ships.)
2. **Allowed libraries only.** React + hooks, plus the artifact allowlist:
   `lucide-react`, `recharts`, `chart.js`, `plotly`, `d3`, `lodash`, `mathjs`, `papaparse`,
   `xlsx`, `tone`, `three`, `mammoth`, `tensorflow`, `shadcn/ui`. **Nothing else.** If something
   seems to need another package, solve it with built-in browser APIs, native `Date`, and React state.
3. **No browser storage APIs.** `localStorage`, `sessionStorage`, cookies, IndexedDB are blocked
   and will fail. Persist only via `window.storage` (see "Persistence").
4. **One default-exported React component.** Functional component with hooks.
5. **No `<form>` tags.** Use buttons with `onClick` and inputs with `onChange`. Hard requirement
   of the artifact + in-app-AI environment.
6. **Styling: inline style objects** driven by a single `BRAND` color-token object and
   `SERIF` / `SANS` font constants. Prefer this over Tailwind (no compiler for custom values in
   the sandbox). Build small reusable UI atoms (buttons, cards, inline confirm, inline error, spinner).

---

## The AI layer (keyless Anthropic API)

The app calls Claude directly from the browser via keyless `fetch` — the claude.ai runtime injects
credentials, so **there is no API key anywhere in the code**. Use the exact pattern in the spec
(`callClaude`), with these project decisions:

- **Model ID: `claude-sonnet-4-6`.** Keep it in a single top-level `MODEL` constant so it's a
  one-line swap.
  > ⚠️ **VERIFY ON FIRST PASTE-IN.** The spec prescribes the older `claude-sonnet-4-20250514` and
  > says the runtime manages this. Bryan chose 4.6. If the work-instance artifact allowlist rejects
  > `claude-sonnet-4-6`, **every AI call fails in production with no local warning.** Fallback is
  > `claude-sonnet-4-20250514`. This is item #1 on the handoff test checklist.
- **Keep `max_tokens` at 1000.** Runtime-managed; don't expect to raise it. Design AI outputs to
  fit. If output risks running long, tighten the prompt — don't ask for more tokens.
- **Structured data → strict JSON, parsed defensively.** Tell the model to return only JSON, no
  preamble, no markdown fences. Always run responses through `stripJSONFences` + `safeParseJSON`
  with a fallback. Never trust raw output to be valid JSON.
- **Every AI prompt that generates user-facing text must instruct the model to avoid em dashes.**
  Bryan strongly dislikes them. This goes in every such prompt.
- **Fail gracefully, never lose user input.** Wrap every AI call so a failure shows a small inline
  error and leaves data intact. Ordering matters: **save the note first, then run analysis**, so a
  failed analysis never costs the user their note.
- **AI calls fail locally** (no key). Only place to test AI behavior is inside a claude.ai artifact.

**MCP connectors (future lever, not a dependency):** the same API can call approved MCP servers via
an `mcp_servers` array. Bryan's work instance has Context7 and Atlassian (Atlassian could later read
Jira). Do **not** add MCP calls unless Bryan explicitly asks.

---

## Persistence (`window.storage`)

Key-value store claude.ai gives artifacts so data survives sessions. Wrap it exactly like the spec's
`storage` helper. Rules:

- **Values are strings.** `JSON.stringify` in, `JSON.parse` out (wrapper handles it).
- **Always pass the `shared` flag explicitly as `false`** (private to the user). Never `true`.
- **Reading a missing key can throw** — always go through the wrapper, which returns null.
- **Key format:** under 200 chars, no spaces/slashes/quotes. Namespace pattern:
  `meetings:list`, `meeting:{id}`, `app:insights`, `app:meta`.
- **~5MB per key, writes are rate limited.** Batch related data into one key (e.g. a meeting's
  notes/todos/decisions under one `meeting:{id}` object), not many writes in a row.
- **Last write wins** — no merging. Read → modify → write the whole object back.

### Migration gotcha (mandatory plumbing)

Storage is tied to the **specific artifact**. A new version = new artifact = **empty storage**. Old
data does not follow. So the app must have, from the start:
1. **Import to match Export.** Export already downloads all data as JSON; add an Import (file input
   that reads JSON text, validates, writes into `window.storage`). This is how data moves v1 → v2.
2. **Schema version.** Store `app:meta` = `{ schema_version: 1 }` and include `schema_version` in the
   export payload. On import, check the version so future shape changes can be migrated, not break.

---

## Local dev loop (browser preview harness)

Decision: we run a lightweight **Vite + React** dev server so Bryan can *see and click* the UI
locally. AI calls fail locally (expected); full AI + persistence testing happens in claude.ai.

**Bright line — dev scaffolding must never contaminate the artifact:**
- The shippable `.tsx` stays a single pristine file with one default export and only allowlist imports.
- Vite config, the entry wrapper that imports the default export, `package.json`, `node_modules`,
  and any installed allowlist libs live in **separate dev-only files** that are NEVER pasted into
  claude.ai.
- Use the spec's in-memory `window.storage` shim (the `if (!window.storage)` block) for local runs.
  Never substitute `localStorage`.
- Prefer inline styles + `lucide-react` + `recharts` over `shadcn/ui` to keep local preview simple
  (shadcn's `@/` imports are painful to mirror locally and the spec's pattern is inline styles anyway).
- Before any handoff, sanity-check the artifact file imports nothing that only exists because of the
  local harness.

The two claude.ai-only features (AI, real persistence) are verified in the artifact, not locally.

---

## Data model (keep stable — see spec for full shapes)

Authoritative shapes are in `meeting-assistant-spec.md` ("Data model"). Keep them stable so Import
and future migrations have a fixed target. Storage keys:

- `meetings:list` → `Meeting[]`
- `meeting:{id}` → `MeetingData` (`summary`, `notes`, `todos`, `decisions`, `talking_points`, `chat`)
- `app:insights` → `{ items: string[], last_refreshed }`
- `app:meta` → `{ schema_version }`

Helpers to keep: `uid(prefix)` for ids, `nowISO()` for timestamps.

**Ask Bryan before changing the data model.** New features that touch it need his sign-off.

---

## Baseline functional requirements (the foundation to extend)

Build and keep all of this working (full detail in spec):
- **Dashboard:** recurring-meeting cards (name, cadence, purpose, last/next dates, open-todo count);
  per-card "Brief me"; cross-meeting Insights panel (3–5 cached, refreshable observations); search;
  Export **+ Import**; create meeting.
- **Meeting view:** paste-notes box with "Save and analyze" (returns structured JSON: todos w/
  priority + inferred due date + source snippet, decisions, inferred completions, updated rolling
  summary); notes list (view/edit/delete); todos (create/edit/complete/delete/priority, auto-complete
  via analysis); talking points (create/edit/mark discussed/delete); decisions log; per-meeting chat
  ("Ask"); "Brief me" markdown briefing (Since last time / Open with you / Suggested talking points /
  Questions to ask).
- **Meeting setup:** create/edit modal (name, cadence, purpose, key people, next date); delete w/ confirm.
- **General:** everything persists via `window.storage`; responsive + phone-friendly with mobile tabs.

---

## Workflow & tooling

- **Design decisions → `impeccable` plugin.** Use it as the designer/brains behind any UI/UX work.
- **Ideate / brainstorm / plan / build → `compound-engineering` plugin.** Use the matching skill for
  each stage rather than freehanding the process. The pipeline is **ideate → brainstorm → plan →
  build**: `ce-ideate` generates and evaluates a spread of grounded options when the direction is
  open; `ce-brainstorm` deep-dives a *chosen* direction into a right-sized requirements doc; then
  `ce-plan`, `ce-work`, `ce-code-review`. Don't skip ideate when the vision isn't yet picked.
- **Don't invent scope.** The spec says new "more robust" features are user-driven. Define them with
  Bryan in brainstorm, then plan, then build.

---

## Code conventions

- Match spec patterns: inline style objects, single `BRAND` token object, `SERIF`/`SANS` constants,
  small reusable UI atoms.
- AI prompts that emit user-facing text: **no em dashes**, always.
- Structured AI output: strict JSON + `safeParseJSON` fallback.
- Wrap every AI and storage call; catch failures, show small inline message, never destroy user data.
- Save-before-analyze ordering for notes.
- Responsive / phone-friendly layout.

---

## Will not work (do not attempt)

- No server code, Node backend, API routes, env vars, `process.env`.
- No external keyed API calls — only the keyless Anthropic call and (if Bryan asks) approved MCP servers.
- No `localStorage` / `sessionStorage` / cookies / IndexedDB.
- No file access beyond Export download (Blob + temp anchor) and Import read (file input → text).
- No multiple files / separate CSS *in the shipped artifact*.
- No `<form>` elements.
- No npm packages outside the allowlist.

---

## Handoff checklist (shipping a version)

1. Output the final single `.tsx`.
2. **Verify the `MODEL` constant works in the work runtime** (see AI-layer warning). If 4.6 is
   rejected, swap to `claude-sonnet-4-20250514`.
3. Paste full code into a new work-instance chat → render as artifact.
4. Make sure the AI-powered capability is enabled for the artifact.
5. Test AI features + saving/loading inside the artifact.
6. Share → Share and copy link → bookmark.
7. Carry data over: Export from old artifact → Import into new one.

---

## Current status

- Spec reviewed; CLAUDE.md established (this file).
- Decisions locked: build baseline from scratch; Vite browser preview harness for local dev; model
  `claude-sonnet-4-6` (pending production verification).
- **Pipeline completed (2026-06-10):** ideation → brainstorm → doc-review → plan. Artifacts:
  - Ideation: `docs/ideation/2026-06-05-meeting-assistant-enhancements-ideation.md` (6 survivors;
    #2 Follow-Through Engine chosen).
  - Requirements: `docs/brainstorms/2026-06-06-intake-projects-follow-through-requirements.md`
    ("Trustworthy Intake, Projects, and Follow-Through" — scope grew during brainstorm to the full
    intake-verify + projects + cockpit + follow-through loop). Has a `## Deferred / Open Questions`
    section from the doc review.
  - Plan: `docs/plans/2026-06-10-001-feat-intake-projects-follow-through-plan.md` (Deep, 12 units in
    5 phases after the 2026-06-12 hardening split U4 into U4a chunked-extraction orchestration +
    U4b parse/validate/anchor; greenfield — builds baseline + feature together).
- **Research + hardening pass (2026-06-12):** deep research stress-tested the plan's six load-bearing
  decisions against external evidence (`docs/research/2026-06-12-meeting-assistant-deep-research.md`,
  raw quote-backed claims in the adjacent JSON; verification was rate-limit-truncated — treat figures
  as directional). A two-round `ce-doc-review` then applied 34 fixes + 9 bundled clarifications. The
  architecture core (derive-then-cache, per-source truth, deterministic cockpit, hybrid verification)
  was externally confirmed; major additions: chunked sequential extraction for long notes,
  deterministic quote anchoring, authoritative `app:followthrough` key (tombstone records w/ dismiss
  reasons + escalation/snooze state), Eisenhower-style importance-co-equal ranking w/ do-next cap,
  habituation-aware escalation (back-off, polymorphic, quiet), recoverability-split write coalescing,
  stale-while-revalidate ledger recovery, and import safety ordering (validate-before-write,
  verified backup-by-default). Both rounds' decisions are recorded in the plan's "Resolved by
  2026-06-12 deep research + doc review" section. <!-- Updated 2026-06-12: research + 2-round review -->
- **Key architecture decision** (resolved in the plan): per-source records are the source of truth;
  a compact `app:ledger` index is rebuilt *wholesale from truth* on each accept (never
  read-modify-merge) — this resolves the `window.storage` last-write-wins clobber hazard, the token
  budget, and read cost together. Follow-through state (tombstones, escalation/snooze) is itself
  authoritative in `app:followthrough`, never derived. Single deliverable `meeting-assistant.tsx`;
  dev harness under `dev/` (never shipped). <!-- Updated 2026-06-12: app:followthrough added -->
- **Design pass completed (2026-06-13):** the impeccable UI/IA pass ran end to end. The brand uses a
  self-contained, calm financial-instrument **design system** (authoritative tokens defined in
  `DESIGN.md` and `.impeccable/design.json`). Artifacts:
  - `PRODUCT.md` — strategic identity (calm/trustworthy/precise instrument; brand personality; the three
    anti-references; WCAG AA + reduced-motion).
  - `DESIGN.md` + `.impeccable/design.json` — the visual system. **Indigo `#2C2A4A`** =
    brand/primary buttons/nav-active/links. **Amber `#F2853C`** = the single scarce "next/active"
    signal (<=10%, marker/soft-fill only). Slate neutral ramp; Secondary-text `#706C82` =
    muted/inferred/**stale** (stale is quiet gray + words, never red/badge). Plum/Rose = quiet
    category/project-tag accents (never status). Service-blue `#2F77E0` info; Errors-red `#D32F2F`
    destructive-confirm ONLY. **No green exists** (done/confirmed = an Indigo check). Type =
    Aptos + Aptos Serif (the artifact falls back to system fonts, so the identity rides on the type
    scale and tracking). Six named rules: One Voice, No-Alarm, Inferred Ink, Two-Voice,
    Provenance Inset, Flat & Precise. **Component radius/spacing/elevation are inferred/provisional**
    (no component spec was provided; ~4-8px radius, near-zero shadow, 4px spacing base, 2px Stroke
    focus ring) — calibrate at first paste-in.
  - `docs/design/2026-06-13-design-language.html` — design-language board (palette, type, components).
  - `docs/design/2026-06-13-surface-specs.md` — **the build-ready brief** for all **8 surfaces** (nav/IA
    shell, capture + destination picker, verification, cockpit + daily focus + escalation, project
    view, empty/first-run, Meetings list, Meeting detail): the canonical shared-component contract,
    per-surface states/flows/microcopy, cross-surface flows, terminology table, a binding-constraint
    audit (zero hard violations), 7 resolved cross-surface decisions, and ~9 open questions (mostly
    recommended defaults — see its "Open questions" section).
  - `docs/design/2026-06-13-shaped-screens.html` — 8 clickable mockups.
  - Process: a 9-agent research workflow (brand extraction + 4 UX-pattern tracks) then a
    7-agent shaping workflow (6 surface specs + a coherence pass); the two meeting surfaces shaped in a
    follow-on. The brand-agnostic UX research (provenance-first verification, calm escalation, empty-
    state onboarding, manual-select destination picker) is baked into the specs.
- **Build completed (2026-06-13):** `ce-work` ran the full plan end to end on branch
  `feat/intake-projects-follow-through`, all 11 units (U1, U2, U3, U4a, U4b, U5, U6, U7, U8, U9, U10,
  U11), one commit per unit/phase. The single deliverable `meeting-assistant.tsx` (~3.3k lines) is the
  one default-exported component, imports only `react` + `lucide-react`, no `<form>`, no
  `localStorage`, no `process.env`. Architecture as planned: per-source truth + wholesale-rebuilt
  `app:ledger`, authoritative `app:followthrough`, deterministic cockpit (Eisenhower importance-co-equal,
  do-next cap 5), hybrid verification with deterministic quote anchoring + ghosted tombstone guard,
  chunked extraction, daily focus narrative (consequence framing, cached), v1->v2 import with
  validate-before-write + backup-by-default, first-run sample drive. Pure logic lives in named exports
  (inert in the artifact) and is covered by the `dev/` Vitest harness: **121 tests green** across
  storage, ledger, routing, extraction (chunk/parse/anchor), verify/accept, staleness/escalation,
  meeting/project views, cockpit ranking, focus cache, migration, plus a jsdom render smoke test.
  Build (Vite transpile/bundle) clean. **Not yet pasted into claude.ai** — AI + persistence remain
  unverified in the real runtime (see handoff checklist + calibration list). <!-- Updated 2026-06-13: build complete -->
- **Flagged at build time (resolve at first paste-in):** (1) Two Amber dots can co-occur on the
  cockpit — the nav-active marker (rail/chrome) and the single do-next marker (content). Each surface
  spec authorizes its own; literally this slightly bends the One Voice Rule. Kept both (distinct zones);
  decide at paste-in whether to drop the nav dot in favor of fill+label alone. (2) Dismiss undo is
  single-slot: rapid multi-dismiss only lets you undo the latest (earlier dismisses still honor their
  own 5s timers). (3) Background incremental summaries + Brief me + Ask + focus narrative cannot be
  tested locally (no key) — verify in the artifact. <!-- Added 2026-06-13 -->
- **Deferred tuning constants** (calibrate at first paste-in alongside the `MODEL` check): chunking
  threshold + overlap, fuzzy-match similarity threshold, quiescence window, due-soon window,
  escalation back-off curve, cockpit ranking weights, and the design-pass **provisional component
  values** (radius/spacing/elevation, picker-degrade threshold). Also probe burst-write rate limits at
  that first paste-in. <!-- Updated 2026-06-13: + design-provisional component values, ranking weights -->
- **Open follow-ups:** whether ranking/threshold tuning becomes a named task; whether U9's cockpit
  rendering can truly parallel the design pass; optional re-run of the truncated research
  verification phase; edit/accept/dismiss-rate counters in `app:meta` as an extraction-trust metric
  (cheap add, pairs with the dismiss reasons that shipped in the plan). <!-- Added 2026-06-12 -->

<!-- Updated 2026-06-12: status synced after deep research + two-round plan review -->
