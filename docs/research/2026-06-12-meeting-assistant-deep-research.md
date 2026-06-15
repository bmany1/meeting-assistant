---
date: 2026-06-12
topic: meeting-assistant-plan-stress-test
purpose: external research to stress-test docs/plans/2026-06-10-001-feat-intake-projects-follow-through-plan.md before build
provenance: deep-research workflow wf_28cfd716-f6b (5 search angles, 25 sources fetched, 122 claims extracted)
verification-status: partial — the adversarial verification phase was cut short by a session rate limit.
  3 verification votes completed, all PASSED (high confidence); 1 claim formally confirmed 2-0 in-run;
  remaining claims are quote-backed from live-fetched sources but not adversarially double-checked.
raw-claims: 2026-06-12-deep-research-raw-claims.json (all 122 claims with verbatim quotes)
---

# Deep Research: Stress-Testing the Intake/Projects/Follow-Through Plan

Five research angles were run against the plan's six load-bearing decisions. Headline: **the
architecture survives scrutiny almost untouched — the intake pipeline and the escalation design do
not.** The wholesale-rebuilt ledger, per-source truth records, deterministic cockpit, and hybrid
human verification are each independently confirmed by multiple unrelated literatures. The
challenges cluster on (1) single-pass extraction over long notes, (2) trusting model-emitted quote
text, (3) dismiss/escalation mechanics that the habituation literature says will train Bryan to
ignore them, and (4) an urgency-only ranking bias.

Verdict key: **CONFIRM** = external evidence supports the plan as written. **CHALLENGE** = evidence
argues for changing the plan. **ADD** = evidence suggests something the plan lacks.

---

## 1. The six plan decisions, judged

### D1. Wholesale-rebuilt `app:ledger` over per-source truth records — CONFIRM (strongest result)

Four independent literatures converge on exactly this pattern:

- **Event-sourcing practice** (Kurrent, "Turning the Database Inside Out"): derived read models are
  disposable projections, recreated by replaying source-of-truth records. Critically, keeping a
  derived view *incrementally* synchronized requires checkpoint machinery (monotonic positions,
  subscriptions) that `window.storage` does not have — so wholesale rebuild on each accept is not a
  simplification, it is the only reliable consistency mechanism available in this runtime.
- **Local-first research** (Ink & Switch, Cambria): their prototypes that translated data at write
  time failed in practice; the published conclusion is "data translations in decentralized systems
  should be performed on read, not on write." Same hazard class the plan's rebuild-from-truth avoids.
- **LWW analysis** (DZone, LWW vs CRDTs): the concrete failure mode is the silent lost update on
  read-modify-write of a shared key. Per-source keys + regenerated index sidestep it; CRDT-style
  merging is explicitly justified only for geo-distributed multi-writer systems — adopting it here
  would be complexity without the conditions that warrant it.
- **LLM memory systems** (MemGPT, CogCanvas): MemGPT's "working context" — a small, bounded,
  structured block of key durable facts, writable only by explicit action — is architecturally the
  `app:ledger`. CogCanvas measures a compact typed-object index at ~1,250 tokens per read versus
  ~10,000 for full context, validating the compact-index-as-AI-read-surface design under a token cap.

Also confirmed by counter-example: a practitioner survey of agent memory reports MemGPT-style
*tiered/paged* memory has near-zero production adoption ~3 years post-paper ("the overhead of
maintaining these separate tiers is burdensome and tends to fail") — the plan's flat compact index
is the defensible end of that spectrum.

### D2. Per-source records as truth; rolling summaries as derived convenience — CONFIRM, with one ADD

The anti-rolling-summary evidence is unusually quantified:

- CogCanvas benchmark: verbatim-grounded extraction recalls **93–97.5%** of facts vs **19%** for
  summarization, with qualifiers ("everywhere") being exactly what summaries drop.
- MemGPT paper: fixed-context baselines using recursive summaries score **32.1–38.7%** on deep
  memory retrieval vs **66.9–93.4%** for tiered memory; the paper itself calls recursive
  summarization "lossy."
- Named failure mode, "summarization drift": each compression pass silently discards low-frequency,
  high-importance details; after ~3 cycles a critical one-off instruction tends to vanish.

**ADD:** the plan keeps per-meeting and per-project *rolling summaries* updated incrementally at
accept-time forever. That is a chain of summaries-of-summaries — the exact drift mechanism above.
Mitigation is cheap because raw notes remain stored: periodically (or on demand via a "regenerate
summary" action) rebuild the summary from the last K raw notes instead of incrementally patching it
without bound. Treat the rolling summary as a cache with a refresh path, never load-bearing.

### D3. Hybrid verification (inline edits, no AI + one additive re-run) — CONFIRM, with sharpening

- At realistic scale, LLM extraction agreed with human coding only **62–72%** (exact match) — far
  below the >90% small-sample marketing numbers. The authors explicitly argue even >90% would not
  justify removing human oversight (accuracy doesn't transfer across contexts) — which kills any
  future "auto-accept high-confidence items" temptation.
- AI self-verification is weakest on the highest-stakes failure: GPT-4 detects errors in meeting
  summaries at ~89% average but only **~72% for hallucination**. Human review is the backstop; an
  AI-checks-AI step would be the wrong spend of the token budget.
- A grounded-extraction framework with machine-side self-verification costs **2.83–4.28 LLM calls
  per input** — the wrong trade in a user-triggered, token-capped client. Single-pass + human
  verification is the right call pattern here.
- The one additive re-run is supported as *meaningful, and sufficient*: a structured
  identify-mistakes → feedback → regenerate pass produced summaries comparable to error-free gold
  standards. One re-run closes most of the gap; more would be waste.
- The AIDE human-in-the-loop extraction tool (working, published) is the plan's verification screen
  almost exactly: per-item accept-or-edit, with the source location auto-surfaced next to each item.
- Inferred fields deserve the most scrutiny: explicit-data extraction ran **83% accurate vs 65%**
  for derived/categorized data (priority, inferred due dates, owner). The verification UI should
  visually weight inferred fields for review — this strengthens the plan's existing R20.
- Owner misattribution is formally taxonomized ("Coreference" error class — *the one claim that
  passed formal 2-0 adversarial verification in-run*) and observed in deployment (Microsoft recap
  study: 4 of 7 participants saw themselves misattributed). Owner must be a first-class editable
  field on every item, never buried. Plan already does this (R8); keep it prominent in the design pass.

### D4. Fixed item-cap single-pass extraction — CHALLENGE (the biggest plan change)

The plan bounds extraction with an item cap per pass plus one conversational re-run. The evidence
says this under-extracts on long notes, and Bryan's stated usage is "varies wildly — some bullets,
some giant multi-page dumps":

- **Omission is a documented top error class** in meeting summarization (human-annotated taxonomy:
  partial and total omission), not an edge case.
- **Lost-in-the-middle**: content mid-way through long inputs is systematically deprioritized
  (Liu et al.) — missed items will cluster in the middle of big dumps, invisibly.
- **Multi-pass/chunked extraction is the established practice**: LangExtract ships
  `extraction_passes=3` + chunking for recall on long documents; Microsoft's deployed recap system
  segmented transcripts into overlapping windows (30 utterances, stride 10); practitioner guidance
  for transcripts is map-reduce chunking (split at natural boundaries, 10–20% overlap, merge +
  dedup).
- The counter-position exists and is worth recording: Granola deliberately skipped chunking
  pipelines, betting longer model contexts make them obsolete. But Granola's constraint was *input*
  length — ours is the **1000-token output cap**, which no future input window fixes. A dense
  3-page dump can simply contain more items than one response can carry.

**Recommended change (U4):** auto-segment long pastes. Below a size threshold, current single-pass
behavior. Above it, split at paragraph/blank-line boundaries into sequential extraction calls
(modest overlap), merge proposals with normalized-key dedup, then present **one** unified
verification screen. Sequential calls are fine (no background jobs needed — it's one user action
with a progress indicator). The item cap stays *per call* as the output-budget guard, but stops
being the recall ceiling for the whole note.

### D5. Quote-grounded provenance — CONFIRM the idea, CHALLENGE the mechanism

Provenance-per-item is unanimously supported (LangExtract anchoring; a provenance-tracked extraction
framework whose ablations show source-anchoring is *the* primary hallucination-reduction mechanism;
Microsoft recap: every participant expanded items back to source context to judge correctness —
provenance isn't a nice-to-have, it is how users decide to trust).

But the plan trusts the **model-emitted quote text** to be the provenance. Two findings break that:

- Models fabricate items by copying from few-shot examples rather than the input (LangExtract names
  this failure and detects it by character-interval validation: an extraction that cannot be located
  in the source is suspect).
- Deterministic Quoting (healthcare RAG): model-emitted "quotes" can themselves be hallucinated; the
  fix is the model selects *which* span, but the displayed text is retrieved from the source by
  lookup, achieving 100% verbatim quotes.

**Recommended change (U4/U5, zero AI cost):** after parsing, substring/fuzzy-match each item's
`quote` against the raw note. Anchors → render the matched span *from the note itself* (deterministic
quoting). Fails to anchor → flag the item visually as unanchored/suspect in the verification screen
(don't auto-delete; the item may be real with a paraphrased quote). This converts provenance from
"model says so" to "deterministically checked," for one string search.

### D6. Staleness = overdue-or-untouched-N-days; escalate; tombstone dismissals — CONFIRM core, CHALLENGE escalation, ADD dismissal semantics

The deterministic core is confirmed: even a feature-rich ML classifier over rich behavioral logs
predicts email deferral/follow-up need at only ~0.25 precision — AI-inferred nudging is hard even
with telemetry the artifact doesn't have; simple deterministic rules + explicit user actions are the
right call. Self-applied "I'll get back to this" markers are unreliable (users don't return to
flagged emails), so system-driven resurfacing is necessary — and deferral is routine daily behavior
(12% of email triage sessions), so snooze/resurface is core machinery, not an edge case. Plan
already treats it as such.

The **escalation** design is where the habituation literature lands hard:

- Interruptive clinical alerts: **4–11% acceptance**; physicians dismissed **91.2%** of 66,049
  alerts, **72.5% in under 3 seconds** — reflexive, not deliberative. Each dismissal reinforces the
  habit of dismissing (self-reinforcing, hard to break once formed, across all seniority levels).
- Attention to identical warnings measurably decays within a five-day week (fMRI + eye-tracking),
  **but recovers partially after gaps without exposure** — spacing restores effectiveness.
- **Polymorphic (varying) presentation substantially reduces habituation** in both lab and a
  3-week field experiment; static warnings decayed, varying ones held.
- Task-manager-specific: aggressive overdue signaling (red, badges) is a primary documented driver
  of task-manager *abandonment*; users develop "ad blindness" to items that roll over day after day.
- Low-quality alerts have a spillover effect: bad nudges degrade trust in the *whole* system, not
  just themselves.

**Recommended changes (U6/U9 + design pass):**
1. Escalation must **change form, not volume** — vary wording/placement/grouping as an item ages
   (the underlying counter stays; the *presentation ladder* becomes polymorphic). Never the same
   banner, louder.
2. Resurfacing needs **gaps**: after a snooze or an ignored surfacing, back off before showing
   again (spacing effect), rather than appearing on every open.
3. Overdue styling stays **quiet** — no red shouting, no badge counts. Frame the cockpit as "what
   to pick next," not a debt ledger (inbox-zero framing and never-empty-list anxiety are documented
   abandonment drivers; "it's OK if the list is never empty" is the sustainable framing).
4. **ADD — dismissal reasons:** user deletions of AI-extracted tasks are ambiguous across at least
   three meanings — *done*, *redundant*, *wrong extraction* (Microsoft recap). One-tap dismiss
   should offer the reason (or default + undo), because the three mean different things: "wrong"
   is extraction feedback, "done" is completion, "redundant" is dedup signal. Without the reason,
   the tombstone is unusable as any future signal and completions go uncounted.
5. **Tombstone keying caveat** (Cambria): normalization is a one-way lossy transform, and the
   normalizer effectively becomes part of the schema — changing it later orphans every existing
   tombstone. Store the *original* text + source ref + reason in the tombstone record alongside the
   normalized key, and treat normalizer changes as schema migrations.

---

## 2. Findings on the intake call shape (new, affects U4)

- **Instruction dilution:** packing todos + decisions + completions + rolling-summary-update into
  one prompt measurably degrades per-task attention and increases hallucinated/misattributed items
  (practitioner guidance for transcript pipelines). The spec's single "Save and analyze" mega-call
  is the risky shape. **Recommend:** split item extraction from rolling-summary update into two
  sequential calls (summary update can even run only at accept-time, matching D2's
  incremental-summary posture). Completions-matching can ride with extraction (it needs the open-todo
  list anyway).
- **JSON format restriction degrades reasoning** ("Let Me Speak Freely?"): strict-JSON output
  measurably hurts *inference-heavy* outputs (inferred due dates, priorities) though it *helps*
  classification-style fields by constraining the answer space. Two usable implications, no plan
  change required yet: (a) keep the schema **flat and simple** — schema-compliance benchmarks show
  compliance collapsing with schema depth/complexity (0.90 easy → 0.13 hard without constrained
  decoding, which the artifact runtime does not have); (b) if inferred-field quality disappoints in
  production, the documented mitigation is a two-step reason-then-format pipeline — known lever,
  don't build preemptively. Notably, the tested Claude model was among the most robust to JSON-format
  degradation — weakly favorable, verify on the production model.
- **Validate structure post-parse:** even "valid JSON" can violate the intended shape
  (under-constrained outputs; one model silently returned nothing for 9/112 inputs and partials for
  3 more). `safeParseJSON` is necessary but not sufficient — after parse, validate required fields
  and types, and treat "model silently dropped items" as an expected case (which D4's chunking and
  the re-run already mitigate).
- **Context injection beats instruction stacking** (Granola): extraction quality improves more from
  injecting situational context — meeting purpose, attendees/roles, the decision at hand — than from
  adding more instructions. The app already stores `purpose` and `people` per meeting; **feed them
  into the extraction prompt** alongside the open-todo list. Nearly free, directly supported.
- **Edit rate as the trust metric** (production practice): the fraction of extracted items the user
  edits before accepting is the most reliable production quality metric for action-item extraction.
  The verification flow makes this trivially countable. **ADD (cheap):** store running
  edit/accept/dismiss-reason counts in `app:meta` — it quantifies whether extraction trust is
  improving and gives the future "should we tune prompts" decision actual data.

---

## 3. Findings on the cockpit and focus narrative (U9/U10)

- **Mere-urgency effect** (Journal of Consumer Research): people preferentially do time-sensitive
  tasks over higher-payoff important ones, and the bias is *strongest in self-described busy
  people* — exactly this app's user. The plan's starting heuristic (`overdue > due-soon > priority >
  age`) ranks urgency strictly above importance and therefore *replicates the bias*. **Recommend:**
  make importance/priority co-equal with urgency rather than a tiebreaker — the Eisenhower 2×2
  (deterministic, four buckets, no continuous scoring needed — Todoist's documented practice) is the
  established shape. The do-next group should be able to contain an important-but-not-urgent item.
- **The same research resolves the brainstorm's open question on whether the daily narrative earns
  its place** (origin doc P2): the urgency bias is *reversible by consequence framing* — prompting
  people to consider consequences at selection time flips choices toward important tasks. That is a
  job the deterministic ranked list cannot do and a one-sentence narrative can. **Recommend:** spec
  U10's prompt as consequence framing ("why this first / what slips if not") rather than restating
  the ranking — that is the narrative's distinct, evidence-backed job, and it doubles as the daily
  habit anchor (to-do systems die of non-review, not of weak ranking formulas).
- **Inferred due dates must not drive "overdue"** (Things 3 start-vs-due lesson: tasks without real
  deadlines appearing falsely overdue is a documented abandonment driver). The plan's R20 already
  gates the *staleness interval* on confirmation; extend the same gate so an **inferred** due date
  alone cannot place an item in the overdue/slipping buckets until confirmed (it may still appear in
  due-soon with its inferred marking).
- **Under-commitment keeps daily surfaces alive** (Sunsama's official guidance: plan 5–6 hours, not
  a full day; finishing what was planned is the habit mechanism; overstuffed today-views cause
  abandonment): keep **do-next deliberately tiny** (3–5 items), with everything else one tap away.
  Aligned with email-triage finding that higher visible workload increases deferral of any given item.
- Generative-agents retrieval scoring (recency decay + importance, deterministic, embedding-free,
  measurably better than similarity-only) is a research precedent for exactly the kind of
  multi-signal deterministic formula the plan sketches — the cockpit's ranking approach is grounded,
  not a compromise.

---

## 4. What stays as-is (explicitly confirmed, no action)

- Derive-then-cache wholesale rebuild; per-source truth records; per-entity key granularity
  (smaller write units shrink the clobber surface).
- Hybrid verification with exactly one additive re-run; no AI self-verification pass.
- Deterministic staleness core + system-driven resurfacing; snooze that actively resurfaces.
- Tombstones as explicit named facts (vs inferring dismissal from absence) — event-modeling practice.
- Compact ledger as the AI read surface; top-N bounded slice for the focus pass.
- `stripJSONFences` + `safeParseJSON` + fallback (even the best constrained-decoding frameworks
  top out at 96–98% schema compliance; the artifact has none).
- Import refusing unknown/newer schema versions (forward compatibility is rare and hard — refusing
  gracefully is the documented correct behavior). One refinement available: route all version
  handling through a single `migrate(record, fromVersion)` seam (Cambria's isolated-translation-layer
  principle) rather than scattering version checks.
- Human accept as the consolidation trigger into durable memory — matches state of the art in agent
  memory systems (consolidation is never automatic).

---

## 5. Coverage gaps in this research round

- **UX interaction patterns (area 5) are under-covered**: the fetch round surfaced verification-UX
  evidence (AIDE, Microsoft recap, deterministic quoting, LangExtract review UI) but little on
  destination pickers, empty states, progressive trust-building, or email-triage interaction
  mechanics (Superhuman/SaneBox). Recommend a small follow-up research round scoped to those,
  feeding the impeccable design pass rather than this plan review.
- Competitor failure-mode reporting (Otter/Fireflies/Read.ai user-correction flows) did not survive
  source selection; the Granola interview and the Microsoft deployment study carry that weight here.
- Claims are quote-backed but mostly not adversarially verified (rate limit). The three votes that
  completed all passed at high confidence. Spot-check anything load-bearing before treating a
  specific number as gospel.

## Sources (25)

Primary/academic: arXiv 2407.11919 (meeting-summary error taxonomy, COLING 2025) · arXiv 2501.11840
(LLM extraction vs human coding; AIDE) · arXiv 2601.00821v2 (CogCanvas) · arXiv 2408.02442 ("Let Me
Speak Freely?") · arXiv 2501.10868 (JSON-schema compliance benchmark) · arXiv 2310.08560 (MemGPT) ·
arXiv 2603.07670 (agent-memory survey) · arXiv 1901.04375 (email deferral) · ResearchGate 372785084
(Microsoft LLM meeting recap deployment study) · MDPI Computers 15(3):178 (anchor-grounded
extraction) · MISQ 42(2) (fMRI habituation to warnings) · PMC9132737 (CDS alert fatigue) ·
PMC8892274 (66k-alert dismissal cohort) · Ink & Switch Cambria · google/langextract.
Practitioner/product: Kurrent (DB inside-out) · DZone (LWW vs CRDTs) · mattyyeung (Deterministic
Quoting) · Gladia (transcript→notes pipelines) · Towards Data Science (agent memory guide) · Granola
CEO interview (Creator Economy) · Sunsama daily-planning guide · Todoist Eisenhower guide ·
molodtsov.me + Zapier (task-manager abandonment).

Raw claim set with verbatim quotes: `2026-06-12-deep-research-raw-claims.json`.
