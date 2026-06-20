/**
 * Meeting Assistant — a calm, trustworthy instrument for turning meeting notes
 * into verified, ranked action. Single-file claude.ai Artifact.
 *
 * ── How this file ships ───────────────────────────────────────────────────
 * This is THE deliverable: one .tsx, one default-exported React component.
 * It is pasted into a claude.ai chat and rendered as an artifact. There is no
 * server, no build step, no env vars. Two features only work inside claude.ai:
 *   1. AI calls (keyless fetch; the runtime injects credentials)
 *   2. real persistence (window.storage)
 * Both fail locally by design. See CLAUDE.md / meeting-assistant-spec.md.
 *
 * ── Named exports ─────────────────────────────────────────────────────────
 * The pure deterministic helpers (rebuildLedger, isStale, ranking, migration,
 * tombstones, JSON parsing) are exported by name so the local Vite + Vitest
 * harness under dev/ can test them. claude.ai renders only the DEFAULT export
 * and ignores named exports, so these are inert in production. The bright line
 * (no dev-only IMPORTS into the artifact) is preserved: exports are the safe
 * direction.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Inbox,
  LayoutGrid,
  CalendarDays,
  FolderKanban,
  Download,
  Upload,
  Plus,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  ArrowUpRight,
  X,
  Pencil,
  Trash2,
  Clock,
  RefreshCw,
  MessageSquare,
  FileText,
  AlertCircle,
  Info,
} from "lucide-react";

/* ========================================================================== *
 *  LOCAL-DEV STORAGE SHIM
 *  Activates ONLY when the real window.storage is missing (local Vite/Vitest).
 *  In claude.ai the runtime provides window.storage, so this never runs there.
 *  Never use localStorage — it is blocked in artifacts.
 * ========================================================================== */
if (typeof window !== "undefined" && !(window as any).storage) {
  const mem = new Map<string, string>();
  (window as any).storage = {
    get: async (k: string) =>
      mem.has(k) ? { key: k, value: mem.get(k) } : null,
    set: async (k: string, v: string) => {
      mem.set(k, v);
      return { key: k, value: v };
    },
    delete: async (k: string) => {
      mem.delete(k);
      return { key: k, deleted: true };
    },
    list: async (prefix = "") => ({
      keys: [...mem.keys()].filter((k) => k.startsWith(prefix)),
    }),
  };
}

/* ========================================================================== *
 *  CONSTANTS
 * ========================================================================== */

// AI model. ⚠ VERIFY ON FIRST PASTE-IN. If claude-sonnet-4-6 is rejected by the
// work-instance allowlist, every AI call fails silently in production. Fallback
// is the literal below. One-line swap by design.
export const MODEL = "claude-sonnet-4-6";
// export const MODEL = "claude-sonnet-4-20250514"; // fallback

export const SCHEMA_VERSION = 2;

// Tuning constants — "deferred to implementation": these are starting values,
// calibrated at first paste-in (alongside the MODEL check). One place to tune.
export const TUNING = {
  CHUNK_THRESHOLD_CHARS: 6000, // notes longer than this are segmented for extraction
  CHUNK_OVERLAP_CHARS: 400, // overlap between sequential chunks (catch boundary items)
  MAX_ITEMS_PER_CALL: 12, // extraction item cap per call (output guard, NOT recall ceiling)
  QUOTE_MAX_CHARS: 200, // length bound on a source quote
  FUZZY_THRESHOLD: 0.72, // token-set similarity for dedup + tombstone resurrection guard
  COMPLETION_THRESHOLD: 0.5, // looser match for inferred completions (gated: the user confirms/declines)
  DUE_SOON_DAYS: 3, // "due soon" window
  DEFAULT_STALE_DAYS: 14, // untouched-N-days default when cadence is Ad hoc/unknown
  DO_NEXT_CAP: 5, // hard cap on the do-next group (overflow demotes to due-soon)
  ESCALATION_BACKOFF: [2, 3, 5, 8, 13], // opens between surfacings, indexed by escalation level (>=2 so an item never re-nags the immediately-following open)
  DISMISS_UNDO_MS: 5000, // in-memory undo window before a dismiss truth-write flushes
  LEDGER_QUIESCE_MS: 1200, // debounce for the derived ledger rebuild write
  TRUTH_DEBOUNCE_MS: 400, // sub-second per-key debounce for truth writes
  PICKER_DEGRADE_MAX: 6, // <= this many destinations -> plain list instead of combobox float
} as const;

export const CADENCE_DAYS: Record<string, number> = {
  Weekly: 7,
  Biweekly: 14,
  Monthly: 30,
  "Ad hoc": TUNING.DEFAULT_STALE_DAYS,
};

// First-run sample: real extraction runs on this throwaway note so the skeptic
// sees provenance + inferred marks do their job before risking a real note.
export const SAMPLE_MEETING_NAME = "Team weekly (sample)";
export const SAMPLE_NOTE = [
  "Team weekly, project sync.",
  "Priya walked through the Atlas migration timeline. I said I will send her the revised cutover plan by Friday so she can review before the change window.",
  "We decided to push the production cutover to the last week of the month to avoid the holiday freeze.",
  "Still waiting on Maria for the final security sign off. She owes us the review notes.",
  "Dana to book the war room for cutover day. Low priority for now.",
].join("\n\n");

/* ── Design tokens (see DESIGN.md / .impeccable/design.json) ───── */

export const BRAND = {
  indigo: "#2C2A4A",
  indigo2: "#423D6E", // hover
  indigo3: "#645CA0",
  indigo6: "#C6C2E0", // waiting-for pill, emphasis stroke
  slate: "#25262B", // body ink
  slateDark: "#565860", // strong secondary text, ghost labels
  slateMedium: "#7F8186", // icons, disabled (not for body text)
  slateLight: "#D2D4D7", // input borders, dividers
  slateXLight: "#F2F3F4", // page canvas, recessed wells, dividers
  secondaryText: "#706C82", // muted/inferred/STALE treatment, placeholders
  clickGray: "#4B4564",
  amber: "#F2853C", // THE scarce signal (do-next marker only)
  amber40: "#F8CFB4",
  amber20: "#FBE7D8",
  rose: "#E96B6E", // category accent ONLY, never status
  rose20: "#FBE1E1",
  plum: "#CE5780", // category accent
  plum40: "#EBBBCB",
  plum20: "#F5DCE4",
  divider: "#F1F2F3",
  stroke: "#C6C2E0", // focus / selected border
  info: "#2F77E0", // info accent, sparing
  error: "#D32F2F", // destructive-confirm ONLY
  white: "#FFFFFF",
} as const;

// Stable per-project identity dot colors (never the amber signal, never indigo-6).
export const PROJECT_DOT_PALETTE = [
  BRAND.plum,
  BRAND.rose,
  BRAND.indigo3,
  BRAND.info,
  BRAND.clickGray,
];

const SANS =
  'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF =
  '"Aptos Serif", Georgia, "Times New Roman", serif';
export { SANS, SERIF };

// Type roles as ready-to-spread style fragments (the type scale).
export const TYPE = {
  display: { fontFamily: SERIF, fontSize: "1.875rem", fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.01em", color: BRAND.slate },
  headline: { fontFamily: SANS, fontSize: "1.5rem", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", color: BRAND.slate },
  title: { fontFamily: SANS, fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3, color: BRAND.slate },
  body: { fontFamily: SANS, fontSize: "1rem", fontWeight: 400, lineHeight: 1.6, color: BRAND.slate },
  bodyStrong: { fontFamily: SANS, fontSize: "1rem", fontWeight: 600, lineHeight: 1.6, color: BRAND.slate },
  reading: { fontFamily: SANS, fontSize: "1.125rem", fontWeight: 400, lineHeight: 1.6, letterSpacing: "-0.01em", color: BRAND.slate },
  label: { fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0.02em", textTransform: "uppercase" as const, color: BRAND.secondaryText },
  meta: { fontFamily: SANS, fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.4, color: BRAND.secondaryText },
  button: { fontFamily: SANS, fontSize: "0.875rem", fontWeight: 600, lineHeight: 1 },
  nav: { fontFamily: SANS, fontSize: "1rem", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0.02em" },
  numeric: { fontFamily: SANS, fontVariantNumeric: "tabular-nums" as const, fontSize: "1rem", fontWeight: 400, lineHeight: 1.4 },
} as const;

export const RADIUS = { xs: "2px", sm: "4px", button: "6px", md: "8px", lg: "12px", full: "999px" } as const;
export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 } as const;
export const SHADOW = {
  float: "0 8px 24px rgba(40,37,37,0.12), 0 2px 6px rgba(40,37,37,0.07)",
  modal: "0 16px 48px rgba(40,37,37,0.18)",
  liftHover: "0 1px 3px rgba(40,37,37,0.08)",
} as const;

/* ========================================================================== *
 *  PRIMITIVE HELPERS  (pure, exported for tests)
 * ========================================================================== */

let _uidc = 0;
export function uid(prefix = "id"): string {
  // Monotonic + time-seeded; unique within a session without Math.random.
  _uidc = (_uidc + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${_uidc.toString(36)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function stripJSONFences(s: string): string {
  return (s || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export function safeParseJSON<T = any>(text: string, fallback: T): T {
  try {
    return JSON.parse(stripJSONFences(text));
  } catch {
    const m = (text || "").match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        /* fall through */
      }
    }
    return fallback;
  }
}

/* ========================================================================== *
 *  PERSISTENCE  (window.storage wrapper — values are strings, private flag)
 * ========================================================================== */

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      const r = await (window as any).storage.get(key, false);
      return r ? r.value : null;
    } catch {
      return null; // a missing key can throw — treat as "no value"
    }
  },
  async set(key: string, value: unknown): Promise<boolean> {
    try {
      const v = typeof value === "string" ? value : JSON.stringify(value);
      await (window as any).storage.set(key, v, false);
      return true;
    } catch (e) {
      console.error("storage.set failed", key, e);
      return false;
    }
  },
  async delete(key: string): Promise<boolean> {
    try {
      await (window as any).storage.delete(key, false);
      return true;
    } catch {
      return false;
    }
  },
  async getJSON<T = any>(key: string): Promise<T | null> {
    const v = await storage.get(key);
    if (!v) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  },
  async list(prefix = ""): Promise<string[]> {
    try {
      const r = await (window as any).storage.list(prefix, false);
      return r?.keys || [];
    } catch {
      return [];
    }
  },
};

// Storage key helpers (under 200 chars, no spaces/slashes/quotes).
export const KEY = {
  meetingsList: "meetings:list",
  meeting: (id: string) => `meeting:${id}`,
  projectsList: "projects:list",
  project: (id: string) => `project:${id}`,
  ledger: "app:ledger",
  followthrough: "app:followthrough",
  focus: "app:focus",
  meta: "app:meta",
};

/* ========================================================================== *
 *  AI LAYER  (keyless — claude.ai runtime injects credentials)
 * ========================================================================== */

export async function callClaude(
  prompt: string,
  opts: { systemHint?: string } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 1000, // runtime-managed; design outputs to fit
    messages: [{ role: "user", content: prompt }],
  };
  if (opts.systemHint) body.system = opts.systemHint;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // no API key — runtime injects
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

/* ========================================================================== *
 *  DATA MODEL  (authoritative per-source records + the derived ledger)
 *  Per-source records are the single source of truth. app:ledger is a compact
 *  index REBUILT WHOLESALE from truth on each accept — never read-modify-merged
 *  — which resolves window.storage's last-write-wins clobber hazard.
 *  app:followthrough (tombstones + engine state) is itself authoritative and is
 *  an INPUT to the rebuild, never derived from / stored in the ledger.
 * ========================================================================== */

export type Cadence = "Weekly" | "Biweekly" | "Monthly" | "Ad hoc";
export type Owner = "i_owe" | "waiting_for";
export type ItemKind = "todo" | "waiting_for" | "decision";
export type ItemStatus = "open" | "completed" | "dismissed";
export type ProjectStatus = "active" | "on_hold" | "done";
export type Priority = "High" | "Medium" | "Low";
export type DismissReason = "done" | "redundant" | "wrong";

export interface SourceRef {
  kind: "meeting" | "direct";
  meeting_id: string | null;
  note_id: string | null;
  date: string; // ISO
}

export interface Item {
  id: string;
  key: string; // ledgerItemKey — stable for tombstones + dedup
  kind: "todo" | "waiting_for";
  text: string;
  owner: Owner;
  waiting_on: string | null;
  priority: Priority;
  due_date: string | null;
  due_confirmed: boolean; // only a CONFIRMED due date trips overdue (R20)
  owner_confirmed: boolean;
  interval_confirmed: boolean; // staleness interval defaulted/confirmed (R20 guard)
  status: ItemStatus;
  project_id: string | null;
  source: SourceRef;
  quote: string; // deterministically anchored span (or model quote if unanchored)
  quote_anchored: boolean;
  occurrence: number; // disambiguates repeated phrasing within one source
  created_at: string;
  completed_at: string | null;
  last_touched: string;
}

export interface Decision {
  id: string;
  key: string;
  kind: "decision";
  text: string;
  project_id: string | null;
  source: SourceRef;
  quote: string;
  quote_anchored: boolean;
  occurrence: number;
  created_at: string;
}

export interface Note { id: string; timestamp: string; content: string; }
export interface TalkingPoint { id: string; text: string; status: "open" | "discussed"; created_at: string; }
export interface ChatMsg { role: "user" | "assistant"; content: string; timestamp: string; }

export interface Meeting {
  id: string;
  name: string;
  cadence: Cadence;
  purpose: string;
  people: string;
  last_meeting_date: string | null;
  next_meeting_date: string | null;
  created_at: string;
  is_sample?: boolean;
}
export interface MeetingData {
  summary: string;
  notes: Note[];
  todos: Item[];
  decisions: Decision[];
  talking_points: TalkingPoint[];
  chat: ChatMsg[];
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  target_date: string | null;
  dot_color: string;
  created_at: string;
  is_sample?: boolean;
}
export interface ProjectUpdate { id: string; timestamp: string; content: string; }
export interface ProjectData {
  summary: string;
  updates: ProjectUpdate[];
  items: Item[];
  decisions: Decision[];
  updated_at: string;
}

export interface TombstoneRecord {
  key: string;
  original_text: string; // retained: normalization is one-way/lossy
  source_ref: string;
  reason: DismissReason;
  dismissed_at: string;
}
export interface ItemState {
  escalation: number;
  snooze_until: string | null;
  last_surfaced: number | null; // global open-count when last surfaced (back-off)
}
export interface Followthrough {
  tombstones: TombstoneRecord[];
  item_state: Record<string, ItemState>;
}

export interface LedgerItem {
  id: string;
  key: string;
  kind: ItemKind;
  text: string;
  owner: Owner | null;
  waiting_on: string | null;
  priority: Priority | null;
  due_date: string | null;
  due_confirmed: boolean;
  owner_confirmed: boolean;
  interval_confirmed: boolean;
  status: ItemStatus;
  project_id: string | null;
  project_name: string | null;
  project_dot: string | null;
  source: { kind: "meeting" | "direct"; meeting_id: string | null; meeting_name: string | null; note_id: string | null; date: string };
  cadence: Cadence | null;
  interval_days: number;
  quote: string;
  quote_anchored: boolean;
  last_touched: string;
  created_at: string;
  resurfaced_flag?: boolean; // multiple open items matched one tombstone key
}
export interface Ledger { built_at: string; items: LedgerItem[]; }

/* ── Record factories ─────────────────────────────────────────────────────── */

export function emptyMeetingData(): MeetingData {
  return { summary: "", notes: [], todos: [], decisions: [], talking_points: [], chat: [], updated_at: nowISO() };
}
export function emptyProjectData(): ProjectData {
  return { summary: "", updates: [], items: [], decisions: [], updated_at: nowISO() };
}
export function emptyFollowthrough(): Followthrough {
  return { tombstones: [], item_state: {} };
}

/* ── Normalization + keys ─────────────────────────────────────────────────── */

// Schema-level normalizer. Changing it later is a schema migration that re-keys
// tombstones from their retained original_text.
export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceRefString(s: SourceRef | LedgerItem["source"]): string {
  return s.kind === "direct" ? "direct" : `meeting:${s.meeting_id}`;
}

// key = normalize(text) :: sourceRef :: occurrenceIndex. The occurrence index
// keeps two same-worded items in one source distinct (so dismissing one does
// not silently tombstone both).
export function ledgerItemKey(item: { text: string; source: SourceRef; occurrence?: number }): string {
  return `${normalize(item.text)}::${sourceRefString(item.source)}::${item.occurrence ?? 0}`;
}

/* ── Fuzzy similarity (token-set) — dedup + tombstone resurrection guard ───── */

// Stopwords are dropped for FUZZY similarity only (not for keys/normalize), so
// content words carry the signal: a paraphrase ("about budget" -> "regarding
// budget") scores high, while a genuinely different commitment ("about budget"
// -> "about hiring") does not. This is the distinction the resurrection guard
// must make.
const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "for", "on", "in", "at", "by", "with", "about", "regarding", "re",
  "and", "or", "up", "out", "off", "is", "are", "be", "this", "that", "we", "i", "you", "our",
  "please", "need", "needs", "should", "will", "get", "got", "let", "lets",
]);

export function tokenSet(text: string): Set<string> {
  const all = normalize(text).split(" ").filter(Boolean);
  const content = all.filter((t) => !STOPWORDS.has(t));
  // If stripping leaves nothing (a pure-stopword phrase), fall back to all tokens.
  return new Set(content.length ? content : all);
}
export function tokenSetSimilarity(a: string, b: string): number {
  const sa = tokenSet(a), sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

/* ── Tombstones ───────────────────────────────────────────────────────────── */

export function makeTombstone(
  item: { key: string; text: string; source: SourceRef },
  reason: DismissReason
): TombstoneRecord {
  return { key: item.key || ledgerItemKey(item), original_text: item.text, source_ref: sourceRefString(item.source), reason, dismissed_at: nowISO() };
}

export function isExactTombstoned(key: string, ft: Followthrough): boolean {
  return ft.tombstones.some((t) => t.key === key);
}

// Resurrection guard: a NEW proposal (same source ref) that paraphrases a
// dismissed item. Returns the matched tombstone or null. Exact-key matches are
// silently suppressed elsewhere; fuzzy matches surface ghosted at verification.
export function fuzzyTombstoneMatch(
  proposal: { text: string; source: SourceRef },
  ft: Followthrough,
  threshold = TUNING.FUZZY_THRESHOLD
): TombstoneRecord | null {
  const sref = sourceRefString(proposal.source);
  let best: TombstoneRecord | null = null;
  let bestScore = threshold;
  for (const t of ft.tombstones) {
    if (t.source_ref !== sref) continue;
    const score = tokenSetSimilarity(proposal.text, t.original_text);
    if (score >= bestScore) { best = t; bestScore = score; }
  }
  return best;
}

/* ── app:followthrough shape-aware merge (rebase, never whole-key LWW) ─────── */

function laterISO(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function mergeFollowthrough(latest: Followthrough, desired: Followthrough): Followthrough {
  // tombstones: append-only set-union (always safe).
  const seen = new Map<string, TombstoneRecord>();
  for (const t of [...(latest.tombstones || []), ...(desired.tombstones || [])]) {
    const k = `${t.key}|${t.dismissed_at}`;
    if (!seen.has(k)) seen.set(k, t);
  }
  // item_state: per-key merge taking later snooze_until/last_surfaced, max escalation.
  const item_state: Record<string, ItemState> = { ...(latest.item_state || {}) };
  for (const [k, s] of Object.entries(desired.item_state || {})) {
    const cur = item_state[k];
    if (!cur) { item_state[k] = s; continue; }
    item_state[k] = {
      escalation: Math.max(cur.escalation || 0, s.escalation || 0),
      snooze_until: laterISO(cur.snooze_until, s.snooze_until),
      last_surfaced: Math.max(cur.last_surfaced || 0, s.last_surfaced || 0) || null,
    };
  }
  return { tombstones: [...seen.values()], item_state };
}

// Prune dead item_state at sweep time (tombstoned or completed keys). Tombstones
// are retained indefinitely by design.
export function pruneItemState(ft: Followthrough, liveOpenKeys: Set<string>): Followthrough {
  const tombKeys = new Set(ft.tombstones.map((t) => t.key));
  const item_state: Record<string, ItemState> = {};
  for (const [k, s] of Object.entries(ft.item_state || {})) {
    if (tombKeys.has(k)) continue;
    if (!liveOpenKeys.has(k)) continue;
    item_state[k] = s;
  }
  return { tombstones: ft.tombstones, item_state };
}

/* ── The wholesale ledger rebuild (PURE over loaded records) ───────────────── */

export interface RebuildInput {
  meetings: Meeting[];
  meetingData: Record<string, MeetingData>;
  projects: Project[];
  projectData: Record<string, ProjectData>;
  followthrough: Followthrough;
}

function toLedgerCommitment(it: Item, meeting: Meeting | null, proj: Project | null, resurfaced: boolean): LedgerItem {
  const cadence = meeting ? meeting.cadence : null;
  const interval_days = cadence ? CADENCE_DAYS[cadence] ?? TUNING.DEFAULT_STALE_DAYS : TUNING.DEFAULT_STALE_DAYS;
  return {
    id: it.id, key: it.key || ledgerItemKey(it), kind: it.kind, text: it.text,
    owner: it.owner, waiting_on: it.waiting_on, priority: it.priority,
    due_date: it.due_date, due_confirmed: it.due_confirmed, owner_confirmed: it.owner_confirmed,
    interval_confirmed: it.interval_confirmed, status: it.status,
    project_id: it.project_id, project_name: proj ? proj.name : null, project_dot: proj ? proj.dot_color : null,
    source: { kind: it.source.kind, meeting_id: it.source.meeting_id, meeting_name: meeting ? meeting.name : null, note_id: it.source.note_id, date: it.source.date },
    cadence, interval_days, quote: it.quote, quote_anchored: it.quote_anchored,
    last_touched: it.last_touched, created_at: it.created_at,
    ...(resurfaced ? { resurfaced_flag: true } : {}),
  };
}

function toLedgerDecision(d: Decision, meeting: Meeting | null, proj: Project | null): LedgerItem {
  return {
    id: d.id, key: d.key || ledgerItemKey(d), kind: "decision", text: d.text,
    owner: null, waiting_on: null, priority: null, due_date: null, due_confirmed: false,
    owner_confirmed: false, interval_confirmed: true, status: "open",
    project_id: d.project_id, project_name: proj ? proj.name : null, project_dot: proj ? proj.dot_color : null,
    source: { kind: d.source.kind, meeting_id: d.source.meeting_id, meeting_name: meeting ? meeting.name : null, note_id: d.source.note_id, date: d.source.date },
    cadence: meeting ? meeting.cadence : null, interval_days: TUNING.DEFAULT_STALE_DAYS,
    quote: d.quote, quote_anchored: d.quote_anchored, last_touched: d.created_at, created_at: d.created_at,
  };
}

// Public converter: render a stored Item through the same shape the ledger
// uses, so the meeting view (driven by its own record for instant feedback)
// reuses the shared CommitmentRow verbatim.
export function itemToLedgerItem(item: Item, meeting: Meeting | null, project: Project | null): LedgerItem {
  return toLedgerCommitment(item, meeting, project, false);
}

export function rebuildLedgerFromRecords(input: Partial<RebuildInput>, now: string = nowISO()): Ledger {
  const meetings = input.meetings || [];
  const meetingData = input.meetingData || {};
  const projects = input.projects || [];
  const projectData = input.projectData || {};
  const ft = input.followthrough || emptyFollowthrough();

  const projById = new Map(projects.map((p) => [p.id, p]));
  const tombOrig = new Set(ft.tombstones.map((t) => t.key));
  const tombLeft = new Map<string, number>();
  for (const t of ft.tombstones) tombLeft.set(t.key, (tombLeft.get(t.key) || 0) + 1);

  const items: LedgerItem[] = [];

  const pushCommitment = (it: Item, meeting: Meeting | null) => {
    if (it.status !== "open") return; // completed/dismissed excluded
    const key = it.key || ledgerItemKey(it);
    const left = tombLeft.get(key) || 0;
    if (left > 0) { tombLeft.set(key, left - 1); return; } // suppressed by a tombstone
    const resurfaced = tombOrig.has(key); // tombstoned before, suppression exhausted -> surface flagged
    items.push(toLedgerCommitment(it, meeting, it.project_id ? projById.get(it.project_id) || null : null, resurfaced));
  };
  const pushDecision = (d: Decision, meeting: Meeting | null) => {
    items.push(toLedgerDecision(d, meeting, d.project_id ? projById.get(d.project_id) || null : null));
  };

  for (const m of meetings) {
    const md = meetingData[m.id];
    if (!md) continue;
    for (const it of md.todos || []) pushCommitment(it, m);
    for (const d of md.decisions || []) pushDecision(d, m);
  }
  for (const p of projects) {
    const pd = projectData[p.id];
    if (!pd) continue;
    for (const it of pd.items || []) pushCommitment(it, null);
    for (const d of pd.decisions || []) pushDecision(d, null);
  }

  return { built_at: now, items };
}

/* ── Storage-backed wrappers around the pure logic ────────────────────────── */

export async function loadAllRecords(): Promise<RebuildInput> {
  const meetings = (await storage.getJSON<Meeting[]>(KEY.meetingsList)) || [];
  const meetingData: Record<string, MeetingData> = {};
  for (const m of meetings) meetingData[m.id] = (await storage.getJSON<MeetingData>(KEY.meeting(m.id))) || emptyMeetingData();
  const projects = (await storage.getJSON<Project[]>(KEY.projectsList)) || [];
  const projectData: Record<string, ProjectData> = {};
  for (const p of projects) projectData[p.id] = (await storage.getJSON<ProjectData>(KEY.project(p.id))) || emptyProjectData();
  const followthrough = (await storage.getJSON<Followthrough>(KEY.followthrough)) || emptyFollowthrough();
  return { meetings, meetingData, projects, projectData, followthrough };
}

export async function rebuildLedger(): Promise<Ledger> {
  const recs = await loadAllRecords();
  const ledger = rebuildLedgerFromRecords(recs, nowISO());
  await storage.set(KEY.ledger, ledger);
  return ledger;
}

// Read-latest-modify-write with an updated_at drift check. The mutator rebases
// the in-memory change onto the latest record, so last-write-wins is safe per
// key for a single active session; cross-session drift is surfaced, not blocked.
export async function commitMeetingData(
  id: string,
  mutate: (cur: MeetingData) => MeetingData,
  expectedUpdatedAt?: string
): Promise<{ drift: boolean; value: MeetingData }> {
  const cur = (await storage.getJSON<MeetingData>(KEY.meeting(id))) || emptyMeetingData();
  const drift = expectedUpdatedAt != null && cur.updated_at !== expectedUpdatedAt;
  const next = mutate(cur);
  next.updated_at = nowISO();
  await storage.set(KEY.meeting(id), next);
  return { drift, value: next };
}

export async function commitProjectData(
  id: string,
  mutate: (cur: ProjectData) => ProjectData,
  expectedUpdatedAt?: string
): Promise<{ drift: boolean; value: ProjectData }> {
  const cur = (await storage.getJSON<ProjectData>(KEY.project(id))) || emptyProjectData();
  const drift = expectedUpdatedAt != null && cur.updated_at !== expectedUpdatedAt;
  const next = mutate(cur);
  next.updated_at = nowISO();
  await storage.set(KEY.project(id), next);
  return { drift, value: next };
}

// Every app:followthrough write re-fetches and rebases (shape-aware merge).
export async function commitFollowthrough(desired: Followthrough): Promise<Followthrough> {
  const latest = (await storage.getJSON<Followthrough>(KEY.followthrough)) || emptyFollowthrough();
  const merged = mergeFollowthrough(latest, desired);
  await storage.set(KEY.followthrough, merged);
  return merged;
}

/* ========================================================================== *
 *  UI ATOMS
 * ========================================================================== */

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive" | "railCapture";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  icon,
  title,
  style,
  full = false,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
  full?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const base: React.CSSProperties = {
    ...TYPE.button,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: RADIUS.button,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 180ms cubic-bezier(0.25,1,0.5,1), border-color 180ms",
    width: full ? "100%" : undefined,
    border: "1px solid transparent",
    padding: "9px 16px",
    whiteSpace: "nowrap",
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: disabled ? BRAND.slateLight : hover ? BRAND.indigo2 : BRAND.indigo,
      color: disabled ? BRAND.slateMedium : BRAND.white,
    },
    secondary: {
      background: hover ? BRAND.slateXLight : BRAND.white,
      color: disabled ? BRAND.slateMedium : BRAND.indigo,
      border: `1px solid ${BRAND.slateLight}`,
      padding: "8px 15px",
    },
    ghost: {
      background: hover ? BRAND.slateXLight : "transparent",
      color: disabled ? BRAND.slateMedium : BRAND.slateDark,
      padding: "8px 12px",
    },
    destructive: {
      background: hover ? BRAND.error : BRAND.white,
      color: hover ? BRAND.white : BRAND.error,
      border: `1px solid ${BRAND.slateLight}`,
      padding: "8px 15px",
    },
    railCapture: {
      background: hover ? BRAND.slateXLight : BRAND.white,
      color: BRAND.indigo,
    },
  };
  return (
    <button
      type="button"
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({
  children,
  style,
  pad = SPACE.md,
  interactive = false,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: BRAND.white,
        border: `1px solid ${BRAND.divider}`,
        borderRadius: RADIUS.md,
        padding: pad,
        boxShadow: interactive && hover ? SHADOW.liftHover : "none",
        cursor: interactive ? "pointer" : undefined,
        transition: "box-shadow 180ms",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  // 3-dot pulse with a reduced-motion static fallback via CSS media query.
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...TYPE.meta }}>
      <style>{`
        @keyframes ma-dot { 0%,80%,100%{opacity:.25} 40%{opacity:1} }
        .ma-dot{width:5px;height:5px;border-radius:999px;background:${BRAND.secondaryText};display:inline-block;animation:ma-dot 1.2s infinite ease-in-out}
        .ma-dot:nth-child(2){animation-delay:.15s}.ma-dot:nth-child(3){animation-delay:.3s}
        @media(prefers-reduced-motion:reduce){.ma-dot{animation:none;opacity:.6}}
      `}</style>
      <span aria-hidden style={{ display: "inline-flex", gap: 3 }}>
        <span className="ma-dot" />
        <span className="ma-dot" />
        <span className="ma-dot" />
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

// Inline error — Secondary-text styling, NEVER red. Always leads with a
// data-safety reassurance line (hard copy template from the surface specs).
export function InlineError({
  message,
  reassurance,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  reassurance?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        background: BRAND.slateXLight,
        border: `1px solid ${BRAND.divider}`,
        borderRadius: RADIUS.sm,
        padding: "8px 11px",
        ...TYPE.meta,
        color: BRAND.secondaryText,
      }}
    >
      <AlertCircle size={14} style={{ flex: "none", marginTop: 2 }} aria-hidden />
      <span style={{ minWidth: 0 }}>
        {reassurance ? <strong style={{ color: BRAND.slateDark, fontWeight: 600 }}>{reassurance} </strong> : null}
        {message}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{ ...TYPE.meta, color: BRAND.indigo, background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: 6, fontWeight: 600 }}
          >
            {retryLabel}
          </button>
        ) : null}
      </span>
    </div>
  );
}

// Inline confirm — neutral two-button affordance (destructive uses red ONLY on
// the final confirm button, per the No-Alarm rule).
export function InlineConfirm({
  prompt,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  prompt: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        background: BRAND.slateXLight,
        border: `1px solid ${BRAND.divider}`,
        borderRadius: RADIUS.sm,
        padding: "8px 11px",
      }}
    >
      <span style={{ ...TYPE.meta, color: BRAND.slateDark, flex: 1, minWidth: 140 }}>{prompt}</span>
      <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  );
}

// Section / group header — canonical uppercase Secondary-text label.
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...TYPE.label, ...style }}>{children}</div>;
}

/* ========================================================================== *
 *  EXPORT / IMPORT shell (Export works now; Import wired in U11)
 * ========================================================================== */

export async function buildExportPayload(): Promise<any> {
  const meetings = (await storage.getJSON<any[]>(KEY.meetingsList)) || [];
  const projects = (await storage.getJSON<any[]>(KEY.projectsList)) || [];
  const meetingData: Record<string, any> = {};
  for (const m of meetings) meetingData[m.id] = await storage.getJSON(KEY.meeting(m.id));
  const projectData: Record<string, any> = {};
  for (const p of projects) projectData[p.id] = await storage.getJSON(KEY.project(p.id));
  const followthrough = (await storage.getJSON(KEY.followthrough)) || { tombstones: [], item_state: {} };
  const meta = (await storage.getJSON(KEY.meta)) || { schema_version: SCHEMA_VERSION };
  return { schema_version: SCHEMA_VERSION, exported_at: nowISO(), meetings, meetingData, projects, projectData, followthrough, meta };
}

function downloadJSON(payload: any, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================================================== *
 *  CAPTURE / ROUTING HELPERS  (pure, exported for tests)
 * ========================================================================== */

export type Destination =
  | { kind: "meeting"; id: string }
  | { kind: "project"; id: string }
  | { kind: "new_meeting"; name: string; cadence: Cadence }
  | { kind: "new_project"; name: string };

export function makeMeeting(name: string, cadence: Cadence): Meeting {
  return { id: uid("mtg"), name: name.trim(), cadence, purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: nowISO() };
}
export function nextProjectDot(existing: Project[]): string {
  return PROJECT_DOT_PALETTE[existing.length % PROJECT_DOT_PALETTE.length];
}
export function makeProject(name: string, dot_color: string): Project {
  return { id: uid("prj"), name: name.trim(), status: "active", target_date: null, dot_color, created_at: nowISO() };
}

// timestamp defaults to nowISO() but accepts the chosen meeting date (U2), so a
// backfilled note records when the meeting happened, not when it was pasted in.
export function addMeetingNote(md: MeetingData, content: string, id = uid("note"), timestamp = nowISO()): MeetingData {
  const note: Note = { id, timestamp, content };
  return { ...md, notes: [note, ...md.notes] };
}
export function addProjectUpdate(pd: ProjectData, content: string, id = uid("upd"), timestamp = nowISO()): ProjectData {
  const update: ProjectUpdate = { id, timestamp, content };
  return { ...pd, updates: [update, ...pd.updates] };
}

// Validate a new meeting/project name. Empty is blocked; an exact (case-insensitive)
// collision is allowed but flagged so the picker can warn rather than silently dup.
export function validateDestinationName(name: string, existingNames: string[]): { ok: boolean; error?: string; collision?: boolean } {
  const t = (name || "").trim();
  if (!t) return { ok: false, error: "Enter a name." };
  if (existingNames.some((n) => (n || "").trim().toLowerCase() === t.toLowerCase())) return { ok: true, collision: true };
  return { ok: true };
}

/* ========================================================================== *
 *  EXTRACTION  (U4a orchestration + U4b parse/validate/anchor)
 *  The extraction call returns items/decisions/completions ONLY — the rolling
 *  summary is a separate bounded call at accept-time (U5/U7/U8), so summary
 *  prose never competes with the item list for the 1000-token output budget.
 * ========================================================================== */

export interface Proposal {
  id: string;
  kind: ItemKind;
  text: string;
  owner: Owner;
  waiting_on: string | null;
  priority: Priority;
  due_date: string | null;
  due_confirmed: boolean;
  owner_confirmed: boolean;
  interval_confirmed: boolean;
  project_id: string | null;
  project_proposed_name: string | null; // model-proposed tag the user can accept/retag
  is_completion: boolean; // an inferred completion of an existing open to-do (gated)
  completes_item_id: string | null;
  quote: string; // the anchored span (from the note) when anchored
  quote_anchored: boolean;
  anchor_index: number | null;
  anchor_len: number;
  occurrence: number;
  source: SourceRef;
  inferred: { due?: boolean; owner?: boolean };
  shape_warning?: string;
}

export interface ExtractionContext {
  destKind: "meeting" | "project";
  meetingName?: string;
  cadence?: Cadence;
  purpose?: string;
  people?: string;
  projectName?: string;
  projectStatus?: ProjectStatus;
  projectNames: string[]; // existing projects the model may tag against (meeting notes)
  openTodos: string[]; // for context; the model is told not to re-extract these
  today: string; // YYYY-MM-DD
  autoProjectId?: string | null; // project-destination items auto-tag, no proposal
}

/* ── Chunking (U4a) ───────────────────────────────────────────────────────── */

function splitLong(segment: string, max: number): string[] {
  if (segment.length <= max) return [segment];
  const out: string[] = [];
  let rest = segment;
  while (rest.length > max) {
    // prefer a sentence boundary within the last 20% of the window
    const window = rest.slice(0, max);
    const bound = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf("! "), window.lastIndexOf("? "));
    const cut = bound > max * 0.6 ? bound + 1 : max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

// Segment a note at paragraph (blank-line) boundaries into sequential chunks
// with modest overlap. Short notes return a single chunk (single-pass).
export function chunkNote(
  text: string,
  threshold = TUNING.CHUNK_THRESHOLD_CHARS,
  overlap = TUNING.CHUNK_OVERLAP_CHARS
): string[] {
  if ((text || "").length <= threshold) return [text || ""];
  const paras = text.split(/\n\s*\n/).flatMap((p) => splitLong(p.trim(), threshold)).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > threshold) {
      chunks.push(cur);
      const tail = cur.slice(Math.max(0, cur.length - overlap));
      cur = tail + "\n\n" + p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

/* ── Prompt (U4a) ─────────────────────────────────────────────────────────── */

export function buildExtractionPrompt(segment: string, ctx: ExtractionContext): string {
  const projectClause =
    ctx.destKind === "project"
      ? `These notes belong to the project "${ctx.projectName}" (status: ${ctx.projectStatus}). Every item is already tagged to this project; do NOT include a "project" field.`
      : ctx.projectNames.length
      ? `For each item, optionally set "project" to EXACTLY one of these existing project names if the item clearly belongs to it, otherwise null: ${ctx.projectNames.map((n) => `"${n}"`).join(", ")}.`
      : `Set "project" to null (no projects exist yet).`;
  const contextLine =
    ctx.destKind === "meeting"
      ? `Meeting: "${ctx.meetingName}" (${ctx.cadence}). Purpose: ${ctx.purpose || "none given"}. People: ${ctx.people || "none given"}.`
      : `Project: "${ctx.projectName}" (status: ${ctx.projectStatus}).`;
  const openClause = ctx.openTodos.length
    ? `Currently open to-dos (for context only; do not re-extract these as new items, but you MAY mark one done via a completion):\n${ctx.openTodos.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}`
    : `There are no currently open to-dos.`;

  return [
    `You extract commitments and decisions from a meeting note. Return ONLY valid JSON. No preamble, no markdown code fences. Do not use em dashes anywhere in your output.`,
    ``,
    `Return a JSON object with this exact flat shape:`,
    `{"items":[{"kind":"todo|waiting_for|decision","text":"short paraphrase","quote":"verbatim span copied EXACTLY from the note (max ${TUNING.QUOTE_MAX_CHARS} chars)","owner":"i_owe|waiting_for|unknown","waiting_on":"person name or null","priority":"High|Medium|Low","due_date":"YYYY-MM-DD or null"${ctx.destKind === "meeting" ? ',"project":"existing project name or null"' : ""},"completes":"text of an open to-do this note marks done, or null"}]}`,
    ``,
    `Rules:`,
    `- Extract at most ${TUNING.MAX_ITEMS_PER_CALL} items from THIS segment.`,
    `- "quote" MUST be copied verbatim from the note so it can be located. Never paraphrase the quote. "text" is your short paraphrase.`,
    `- owner: "i_owe" when the user owes the action; "waiting_for" when the user is waiting on someone else (put that person in "waiting_on"); "unknown" if unclear.`,
    `- due_date: infer a calendar date ONLY if the note implies one; otherwise null. Today is ${ctx.today}.`,
    `- ${projectClause}`,
    `- A decision has kind "decision" and no owner, due date, or project relevance beyond tagging.`,
    `- "completes": if the note clearly says one of the open to-dos above is done, set "completes" to that to-do's text; otherwise null.`,
    `- No em dashes anywhere.`,
    ``,
    contextLine,
    openClause,
    ``,
    `Note segment:`,
    `"""`,
    segment,
    `"""`,
  ].join("\n");
}

/* ── Anchoring (U4b) — provenance is checked, not trusted ─────────────────── */

// Locate the model's quote in the raw note. Substring (exact, then
// case-insensitive, then whitespace-normalized) from fromIndex so repeated
// phrasing anchors to distinct occurrences. Returns the span FROM THE NOTE.
export function anchorQuote(note: string, quote: string, fromIndex = 0): { anchored: boolean; span: string; index: number; length: number } {
  const q = (quote || "").trim();
  if (!q) return { anchored: false, span: quote || "", index: -1, length: 0 };
  let idx = note.indexOf(q, fromIndex);
  if (idx >= 0) return { anchored: true, span: note.slice(idx, idx + q.length), index: idx, length: q.length };
  idx = note.toLowerCase().indexOf(q.toLowerCase(), fromIndex);
  if (idx >= 0) return { anchored: true, span: note.slice(idx, idx + q.length), index: idx, length: q.length };
  // whitespace-normalized fallback
  const normNote = note.replace(/\s+/g, " ");
  const normQ = q.replace(/\s+/g, " ");
  idx = normNote.toLowerCase().indexOf(normQ.toLowerCase());
  if (idx >= 0) return { anchored: true, span: normQ, index: idx, length: normQ.length };
  return { anchored: false, span: q, index: -1, length: 0 };
}

/* ── Parse + validate + build proposals (U4b) ─────────────────────────────── */

export type ParseResult =
  | { ok: true; items: any[] }
  | { ok: false; kind: "truncated" | "empty"; }; // recoverable

export function parseExtraction(raw: string): ParseResult {
  const parsed = safeParseJSON<any>(raw, null);
  if (parsed == null) return { ok: false, kind: "truncated" };
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : null;
  if (!items) return { ok: false, kind: "truncated" };
  return { ok: true, items };
}

const VALID_KINDS = new Set(["todo", "waiting_for", "decision"]);
const VALID_PRIORITY = new Set(["High", "Medium", "Low"]);

function isValidDate(s: any): boolean {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s));
}

export function buildProposalsFromParsed(
  rawItems: any[],
  note: string,
  source: SourceRef,
  ctx: ExtractionContext
): Proposal[] {
  const projByName = new Map(ctx.projectNames.map((n, i) => [n.toLowerCase(), n]));
  const occ = new Map<string, number>(); // normalized quote -> next occurrence index
  const lastIdx = new Map<string, number>(); // normalized quote -> last anchor index (advance past)
  const out: Proposal[] = [];

  for (const raw of rawItems || []) {
    const missing: string[] = [];
    const text = typeof raw?.text === "string" ? raw.text.trim() : "";
    const quoteRaw = typeof raw?.quote === "string" ? raw.quote.trim() : "";
    let kind: ItemKind = VALID_KINDS.has(raw?.kind) ? raw.kind : "todo";
    if (!text) missing.push("text");
    if (!raw?.kind || !VALID_KINDS.has(raw.kind)) missing.push("kind");
    if (!quoteRaw) missing.push("quote");

    // owner inference (ambiguous -> i_owe). All extracted owners start inferred.
    const ownerRaw = raw?.owner;
    const owner: Owner = ownerRaw === "waiting_for" ? "waiting_for" : "i_owe";
    const waiting_on = owner === "waiting_for" && typeof raw?.waiting_on === "string" ? raw.waiting_on.trim() || null : null;
    if (owner === "waiting_for") kind = "waiting_for";
    else if (kind !== "decision") kind = "todo";

    const priority: Priority = VALID_PRIORITY.has(raw?.priority) ? raw.priority : "Medium";
    const hasDue = isValidDate(raw?.due_date);
    const due_date = hasDue ? String(raw.due_date).slice(0, 10) : null;

    // project tag
    let project_id: string | null = null;
    let project_proposed_name: string | null = null;
    if (ctx.autoProjectId) {
      project_id = ctx.autoProjectId; // project-destination items auto-tag, no proposal
    } else if (typeof raw?.project === "string" && raw.project.trim()) {
      const canon = projByName.get(raw.project.trim().toLowerCase());
      project_proposed_name = canon || raw.project.trim();
    }

    // completion
    const completesText = typeof raw?.completes === "string" && raw.completes.trim() ? raw.completes.trim() : null;

    // anchoring (occurrence-aware)
    const nq = normalize(quoteRaw);
    const from = lastIdx.has(nq) ? (lastIdx.get(nq) as number) + 1 : 0;
    const anchored = quoteRaw ? anchorQuote(note, quoteRaw, from) : { anchored: false, span: quoteRaw, index: -1, length: 0 };
    if (anchored.anchored) lastIdx.set(nq, anchored.index);
    const occurrence = occ.get(nq) || 0;
    occ.set(nq, occurrence + 1);

    const prop: Proposal = {
      id: uid("prop"),
      kind: completesText ? "todo" : kind,
      text: text || "(no text)",
      owner,
      waiting_on,
      priority,
      due_date,
      due_confirmed: false, // extracted dates are inferred (R20)
      owner_confirmed: false,
      interval_confirmed: true, // staleness interval is deterministic
      project_id,
      project_proposed_name,
      is_completion: !!completesText,
      completes_item_id: null, // resolved against open todos in U5
      quote: anchored.anchored ? anchored.span : quoteRaw,
      quote_anchored: anchored.anchored,
      anchor_index: anchored.anchored ? anchored.index : null,
      anchor_len: anchored.length,
      occurrence,
      source,
      inferred: { due: hasDue, owner: true },
      ...(completesText ? { _completesText: completesText } as any : {}),
      ...(missing.length ? { shape_warning: `missing ${missing.join(", ")}` } : {}),
    };
    out.push(prop);
  }
  return out;
}

/* ── Merge / dedup across chunks (U4a) ────────────────────────────────────── */

function spansOverlap(a: Proposal, b: Proposal): boolean {
  if (a.anchor_index == null || b.anchor_index == null) return false;
  const a0 = a.anchor_index, a1 = a.anchor_index + a.anchor_len;
  const b0 = b.anchor_index, b1 = b.anchor_index + b.anchor_len;
  return a0 < b1 && b0 < a1; // ranges intersect
}

// Merge proposals from all chunks into one set. Within overlap regions,
// overlapping anchored-quote spans are the primary merge signal (independent
// calls paraphrase the same item differently). Exact normalized-text and
// token-set similarity catch the rest.
export function mergeProposals(lists: Proposal[][]): Proposal[] {
  const result: Proposal[] = [];
  for (const list of lists) {
    for (const p of list) {
      const dupIdx = result.findIndex(
        (r) =>
          r.kind === p.kind &&
          (spansOverlap(r, p) || normalize(r.text) === normalize(p.text) || tokenSetSimilarity(r.text, p.text) >= TUNING.FUZZY_THRESHOLD)
      );
      if (dupIdx >= 0) {
        // prefer the anchored representative (deterministic provenance)
        if (p.quote_anchored && !result[dupIdx].quote_anchored) result[dupIdx] = p;
        continue;
      }
      result.push(p);
    }
  }
  return result;
}

/* ── Orchestrator (U4a) — single-pass or chunked sequential ───────────────── */

export interface ExtractionRun {
  proposals: Proposal[];
  chunkCount: number;
  failedChunks: number[]; // 1-based indices of chunks whose call failed
  rawByChunk: (string | null)[]; // for retry-of-one-chunk
  parseError: boolean;
}

// Runs extraction over a saved note. Chunks long notes into sequential calls.
// A failed chunk preserves completed chunks' proposals and is retryable alone.
// onProgress reports "part N of M". Designed to fail gracefully and never lose
// the already-saved note.
export async function runExtraction(
  note: string,
  source: SourceRef,
  ctx: ExtractionContext,
  onProgress?: (done: number, total: number) => void,
  callFn: (prompt: string) => Promise<string> = (p) => callClaude(p)
): Promise<ExtractionRun> {
  const chunks = chunkNote(note);
  const total = chunks.length;
  const perChunk: Proposal[][] = [];
  const failedChunks: number[] = [];
  const rawByChunk: (string | null)[] = [];
  let anyParse = false;
  let anyParseFail = false;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i, total);
    try {
      const raw = await callFn(buildExtractionPrompt(chunks[i], ctx));
      rawByChunk.push(raw);
      const parsed = parseExtraction(raw);
      if (!parsed.ok) { anyParseFail = true; perChunk.push([]); continue; }
      anyParse = true;
      perChunk.push(buildProposalsFromParsed(parsed.items, note, source, ctx));
    } catch {
      failedChunks.push(i + 1);
      rawByChunk.push(null);
      perChunk.push([]);
    }
  }
  onProgress?.(total, total);
  return { proposals: mergeProposals(perChunk), chunkCount: total, failedChunks, rawByChunk, parseError: anyParseFail && !anyParse };
}

/* ========================================================================== *
 *  ACCEPT + SUMMARY + RE-RUN  (U5, pure helpers + prompts)
 * ========================================================================== */

export function proposalToItem(p: Proposal, now = nowISO()): Item {
  const item: Item = {
    id: uid("it"), key: "", kind: p.kind === "decision" ? "todo" : p.kind, text: p.text,
    owner: p.owner, waiting_on: p.waiting_on, priority: p.priority,
    due_date: p.due_date, due_confirmed: p.due_confirmed, owner_confirmed: p.owner_confirmed,
    interval_confirmed: p.interval_confirmed, status: "open", project_id: p.project_id,
    source: p.source, quote: p.quote, quote_anchored: p.quote_anchored, occurrence: p.occurrence,
    // last_touched seeds the staleness clock from the EVENT date (the meeting
    // date carried on the source ref), so a backfilled commitment ages from when
    // it was really made; created_at stays the true ingestion instant. Falls back
    // to now when no source date is present (back-compat). This is inert in
    // production until the capture flow supplies a real date (source.date == now today).
    created_at: now, completed_at: null, last_touched: p.source?.date ?? now,
  };
  item.key = ledgerItemKey(item);
  return item;
}

export function proposalToDecision(p: Proposal, now = nowISO()): Decision {
  const d: Decision = {
    id: uid("dec"), key: "", kind: "decision", text: p.text, project_id: p.project_id,
    source: p.source, quote: p.quote, quote_anchored: p.quote_anchored, occurrence: p.occurrence, created_at: now,
  };
  d.key = ledgerItemKey(d);
  return d;
}

// Resolve which open to-dos a set of completion proposals marks done (best
// token-set match per completion, above threshold). Returns a Set of item ids.
export function resolveCompletions(openItems: Item[], completionTexts: string[], threshold = TUNING.COMPLETION_THRESHOLD): Set<string> {
  const ids = new Set<string>();
  for (const ct of completionTexts) {
    let bestId: string | null = null;
    let best = threshold;
    for (const it of openItems) {
      if (it.status !== "open") continue;
      const s = tokenSetSimilarity(ct, it.text);
      if (s >= best) { best = s; bestId = it.id; }
    }
    if (bestId) ids.add(bestId);
  }
  return ids;
}

function partitionAccepted(accepted: Proposal[], now: string) {
  const items: Item[] = [];
  const decisions: Decision[] = [];
  const completionTexts: string[] = [];
  for (const p of accepted) {
    if (p.is_completion) { const t = (p as any)._completesText || p.text; completionTexts.push(t); continue; }
    if (p.kind === "decision") decisions.push(proposalToDecision(p, now));
    else items.push(proposalToItem(p, now));
  }
  return { items, decisions, completionTexts };
}

export function applyAcceptToMeetingData(md: MeetingData, accepted: Proposal[], now = nowISO()): MeetingData {
  const { items, decisions, completionTexts } = partitionAccepted(accepted, now);
  const completeIds = resolveCompletions(md.todos, completionTexts);
  const existing = md.todos.map((t) => (completeIds.has(t.id) ? { ...t, status: "completed" as ItemStatus, completed_at: now, last_touched: now } : t));
  return { ...md, todos: [...items, ...existing], decisions: [...decisions, ...md.decisions] };
}

export function applyAcceptToProjectData(pd: ProjectData, accepted: Proposal[], now = nowISO()): ProjectData {
  const { items, decisions, completionTexts } = partitionAccepted(accepted, now);
  const completeIds = resolveCompletions(pd.items, completionTexts);
  const existing = pd.items.map((t) => (completeIds.has(t.id) ? { ...t, status: "completed" as ItemStatus, completed_at: now, last_touched: now } : t));
  return { ...pd, items: [...items, ...existing], decisions: [...decisions, ...pd.decisions] };
}

// The conversational re-run is additive: accepted/edited proposals are passed
// as FIXED context the model must not re-emit, and the model returns only
// adds/revisions. Merge keeps the fixed set and appends genuinely new items.
export function mergeRerun(fixed: Proposal[], additions: Proposal[]): Proposal[] {
  const out = [...fixed];
  for (const a of additions) {
    const dup = out.some((r) => r.kind === a.kind && (normalize(r.text) === normalize(a.text) || tokenSetSimilarity(r.text, a.text) >= TUNING.FUZZY_THRESHOLD));
    if (!dup) out.push(a);
  }
  return out;
}

export function buildRerunPrompt(note: string, fixed: Proposal[], instruction: string, ctx: ExtractionContext): string {
  const fixedList = fixed.length
    ? fixed.map((p, i) => `  ${i + 1}. [${p.kind}] ${p.text}`).join("\n")
    : "  (none yet)";
  return [
    buildExtractionPrompt(note, ctx),
    ``,
    `IMPORTANT: This is a follow-up pass. The user has ALREADY reviewed these items and they are final. Do NOT re-emit or modify them:`,
    fixedList,
    ``,
    `The user says: "${instruction}"`,
    `Return ONLY new items the user is asking for or items you previously missed, in the same JSON shape. Do not repeat the items above. No em dashes.`,
  ].join("\n");
}

/* ── Rolling summary (split from extraction; bounded) ─────────────────────── */

export function buildIncrementalSummaryPrompt(prevSummary: string, acceptedTexts: string[], name: string): string {
  return [
    `Update a short rolling summary for "${name}". Keep it under 90 words, plain prose, no bullet points, no em dashes. Do not invent facts.`,
    ``,
    `Current summary:`,
    prevSummary || "(none yet)",
    ``,
    `Newly confirmed items to fold in:`,
    acceptedTexts.map((t) => `- ${t}`).join("\n") || "(none)",
    ``,
    `Return ONLY the updated summary prose.`,
  ].join("\n");
}

export function buildRegenerateSummaryPrompt(rawNotes: string[], name: string): string {
  return [
    `Write a short rolling summary for "${name}" from these recent notes. Under 90 words, plain prose, no bullet points, no em dashes. Do not invent facts beyond the notes.`,
    ``,
    rawNotes.map((n, i) => `Note ${i + 1}:\n${n}`).join("\n\n"),
    ``,
    `Return ONLY the summary prose.`,
  ].join("\n");
}

/* ========================================================================== *
 *  FOLLOW-THROUGH ENGINE  (U6 — deterministic, zero-token, non-hallucinating)
 * ========================================================================== */

export function nDaysForCadence(cadence: Cadence | null): number {
  return cadence ? CADENCE_DAYS[cadence] ?? TUNING.DEFAULT_STALE_DAYS : TUNING.DEFAULT_STALE_DAYS;
}

export interface StaleInput {
  status: ItemStatus;
  due_date: string | null;
  due_confirmed: boolean;
  last_touched: string;
  interval_days: number;
  interval_confirmed: boolean;
}

// Overdue requires a CONFIRMED due date (R20: an inferred date never trips it).
export function isOverdue(it: StaleInput, now: Date = new Date()): boolean {
  return it.status === "open" && it.due_confirmed && !!it.due_date && now.getTime() > new Date(it.due_date).getTime();
}

// Untouched-N-days. The R20 interval guard scopes ONLY this branch.
export function isUntouchedStale(it: StaleInput, now: Date = new Date()): boolean {
  if (it.status !== "open" || !it.interval_confirmed) return false;
  return now.getTime() - new Date(it.last_touched).getTime() > it.interval_days * 86400000;
}

export function isStale(it: StaleInput, now: Date = new Date()): boolean {
  return it.status === "open" && (isOverdue(it, now) || isUntouchedStale(it, now));
}

// The reference date for "since" wording: the confirmed due date if overdue,
// otherwise when it was last touched.
export function staleSince(it: StaleInput, now: Date = new Date()): string | null {
  if (isOverdue(it, now)) return it.due_date;
  if (isUntouchedStale(it, now)) return it.last_touched;
  return null;
}

/* ── Escalation: spaced back-off + polymorphic form (never louder) ────────── */

export function isSnoozed(state: ItemState | undefined, now: Date = new Date()): boolean {
  return !!state?.snooze_until && now.getTime() < new Date(state.snooze_until).getTime();
}

export function backoffInterval(level: number): number {
  const b = TUNING.ESCALATION_BACKOFF;
  return b[Math.min(Math.max(level, 0), b.length - 1)];
}

// A stale item surfaces only every Nth open, N growing with escalation level —
// so an ignored item does NOT reappear on the immediately-following open.
export function surfaceEligible(state: ItemState | undefined, openCount: number): boolean {
  const last = state?.last_surfaced ?? null;
  if (last == null) return true; // never surfaced -> eligible now
  return openCount - last >= backoffInterval(state?.escalation ?? 0);
}

// Escalation varies the FORM, never the volume.
export function escalationForm(level: number): "plain" | "question" | "consequence" {
  if (level <= 0) return "plain";
  if (level === 1) return "question";
  return "consequence";
}

export interface SweepResult {
  item_state: Record<string, ItemState>;
  surfaced: Record<string, { form: "plain" | "question" | "consequence"; level: number }>;
}

// Per-open engine sweep over the currently-stale items. Snoozed items are
// suppressed; eligible items surface and (if they were surfaced before, i.e.
// ignored) escalate one step. Returns the next item_state and the visible set
// with each surfaced item's presentation form.
export function sweepEngine(staleKeys: string[], item_state: Record<string, ItemState>, openCount: number, now: Date = new Date()): SweepResult {
  const next: Record<string, ItemState> = { ...item_state };
  const surfaced: SweepResult["surfaced"] = {};
  for (const key of staleKeys) {
    const cur = next[key] || { escalation: 0, snooze_until: null, last_surfaced: null };
    if (isSnoozed(cur, now)) { next[key] = cur; continue; }
    if (surfaceEligible(cur, openCount)) {
      const wasSurfaced = cur.last_surfaced != null;
      const escalation = wasSurfaced ? Math.min(cur.escalation + 1, TUNING.ESCALATION_BACKOFF.length - 1) : cur.escalation;
      next[key] = { ...cur, last_surfaced: openCount, escalation };
      surfaced[key] = { form: escalationForm(escalation), level: escalation };
    } else {
      next[key] = cur; // backed off this open
    }
  }
  return { item_state: next, surfaced };
}

/* ========================================================================== *
 *  COCKPIT RANKING  (U9 — pure, deterministic, no AI)
 *  Eisenhower-style with importance CO-EQUAL to urgency: urgent+important and
 *  important-not-urgent both reach do-next, correcting the mere-urgency bias.
 *  do-next is hard-capped (overflow demotes to due-soon). Inferred due dates can
 *  reach due-soon (marked) but never overdue/slipping (R20).
 * ========================================================================== */

export type CockpitGroup = "do_next" | "due_soon" | "waiting" | "slipping" | "none";
export type RankedItem = LedgerItem & { _slot?: number; _form?: "plain" | "question" | "consequence" };

export interface RankOpts {
  now?: Date;
  projectFilter?: string | null;
  snoozed?: Set<string>;
  surfaced?: Record<string, { form: "plain" | "question" | "consequence"; level: number }> | null;
  dueSoonDays?: number;
  doNextCap?: number;
}
export interface CockpitGroups { doNext: RankedItem[]; dueSoon: RankedItem[]; waiting: RankedItem[]; slipping: RankedItem[]; overflow: number }

// A project's target date feeds the cockpit like a confirmed due date.
export function synthesizeProjectTargets(projects: Project[]): LedgerItem[] {
  return projects
    .filter((p) => p.target_date && p.status !== "done")
    .map((p) => ({
      id: `pt_${p.id}`, key: `pt_${p.id}`, kind: "project_target" as any, text: `${p.name} target date`,
      owner: null, waiting_on: null, priority: "High" as Priority, due_date: p.target_date, due_confirmed: true,
      owner_confirmed: true, interval_confirmed: true, status: "open" as ItemStatus, project_id: p.id, project_name: p.name, project_dot: p.dot_color,
      source: { kind: "direct" as const, meeting_id: null, meeting_name: null, note_id: null, date: p.created_at },
      cadence: null, interval_days: TUNING.DEFAULT_STALE_DAYS, quote: "", quote_anchored: false, last_touched: p.created_at, created_at: p.created_at,
    }));
}

const PRIO_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
function dueMs(li: LedgerItem): number { return li.due_date ? new Date(li.due_date).getTime() : Number.POSITIVE_INFINITY; }

export function rankCockpit(items: LedgerItem[], opts: RankOpts = {}): CockpitGroups {
  const now = opts.now ?? new Date();
  const windowMs = (opts.dueSoonDays ?? TUNING.DUE_SOON_DAYS) * 86400000;
  const cap = opts.doNextCap ?? TUNING.DO_NEXT_CAP;
  const snoozed = opts.snoozed ?? new Set<string>();
  const surfaced = opts.surfaced ?? null;
  const filter = opts.projectFilter ?? null;

  const doNext: RankedItem[] = [], dueSoon: RankedItem[] = [], waiting: RankedItem[] = [], slipping: RankedItem[] = [];
  const withForm = (li: LedgerItem): RankedItem => ({ ...li, _form: surfaced ? surfaced[li.key]?.form ?? "plain" : "plain" });

  for (const li of items) {
    if (li.status !== "open") continue;
    if (filter && li.project_id !== filter) continue;
    if (snoozed.has(li.key)) continue;

    if ((li.kind as any) === "project_target") {
      if (isOverdue(li, now)) slipping.push(withForm(li));
      else if (li.due_date && dueMs(li) <= now.getTime() + windowMs) dueSoon.push(li);
      continue;
    }
    if (li.kind === "decision") continue;

    const stale = isStale(li, now);
    if (li.owner === "waiting_for") {
      if (stale && surfaced && !surfaced[li.key]) continue; // backed off this open
      waiting.push(withForm(li));
      continue;
    }
    // i_owe
    if (stale) {
      if (surfaced && !surfaced[li.key]) continue; // backed off this open
      slipping.push(withForm(li));
      continue;
    }
    const due = dueMs(li);
    const inWindow = Number.isFinite(due) && due >= now.getTime() && due <= now.getTime() + windowMs;
    const urgentConfirmed = li.due_confirmed && inWindow;
    const urgentInferred = !li.due_confirmed && inWindow;
    const important = li.priority === "High";
    if (urgentConfirmed && important) doNext.push({ ...li, _slot: 0 });
    else if (important) doNext.push({ ...li, _slot: 1 }); // important-not-urgent still reaches do-next
    else if (urgentConfirmed || urgentInferred) dueSoon.push(li);
    // neither urgent nor important and not stale -> not surfaced (will surface once stale)
  }

  doNext.sort((a, b) => (a._slot! - b._slot!) || (dueMs(a) - dueMs(b)) || (PRIO_RANK[a.priority || "Low"] - PRIO_RANK[b.priority || "Low"]) || (new Date(a.last_touched).getTime() - new Date(b.last_touched).getTime()));
  const overflowItems = doNext.splice(cap); // hard cap; overflow demotes
  for (const o of overflowItems) dueSoon.push(o);
  dueSoon.sort((a, b) => (Number(b.due_confirmed) - Number(a.due_confirmed)) || (dueMs(a) - dueMs(b)) || (PRIO_RANK[a.priority || "Low"] - PRIO_RANK[b.priority || "Low"]));
  waiting.sort((a, b) => (Number(isStale(b, now)) - Number(isStale(a, now))) || (new Date(a.last_touched).getTime() - new Date(b.last_touched).getTime()));
  slipping.sort((a, b) => { const sa = staleSince(a, now), sb = staleSince(b, now); return new Date(sa || a.last_touched).getTime() - new Date(sb || b.last_touched).getTime(); });

  return { doNext, dueSoon, waiting, slipping, overflow: overflowItems.length };
}

/* ========================================================================== *
 *  DAILY FOCUS NARRATIVE  (U10 — cached, bounded, cuttable; pure cache logic)
 *  Job: CONSEQUENCE FRAMING (why each top item comes first, what slips if it
 *  waits) — explicitly NOT a restatement of the rank order. Cache key is
 *  {local date, last-accept marker}: invalidates on accept or day-roll only.
 * ========================================================================== */

export interface FocusCache { date: string; accept_marker: string; narrative: string; built_at: string }

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
export function localDateString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
export function isFocusValid(cache: FocusCache | null, date: string, marker: string): boolean {
  return !!cache && cache.date === date && cache.accept_marker === marker;
}

export function buildFocusPrompt(top: { text: string; owner: Owner | null; due: string | null; project: string | null; slipping: boolean }[], date: string): string {
  const lines = top.map((t, i) => `${i + 1}. ${t.text}${t.owner === "waiting_for" ? " (waiting on someone)" : ""}${t.due ? ` (due ${t.due})` : ""}${t.project ? ` [${t.project}]` : ""}${t.slipping ? " (slipping)" : ""}`);
  return [
    `Write a very short daily focus note (${date}). For the top items below, explain WHY each deserves attention first and WHAT slips or breaks if it waits. This is consequence framing, not a list. Do NOT restate the ranking or number the items back. Two or three sentences total, plain prose, no em dashes, no bullet points.`,
    ``,
    `Top items:`,
    lines.join("\n"),
    ``,
    `Return ONLY the focus note prose.`,
  ].join("\n");
}

/* ========================================================================== *
 *  MIGRATION + IMPORT  (U11 — pure; validate the WHOLE payload before any write)
 * ========================================================================== */

export interface ImportClassification { ok: boolean; version: number | null; error?: string }

// Classify a backup. A version-LESS export with a recognizable v1 shape
// (meetings list present) is treated as v1 — real v1 exports predate the field,
// so reject-on-missing would strand exactly the legacy data migration exists for.
export function classifyImport(payload: any): ImportClassification {
  if (!payload || typeof payload !== "object") return { ok: false, version: null, error: "This file is not a valid backup." };
  const v = payload.schema_version;
  if (v === 2) return { ok: true, version: 2 };
  if (v === 1) return { ok: true, version: 1 };
  if (v == null) {
    if (Array.isArray(payload.meetings)) return { ok: true, version: 1 }; // version-less v1 shape
    return { ok: false, version: null, error: "Unrecognized file: no schema version and no meetings." };
  }
  if (typeof v === "number" && v > SCHEMA_VERSION) return { ok: false, version: v, error: `This backup is from a newer version (v${v}). Update the app first.` };
  return { ok: false, version: typeof v === "number" ? v : null, error: `Unrecognized schema version.` };
}

export function validateImportStructure(payload: any): { ok: boolean; error?: string } {
  if (!Array.isArray(payload.meetings)) return { ok: false, error: "Missing the meetings list." };
  for (const m of payload.meetings) if (!m || typeof m.id !== "string" || typeof m.name !== "string") return { ok: false, error: "A meeting record is malformed." };
  if (payload.projects && !Array.isArray(payload.projects)) return { ok: false, error: "The projects list is malformed." };
  if (payload.projects) for (const p of payload.projects) if (!p || typeof p.id !== "string" || typeof p.name !== "string") return { ok: false, error: "A project record is malformed." };
  return { ok: true };
}

function migrateTodoV1ToItem(t: any, meetingId: string, now: string): Item {
  const created = t.created_at || now;
  const item: Item = {
    id: t.id || uid("it"), key: "", kind: "todo", text: t.text || "", owner: "i_owe", waiting_on: null,
    priority: VALID_PRIORITY.has(t.priority) ? t.priority : "Medium",
    due_date: t.due_date || null, due_confirmed: false, owner_confirmed: false, interval_confirmed: true,
    status: t.status === "completed" ? "completed" : "open", project_id: null,
    source: { kind: "meeting", meeting_id: t.source_meeting_id || meetingId, note_id: t.source_note_id || null, date: created },
    quote: t.source_snippet || "", quote_anchored: false, occurrence: 0,
    created_at: created, completed_at: t.completed_at || null, last_touched: t.completed_at || created,
  };
  item.key = ledgerItemKey(item);
  return item;
}
function migrateDecisionV1(d: any, meetingId: string, now: string): Decision {
  const dec: Decision = { id: d.id || uid("dec"), key: "", kind: "decision", text: d.text || "", project_id: null, source: { kind: "meeting", meeting_id: meetingId, note_id: d.source_note_id || null, date: d.timestamp || now }, quote: "", quote_anchored: false, occurrence: 0, created_at: d.timestamp || now };
  dec.key = ledgerItemKey(dec);
  return dec;
}
// Defensive v2 normalizer: fill any missing fields and (re)compute the key.
function normalizeItemV2(t: any, now: string): Item {
  const created = t.created_at || now;
  const item: Item = {
    id: t.id || uid("it"), key: t.key || "", kind: t.kind === "waiting_for" ? "waiting_for" : "todo", text: t.text || "",
    owner: t.owner === "waiting_for" ? "waiting_for" : "i_owe", waiting_on: t.waiting_on ?? null,
    priority: VALID_PRIORITY.has(t.priority) ? t.priority : "Medium", due_date: t.due_date ?? null,
    due_confirmed: !!t.due_confirmed, owner_confirmed: !!t.owner_confirmed, interval_confirmed: t.interval_confirmed !== false,
    status: t.status === "completed" ? "completed" : t.status === "dismissed" ? "dismissed" : "open",
    project_id: t.project_id ?? null, source: t.source || { kind: "meeting", meeting_id: null, note_id: null, date: created },
    quote: t.quote || "", quote_anchored: !!t.quote_anchored, occurrence: t.occurrence || 0,
    created_at: created, completed_at: t.completed_at ?? null, last_touched: t.last_touched || created,
  };
  if (!item.key) item.key = ledgerItemKey(item);
  return item;
}
function normalizeDecisionV2(d: any, now: string): Decision {
  const dec: Decision = { id: d.id || uid("dec"), key: d.key || "", kind: "decision", text: d.text || "", project_id: d.project_id ?? null, source: d.source || { kind: "meeting", meeting_id: null, note_id: null, date: now }, quote: d.quote || "", quote_anchored: !!d.quote_anchored, occurrence: d.occurrence || 0, created_at: d.created_at || now };
  if (!dec.key) dec.key = ledgerItemKey(dec);
  return dec;
}

// Migrate a classified payload into the v2 record set. v2 passes through
// (defensively normalized); v1 gets new fields with safe defaults.
export function normalizeImport(payload: any, version: number, now: string = nowISO()): RebuildInput {
  const meetings: Meeting[] = (payload.meetings || []).map((m: any) => ({ ...m }));
  const meetingData: Record<string, MeetingData> = {};
  for (const m of meetings) {
    const md = (payload.meetingData && payload.meetingData[m.id]) || {};
    if (version === 2) {
      meetingData[m.id] = { summary: md.summary || "", notes: md.notes || [], todos: (md.todos || []).map((t: any) => normalizeItemV2(t, now)), decisions: (md.decisions || []).map((d: any) => normalizeDecisionV2(d, now)), talking_points: md.talking_points || [], chat: md.chat || [], updated_at: md.updated_at || now };
    } else {
      meetingData[m.id] = { summary: md.summary || "", notes: md.notes || [], todos: (md.todos || []).map((t: any) => migrateTodoV1ToItem(t, m.id, now)), decisions: (md.decisions || []).map((d: any) => migrateDecisionV1(d, m.id, now)), talking_points: md.talking_points || [], chat: md.chat || [], updated_at: now };
    }
  }
  const projects: Project[] = (payload.projects || []).map((p: any) => ({ ...p }));
  const projectData: Record<string, ProjectData> = {};
  for (const p of projects) {
    const pd = (payload.projectData && payload.projectData[p.id]) || {};
    projectData[p.id] = { summary: pd.summary || "", updates: pd.updates || [], items: (pd.items || []).map((t: any) => normalizeItemV2(t, now)), decisions: (pd.decisions || []).map((d: any) => normalizeDecisionV2(d, now)), updated_at: pd.updated_at || now };
  }
  const followthrough: Followthrough = version === 2 && payload.followthrough ? { tombstones: payload.followthrough.tombstones || [], item_state: payload.followthrough.item_state || {} } : emptyFollowthrough();
  return { meetings, meetingData, projects, projectData, followthrough };
}

// The ordered write plan for a normalized import (lists, records, followthrough, meta).
export function planImportWrites(n: RebuildInput, acceptMarker: string): { key: string; value: any }[] {
  const writes: { key: string; value: any }[] = [];
  writes.push({ key: KEY.meetingsList, value: n.meetings });
  for (const m of n.meetings) writes.push({ key: KEY.meeting(m.id), value: n.meetingData[m.id] });
  writes.push({ key: KEY.projectsList, value: n.projects });
  for (const p of n.projects) writes.push({ key: KEY.project(p.id), value: n.projectData[p.id] });
  writes.push({ key: KEY.followthrough, value: n.followthrough });
  writes.push({ key: KEY.meta, value: { schema_version: SCHEMA_VERSION, accept_marker: acceptMarker, open_count: 0 } });
  return writes;
}

/* ========================================================================== *
 *  STORE + CONTEXT
 * ========================================================================== */

export type ViewName = "cockpit" | "capture" | "meetings" | "projects" | "meeting" | "project" | "verification";
export interface View { name: ViewName; meetingId?: string; projectId?: string }

export function parentDestination(v: View): "cockpit" | "meetings" | "projects" | null {
  if (v.name === "cockpit") return "cockpit";
  if (v.name === "meetings" || v.name === "meeting") return "meetings";
  if (v.name === "projects" || v.name === "project") return "projects";
  return null; // capture, verification
}

function useStore() {
  const [view, setViewState] = useState<View>({ name: "cockpit" });
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [followthrough, setFollowthrough] = useState<Followthrough>(emptyFollowthrough());
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [toast, setToastState] = useState<string | null>(null);
  // Verification transient state (U4b/U5 fill this in).
  const [verification, setVerification] = useState<any>(null);

  const isPhone = vw < 640;
  const toastTimer = useRef<any>(null);
  const toast_ = useCallback((msg: string | null) => {
    setToastState(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (msg) toastTimer.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadCore = useCallback(async () => {
    const m = (await storage.getJSON<Meeting[]>(KEY.meetingsList)) || [];
    const p = (await storage.getJSON<Project[]>(KEY.projectsList)) || [];
    const ft = (await storage.getJSON<Followthrough>(KEY.followthrough)) || emptyFollowthrough();
    setMeetings(m);
    setProjects(p);
    setFollowthrough(ft);
    let l = await storage.getJSON<Ledger>(KEY.ledger);
    if (!l) l = await rebuildLedger();
    setLedger(l);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const meta = await storage.getJSON<any>(KEY.meta);
        if (!meta) await storage.set(KEY.meta, { schema_version: SCHEMA_VERSION });
        await loadCore();
        setBooted(true);
      } catch {
        setBootError(true);
        setBooted(true);
      }
    })();
  }, [loadCore]);

  const navigate = useCallback((name: ViewName, ids?: { meetingId?: string; projectId?: string }) => {
    setViewState({ name, ...ids });
    if (typeof window !== "undefined") window.scrollTo?.(0, 0);
  }, []);

  // Rebuild the derived ledger from truth and refresh in-memory copy.
  const refreshLedger = useCallback(async () => {
    const l = await rebuildLedger();
    setLedger(l);
    return l;
  }, []);

  const createMeeting = useCallback(async (name: string, cadence: Cadence): Promise<Meeting> => {
    const m = makeMeeting(name, cadence);
    const list = [...(await storage.getJSON<Meeting[]>(KEY.meetingsList) || []), m];
    await storage.set(KEY.meetingsList, list);
    await storage.set(KEY.meeting(m.id), emptyMeetingData());
    setMeetings(list);
    return m;
  }, []);

  const createProject = useCallback(async (name: string): Promise<Project> => {
    const cur = (await storage.getJSON<Project[]>(KEY.projectsList)) || [];
    const p = makeProject(name, nextProjectDot(cur));
    const list = [...cur, p];
    await storage.set(KEY.projectsList, list);
    await storage.set(KEY.project(p.id), emptyProjectData());
    setProjects(list);
    return p;
  }, []);

  // Save the raw note to its destination FIRST (R3). Creating a new
  // meeting/project writes that record before the note attaches. Returns the
  // saved note's source reference so extraction (U4) can anchor against it.
  const saveRawNote = useCallback(
    async (dest: Destination, text: string, noteDateISO: string = nowISO()): Promise<{ recordKind: "meeting" | "project"; recordId: string; sourceRef: SourceRef; text: string }> => {
      let resolved: { kind: "meeting" | "project"; id: string };
      if (dest.kind === "new_meeting") { const m = await createMeeting(dest.name, dest.cadence); resolved = { kind: "meeting", id: m.id }; }
      else if (dest.kind === "new_project") { const p = await createProject(dest.name); resolved = { kind: "project", id: p.id }; }
      else resolved = { kind: dest.kind, id: dest.id };

      // noteDateISO is the chosen event date: it stamps both the note timestamp
      // and the source ref's date, so extraction anchors items to it (U1 seeds
      // last_touched from source.date). Defaults to now for same-day capture.
      if (resolved.kind === "meeting") {
        const noteId = uid("note");
        await commitMeetingData(resolved.id, (cur) => addMeetingNote(cur, text, noteId, noteDateISO));
        return { recordKind: "meeting", recordId: resolved.id, sourceRef: { kind: "meeting", meeting_id: resolved.id, note_id: noteId, date: noteDateISO }, text };
      } else {
        const noteId = uid("upd");
        await commitProjectData(resolved.id, (cur) => addProjectUpdate(cur, text, noteId, noteDateISO));
        return { recordKind: "project", recordId: resolved.id, sourceRef: { kind: "direct", meeting_id: null, note_id: noteId, date: noteDateISO }, text };
      }
    },
    [createMeeting, createProject]
  );

  // The capture orchestrator: save the note (R3), build extraction context from
  // the destination record, run single-pass or chunked extraction, and land on
  // the verification screen. The note is already safe before any AI runs.
  const captureAndAnalyze = useCallback(
    async (dest: Destination, text: string, meetingDateInput?: string) => {
      // Resolve the chosen event date (defaults to today, local calendar day).
      // A future date never reaches storage: a future last_touched would make the
      // item never age as stale, so the UI rejects it visibly (R3/KTD4) and this
      // clamp is the backstop. The chosen date stamps the note timestamp and
      // provenance, anchors relative-due inference (R8), and feeds "last met" (R9).
      const dateInput = meetingDateInput || todayDateInput();
      const future = isFutureDateInput(dateInput);
      const chosenISO = future ? nowISO() : fromDateInput(dateInput);
      const today = future ? todayDateInput() : dateInput;
      const saved = await saveRawNote(dest, text, chosenISO);
      await refreshLedger();
      const projectNames = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).map((p) => p.name);
      let ctx: ExtractionContext;
      if (saved.recordKind === "meeting") {
        const m = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).find((x) => x.id === saved.recordId);
        const md = await storage.getJSON<MeetingData>(KEY.meeting(saved.recordId));
        ctx = { destKind: "meeting", meetingName: m?.name, cadence: m?.cadence, purpose: m?.purpose, people: m?.people, projectNames, openTodos: (md?.todos || []).filter((t) => t.status === "open").map((t) => t.text), today, autoProjectId: null };
        // "Last met" reflects the newest note's meeting date and never regresses (R9).
        // updateMeeting is a stable useCallback declared later in App; it is referenced
        // here (not in this callback's deps) on purpose -- adding it to the deps array
        // would read it before initialization (TDZ) at render.
        await updateMeeting(saved.recordId, { last_meeting_date: latestMeetingDate(m?.last_meeting_date ?? null, chosenISO) });
      } else {
        const p = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).find((x) => x.id === saved.recordId);
        const pd = await storage.getJSON<ProjectData>(KEY.project(saved.recordId));
        ctx = { destKind: "project", projectName: p?.name, projectStatus: p?.status, projectNames, openTodos: (pd?.items || []).filter((t) => t.status === "open").map((t) => t.text), today, autoProjectId: saved.recordId };
      }
      setVerification({ status: "analyzing", progress: { done: 0, total: chunkNote(text).length }, source: saved.sourceRef, recordKind: saved.recordKind, recordId: saved.recordId, note: text, ctx, run: null });
      navigate("verification");
      const run = await runExtraction(text, saved.sourceRef, ctx, (done, total) => {
        setVerification((v: any) => (v ? { ...v, progress: { done, total } } : v));
      });
      setVerification((v: any) => (v ? { ...v, status: run.parseError ? "error" : "review", run } : v));
    },
    [saveRawNote, refreshLedger, navigate]
  );

  // Bump the accept marker so the daily focus cache (U10) invalidates.
  const bumpAcceptMarker = useCallback(async () => {
    const meta = (await storage.getJSON<any>(KEY.meta)) || { schema_version: SCHEMA_VERSION };
    meta.accept_marker = uid("acc");
    await storage.set(KEY.meta, meta);
  }, []);

  // Background, best-effort incremental summaries. Each is individually wrapped;
  // a failure leaves the stale summary in place (Regenerate is the recovery
  // path in U7/U8). Never blocks the accept.
  const runBackgroundSummaries = useCallback(async (target: { recordKind: "meeting" | "project"; recordId: string }, accepted: Proposal[]) => {
    const texts = accepted.filter((p) => !p.is_completion).map((p) => p.text);
    if (!texts.length) return;
    try {
      if (target.recordKind === "meeting") {
        const md = await storage.getJSON<MeetingData>(KEY.meeting(target.recordId));
        const m = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).find((x) => x.id === target.recordId);
        const next = await callClaude(buildIncrementalSummaryPrompt(md?.summary || "", texts, m?.name || "this meeting"));
        if (next && next.trim()) await commitMeetingData(target.recordId, (cur) => ({ ...cur, summary: next.trim() }));
      } else {
        const pd = await storage.getJSON<ProjectData>(KEY.project(target.recordId));
        const p = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).find((x) => x.id === target.recordId);
        const next = await callClaude(buildIncrementalSummaryPrompt(pd?.summary || "", texts, p?.name || "this project"));
        if (next && next.trim()) await commitProjectData(target.recordId, (cur) => ({ ...cur, summary: next.trim() }));
      }
    } catch {
      /* leave stale summary; Regenerate recovers (U7/U8) */
    }
  }, []);

  // Accept the verified set into truth: write tombstones for dismissed
  // proposals, write items to the ONE source record, rebuild the ledger, then
  // fire background summaries. Lands on the source view.
  const acceptProposals = useCallback(
    async (accepted: Proposal[], tombstones: TombstoneRecord[], target: { recordKind: "meeting" | "project"; recordId: string }) => {
      if (tombstones.length) {
        const merged = await commitFollowthrough({ tombstones, item_state: {} });
        setFollowthrough(merged);
      }
      const now = nowISO();
      if (target.recordKind === "meeting") await commitMeetingData(target.recordId, (cur) => applyAcceptToMeetingData(cur, accepted, now));
      else await commitProjectData(target.recordId, (cur) => applyAcceptToProjectData(cur, accepted, now));
      await refreshLedger();
      await bumpAcceptMarker();
      // refresh in-memory lists (new records may have been created upstream)
      setMeetings((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []);
      setProjects((await storage.getJSON<Project[]>(KEY.projectsList)) || []);
      const committed = accepted.filter((p) => !p.is_completion).length;
      toast_(`Saved ${committed} item${committed === 1 ? "" : "s"}.`);
      setVerification(null);
      if (target.recordKind === "meeting") navigate("meeting", { meetingId: target.recordId });
      else navigate("project", { projectId: target.recordId });
      // fire-and-forget (do not await; never block the UI)
      void runBackgroundSummaries(target, accepted);
    },
    [refreshLedger, bumpAcceptMarker, toast_, navigate, runBackgroundSummaries]
  );

  // One additive conversational re-run over the full note (un-chunked), keeping
  // the fixed/accepted items and returning adds/revisions only.
  const rerunExtraction = useCallback(
    async (instruction: string, fixed: Proposal[]): Promise<{ additions: Proposal[]; failed: boolean }> => {
      const v = (verification as any);
      if (!v) return { additions: [], failed: true };
      try {
        const raw = await callClaude(buildRerunPrompt(v.note, fixed, instruction, v.ctx));
        const parsed = parseExtraction(raw);
        if (!parsed.ok) return { additions: [], failed: true };
        return { additions: buildProposalsFromParsed(parsed.items, v.note, v.source, v.ctx), failed: false };
      } catch {
        return { additions: [], failed: true };
      }
    },
    [verification]
  );

  // Retry a single failed extraction chunk (re-runs only that chunk).
  const retryChunk = useCallback(
    async (chunkIndex1Based: number): Promise<void> => {
      const v = (verification as any);
      if (!v?.run) return;
      const chunks = chunkNote(v.note);
      const i = chunkIndex1Based - 1;
      if (i < 0 || i >= chunks.length) return;
      try {
        const raw = await callClaude(buildExtractionPrompt(chunks[i], v.ctx));
        const parsed = parseExtraction(raw);
        const newProps = parsed.ok ? buildProposalsFromParsed(parsed.items, v.note, v.source, v.ctx) : [];
        setVerification((cur: any) => {
          if (!cur?.run) return cur;
          const run: ExtractionRun = cur.run;
          const failedChunks = run.failedChunks.filter((c) => c !== chunkIndex1Based);
          const rawByChunk = [...run.rawByChunk];
          rawByChunk[i] = raw;
          const proposals = mergeProposals([run.proposals, newProps]);
          return { ...cur, run: { ...run, failedChunks, rawByChunk, proposals }, status: failedChunks.length || run.parseError ? cur.status : "review" };
        });
      } catch {
        /* still failed; leave state */
      }
    },
    [verification]
  );

  /* ── Follow-through actions (U6): done / snooze / dismiss-with-undo ─────── */

  // The derived ledger rebuild is debounced (burst triage coalesces); truth
  // writes inside the actions are eager (small, non-reconstructible).
  const rebuildTimer = useRef<any>(null);
  const coalesceRebuild = useCallback(() => {
    if (rebuildTimer.current) clearTimeout(rebuildTimer.current);
    rebuildTimer.current = setTimeout(() => { void rebuildLedger().then(setLedger); }, TUNING.LEDGER_QUIESCE_MS);
  }, []);

  // Mutate the source item's STATUS (truth). Meeting-sourced items live on the
  // meeting record; direct items on the project record (read-latest-modify-write).
  const commitItemStatus = useCallback(async (li: LedgerItem, status: ItemStatus) => {
    const now = nowISO();
    const patch = (t: Item): Item => (t.id === li.id ? { ...t, status, completed_at: status === "completed" ? now : t.completed_at, last_touched: now } : t);
    if (li.source.kind === "meeting" && li.source.meeting_id) {
      await commitMeetingData(li.source.meeting_id, (md) => ({ ...md, todos: md.todos.map(patch) }));
    } else if (li.project_id) {
      await commitProjectData(li.project_id, (pd) => ({ ...pd, items: pd.items.map(patch) }));
    }
  }, []);

  const completeItem = useCallback(async (li: LedgerItem) => {
    await commitItemStatus(li, "completed");
    setLedger((l) => (l ? { ...l, items: l.items.filter((i) => i.id !== li.id) } : l)); // optimistic
    coalesceRebuild();
  }, [commitItemStatus, coalesceRebuild]);

  const snoozeItem = useCallback(async (li: LedgerItem, days = 3) => {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const merged = await commitFollowthrough({ tombstones: [], item_state: { [li.key]: { escalation: 0, snooze_until: until, last_surfaced: null } } });
    setFollowthrough(merged);
  }, []);

  // Dismiss with a fixed in-memory undo deadline (~5s). The truth write (tombstone
  // + source status) is HELD until the deadline; undo before then drops it (never
  // a compensating write). The item hides optimistically meanwhile.
  const [pendingDismiss, setPendingDismiss] = useState<Record<string, true>>({});
  const [undo, setUndo] = useState<{ key: string } | null>(null);
  const dismissTimers = useRef<Record<string, any>>({});

  const dismissItem = useCallback((li: LedgerItem, reason: DismissReason) => {
    setPendingDismiss((p) => ({ ...p, [li.key]: true }));
    setUndo({ key: li.key });
    dismissTimers.current[li.key] = setTimeout(async () => {
      delete dismissTimers.current[li.key];
      const tomb = makeTombstone({ key: li.key, text: li.text, source: li.source }, reason);
      const merged = await commitFollowthrough({ tombstones: [tomb], item_state: {} });
      await commitItemStatus(li, reason === "done" ? "completed" : "dismissed");
      setFollowthrough(merged);
      setPendingDismiss((p) => { const n = { ...p }; delete n[li.key]; return n; });
      setUndo((u) => (u && u.key === li.key ? null : u));
      const l = await rebuildLedger(); setLedger(l);
    }, TUNING.DISMISS_UNDO_MS);
  }, [commitItemStatus]);

  const undoDismiss = useCallback((key: string) => {
    if (dismissTimers.current[key]) { clearTimeout(dismissTimers.current[key]); delete dismissTimers.current[key]; }
    setPendingDismiss((p) => { const n = { ...p }; delete n[key]; return n; });
    setUndo((u) => (u && u.key === key ? null : u));
  }, []);

  // Per-open engine sweep over the currently-stale items. Reads latest
  // followthrough, computes escalation/back-off + prunes dead state, writes it
  // back (serialized behind taps), returns the surfaced set + their forms.
  const sweepStale = useCallback(async (items: LedgerItem[]): Promise<SweepResult["surfaced"]> => {
    const meta = (await storage.getJSON<any>(KEY.meta)) || { schema_version: SCHEMA_VERSION };
    const openCount = (meta.open_count || 0) + 1;
    meta.open_count = openCount;
    await storage.set(KEY.meta, meta);
    const now = new Date();
    const ft = (await storage.getJSON<Followthrough>(KEY.followthrough)) || emptyFollowthrough();
    const staleKeys = items.filter((li) => li.kind !== "decision" && isStale(li, now)).map((li) => li.key);
    const res = sweepEngine(staleKeys, ft.item_state, openCount, now);
    const liveOpenKeys = new Set(items.filter((li) => li.status === "open").map((li) => li.key));
    // Re-read tombstones immediately before writing so a dismiss-flush that
    // landed during the sweep is not clobbered (tombstones are the durable,
    // must-not-lose data; the write window is now a negligible microtask).
    const latest = (await storage.getJSON<Followthrough>(KEY.followthrough)) || ft;
    const pruned = pruneItemState({ tombstones: latest.tombstones, item_state: res.item_state }, liveOpenKeys);
    await storage.set(KEY.followthrough, pruned);
    setFollowthrough(pruned);
    return res.surfaced;
  }, []);

  /* ── Item / record mutations (U7/U8 CRUD; all coalesce a rebuild) ───────── */

  // Patch a commitment's fields on its source record (owner flip, due confirm,
  // retag, priority, text). Touches last_touched.
  const patchItem = useCallback(async (li: LedgerItem, patch: Partial<Item>) => {
    const now = nowISO();
    const apply = (t: Item): Item => (t.id === li.id ? { ...t, ...patch, last_touched: now } : t);
    if (li.source.kind === "meeting" && li.source.meeting_id) await commitMeetingData(li.source.meeting_id, (md) => ({ ...md, todos: md.todos.map(apply) }));
    else if (li.project_id) await commitProjectData(li.project_id, (pd) => ({ ...pd, items: pd.items.map(apply) }));
    // optimistic in-memory ledger update (the debounced rebuild reconciles)
    setLedger((l) => (l ? { ...l, items: l.items.map((i) => (i.id === li.id ? { ...i, ...patch } as LedgerItem : i)) } : l));
    coalesceRebuild();
  }, [coalesceRebuild]);

  const deleteItem = useCallback(async (li: LedgerItem) => {
    const drop = (arr: Item[]) => arr.filter((t) => t.id !== li.id);
    if (li.source.kind === "meeting" && li.source.meeting_id) await commitMeetingData(li.source.meeting_id, (md) => ({ ...md, todos: drop(md.todos) }));
    else if (li.project_id) await commitProjectData(li.project_id, (pd) => ({ ...pd, items: drop(pd.items) }));
    coalesceRebuild();
  }, [coalesceRebuild]);

  const addTodo = useCallback(async (target: { recordKind: "meeting" | "project"; recordId: string }, text: string, owner: Owner = "i_owe") => {
    const now = nowISO();
    const source: SourceRef = target.recordKind === "meeting"
      ? { kind: "meeting", meeting_id: target.recordId, note_id: null, date: now }
      : { kind: "direct", meeting_id: null, note_id: null, date: now };
    const item: Item = {
      id: uid("it"), key: "", kind: owner === "waiting_for" ? "waiting_for" : "todo", text: text.trim(), owner, waiting_on: null,
      priority: "Medium", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open",
      project_id: target.recordKind === "project" ? target.recordId : null, source, quote: "", quote_anchored: false, occurrence: 0,
      created_at: now, completed_at: null, last_touched: now,
    };
    item.key = ledgerItemKey(item);
    if (target.recordKind === "meeting") await commitMeetingData(target.recordId, (md) => ({ ...md, todos: [item, ...md.todos] }));
    else await commitProjectData(target.recordId, (pd) => ({ ...pd, items: [item, ...pd.items] }));
    coalesceRebuild();
  }, [coalesceRebuild]);

  // Talking points + notes (meeting-only, non-AI CRUD).
  const addTalkingPoint = useCallback(async (meetingId: string, text: string) => {
    const tp: TalkingPoint = { id: uid("tp"), text: text.trim(), status: "open", created_at: nowISO() };
    await commitMeetingData(meetingId, (md) => ({ ...md, talking_points: [...md.talking_points, tp] }));
    setMeetings((m) => [...m]); // nudge
  }, []);
  const toggleTalkingPoint = useCallback(async (meetingId: string, tpId: string) => {
    await commitMeetingData(meetingId, (md) => ({ ...md, talking_points: md.talking_points.map((t) => (t.id === tpId ? { ...t, status: t.status === "open" ? "discussed" : "open" } : t)) }));
    setMeetings((m) => [...m]);
  }, []);
  const deleteTalkingPoint = useCallback(async (meetingId: string, tpId: string) => {
    await commitMeetingData(meetingId, (md) => ({ ...md, talking_points: md.talking_points.filter((t) => t.id !== tpId) }));
    setMeetings((m) => [...m]);
  }, []);
  const deleteNote = useCallback(async (meetingId: string, noteId: string) => {
    await commitMeetingData(meetingId, (md) => ({ ...md, notes: md.notes.filter((n) => n.id !== noteId) }));
    setMeetings((m) => [...m]);
  }, []);
  const editNote = useCallback(async (meetingId: string, noteId: string, content: string) => {
    await commitMeetingData(meetingId, (md) => ({ ...md, notes: md.notes.map((n) => (n.id === noteId ? { ...n, content } : n)) }));
    setMeetings((m) => [...m]);
  }, []);

  const updateMeeting = useCallback(async (id: string, patch: Partial<Meeting>) => {
    const list = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    await storage.set(KEY.meetingsList, list);
    setMeetings(list);
  }, []);
  const deleteMeeting = useCallback(async (id: string) => {
    const list = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).filter((m) => m.id !== id);
    await storage.set(KEY.meetingsList, list);
    await storage.delete(KEY.meeting(id));
    setMeetings(list);
    const l = await rebuildLedger(); setLedger(l);
    navigate("meetings");
  }, [navigate]);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const list = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    await storage.set(KEY.projectsList, list);
    setProjects(list);
    const l = await rebuildLedger(); setLedger(l); // status/target may affect cockpit
  }, []);
  const deleteProject = useCallback(async (id: string) => {
    const list = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).filter((p) => p.id !== id);
    await storage.set(KEY.projectsList, list);
    await storage.delete(KEY.project(id));
    setProjects(list);
    const l = await rebuildLedger(); setLedger(l);
    navigate("projects");
  }, [navigate]);

  // Regenerate a rolling summary from the last K raw notes/updates. On failure
  // the prior summary is preserved unchanged (shared U7/U8 contract).
  const regenerateSummary = useCallback(async (kind: "meeting" | "project", id: string): Promise<boolean> => {
    try {
      if (kind === "meeting") {
        const md = await storage.getJSON<MeetingData>(KEY.meeting(id));
        const m = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).find((x) => x.id === id);
        const notes = (md?.notes || []).slice(0, 6).map((n) => n.content);
        if (!notes.length) return false;
        const next = await callClaude(buildRegenerateSummaryPrompt(notes, m?.name || "this meeting"));
        if (!next || !next.trim()) return false;
        await commitMeetingData(id, (cur) => ({ ...cur, summary: next.trim() }));
        setMeetings((x) => [...x]);
        return true;
      } else {
        const pd = await storage.getJSON<ProjectData>(KEY.project(id));
        const p = ((await storage.getJSON<Project[]>(KEY.projectsList)) || []).find((x) => x.id === id);
        const notes = [...(pd?.updates || []).slice(0, 6).map((u) => u.content)];
        if (!notes.length) return false;
        const next = await callClaude(buildRegenerateSummaryPrompt(notes, p?.name || "this project"));
        if (!next || !next.trim()) return false;
        await commitProjectData(id, (cur) => ({ ...cur, summary: next.trim() }));
        setProjects((x) => [...x]);
        return true;
      }
    } catch {
      return false; // prior summary preserved
    }
  }, []);

  // Brief me (markdown briefing) + Ask (per-meeting chat) — AI, graceful.
  const briefMeeting = useCallback(async (id: string): Promise<string | null> => {
    try {
      const md = await storage.getJSON<MeetingData>(KEY.meeting(id));
      const m = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).find((x) => x.id === id);
      const open = (md?.todos || []).filter((t) => t.status === "open");
      const prompt = [
        `Write a concise pre-meeting briefing for "${m?.name}". Use these four markdown sections exactly: "## Since last time", "## Open with you", "## Suggested talking points", "## Questions to ask". Plain prose and short bullets, no em dashes. Do not invent facts.`,
        `Summary so far: ${md?.summary || "none"}`,
        `Open commitments: ${open.map((t) => `${t.owner === "waiting_for" ? "waiting on " + (t.waiting_on || "someone") + ": " : ""}${t.text}`).join("; ") || "none"}`,
        `Recent notes: ${(md?.notes || []).slice(0, 3).map((n) => n.content).join(" || ") || "none"}`,
      ].join("\n\n");
      return await callClaude(prompt);
    } catch { return null; }
  }, []);

  const askMeeting = useCallback(async (id: string, question: string): Promise<string | null> => {
    try {
      const md = await storage.getJSON<MeetingData>(KEY.meeting(id));
      const m = ((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []).find((x) => x.id === id);
      const open = (md?.todos || []).filter((t) => t.status === "open");
      const prompt = [
        `Answer the question using ONLY this meeting's context. Be concise, plain prose, no em dashes. If the context does not contain the answer, say so.`,
        `Meeting: ${m?.name}. Summary: ${md?.summary || "none"}.`,
        `Open commitments: ${open.map((t) => t.text).join("; ") || "none"}.`,
        `Recent notes: ${(md?.notes || []).slice(0, 4).map((n) => n.content).join(" || ") || "none"}.`,
        `Talking points: ${(md?.talking_points || []).map((t) => t.text).join("; ") || "none"}.`,
        ``,
        `Question: ${question}`,
      ].join("\n");
      const answer = await callClaude(prompt);
      const now = nowISO();
      await commitMeetingData(id, (cur) => ({ ...cur, chat: [...cur.chat, { role: "user", content: question, timestamp: now }, { role: "assistant", content: answer, timestamp: now }] }));
      setMeetings((x) => [...x]);
      return answer;
    } catch { return null; }
  }, []);

  // Daily focus narrative: cached under app:focus keyed {local date, accept
  // marker}. Recomputes at most once per day/accept; on failure returns the last
  // cached narrative + an error flag and NEVER blocks the cockpit.
  const ensureFocus = useCallback(async (top: LedgerItem[]): Promise<{ narrative: string | null; error: boolean }> => {
    const date = localDateString();
    const meta = (await storage.getJSON<any>(KEY.meta)) || {};
    const marker = meta.accept_marker || "init";
    const cache = await storage.getJSON<FocusCache>(KEY.focus);
    if (isFocusValid(cache, date, marker)) return { narrative: cache!.narrative, error: false };
    if (!top.length) return { narrative: cache?.narrative || null, error: false };
    try {
      const slice = top.slice(0, 6).map((li) => ({ text: li.text, owner: li.owner, due: li.due_confirmed ? fmtDate(li.due_date) : null, project: li.project_name, slipping: isStale(li, new Date()) }));
      const narrative = await callClaude(buildFocusPrompt(slice, date));
      if (!narrative || !narrative.trim()) return { narrative: cache?.narrative || null, error: true };
      const next: FocusCache = { date, accept_marker: marker, narrative: narrative.trim(), built_at: nowISO() };
      await storage.set(KEY.focus, next);
      return { narrative: next.narrative, error: false };
    } catch {
      return { narrative: cache?.narrative || null, error: true };
    }
  }, []);

  const exportData = useCallback(async () => {
    const payload = await buildExportPayload();
    downloadJSON(payload, `meeting-assistant-export-${new Date().toISOString().slice(0, 10)}.json`);
    toast_("Backup downloaded.");
  }, [toast_]);

  /* ── Import (U11): validate the whole payload, then wholesale replace ───── */

  const [importTick, setImportTick] = useState(0);
  const triggerImport = useCallback(() => setImportTick((t) => t + 1), []);

  const importData = useCallback(async (payload: any, onProgress?: (done: number, total: number) => void): Promise<{ ok: boolean; error?: string; failed?: string[] }> => {
    const c = classifyImport(payload);
    if (!c.ok) return { ok: false, error: c.error };
    const v = validateImportStructure(payload);
    if (!v.ok) return { ok: false, error: v.error };
    const normalized = normalizeImport(payload, c.version!);
    // wholesale replace: clear existing record keys + focus cache first
    for (const k of await storage.list("meeting:")) await storage.delete(k);
    for (const k of await storage.list("project:")) await storage.delete(k);
    await storage.delete(KEY.focus);
    const writes = planImportWrites(normalized, uid("acc"));
    const failed: string[] = [];
    for (let i = 0; i < writes.length; i++) {
      const ok = await storage.set(writes[i].key, writes[i].value);
      if (!ok) failed.push(writes[i].key);
      onProgress?.(i + 1, writes.length);
    }
    setMeetings(normalized.meetings);
    setProjects(normalized.projects);
    setFollowthrough(normalized.followthrough);
    const l = await rebuildLedger();
    setLedger(l);
    return failed.length ? { ok: false, failed } : { ok: true };
  }, []);

  /* ── Sample drive (first-run trust move) ────────────────────────────────── */

  const loadSample = useCallback(async () => {
    const m = makeMeeting(SAMPLE_MEETING_NAME, "Weekly");
    (m as any).is_sample = true;
    const list = [...((await storage.getJSON<Meeting[]>(KEY.meetingsList)) || []), m];
    await storage.set(KEY.meetingsList, list);
    await storage.set(KEY.meeting(m.id), emptyMeetingData());
    setMeetings(list);
    await captureAndAnalyze({ kind: "meeting", id: m.id }, SAMPLE_NOTE);
  }, [captureAndAnalyze]);

  const clearSample = useCallback(async () => {
    const ms = (await storage.getJSON<Meeting[]>(KEY.meetingsList)) || [];
    const ps = (await storage.getJSON<Project[]>(KEY.projectsList)) || [];
    const sampleMeetings = ms.filter((m) => (m as any).is_sample);
    const sampleProjects = ps.filter((p) => (p as any).is_sample);
    for (const m of sampleMeetings) await storage.delete(KEY.meeting(m.id));
    for (const p of sampleProjects) await storage.delete(KEY.project(p.id));
    const nextMeetings = ms.filter((m) => !(m as any).is_sample);
    const nextProjects = ps.filter((p) => !(p as any).is_sample);
    await storage.set(KEY.meetingsList, nextMeetings);
    await storage.set(KEY.projectsList, nextProjects);
    // prune followthrough referencing sample meetings (tombstones + item_state)
    const ft = (await storage.getJSON<Followthrough>(KEY.followthrough)) || emptyFollowthrough();
    const sampleRefs = sampleMeetings.map((m) => `meeting:${m.id}`);
    const tombstones = ft.tombstones.filter((t) => !sampleRefs.includes(t.source_ref));
    const item_state: Record<string, ItemState> = {};
    for (const [k, s] of Object.entries(ft.item_state)) if (!sampleRefs.some((r) => k.includes(r))) item_state[k] = s;
    await storage.set(KEY.followthrough, { tombstones, item_state });
    setMeetings(nextMeetings); setProjects(nextProjects); setFollowthrough({ tombstones, item_state });
    const l = await rebuildLedger(); setLedger(l);
    toast_("Sample data cleared.");
  }, [toast_]);

  return {
    view, navigate, isPhone, meetings, projects, ledger, followthrough, booted, bootError,
    toast, toast_, undo, verification, setVerification, setFollowthrough, setMeetings, setProjects,
    loadCore, refreshLedger, createMeeting, createProject, saveRawNote, captureAndAnalyze,
    acceptProposals, rerunExtraction, retryChunk, runBackgroundSummaries, bumpAcceptMarker, exportData,
    completeItem, snoozeItem, dismissItem, undoDismiss, pendingDismiss, sweepStale, commitItemStatus,
    patchItem, deleteItem, addTodo, addTalkingPoint, toggleTalkingPoint, deleteTalkingPoint, deleteNote, editNote,
    updateMeeting, deleteMeeting, updateProject, deleteProject, regenerateSummary, briefMeeting, askMeeting,
    ensureFocus, importData, triggerImport, importTick, loadSample, clearSample,
  };
}

type Store = ReturnType<typeof useStore>;
const AppCtx = React.createContext<Store | null>(null);
function useApp(): Store {
  const c = React.useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within the provider");
  return c;
}

/* ========================================================================== *
 *  ROOT COMPONENT (default export)
 * ========================================================================== */

export default function MeetingAssistant() {
  const store = useStore();
  return (
    <AppCtx.Provider value={store}>
      <div style={{ minHeight: "100%", background: BRAND.slateXLight, color: BRAND.slate, fontFamily: SANS }}>
        <AppShell>
          {!store.booted ? (
            <div style={{ padding: SPACE.xl, textAlign: "center" }}><Spinner label="Loading" /></div>
          ) : store.bootError ? (
            <InlineError reassurance="Your notes are safe." message="Could not load saved data." onRetry={() => store.loadCore()} />
          ) : (
            <Surface />
          )}
        </AppShell>
        {store.undo ? <UndoToast onUndo={() => store.undoDismiss(store.undo!.key)} /> : store.toast ? <Toast message={store.toast} /> : null}
        <ImportFlow />
      </div>
    </AppCtx.Provider>
  );
}

function UndoToast({ onUndo }: { onUndo: () => void }) {
  return (
    <div role="status" style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: BRAND.slate, color: BRAND.white, ...TYPE.meta, padding: "9px 14px", borderRadius: RADIUS.button, boxShadow: SHADOW.float, display: "flex", alignItems: "center", gap: 12 }}>
      Dismissed.
      <button type="button" onClick={onUndo} style={{ ...TYPE.meta, fontWeight: 600, color: BRAND.amber40, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Undo</button>
    </div>
  );
}

function Surface() {
  const { view } = useApp();
  switch (view.name) {
    case "capture": return <CaptureSurface />;
    case "meetings": return <MeetingsListSurface />;
    case "projects": return <ProjectsListSurface />;
    case "meeting": return <MeetingDetailSurface meetingId={view.meetingId!} />;
    case "project": return <ProjectDetailSurface projectId={view.projectId!} />;
    case "verification": return <VerificationSurface />;
    case "cockpit":
    default: return <CockpitSurface />;
  }
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 50,
        background: BRAND.slate, color: BRAND.white, ...TYPE.meta, padding: "9px 14px",
        borderRadius: RADIUS.button, boxShadow: SHADOW.float, maxWidth: "90vw",
      }}
    >
      {message}
    </div>
  );
}

/* ── App shell: desktop left rail / phone bottom tabs ─────────────────────── */

function AppShell({ children }: { children: React.ReactNode }) {
  const { view, navigate, isPhone, exportData } = useApp();
  const parent = parentDestination(view);
  const captureActive = view.name === "capture" || view.name === "verification";

  if (isPhone) {
    return (
      <div style={{ minHeight: "100vh", paddingBottom: 72 }}>
        <main style={{ padding: SPACE.md }}><SampleBanner />{children}</main>
        <nav
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
            background: BRAND.white, borderTop: `1px solid ${BRAND.divider}`,
            display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 20,
          }}
        >
          <PhoneTab active={parent === "cockpit"} label="Cockpit" icon={<LayoutGrid size={20} />} onClick={() => navigate("cockpit")} />
          <PhoneTab active={parent === "meetings"} label="Meetings" icon={<CalendarDays size={20} />} onClick={() => navigate("meetings")} />
          <PhoneCaptureTab active={captureActive} onClick={() => navigate("capture")} />
          <PhoneTab active={parent === "projects"} label="Projects" icon={<FolderKanban size={20} />} onClick={() => navigate("projects")} />
          <PhoneTab active={false} label="Export" icon={<Download size={20} />} onClick={exportData} />
        </nav>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 220, flex: "none", background: BRAND.indigo, color: BRAND.white,
          display: "flex", flexDirection: "column", padding: SPACE.md, position: "sticky", top: 0, height: "100vh",
        }}
      >
        <div style={{ ...TYPE.title, color: BRAND.white, padding: `${SPACE.sm}px ${SPACE.xs}px ${SPACE.lg}px` }}>
          Meeting Assistant
        </div>
        <Button variant="railCapture" full icon={<Inbox size={16} />} onClick={() => navigate("capture")}
          style={{ marginBottom: SPACE.lg, boxShadow: captureActive ? `0 0 0 2px ${BRAND.amber40}` : undefined }}>
          Capture
        </Button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <RailItem active={parent === "cockpit"} label="Cockpit" icon={<LayoutGrid size={18} />} onClick={() => navigate("cockpit")} />
          <RailItem active={parent === "meetings"} label="Meetings" icon={<CalendarDays size={18} />} onClick={() => navigate("meetings")} />
          <RailItem active={parent === "projects"} label="Projects" icon={<FolderKanban size={18} />} onClick={() => navigate("projects")} />
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2, paddingTop: SPACE.lg, borderTop: `1px solid ${BRAND.indigo2}` }}>
          <RailItem active={false} label="Export" icon={<Download size={18} />} onClick={exportData} muted />
          <ImportControl />
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, padding: `${SPACE.xl}px ${SPACE.lg}px` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}><SampleBanner />{children}</div>
      </main>
    </div>
  );
}

// The single rail Import entry — routes into the one ImportFlow.
function ImportControl() {
  const { triggerImport } = useApp();
  return <RailItem active={false} label="Import" icon={<Upload size={18} />} onClick={() => triggerImport()} muted />;
}

function RailItem({ active, label, icon, onClick, muted = false }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void; muted?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        background: active ? BRAND.indigo2 : hover ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", borderRadius: RADIUS.button, padding: "9px 10px", cursor: "pointer",
        color: active ? BRAND.white : muted ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.78)",
        ...TYPE.nav, fontSize: "0.9375rem",
      }}
    >
      <span style={{ position: "relative", display: "inline-flex" }}>
        {active ? (
          <span style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: 999, background: BRAND.amber }} />
        ) : null}
        {icon}
      </span>
      {label}
    </button>
  );
}

function PhoneTab({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer",
        color: active ? BRAND.indigo : BRAND.secondaryText, ...TYPE.meta, fontWeight: active ? 600 : 400, position: "relative",
      }}
    >
      {active ? <span style={{ position: "absolute", top: -6, width: 5, height: 5, borderRadius: 999, background: BRAND.amber }} /> : null}
      {icon}
      {label}
    </button>
  );
}

function PhoneCaptureTab({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Capture"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, marginTop: -16,
        borderRadius: 999, background: BRAND.indigo, color: BRAND.white, border: `3px solid ${BRAND.white}`, cursor: "pointer",
        boxShadow: active ? `0 0 0 2px ${BRAND.stroke}` : SHADOW.liftHover,
      }}
    >
      <Inbox size={22} />
    </button>
  );
}

/* ========================================================================== *
 *  SHARED: project dot, destination picker
 * ========================================================================== */

export function ProjectDot({ color, size = 6 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: color, flex: "none", display: "inline-block" }} />;
}

interface PickerOption {
  group: "Recent" | "Meetings" | "Projects";
  destination: Destination;
  label: string;
  meta?: string;
  dot?: string;
}

// The signature combobox. Reused by Capture (primary) and Verification retag.
// Manual selection only: nothing highlighted on open; commit requires an
// explicit click or Arrow+Enter. Stray Enter does nothing (the structural
// no-inference guarantee). Degrades to a plain list under PICKER_DEGRADE_MAX.
function DestinationPicker({
  onSelect,
  onClose,
  allowProjects = true,
  allowMeetings = true,
}: {
  onSelect: (d: Destination) => void;
  onClose: () => void;
  allowProjects?: boolean;
  allowMeetings?: boolean;
}) {
  const { meetings, projects, ledger } = useApp();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1); // nothing highlighted by default
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as any)) onClose(); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [onClose]);

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const li of ledger?.items || []) {
      if (li.kind === "decision" || li.status !== "open") continue;
      const k = li.source.kind === "meeting" ? `m:${li.source.meeting_id}` : li.project_id ? `p:${li.project_id}` : "";
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return counts;
  }, [ledger]);

  const q = query.trim().toLowerCase();
  const recentIds = useMemo(() => {
    const all = [
      ...meetings.map((m) => ({ created_at: m.created_at, id: `m:${m.id}` })),
      ...projects.map((p) => ({ created_at: p.created_at, id: `p:${p.id}` })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 3).map((x) => x.id);
    return new Set(all);
  }, [meetings, projects]);

  const options = useMemo<PickerOption[]>(() => {
    const opts: PickerOption[] = [];
    const matchedMeetings = (allowMeetings ? meetings : []).filter((m) => !q || m.name.toLowerCase().includes(q));
    const matchedProjects = (allowProjects ? projects : []).filter((p) => !q || p.name.toLowerCase().includes(q));
    // Recent first (only when not filtering)
    if (!q) {
      for (const m of matchedMeetings) if (recentIds.has(`m:${m.id}`)) opts.push({ group: "Recent", destination: { kind: "meeting", id: m.id }, label: m.name, meta: `${m.cadence} · ${openCounts.get(`m:${m.id}`) || 0} open` });
      for (const p of matchedProjects) if (recentIds.has(`p:${p.id}`)) opts.push({ group: "Recent", destination: { kind: "project", id: p.id }, label: p.name, meta: `${openCounts.get(`p:${p.id}`) || 0} open`, dot: p.dot_color });
    }
    for (const m of matchedMeetings) opts.push({ group: "Meetings", destination: { kind: "meeting", id: m.id }, label: m.name, meta: `${m.cadence} · ${openCounts.get(`m:${m.id}`) || 0} open` });
    for (const p of matchedProjects) opts.push({ group: "Projects", destination: { kind: "project", id: p.id }, label: p.name, meta: `${p.status} · ${openCounts.get(`p:${p.id}`) || 0} open`, dot: p.dot_color });
    return opts;
  }, [meetings, projects, q, recentIds, openCounts, allowMeetings, allowProjects]);

  const typed = query.trim();
  const createRows: PickerOption[] = [];
  if (typed) {
    if (allowMeetings) createRows.push({ group: "Meetings", destination: { kind: "new_meeting", name: typed, cadence: "Weekly" }, label: `Create new meeting "${typed}"` });
    if (allowProjects) createRows.push({ group: "Projects", destination: { kind: "new_project", name: typed }, label: `Create new project "${typed}"` });
  }
  const flat = [...options, ...createRows];

  const meetingNames = meetings.map((m) => m.name);
  const projectNames = projects.map((p) => p.name);

  const commit = (opt: PickerOption) => {
    // Exact-name collision on create -> warn rather than silently duplicate.
    if (opt.destination.kind === "new_meeting") {
      const v = validateDestinationName(opt.destination.name, meetingNames);
      if (v.collision && !window.confirm(`A meeting named "${opt.destination.name}" already exists. Create another with the same name?`)) return;
    }
    if (opt.destination.kind === "new_project") {
      const v = validateDestinationName(opt.destination.name, projectNames);
      if (v.collision && !window.confirm(`A project named "${opt.destination.name}" already exists. Create another with the same name?`)) return;
    }
    onSelect(opt.destination);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min((a < 0 ? -1 : a) + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && flat[active]) commit(flat[active]); /* stray Enter does nothing */ }
  };

  const degrade = options.length <= TUNING.PICKER_DEGRADE_MAX && !q;
  let renderIndex = -1;
  const groups: PickerOption["group"][] = ["Recent", "Meetings", "Projects"];

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-activedescendant={active >= 0 ? `picker-opt-${active}` : undefined}
      style={{ position: "absolute", zIndex: 40, top: "calc(100% + 6px)", left: 0, right: 0, background: BRAND.white, border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.md, boxShadow: SHADOW.float, padding: SPACE.sm, maxHeight: 360, overflowY: "auto" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px 8px" }}>
        <Search size={14} color={BRAND.secondaryText} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(-1); }}
          onKeyDown={onKeyDown}
          placeholder="Type to filter, or name a new one"
          aria-label="Filter destinations"
          style={{ ...TYPE.body, fontSize: "0.9375rem", border: "none", outline: "none", flex: 1, background: "transparent", color: BRAND.slate }}
        />
      </div>
      {groups.map((g) => {
        const rows = flat.filter((o) => o.group === g);
        if (!rows.length) return null;
        return (
          <div key={g} style={{ marginBottom: 4 }}>
            <SectionLabel style={{ padding: "6px 8px 4px" }}>{g}</SectionLabel>
            {rows.map((opt) => {
              renderIndex++;
              const idx = flat.indexOf(opt);
              const isActive = idx === active;
              const isCreate = opt.destination.kind === "new_meeting" || opt.destination.kind === "new_project";
              return (
                <div
                  key={`${g}-${opt.label}-${renderIndex}`}
                  id={`picker-opt-${idx}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => commit(opt)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: RADIUS.sm, cursor: "pointer", background: isActive ? BRAND.slateXLight : "transparent" }}
                >
                  {isCreate ? <Plus size={14} color={BRAND.indigo} /> : opt.dot ? <ProjectDot color={opt.dot} /> : <CalendarDays size={14} color={BRAND.slateMedium} />}
                  <span style={{ ...TYPE.body, fontSize: "0.9375rem", color: isCreate ? BRAND.indigo : BRAND.slate, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                  {opt.meta ? <span style={{ ...TYPE.meta }}>{opt.meta}</span> : null}
                </div>
              );
            })}
          </div>
        );
      })}
      {!flat.length ? <div style={{ ...TYPE.meta, padding: "8px" }}>No matches. Type a name to create one.</div> : null}
    </div>
  );
}

/* ========================================================================== *
 *  SURFACE: Capture (U3)
 * ========================================================================== */

function destinationLabel(d: Destination | null, meetings: Meeting[], projects: Project[]): string {
  if (!d) return "Send to…";
  if (d.kind === "meeting") return meetings.find((m) => m.id === d.id)?.name || "Meeting";
  if (d.kind === "project") return projects.find((p) => p.id === d.id)?.name || "Project";
  if (d.kind === "new_meeting") return `New meeting: ${d.name}`;
  return `New project: ${d.name}`;
}

function CaptureSurface() {
  const { meetings, projects, captureAndAnalyze } = useApp();
  const [text, setText] = useState("");
  const [dest, setDest] = useState<Destination | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = text.trim().length > 0 && !!dest && !busy;

  const onSave = async () => {
    if (!dest) return;
    setBusy(true);
    setErr(null);
    try {
      await captureAndAnalyze(dest, text.trim());
      setText("");
      setDest(null);
    } catch (e) {
      setErr("Something went wrong saving the note. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 style={{ ...TYPE.headline, margin: `0 0 ${SPACE.xs}px` }}>Capture</h1>
      <p style={{ ...TYPE.body, color: BRAND.secondaryText, margin: `0 0 ${SPACE.lg}px` }}>
        Paste a note, then choose where it belongs. The note is saved before anything is analyzed.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your meeting notes…"
        style={{
          display: "block", width: "100%", minHeight: 200, boxSizing: "border-box",
          background: BRAND.slateXLight, color: BRAND.slate, ...TYPE.body, fontSize: "0.9375rem",
          padding: "14px 16px", border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, resize: "vertical",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, marginTop: SPACE.md, flexWrap: "wrap" }}>
        <SectionLabel style={{ textTransform: "none", letterSpacing: 0, ...TYPE.meta, color: BRAND.slateDark }}>Send to</SectionLabel>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
              background: BRAND.white, border: `1px solid ${dest ? BRAND.stroke : BRAND.slateLight}`, borderRadius: RADIUS.sm,
              padding: "9px 12px", cursor: "pointer", ...TYPE.body, fontSize: "0.9375rem",
              color: dest ? BRAND.slate : BRAND.secondaryText,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{destinationLabel(dest, meetings, projects)}</span>
            <ChevronRight size={16} style={{ transform: pickerOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
          </button>
          {pickerOpen ? (
            <DestinationPicker
              onSelect={(d) => { setDest(d); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          ) : null}
        </div>
        <Button variant="primary" disabled={!canSave} onClick={onSave} icon={busy ? undefined : <Check size={16} />}>
          {busy ? <Spinner /> : "Save and analyze"}
        </Button>
      </div>

      {text.trim() && !dest ? (
        <p style={{ ...TYPE.meta, marginTop: SPACE.sm }}>Pick where this note belongs to save it.</p>
      ) : null}
      {err ? <div style={{ marginTop: SPACE.md }}><InlineError reassurance="Your note is not lost." message={err} onRetry={onSave} /></div> : null}
    </div>
  );
}

/* ========================================================================== *
 *  SHARED ITEM ATOMS  (owner pill, project tag, inferred mark, provenance)
 *  Visually identical across Verification / Cockpit / Project / Meeting —
 *  consistency is a trust lever.
 * ========================================================================== */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Convert a date-only input value ("YYYY-MM-DD") to an ISO instant anchored at
// LOCAL noon, so the stored date's local calendar day equals the picked day
// (KTD6). new Date("YYYY-MM-DD") parses as UTC midnight, which renders as the
// previous calendar day in negative-UTC-offset zones; noon is the safe anchor.
export function fromDateInput(value: string): string {
  if (!value) return nowISO();
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return nowISO();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}
// The user's LOCAL calendar date as "YYYY-MM-DD", for the date-input value/max
// and the future-date guard. Distinct from toDateInput(nowISO()), which is
// UTC-based and can read as the next day late in the day in negative-UTC-offset
// zones (which would make the default itself a future date).
export function todayDateInput(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
// A date-only input value is "future" when its calendar day is after today's
// (string compare is valid for zero-padded YYYY-MM-DD). Drives the R3 guard.
export function isFutureDateInput(value: string, now: Date = new Date()): boolean {
  return !!value && value > todayDateInput(now);
}
// "Last met" never regresses: returns the later of the existing last-met date
// and the chosen event date, so backfilling an older note cannot move it earlier
// than a more recent note already set it (R9). Null existing -> the chosen date.
export function latestMeetingDate(existing: string | null, chosen: string): string {
  if (!existing) return chosen;
  return new Date(chosen).getTime() > new Date(existing).getTime() ? chosen : existing;
}
// Plain relative-time words for the slipping/stale signal (no alarm, no badge).
export function ageWords(fromISO: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(fromISO).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}

export function OwnerPill({ owner, waiting_on, onClick }: { owner: Owner; waiting_on?: string | null; onClick?: () => void }) {
  const waiting = owner === "waiting_for";
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, ...TYPE.meta, fontWeight: 500,
    background: waiting ? BRAND.indigo6 : BRAND.slateXLight, color: waiting ? BRAND.indigo : BRAND.slateDark,
    padding: "2px 9px", borderRadius: RADIUS.full, whiteSpace: "nowrap", border: "none", cursor: onClick ? "pointer" : "default",
  };
  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={style} title={onClick ? "Flip owner" : undefined}>
      {waiting ? <ArrowUpRight size={12} /> : <ArrowDown size={12} />}
      {waiting ? `Waiting on ${waiting_on || "someone"}` : "I owe"}
    </button>
  );
}

export function ProjectTagPill({ name, dot, onClick }: { name: string; dot: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TYPE.meta, fontWeight: 500, background: BRAND.slateXLight, color: BRAND.slateDark, padding: "2px 9px", borderRadius: RADIUS.full, border: `1px solid ${BRAND.divider}`, cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap" }}
    >
      <ProjectDot color={dot} />
      {name}
    </button>
  );
}

export function StalePill({ words, prefix = "" }: { words: string; prefix?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...TYPE.meta, fontWeight: 500, background: BRAND.slateXLight, color: BRAND.secondaryText, padding: "2px 9px", borderRadius: RADIUS.full, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <Clock size={11} /> {prefix}{words}
    </span>
  );
}

// Provenance inset (Provenance Inset Rule): the anchored span in a tinted
// italic well, pre-expanded. Unanchored falls back to the check-before-accepting
// line. label e.g. "From your note:" / "From Team weekly, Jun 13".
export function ProvenanceInset({ quote, anchored, label }: { quote: string; anchored: boolean; label?: string }) {
  if (!anchored) {
    return (
      <div style={{ ...TYPE.meta, color: BRAND.secondaryText, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Info size={12} /> Source not found in note. Check this before accepting.
      </div>
    );
  }
  return (
    <blockquote style={{ margin: "8px 0 0", background: BRAND.slateXLight, borderRadius: RADIUS.sm, padding: "8px 11px" }}>
      {label ? <div style={{ ...TYPE.label, fontSize: "0.625rem", marginBottom: 3 }}>{label}</div> : null}
      <span style={{ fontFamily: SANS, fontStyle: "italic", fontSize: "0.875rem", lineHeight: 1.5, color: BRAND.slateDark }}>{quote}</span>
    </blockquote>
  );
}

// Dismiss reason — one quiet tap (done / redundant / wrong). Default "done".
export function DismissReasonControl({ onPick, onCancel }: { onPick: (r: DismissReason) => void; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", ...TYPE.meta }}>
      <span style={{ color: BRAND.slateDark }}>Why dismiss?</span>
      <Button variant="secondary" onClick={() => onPick("done")} style={{ padding: "4px 10px" }}>Done</Button>
      <Button variant="secondary" onClick={() => onPick("redundant")} style={{ padding: "4px 10px" }}>Redundant</Button>
      <Button variant="secondary" onClick={() => onPick("wrong")} style={{ padding: "4px 10px" }}>Wrong</Button>
      <Button variant="ghost" onClick={onCancel} style={{ padding: "4px 8px" }}>Cancel</Button>
    </div>
  );
}

/* ========================================================================== *
 *  VERIFICATION  (U5 — the trust core)
 * ========================================================================== */

type VProposal = Proposal & { _dismissed?: boolean; _dismissReason?: DismissReason; _ghosted?: boolean; _ghostTomb?: TombstoneRecord; _restored?: boolean };

function VerificationRow({
  row,
  onChange,
  onDismiss,
  onResolveProject,
}: {
  row: VProposal;
  onChange: (next: VProposal) => void;
  onDismiss: (reason: DismissReason) => void;
  onResolveProject: (d: Destination) => Promise<{ id: string; name: string; dot: string } | null>;
}) {
  const { projects } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.text);
  const [dismissing, setDismissing] = useState(false);
  const [retag, setRetag] = useState(false);
  const [editingDue, setEditingDue] = useState(false);

  const proj = row.project_id ? projects.find((p) => p.id === row.project_id) : null;

  const flipOwner = () => {
    const next: VProposal = row.owner === "i_owe"
      ? { ...row, owner: "waiting_for", kind: "waiting_for", waiting_on: row.waiting_on || "", owner_confirmed: true, inferred: { ...row.inferred, owner: false } }
      : { ...row, owner: "i_owe", kind: row.kind === "decision" ? "decision" : "todo", waiting_on: null, owner_confirmed: true, inferred: { ...row.inferred, owner: false } };
    onChange(next);
  };

  const confirmDue = (val: string) => {
    onChange({ ...row, due_date: val ? new Date(val).toISOString() : null, due_confirmed: !!val, inferred: { ...row.inferred, due: false } });
    setEditingDue(false);
  };

  const pickProject = async (d: Destination) => {
    const resolved = await onResolveProject(d);
    if (resolved) onChange({ ...row, project_id: resolved.id, project_proposed_name: null });
    setRetag(false);
  };

  return (
    <Card pad={SPACE.md} style={{ opacity: row._ghosted && !row._restored ? 0.6 : 1 }}>
      {/* control / pill row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {row.kind !== "decision" ? <OwnerPill owner={row.owner} waiting_on={row.waiting_on} onClick={flipOwner} /> : <SectionLabel style={{ margin: 0 }}>Decision</SectionLabel>}
        {proj ? (
          <ProjectTagPill name={proj.name} dot={proj.dot_color} onClick={() => setRetag((v) => !v)} />
        ) : row.project_proposed_name ? (
          <button type="button" onClick={() => setRetag((v) => !v)} style={{ ...TYPE.meta, fontWeight: 500, background: BRAND.amber20, color: BRAND.slateDark, padding: "2px 9px", borderRadius: RADIUS.full, border: `1px dashed ${BRAND.slateLight}`, cursor: "pointer" }}>
            Tag: {row.project_proposed_name}?
          </button>
        ) : (
          <button type="button" onClick={() => setRetag((v) => !v)} style={{ ...TYPE.meta, background: "none", border: "none", color: BRAND.indigo, cursor: "pointer", padding: "2px 4px" }}>+ tag</button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <Button variant="ghost" onClick={() => { setEditing((e) => !e); setDraft(row.text); }} style={{ padding: "4px 8px" }} icon={<Pencil size={13} />} title="Edit" />
          <Button variant="ghost" onClick={() => setDismissing(true)} style={{ padding: "4px 8px" }} icon={<Trash2 size={13} />} title="Dismiss" />
        </div>
      </div>

      {row.project_proposed_name && !proj && !retag ? (
        <div style={{ ...TYPE.meta, marginBottom: 6 }}>
          <button type="button" onClick={async () => { const existing = projects.find((p) => p.name.toLowerCase() === row.project_proposed_name!.toLowerCase()); await pickProject(existing ? { kind: "project", id: existing.id } : { kind: "new_project", name: row.project_proposed_name! }); }} style={{ color: BRAND.indigo, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>Confirm tag</button>
          <span style={{ color: BRAND.slateLight, margin: "0 6px" }}>·</span>
          <button type="button" onClick={() => onChange({ ...row, project_proposed_name: null })} style={{ color: BRAND.secondaryText, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remove</button>
        </div>
      ) : null}

      {retag ? (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <DestinationPicker allowMeetings={false} onSelect={pickProject} onClose={() => setRetag(false)} />
        </div>
      ) : null}

      {/* item text */}
      {editing ? (
        <div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%", boxSizing: "border-box", ...TYPE.body, fontSize: "0.9375rem", padding: 8, border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, resize: "vertical", minHeight: 56 }} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Button variant="primary" onClick={() => { onChange({ ...row, text: draft.trim() || row.text }); setEditing(false); }} style={{ padding: "5px 12px" }}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} style={{ padding: "5px 10px" }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div style={{ ...TYPE.body, fontSize: "0.9375rem" }}>{row.text}</div>
      )}

      {/* inferred / confirmed due date */}
      {row.kind !== "decision" ? (
        <div style={{ marginTop: 6, ...TYPE.meta }}>
          {editingDue ? (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="date" defaultValue={toDateInput(row.due_date)} onChange={(e) => confirmDue(e.target.value)} style={{ ...TYPE.meta, padding: "3px 6px", border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm }} />
              <button type="button" onClick={() => setEditingDue(false)} style={{ background: "none", border: "none", color: BRAND.secondaryText, cursor: "pointer" }}>cancel</button>
            </span>
          ) : row.due_date ? (
            row.due_confirmed ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: BRAND.slate }}>
                <Check size={12} color={BRAND.indigo} /> due {fmtDate(row.due_date)}
              </span>
            ) : (
              <button type="button" onClick={() => setEditingDue(true)} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ color: BRAND.secondaryText, borderBottom: `1px dotted ${BRAND.slateMedium}` }}>due {fmtDate(row.due_date)}</span>
                <span style={{ ...TYPE.label, fontSize: "0.625rem", color: BRAND.secondaryText }}>inferred</span>
              </button>
            )
          ) : (
            <button type="button" onClick={() => setEditingDue(true)} style={{ background: "none", border: "none", color: BRAND.indigo, cursor: "pointer", padding: 0 }}>+ due date</button>
          )}
        </div>
      ) : null}

      {/* provenance */}
      <ProvenanceInset quote={row.quote} anchored={row.quote_anchored} label="From your note:" />

      {row.shape_warning ? (
        <div style={{ ...TYPE.meta, marginTop: 6, color: BRAND.secondaryText }}>Incomplete extraction ({row.shape_warning}). Check before accepting.</div>
      ) : null}

      {dismissing ? (
        <div style={{ marginTop: 8 }}>
          <DismissReasonControl onPick={(r) => { setDismissing(false); onDismiss(r); }} onCancel={() => setDismissing(false)} />
        </div>
      ) : null}
    </Card>
  );
}

function VerificationSurface() {
  const { verification, followthrough, navigate, acceptProposals, rerunExtraction, retryChunk, projects, createProject } = useApp();
  const v = verification as any;

  // Seed editable rows once the run lands. Drop exact-tombstoned proposals
  // (silent suppression), mark fuzzy matches ghosted (the centralized
  // suppression surface).
  const seeded = useMemo<VProposal[]>(() => {
    if (!v?.run) return [];
    const out: VProposal[] = [];
    for (const p of v.run.proposals as Proposal[]) {
      const key = ledgerItemKey({ text: p.text, source: p.source, occurrence: p.occurrence });
      if (isExactTombstoned(key, followthrough)) continue; // silent
      const tomb = fuzzyTombstoneMatch({ text: p.text, source: p.source }, followthrough);
      out.push(tomb ? { ...p, _ghosted: true, _ghostTomb: tomb } : { ...p });
    }
    return out;
  }, [v?.run, followthrough]);

  const [rows, setRows] = useState<VProposal[]>([]);
  const [seedKey, setSeedKey] = useState<string>("");
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerunText, setRerunText] = useState("");
  const [rerunBusy, setRerunBusy] = useState(false);
  const [rerunFailed, setRerunFailed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Reseed when a new run arrives.
  const runStamp = v?.run ? `${v.recordId}:${(v.run.proposals as Proposal[]).length}:${v.status}` : "";
  useEffect(() => {
    if (runStamp && runStamp !== seedKey) { setRows(seeded); setSeedKey(runStamp); }
  }, [runStamp, seeded, seedKey]);

  if (!v) {
    return <EmptyState title="Nothing to review" body="Capture a note to extract and verify items." actionLabel="Capture a note" onAction={() => navigate("capture")} />;
  }

  const target = { recordKind: v.recordKind as "meeting" | "project", recordId: v.recordId as string };

  const resolveProject = async (d: Destination): Promise<{ id: string; name: string; dot: string } | null> => {
    if (d.kind === "project") { const p = projects.find((x) => x.id === d.id); return p ? { id: p.id, name: p.name, dot: p.dot_color } : null; }
    if (d.kind === "new_project") { const p = await createProject(d.name); return { id: p.id, name: p.name, dot: p.dot_color }; }
    return null;
  };

  const updateRow = (id: string, next: VProposal) => setRows((rs) => rs.map((r) => (r.id === id ? next : r)));
  const dismissRow = (id: string, reason: DismissReason) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _dismissed: true, _dismissReason: reason } : r)));
  const restoreGhost = (id: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _restored: true } : r)));
  const dismissGhostAgain = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id)); // already tombstoned; just remove

  const live = rows.filter((r) => !r._dismissed && !(r._ghosted && !r._restored));
  const ghosted = rows.filter((r) => r._ghosted && !r._restored && !r._dismissed);
  const todos = live.filter((r) => (r.kind === "todo" || r.kind === "waiting_for") && !r.is_completion);
  const decisions = live.filter((r) => r.kind === "decision");
  const completions = live.filter((r) => r.is_completion);

  // ambiguous/unanchored sort to the top of their group (flat loudness)
  const sortSuspectFirst = (a: VProposal, b: VProposal) => Number(!!b.shape_warning || !b.quote_anchored) - Number(!!a.shape_warning || !a.quote_anchored);
  todos.sort(sortSuspectFirst);

  const onAccept = async () => {
    setAccepting(true);
    // resolve still-proposed tags that match an existing project (auto-apply
    // existing-project matches; new-name proposals require explicit confirm)
    const accepted = live.map((r) => {
      if (!r.project_id && r.project_proposed_name) {
        const match = projects.find((p) => p.name.toLowerCase() === r.project_proposed_name!.toLowerCase());
        if (match) return { ...r, project_id: match.id };
      }
      return r;
    });
    // tombstones for dismissed (with reason) — re-extraction will not resurface
    const tombstones: TombstoneRecord[] = rows
      .filter((r) => r._dismissed)
      .map((r) => makeTombstone({ key: ledgerItemKey({ text: r.text, source: r.source, occurrence: r.occurrence }), text: r.text, source: r.source }, r._dismissReason || "wrong"));
    await acceptProposals(accepted as Proposal[], tombstones, target);
  };

  const doRerun = async () => {
    setRerunBusy(true);
    setRerunFailed(false);
    const { additions, failed } = await rerunExtraction(rerunText.trim(), live as Proposal[]);
    if (failed) setRerunFailed(true);
    else { setRows((rs) => mergeRerun(rs.filter((r) => !r._dismissed) as Proposal[], additions) as VProposal[]); setRerunText(""); setRerunOpen(false); }
    setRerunBusy(false);
  };

  // ---- status branches ----
  if (v.status === "analyzing") {
    const { done, total } = v.progress || { done: 0, total: 1 };
    return (
      <div>
        <h1 style={{ ...TYPE.headline, margin: `0 0 ${SPACE.md}px` }}>Review extraction</h1>
        <Card>
          <Spinner label={total > 1 ? `Analyzing part ${Math.min(done + 1, total)} of ${total}` : "Analyzing your note"} />
          {total > 1 ? (
            <div style={{ height: 4, background: BRAND.divider, borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((done / total) * 100)}%`, height: "100%", background: BRAND.indigo, transition: "width 200ms" }} />
            </div>
          ) : null}
          <p style={{ ...TYPE.meta, marginTop: 10 }}>Your note is saved. Nothing is committed until you accept.</p>
        </Card>
      </div>
    );
  }
  if (v.status === "error" || (v.run && v.run.parseError && !rows.length)) {
    return (
      <div>
        <h1 style={{ ...TYPE.headline, margin: `0 0 ${SPACE.md}px` }}>Review extraction</h1>
        <InlineError reassurance="Your note is saved." message="The analysis came back unreadable. Try analyzing again from the note." onRetry={() => retryChunk(1)} retryLabel="Try again" />
        <div style={{ marginTop: SPACE.md }}>
          <Button variant="secondary" onClick={() => navigate(target.recordKind === "meeting" ? "meeting" : "project", target.recordKind === "meeting" ? { meetingId: target.recordId } : { projectId: target.recordId })}>Go to {target.recordKind}</Button>
        </div>
      </div>
    );
  }
  const noItems = v.run && (v.run.proposals as Proposal[]).length === 0 && !(v.run.failedChunks?.length);
  if (noItems && !rows.length) {
    return (
      <div>
        <h1 style={{ ...TYPE.headline, margin: `0 0 ${SPACE.md}px` }}>Review extraction</h1>
        <Card>
          <p style={{ ...TYPE.body, margin: 0 }}>No clear to-dos or decisions in these notes. The note is saved.</p>
          <div style={{ marginTop: SPACE.md }}>
            <Button onClick={() => navigate(target.recordKind === "meeting" ? "meeting" : "project", target.recordKind === "meeting" ? { meetingId: target.recordId } : { projectId: target.recordId })}>Go to {target.recordKind}</Button>
          </div>
        </Card>
      </div>
    );
  }

  const acceptCount = live.filter((r) => !r.is_completion).length + completions.length;

  return (
    <div style={{ paddingBottom: 88 }}>
      <h1 style={{ ...TYPE.headline, margin: `0 0 ${SPACE.xs}px` }}>Review extraction</h1>
      <p style={{ ...TYPE.body, color: BRAND.secondaryText, margin: `0 0 ${SPACE.md}px` }}>
        Found these in your notes. Check each before saving. Nothing is saved until you accept.
      </p>

      {v.run?.failedChunks?.length ? (
        <div style={{ marginBottom: SPACE.md }}>
          <InlineError reassurance="Your note is saved." message={`Part ${v.run.failedChunks.join(", ")} could not be read. Items from the other parts are below.`} onRetry={() => retryChunk(v.run.failedChunks[0])} retryLabel={`Retry part ${v.run.failedChunks[0]}`} />
        </div>
      ) : null}

      {ghosted.length ? (
        <Card style={{ marginBottom: SPACE.md, background: BRAND.slateXLight }}>
          <SectionLabel style={{ marginBottom: 6 }}>Matches a dismissed item</SectionLabel>
          {ghosted.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", flexWrap: "wrap" }}>
              <span style={{ ...TYPE.meta, color: BRAND.secondaryText, flex: 1, minWidth: 160 }}>{r.text}</span>
              <Button variant="secondary" onClick={() => restoreGhost(r.id)} style={{ padding: "4px 10px" }}>Accept anyway</Button>
              <Button variant="ghost" onClick={() => dismissGhostAgain(r.id)} style={{ padding: "4px 10px" }}>Dismiss again</Button>
            </div>
          ))}
        </Card>
      ) : null}

      {todos.length ? (
        <div style={{ marginBottom: SPACE.lg }}>
          <SectionLabel style={{ marginBottom: SPACE.sm }}>To-dos</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            {todos.map((r) => <VerificationRow key={r.id} row={r} onChange={(n) => updateRow(r.id, n)} onDismiss={(reason) => dismissRow(r.id, reason)} onResolveProject={resolveProject} />)}
          </div>
        </div>
      ) : null}

      {decisions.length ? (
        <div style={{ marginBottom: SPACE.lg }}>
          <SectionLabel style={{ marginBottom: SPACE.sm }}>Decisions</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            {decisions.map((r) => <VerificationRow key={r.id} row={r} onChange={(n) => updateRow(r.id, n)} onDismiss={(reason) => dismissRow(r.id, reason)} onResolveProject={resolveProject} />)}
          </div>
        </div>
      ) : null}

      {completions.length ? (
        <div style={{ marginBottom: SPACE.lg }}>
          <SectionLabel style={{ marginBottom: SPACE.sm }}>Possible completions</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            {completions.map((r) => (
              <Card key={r.id} pad={SPACE.md}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={14} color={BRAND.indigo} />
                  <span style={{ ...TYPE.body, fontSize: "0.9375rem", flex: 1 }}>Marks done: {(r as any)._completesText || r.text}</span>
                  <Button variant="ghost" onClick={() => dismissRow(r.id, "wrong")} style={{ padding: "4px 8px" }}>Keep open</Button>
                </div>
                <ProvenanceInset quote={r.quote} anchored={r.quote_anchored} label="From your note:" />
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {rerunOpen ? (
        <Card style={{ marginBottom: SPACE.md }}>
          <SectionLabel style={{ marginBottom: 6 }}>Add or fix something</SectionLabel>
          <textarea value={rerunText} onChange={(e) => setRerunText(e.target.value)} placeholder="e.g. You missed the decision about the vendor" style={{ width: "100%", boxSizing: "border-box", ...TYPE.body, fontSize: "0.9375rem", padding: 8, border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, minHeight: 56, resize: "vertical" }} />
          {rerunFailed ? <div style={{ marginTop: 6 }}><InlineError reassurance="Your items are unchanged." message="The re-run did not return anything new. Try rephrasing." /></div> : null}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Button variant="primary" disabled={!rerunText.trim() || rerunBusy} onClick={doRerun}>{rerunBusy ? <Spinner label="Looking again" /> : "Look again"}</Button>
            <Button variant="ghost" onClick={() => setRerunOpen(false)}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {/* sticky commit bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: BRAND.white, borderTop: `1px solid ${BRAND.divider}`, padding: `${SPACE.sm}px ${SPACE.md}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.md, zIndex: 15 }}>
        <Button variant="ghost" onClick={() => setRerunOpen((o) => !o)}>Add or fix something</Button>
        <Button variant="primary" disabled={accepting || acceptCount === 0} onClick={onAccept}>{accepting ? <Spinner label="Saving" /> : `Accept ${acceptCount} item${acceptCount === 1 ? "" : "s"}`}</Button>
      </div>
    </div>
  );
}

/* ========================================================================== *
 *  SHARED: CommitmentRow (the central reused row) + Modal
 * ========================================================================== */

type RowAction = "done" | "snooze" | "dismiss" | "owner";

function CommitmentRow({
  li,
  slipping = false,
  form = "plain",
  actions = ["done", "snooze", "dismiss"],
  showProject = true,
  onChanged,
  leadMarker = false,
}: {
  li: LedgerItem;
  slipping?: boolean;
  form?: "plain" | "question" | "consequence";
  actions?: RowAction[];
  showProject?: boolean;
  onChanged?: () => void;
  leadMarker?: boolean;
}) {
  const { navigate, completeItem, snoozeItem, dismissItem, patchItem, pendingDismiss } = useApp();
  const [dismissing, setDismissing] = useState(false);
  const [editDue, setEditDue] = useState(false);
  if (pendingDismiss[li.key]) return null; // optimistically hidden during the undo window

  const done = async () => { await completeItem(li); onChanged?.(); };
  const snooze = async () => { await snoozeItem(li); onChanged?.(); };
  const patch = async (p: Partial<Item>) => { await patchItem(li, p); onChanged?.(); };

  const now = new Date();
  const sinceISO = staleSince(li, now);
  const ageText = sinceISO ? ageWords(sinceISO, now) : "";
  const provLabel = li.source.kind === "meeting" ? `From ${li.source.meeting_name || "meeting"}, ${fmtDate(li.source.date)}` : `From a direct update, ${fmtDate(li.source.date)}`;

  const escalationLine =
    slipping && form === "question"
      ? li.owner === "waiting_for" ? `Still waiting on ${li.waiting_on || "someone"}?` : "Still need to handle this?"
      : slipping && form === "consequence"
      ? li.owner === "waiting_for" ? `${li.waiting_on || "Someone"} has not responded in ${ageText}.` : `Open ${ageText} with no movement.`
      : "";

  const flipOwner = () => {
    if (li.owner === "i_owe") {
      const name = typeof window !== "undefined" ? window.prompt("Waiting on whom?", "") : "";
      patch({ owner: "waiting_for", kind: "waiting_for", waiting_on: (name || "").trim() || null, owner_confirmed: true });
    } else {
      patch({ owner: "i_owe", kind: "todo", waiting_on: null, owner_confirmed: true });
    }
  };

  return (
    <Card pad={12}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {leadMarker ? <span title="Next" style={{ width: 8, height: 8, borderRadius: 999, background: BRAND.amber, flex: "none" }} /> : null}
        {li.kind !== "decision" ? <OwnerPill owner={li.owner || "i_owe"} waiting_on={li.waiting_on} onClick={actions.includes("owner") ? flipOwner : undefined} /> : <SectionLabel style={{ margin: 0 }}>Decision</SectionLabel>}
        {showProject && li.project_id && li.project_name ? <ProjectTagPill name={li.project_name} dot={li.project_dot || BRAND.plum} onClick={() => navigate("project", { projectId: li.project_id! })} /> : null}
        {slipping ? <StalePill words={ageText} prefix={li.owner === "waiting_for" ? "waiting " : ""} /> : null}
        {actions.length ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            {actions.includes("done") ? <Button variant="ghost" onClick={done} style={{ padding: "4px 8px" }} icon={<Check size={14} />} title="Done" /> : null}
            {actions.includes("snooze") ? <Button variant="ghost" onClick={snooze} style={{ padding: "4px 8px" }} icon={<Clock size={14} />} title="Snooze 3 days" /> : null}
            {actions.includes("dismiss") ? <Button variant="ghost" onClick={() => setDismissing(true)} style={{ padding: "4px 8px" }} icon={<Trash2 size={14} />} title="Dismiss" /> : null}
          </div>
        ) : null}
      </div>

      <div style={{ ...TYPE.body, fontSize: "0.9375rem", color: slipping ? BRAND.secondaryText : BRAND.slate }}>{li.text}</div>
      {escalationLine ? <div style={{ ...TYPE.meta, marginTop: 4, color: BRAND.secondaryText }}>{escalationLine}</div> : null}

      {li.kind !== "decision" ? (
        <div style={{ marginTop: 6, ...TYPE.meta }}>
          {editDue ? (
            <input type="date" defaultValue={toDateInput(li.due_date)} onChange={(e) => { patch({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null, due_confirmed: !!e.target.value }); setEditDue(false); }} style={{ ...TYPE.meta, padding: "3px 6px", border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm }} />
          ) : li.due_date ? (
            li.due_confirmed ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: BRAND.slate }}><Check size={12} color={BRAND.indigo} /> due {fmtDate(li.due_date)}</span>
            ) : (
              <button type="button" onClick={() => setEditDue(true)} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ color: BRAND.secondaryText, borderBottom: `1px dotted ${BRAND.slateMedium}` }}>due {fmtDate(li.due_date)}</span>
                <span style={{ ...TYPE.label, fontSize: "0.625rem", color: BRAND.secondaryText }}>inferred · confirm</span>
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {li.quote ? <ProvenanceInset quote={li.quote} anchored={li.quote_anchored} label={provLabel} /> : <div style={{ ...TYPE.meta, marginTop: 6, color: BRAND.secondaryText }}>Added directly</div>}

      {dismissing ? <div style={{ marginTop: 8 }}><DismissReasonControl onPick={(r) => { setDismissing(false); dismissItem(li, r); }} onCancel={() => setDismissing(false)} /></div> : null}
    </Card>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(40,37,37,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: SPACE.lg, zIndex: 60, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: BRAND.white, borderRadius: RADIUS.lg, boxShadow: SHADOW.modal, width: "100%", maxWidth: 520, marginTop: "6vh", padding: SPACE.lg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
          <h2 style={{ ...TYPE.title, margin: 0 }}>{title}</h2>
          <Button variant="ghost" onClick={onClose} icon={<X size={18} />} style={{ padding: 6 }} />
        </div>
        {children}
      </div>
    </div>
  );
}

// Small labeled text/select field for forms.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: SPACE.md }}>
      <span style={{ ...TYPE.label, textTransform: "none", letterSpacing: 0, fontWeight: 600, color: BRAND.slateDark, display: "block", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", ...TYPE.body, fontSize: "0.9375rem", padding: "9px 12px", border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, background: BRAND.white, color: BRAND.slate };

/* ========================================================================== *
 *  LIGHT SURFACES (fleshed out in U7/U8/U9; functional placeholders here)
 * ========================================================================== */

function SurfaceHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.md, marginBottom: SPACE.lg }}>
      <h1 style={{ ...TYPE.headline, margin: 0 }}>{title}</h1>
      {action}
    </div>
  );
}

function EmptyState({ title, body, actionLabel, onAction, centered = false }: { title: string; body: string; actionLabel?: string; onAction?: () => void; centered?: boolean }) {
  return (
    <div style={{ maxWidth: centered ? 560 : undefined, margin: centered ? "10vh auto 0" : undefined, textAlign: centered ? "center" : "left", padding: centered ? SPACE.lg : 0 }}>
      <div style={{ ...TYPE.title, marginBottom: SPACE.xs }}>{title}</div>
      <p style={{ ...TYPE.reading, fontSize: "1rem", color: BRAND.secondaryText, margin: `0 0 ${SPACE.md}px` }}>{body}</p>
      {actionLabel && onAction ? <div style={{ display: "flex", justifyContent: centered ? "center" : "flex-start" }}><Button onClick={onAction} icon={<Plus size={16} />}>{actionLabel}</Button></div> : null}
    </div>
  );
}

/* ── data hooks that reload on ledger rebuild + explicit tick ─────────────── */

function useMeetingData(id: string) {
  const { ledger } = useApp();
  const [md, setMd] = useState<MeetingData | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; storage.getJSON<MeetingData>(KEY.meeting(id)).then((d) => { if (live) setMd(d || emptyMeetingData()); }); return () => { live = false; }; }, [id, tick, ledger?.built_at]);
  return { md, reload: () => setTick((t) => t + 1) };
}
function useProjectData(id: string) {
  const { ledger } = useApp();
  const [pd, setPd] = useState<ProjectData | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; storage.getJSON<ProjectData>(KEY.project(id)).then((d) => { if (live) setPd(d || emptyProjectData()); }); return () => { live = false; }; }, [id, tick, ledger?.built_at]);
  return { pd, reload: () => setTick((t) => t + 1) };
}

function openCountFor(ledger: Ledger | null, predicate: (li: LedgerItem) => boolean): number {
  return (ledger?.items || []).filter((li) => li.kind !== "decision" && li.status === "open" && predicate(li)).length;
}

/* ── Meeting setup modal (create + edit) ──────────────────────────────────── */

const CADENCES: Cadence[] = ["Weekly", "Biweekly", "Monthly", "Ad hoc"];

function MeetingSetupModal({ meeting, onClose }: { meeting?: Meeting; onClose: () => void }) {
  const { createMeeting, updateMeeting, deleteMeeting, navigate } = useApp();
  const [name, setName] = useState(meeting?.name || "");
  const [cadence, setCadence] = useState<Cadence>(meeting?.cadence || "Weekly");
  const [purpose, setPurpose] = useState(meeting?.purpose || "");
  const [people, setPeople] = useState(meeting?.people || "");
  const [next, setNext] = useState(toDateInput(meeting?.next_meeting_date || null));
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    const patch = { name: name.trim(), cadence, purpose: purpose.trim(), people: people.trim(), next_meeting_date: next ? new Date(next).toISOString() : null };
    if (meeting) { await updateMeeting(meeting.id, patch); onClose(); }
    else { const m = await createMeeting(name.trim(), cadence); await updateMeeting(m.id, patch); onClose(); navigate("meeting", { meetingId: m.id }); }
  };

  return (
    <Modal title={meeting ? "Edit meeting" : "New meeting"} onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Team weekly" /></Field>
      <Field label="Cadence"><select style={inputStyle} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>{CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="Purpose"><input style={inputStyle} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What this meeting is for" /></Field>
      <Field label="Key people"><input style={inputStyle} value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Priya, Maria, Dana" /></Field>
      <Field label="Next meeting date"><input type="date" style={inputStyle} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: SPACE.md, gap: SPACE.sm, flexWrap: "wrap" }}>
        {meeting ? (
          confirmDel ? (
            <InlineConfirm prompt={`Delete ${meeting.name} and all its notes, to-dos, and decisions? This cannot be undone.`} destructive confirmLabel="Delete meeting" onConfirm={() => deleteMeeting(meeting.id)} onCancel={() => setConfirmDel(false)} />
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDel(true)} icon={<Trash2 size={14} />}>Delete meeting</Button>
          )
        ) : <span />}
        {!confirmDel ? (
          <div style={{ display: "flex", gap: SPACE.sm }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={save}>{meeting ? "Save" : "Create"}</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ProjectSetupModal({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { createProject, updateProject, deleteProject, navigate } = useApp();
  const [name, setName] = useState(project?.name || "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "active");
  const [target, setTarget] = useState(toDateInput(project?.target_date || null));
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    const patch = { name: name.trim(), status, target_date: target ? new Date(target).toISOString() : null };
    if (project) { await updateProject(project.id, patch); onClose(); }
    else { const p = await createProject(name.trim()); await updateProject(p.id, patch); onClose(); navigate("project", { projectId: p.id }); }
  };

  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Atlas migration" /></Field>
      <Field label="Status"><select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}><option value="active">Active</option><option value="on_hold">On hold</option><option value="done">Done</option></select></Field>
      <Field label="Target date (optional)"><input type="date" style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: SPACE.md, gap: SPACE.sm, flexWrap: "wrap" }}>
        {project ? (
          confirmDel ? (
            <InlineConfirm prompt={`Delete ${project.name}? Items keep their notes but lose this tag. This cannot be undone.`} destructive confirmLabel="Delete project" onConfirm={() => deleteProject(project.id)} onCancel={() => setConfirmDel(false)} />
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDel(true)} icon={<Trash2 size={14} />}>Delete project</Button>
          )
        ) : <span />}
        {!confirmDel ? (
          <div style={{ display: "flex", gap: SPACE.sm }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={save}>{project ? "Save" : "Create"}</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── Meetings list (Surface 7) ────────────────────────────────────────────── */

function MeetingsListSurface() {
  const { meetings, ledger, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const q = query.trim().toLowerCase();
  const filtered = meetings.filter((m) => !q || m.name.toLowerCase().includes(q) || (m.purpose || "").toLowerCase().includes(q));

  return (
    <div>
      <SurfaceHeader title="Meetings" action={<Button icon={<Plus size={16} />} onClick={() => setModal(true)}>New meeting</Button>} />
      {meetings.length ? (
        <div style={{ position: "relative", marginBottom: SPACE.md }}>
          <Search size={15} color={BRAND.secondaryText} style={{ position: "absolute", left: 12, top: 11 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meetings" style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
      ) : null}
      {!meetings.length ? (
        <EmptyState title="Recurring and one-off meetings live here" body="Each meeting keeps its own notes, to-dos, decisions, and talking points. Create one, or capture a note and point it at a new meeting." actionLabel="New meeting" onAction={() => setModal(true)} />
      ) : !filtered.length ? (
        <p style={{ ...TYPE.meta }}>No meetings match "{query}".</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {filtered.map((m) => {
            const open = openCountFor(ledger, (li) => li.source.kind === "meeting" && li.source.meeting_id === m.id);
            return (
              <Card key={m.id} interactive onClick={() => navigate("meeting", { meetingId: m.id })}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: SPACE.md, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...TYPE.title, fontFamily: SERIF, fontWeight: 400 }}>{m.name}</div>
                    <div style={{ ...TYPE.meta, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                      {m.cadence}{m.purpose ? ` · ${m.purpose}` : ""}
                      {m.last_meeting_date ? ` · Last met ${fmtDate(m.last_meeting_date)}` : ""}{m.next_meeting_date ? ` · Next ${fmtDate(m.next_meeting_date)}` : ""}
                    </div>
                    <div style={{ ...TYPE.meta, marginTop: 4 }}>{open} open</div>
                  </div>
                  <Button variant="ghost" onClick={(/* stop nav */) => { navigate("meeting", { meetingId: m.id }); }} icon={<MessageSquare size={14} />} style={{ flex: "none" }}>Brief me</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modal ? <MeetingSetupModal onClose={() => setModal(false)} /> : null}
    </div>
  );
}

/* ── Projects list ────────────────────────────────────────────────────────── */

function ProjectsListSurface() {
  const { projects, ledger, navigate } = useApp();
  const [modal, setModal] = useState(false);
  return (
    <div>
      <SurfaceHeader title="Projects" action={<Button icon={<Plus size={16} />} onClick={() => setModal(true)}>New project</Button>} />
      {!projects.length ? (
        <EmptyState title="Projects gather work across meetings" body="Tag items to a project and its full state collects here. Create one, or capture a note and point it at a new project." actionLabel="New project" onAction={() => setModal(true)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {projects.map((p) => {
            const open = openCountFor(ledger, (li) => li.project_id === p.id);
            return (
              <Card key={p.id} interactive onClick={() => navigate("project", { projectId: p.id })}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProjectDot color={p.dot_color} size={8} />
                  <span style={{ ...TYPE.title, fontFamily: SERIF, fontWeight: 400, flex: 1 }}>{p.name}</span>
                </div>
                <div style={{ ...TYPE.meta, marginTop: 4, textTransform: "capitalize" }}>{p.status.replace("_", " ")}{p.target_date ? ` · target ${fmtDate(p.target_date)}` : ""} · {open} open</div>
              </Card>
            );
          })}
        </div>
      )}
      {modal ? <ProjectSetupModal onClose={() => setModal(false)} /> : null}
    </div>
  );
}

/* ========================================================================== *
 *  IMPORT FLOW + FIRST-RUN + SAMPLE BANNER (U11)
 * ========================================================================== */

// One Import flow that the rail Import, the first-run link, and any handoff all
// route into. Validates the WHOLE payload before any destructive write; a
// populated artifact requires confirm with a backup-by-default offer.
function ImportFlow() {
  const { importTick, importData, exportData, meetings, projects, navigate, toast_ } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "error" | "confirm" | "importing" | "failed">("idle");
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => { if (importTick > 0) inputRef.current?.click(); }, [importTick]);

  const run = async (p: any) => {
    setPhase("importing"); setProgress({ done: 0, total: 0 });
    const res = await importData(p, (done, total) => setProgress({ done, total }));
    if (res.ok) { setPhase("idle"); setPayload(null); toast_("Import complete."); navigate("cockpit"); }
    else if (res.failed) { setFailed(res.failed); setPhase("failed"); }
    else { setError(res.error || "Import failed."); setPhase("error"); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    let parsed: any;
    try { parsed = JSON.parse(await f.text()); } catch { setError("This file is not valid JSON."); setPhase("error"); return; }
    const c = classifyImport(parsed);
    if (!c.ok) { setError(c.error!); setPhase("error"); return; }
    const v = validateImportStructure(parsed);
    if (!v.ok) { setError(v.error!); setPhase("error"); return; }
    setPayload(parsed); setBackedUp(false);
    if (meetings.length || projects.length) setPhase("confirm");
    else run(parsed);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onFile} />
      {phase === "error" ? (
        <Modal title="Import" onClose={() => setPhase("idle")}>
          <InlineError reassurance="Your current data is unchanged." message={error} />
          <div style={{ marginTop: SPACE.md, display: "flex", justifyContent: "flex-end" }}><Button onClick={() => setPhase("idle")}>Close</Button></div>
        </Modal>
      ) : null}
      {phase === "confirm" ? (
        <Modal title="Import replaces current data" onClose={() => setPhase("idle")}>
          <p style={{ ...TYPE.body, fontSize: "0.9375rem", margin: 0 }}>Importing replaces everything currently saved in this artifact. There is no merge. Export a backup first, or replace without one.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, marginTop: SPACE.md }}>
            <Button variant={backedUp ? "secondary" : "primary"} onClick={async () => { await exportData(); setBackedUp(true); }} icon={<Download size={15} />}>{backedUp ? "Backup downloaded" : "Export backup first"}</Button>
            <Button variant={backedUp ? "primary" : "secondary"} onClick={() => run(payload)} icon={<Upload size={15} />}>{backedUp ? "Replace now" : "Replace without backup"}</Button>
            <Button variant="ghost" onClick={() => setPhase("idle")}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
      {phase === "importing" ? (
        <Modal title="Importing" onClose={() => {}}><Spinner label={progress.total ? `Writing ${progress.done} of ${progress.total}` : "Importing"} /></Modal>
      ) : null}
      {phase === "failed" ? (
        <Modal title="Some records did not write" onClose={() => setPhase("idle")}>
          <InlineError reassurance="Re-running import is safe and idempotent." message={`${failed.length} record(s) failed to write.`} />
          <div style={{ marginTop: SPACE.md, display: "flex", gap: SPACE.sm, justifyContent: "flex-end" }}><Button variant="ghost" onClick={() => setPhase("idle")}>Close</Button><Button onClick={() => run(payload)}>Retry</Button></div>
        </Modal>
      ) : null}
    </>
  );
}

function FirstRunHome() {
  const { loadSample, triggerImport } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ maxWidth: 560, margin: "8vh auto 0", textAlign: "center", padding: SPACE.lg }}>
      <h1 style={{ ...TYPE.display, margin: 0 }}>Meeting Assistant</h1>
      <p style={{ ...TYPE.reading, fontSize: "1rem", color: BRAND.slateDark, marginTop: SPACE.sm }}>Turn meeting notes into verified, ranked action. Paste a note, confirm what the tool finds, and see what is next, due, and slipping.</p>
      <p style={{ ...TYPE.meta, color: BRAND.secondaryText, margin: `${SPACE.md}px auto`, maxWidth: 460 }}>The tool proposes items from your notes. You review and confirm each one before it counts. It can be wrong, so review is required.</p>
      <Card style={{ textAlign: "left", marginBottom: SPACE.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: BRAND.amber, flex: "none" }} />
          <span style={{ ...TYPE.title }}>Try it on a sample note</span>
        </div>
        <p style={{ ...TYPE.body, fontSize: "0.9375rem", color: BRAND.secondaryText, margin: "0 0 12px" }}>Run the real extraction on a throwaway note, so you can see provenance and inferred marks before risking a real one.</p>
        <Button onClick={async () => { setBusy(true); await loadSample(); }} disabled={busy}>{busy ? <Spinner /> : "Run the sample note"}</Button>
      </Card>
      <button type="button" onClick={() => triggerImport()} style={{ ...TYPE.meta, color: BRAND.indigo, background: "none", border: "none", cursor: "pointer" }}>Import data from a previous version</button>
    </div>
  );
}

function SampleBanner() {
  const { meetings, projects, clearSample } = useApp();
  const [confirm, setConfirm] = useState(false);
  const hasSample = meetings.some((m) => (m as any).is_sample) || projects.some((p) => (p as any).is_sample);
  if (!hasSample) return null;
  return (
    <div style={{ background: BRAND.amber20, border: `1px solid ${BRAND.amber40}`, borderRadius: RADIUS.sm, padding: "8px 12px", marginBottom: SPACE.md }}>
      {confirm ? (
        <InlineConfirm prompt="Remove the sample meeting and its items? Your real data is not affected." confirmLabel="Clear sample" onConfirm={() => { clearSample(); setConfirm(false); }} onCancel={() => setConfirm(false)} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm, ...TYPE.meta, color: BRAND.slateDark }}>
          <span>This is sample data.</span>
          <Button variant="ghost" onClick={() => setConfirm(true)} style={{ padding: "4px 8px" }}>Clear sample</Button>
        </div>
      )}
    </div>
  );
}

function greeting(now: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${days[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function CockpitGroupBlock({ label, items, leadFirst = false, slipping = false, onChanged }: { label: string; items: RankedItem[]; leadFirst?: boolean; slipping?: boolean; onChanged?: () => void }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: SPACE.lg }}>
      <SectionLabel style={{ marginBottom: SPACE.sm }}>{label}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        {items.map((li, i) => (
          (li.kind as any) === "project_target" ? (
            <Card key={li.id} pad={12}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ProjectDot color={li.project_dot || BRAND.plum} size={8} />
                <span style={{ ...TYPE.body, fontSize: "0.9375rem", flex: 1 }}>{li.text}</span>
                <StalePill words={fmtDate(li.due_date)} prefix="target " />
              </div>
            </Card>
          ) : (
            <CommitmentRow key={li.id} li={li} leadMarker={leadFirst && i === 0} slipping={slipping} form={li._form} actions={["done", "snooze", "dismiss"]} onChanged={onChanged} />
          )
        ))}
      </div>
    </div>
  );
}

function FocusCard({ top }: { top: LedgerItem[] }) {
  const { ensureFocus } = useApp();
  const [state, setState] = useState<{ loading: boolean; narrative: string | null; error: boolean }>({ loading: true, narrative: null, error: false });
  useEffect(() => {
    let live = true;
    (async () => { const r = await ensureFocus(top); if (live) setState({ loading: false, narrative: r.narrative, error: r.error }); })();
    return () => { live = false; };
    // once per mount; ensureFocus handles cache validity internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (state.loading && !state.narrative) {
    return <Card style={{ marginBottom: SPACE.lg }}><SectionLabel>Today's focus</SectionLabel><div style={{ marginTop: 8 }}><Spinner label="Thinking about your day" /></div></Card>;
  }
  if (!state.narrative && !state.error) return null;
  return (
    <Card style={{ marginBottom: SPACE.lg }}>
      <SectionLabel>Today's focus</SectionLabel>
      {state.narrative ? <p style={{ ...TYPE.reading, fontSize: "1.0625rem", margin: "8px 0 0" }}>{state.narrative}</p> : null}
      {state.error ? <div style={{ marginTop: 8 }}><InlineError reassurance="Your cockpit below is current." message="Could not refresh today's focus." /></div> : null}
    </Card>
  );
}

function CockpitSurface() {
  const { ledger, projects, meetings, followthrough, navigate, sweepStale, refreshLedger } = useApp() as any;
  const [filter, setFilter] = useState<string | null>(null);
  const [surfaced, setSurfaced] = useState<Record<string, { form: any; level: number }> | null>(null);
  const [tick, setTick] = useState(0);

  // Stale-while-revalidate: render instantly from the cached ledger, then run
  // the per-open sweep + a quiet rebuild after first paint.
  useEffect(() => {
    let live = true;
    (async () => {
      const items = (ledger?.items || []) as LedgerItem[];
      const s = await sweepStale(items);
      if (live) setSurfaced(s);
      await refreshLedger();
    })();
    return () => { live = false; };
    // run once on mount; reconcile is intentionally not re-triggered per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const snoozed = useMemo(() => {
    const set = new Set<string>();
    for (const [k, st] of Object.entries((followthrough?.item_state || {}) as Record<string, ItemState>)) if (isSnoozed(st, now)) set.add(k);
    return set;
  }, [followthrough, now]);

  const items = useMemo(() => [...((ledger?.items || []) as LedgerItem[]), ...synthesizeProjectTargets(projects)], [ledger, projects]);
  const groups = useMemo(() => rankCockpit(items, { now, projectFilter: filter, snoozed, surfaced }), [items, filter, snoozed, surfaced, tick]);

  const openCount = (ledger?.items || []).filter((i: LedgerItem) => i.kind !== "decision" && i.status === "open").length;
  const anyInGroups = groups.doNext.length + groups.dueSoon.length + groups.waiting.length + groups.slipping.length > 0;
  const onChanged = () => setTick((t) => t + 1);
  const zeroRecords = !meetings.length && !projects.length;

  if (zeroRecords) return <FirstRunHome />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: SPACE.md, marginBottom: SPACE.lg, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ ...TYPE.display, margin: 0 }}>{greeting(now)}</h1>
          <div style={{ ...TYPE.meta, marginTop: 4 }}>{groups.doNext.length} to do next{groups.slipping.length ? `, ${groups.slipping.length} slipping` : ""}</div>
        </div>
        {projects.length ? (
          <select value={filter || ""} onChange={(e) => setFilter(e.target.value || null)} style={{ ...inputStyle, width: "auto", padding: "7px 10px" }}>
            <option value="">All projects</option>
            {projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : null}
      </div>

      {openCount && (groups.doNext.length || groups.slipping.length) ? <FocusCard top={[...groups.doNext, ...groups.slipping]} /> : null}

      {!openCount ? (
        <EmptyState title="Your day surfaces here" body="Capture a note and verify what the tool finds. Your to-dos, what is due, and what is slipping rank here automatically." actionLabel="Capture a note" onAction={() => navigate("capture")} />
      ) : !anyInGroups ? (
        <Card style={{ textAlign: "center", padding: SPACE.xl }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: BRAND.indigo, marginBottom: SPACE.sm }}><Check size={22} color={BRAND.white} /></div>
          <div style={{ ...TYPE.display, fontSize: "1.5rem" }}>Nothing needs you right now.</div>
          <p style={{ ...TYPE.meta, marginTop: 6 }}>All commitments are current, nothing is slipping.</p>
        </Card>
      ) : (
        <>
          <CockpitGroupBlock label="Do next" items={groups.doNext} leadFirst onChanged={onChanged} />
          {groups.overflow ? <p style={{ ...TYPE.meta, marginTop: -SPACE.sm, marginBottom: SPACE.lg }}>{groups.overflow} more in Due soon.</p> : null}
          <CockpitGroupBlock label="Due soon" items={groups.dueSoon} onChanged={onChanged} />
          <CockpitGroupBlock label="Waiting on others" items={groups.waiting} onChanged={onChanged} />
          <CockpitGroupBlock label="Slipping" items={groups.slipping} slipping onChanged={onChanged} />
        </>
      )}
    </div>
  );
}

function Breadcrumb({ parent, onParent, label }: { parent: string; onParent: () => void; label: string }) {
  return (
    <div style={{ ...TYPE.meta, marginBottom: SPACE.md, display: "flex", alignItems: "center", gap: 4 }}>
      <button type="button" onClick={onParent} style={{ ...TYPE.meta, color: BRAND.indigo, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{parent}</button>
      <ChevronRight size={12} color={BRAND.slateMedium} />
      <span style={{ color: BRAND.slateDark }}>{label}</span>
    </div>
  );
}

function ScopedCapture({ target }: { target: { recordKind: "meeting" | "project"; recordId: string } }) {
  const { captureAndAnalyze } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await captureAndAnalyze({ kind: target.recordKind, id: target.recordId } as Destination, text.trim()); setText(""); } finally { setBusy(false); } };
  return (
    <Card>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={target.recordKind === "meeting" ? "Paste notes from this meeting" : "Paste a project update"} style={{ width: "100%", boxSizing: "border-box", background: BRAND.slateXLight, ...TYPE.body, fontSize: "0.9375rem", padding: 12, border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, minHeight: 96, resize: "vertical" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: SPACE.sm }}>
        <Button variant="primary" disabled={!text.trim() || busy} onClick={save} icon={busy ? undefined : <Check size={15} />}>{busy ? <Spinner /> : "Save and analyze"}</Button>
      </div>
    </Card>
  );
}

function SummaryCard({ summary, onRegenerate }: { summary: string; onRegenerate: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const run = async () => { setBusy(true); setErr(false); const ok = await onRegenerate(); if (!ok) setErr(true); setBusy(false); };
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: summary ? 8 : 0 }}>
        <SectionLabel>Summary</SectionLabel>
        <Button variant="ghost" onClick={run} disabled={busy} icon={busy ? undefined : <RefreshCw size={13} />} style={{ padding: "4px 8px" }}>{busy ? <Spinner /> : "Regenerate"}</Button>
      </div>
      {summary ? <p style={{ ...TYPE.reading, fontSize: "1rem", margin: 0 }}>{summary}</p> : <p style={{ ...TYPE.meta, margin: 0 }}>No summary yet. It builds as you verify items, or regenerate it from recent notes.</p>}
      {err ? <div style={{ marginTop: 8 }}><InlineError reassurance="Your previous summary is unchanged." message="Could not regenerate the summary." onRetry={run} /></div> : null}
    </Card>
  );
}

function CardSection({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
    </Card>
  );
}

/* ── Meeting detail (Surface 8) ───────────────────────────────────────────── */

function MeetingDetailSurface({ meetingId }: { meetingId: string }) {
  const { meetings, projects, navigate, regenerateSummary, briefMeeting, askMeeting, addTodo, addTalkingPoint, toggleTalkingPoint, deleteTalkingPoint, deleteNote, editNote } = useApp();
  const m = meetings.find((x) => x.id === meetingId);
  const { md, reload } = useMeetingData(meetingId);
  const [editing, setEditing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTodo, setNewTodo] = useState("");
  const [newTp, setNewTp] = useState("");
  const [brief, setBrief] = useState<{ loading: boolean; text: string | null; failed: boolean } | null>(null);
  const [ask, setAsk] = useState<{ open: boolean; q: string; busy: boolean }>({ open: false, q: "", busy: false });

  if (!m) return <EmptyState title="Meeting not found" body="It may have been deleted." actionLabel="Back to meetings" onAction={() => navigate("meetings")} />;

  const openItems = (md?.todos || []).filter((t) => t.status === "open");
  const completed = (md?.todos || []).filter((t) => t.status === "completed");
  const hasContent = (md?.notes.length || 0) > 0;

  const runBrief = async () => { setBrief({ loading: true, text: null, failed: false }); const t = await briefMeeting(meetingId); setBrief({ loading: false, text: t, failed: !t }); };
  const runAsk = async () => { if (!ask.q.trim()) return; setAsk((a) => ({ ...a, busy: true })); await askMeeting(meetingId, ask.q.trim()); setAsk((a) => ({ ...a, busy: false, q: "" })); reload(); };

  return (
    <div>
      <Breadcrumb parent="Meetings" onParent={() => navigate("meetings")} label={m.name} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: SPACE.md, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...TYPE.display, fontSize: "1.5rem", margin: 0 }}>{m.name}</h1>
            <div style={{ ...TYPE.meta, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              {m.cadence}{m.purpose ? ` · ${m.purpose}` : ""}{m.next_meeting_date ? ` · Next ${fmtDate(m.next_meeting_date)}` : ""}{m.people ? ` · ${m.people}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <Button variant="secondary" onClick={runBrief} disabled={!hasContent} title={hasContent ? undefined : "Available after the first note"}>Brief me</Button>
            <Button variant="ghost" onClick={() => setAsk((a) => ({ ...a, open: !a.open }))} icon={<MessageSquare size={14} />}>Ask</Button>
            <Button variant="ghost" onClick={() => setEditing(true)} icon={<Pencil size={14} />}>Edit</Button>
          </div>
        </div>
      </Card>

      {brief ? (
        <Card style={{ marginTop: SPACE.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <SectionLabel>Briefing</SectionLabel>
            <Button variant="ghost" onClick={() => setBrief(null)} icon={<X size={14} />} style={{ padding: 4 }} />
          </div>
          {brief.loading ? <Spinner label="Preparing your briefing" /> : brief.failed ? <InlineError reassurance="Your data is unchanged." message="Could not generate the briefing." onRetry={runBrief} /> : <div style={{ ...TYPE.reading, fontSize: "1rem", whiteSpace: "pre-wrap" }}>{brief.text}</div>}
        </Card>
      ) : null}

      {ask.open ? (
        <Card style={{ marginTop: SPACE.md }}>
          <SectionLabel style={{ marginBottom: 8 }}>Ask about this meeting</SectionLabel>
          {(md?.chat || []).slice(-6).map((c, i) => (
            <div key={i} style={{ ...TYPE.body, fontSize: "0.9375rem", marginBottom: 8, color: c.role === "user" ? BRAND.slate : BRAND.slateDark }}>
              <strong style={{ fontWeight: 600 }}>{c.role === "user" ? "You: " : ""}</strong>{c.content}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={ask.q} onChange={(e) => setAsk((a) => ({ ...a, q: e.target.value }))} placeholder="Ask a question" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") runAsk(); }} />
            <Button variant="primary" disabled={!ask.q.trim() || ask.busy} onClick={runAsk}>{ask.busy ? <Spinner /> : "Ask"}</Button>
          </div>
        </Card>
      ) : null}

      <div style={{ marginTop: SPACE.md }}><ScopedCapture target={{ recordKind: "meeting", recordId: meetingId }} /></div>

      <div style={{ marginTop: SPACE.md }}><SummaryCard summary={md?.summary || ""} onRegenerate={() => regenerateSummary("meeting", meetingId)} /></div>

      <div style={{ marginTop: SPACE.md }}>
        <CardSection label="To-dos">
          {openItems.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              {openItems.map((it) => <CommitmentRow key={it.id} li={itemToLedgerItem(it, m, it.project_id ? projects.find((p) => p.id === it.project_id) || null : null)} actions={["done", "owner", "dismiss"]} onChanged={reload} />)}
            </div>
          ) : <p style={{ ...TYPE.meta, margin: 0 }}>No open to-dos.</p>}
          <div style={{ display: "flex", gap: 6, marginTop: SPACE.sm }}>
            <input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="Add a to-do" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter" && newTodo.trim()) { addTodo({ recordKind: "meeting", recordId: meetingId }, newTodo.trim()).then(reload); setNewTodo(""); } }} />
            <Button variant="secondary" disabled={!newTodo.trim()} onClick={() => { addTodo({ recordKind: "meeting", recordId: meetingId }, newTodo.trim()).then(reload); setNewTodo(""); }}>Add</Button>
          </div>
          {completed.length ? (
            <div style={{ marginTop: SPACE.sm }}>
              <button type="button" onClick={() => setShowCompleted((s) => !s)} style={{ ...TYPE.meta, color: BRAND.indigo, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Completed ({completed.length})</button>
              {showCompleted ? completed.map((c) => <div key={c.id} style={{ ...TYPE.body, fontSize: "0.875rem", color: BRAND.secondaryText, textDecoration: "line-through", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Check size={12} color={BRAND.indigo} />{c.text}</div>) : null}
            </div>
          ) : null}
        </CardSection>
      </div>

      <div style={{ marginTop: SPACE.md }}>
        <CardSection label="Talking points">
          {(md?.talking_points || []).length ? (md!.talking_points).map((tp) => (
            <div key={tp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <button type="button" onClick={() => toggleTalkingPoint(meetingId, tp.id).then(reload)} style={{ width: 16, height: 16, borderRadius: RADIUS.xs, border: `1px solid ${tp.status === "discussed" ? BRAND.indigo : BRAND.slateLight}`, background: tp.status === "discussed" ? BRAND.indigo : "transparent", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{tp.status === "discussed" ? <Check size={11} color="#fff" /> : null}</button>
              <span style={{ ...TYPE.body, fontSize: "0.9375rem", flex: 1, color: tp.status === "discussed" ? BRAND.secondaryText : BRAND.slate, textDecoration: tp.status === "discussed" ? "line-through" : "none" }}>{tp.text}</span>
              <Button variant="ghost" onClick={() => deleteTalkingPoint(meetingId, tp.id).then(reload)} icon={<X size={13} />} style={{ padding: 4 }} />
            </div>
          )) : <p style={{ ...TYPE.meta, margin: 0 }}>No talking points yet.</p>}
          <div style={{ display: "flex", gap: 6, marginTop: SPACE.sm }}>
            <input value={newTp} onChange={(e) => setNewTp(e.target.value)} placeholder="Add a talking point" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter" && newTp.trim()) { addTalkingPoint(meetingId, newTp.trim()).then(reload); setNewTp(""); } }} />
            <Button variant="secondary" disabled={!newTp.trim()} onClick={() => { addTalkingPoint(meetingId, newTp.trim()).then(reload); setNewTp(""); }}>Add</Button>
          </div>
        </CardSection>
      </div>

      {(md?.decisions || []).length ? (
        <div style={{ marginTop: SPACE.md }}>
          <CardSection label="Decisions">
            {md!.decisions.map((d) => (
              <div key={d.id} style={{ padding: "6px 0", borderBottom: `1px solid ${BRAND.divider}` }}>
                <div style={{ ...TYPE.body, fontSize: "0.9375rem" }}>{d.text}</div>
                {d.quote ? <ProvenanceInset quote={d.quote} anchored={d.quote_anchored} label={`Decided ${fmtDate(d.source.date)}`} /> : null}
              </div>
            ))}
          </CardSection>
        </div>
      ) : null}

      <div style={{ marginTop: SPACE.md }}>
        <CardSection label="Notes">
          {(md?.notes || []).length ? md!.notes.map((n) => <NoteRow key={n.id} note={n} onEdit={(c) => editNote(meetingId, n.id, c).then(reload)} onDelete={() => deleteNote(meetingId, n.id).then(reload)} />) : <p style={{ ...TYPE.meta, margin: 0 }}>No notes yet. Paste one above.</p>}
        </CardSection>
      </div>

      {editing ? <MeetingSetupModal meeting={m} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function NoteRow({ note, onEdit, onDelete }: { note: Note; onEdit: (content: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${BRAND.divider}` }}>
      <div style={{ ...TYPE.meta, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{fmtDate(note.timestamp)}</div>
      {editing ? (
        <div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%", boxSizing: "border-box", ...TYPE.body, fontSize: "0.9375rem", padding: 8, border: `1px solid ${BRAND.slateLight}`, borderRadius: RADIUS.sm, minHeight: 80 }} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}><Button variant="primary" onClick={() => { onEdit(draft); setEditing(false); }} style={{ padding: "5px 12px" }}>Save</Button><Button variant="ghost" onClick={() => { setDraft(note.content); setEditing(false); }} style={{ padding: "5px 10px" }}>Cancel</Button></div>
        </div>
      ) : (
        <div>
          <div style={{ ...TYPE.body, fontSize: "0.9375rem", whiteSpace: "pre-wrap" }}>{note.content}</div>
          {confirm ? (
            <div style={{ marginTop: 6 }}><InlineConfirm prompt="Delete this note?" destructive confirmLabel="Delete" onConfirm={onDelete} onCancel={() => setConfirm(false)} /></div>
          ) : (
            <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
              <Button variant="ghost" onClick={() => setEditing(true)} icon={<Pencil size={12} />} style={{ padding: "3px 7px" }}>Edit</Button>
              <Button variant="ghost" onClick={() => setConfirm(true)} icon={<Trash2 size={12} />} style={{ padding: "3px 7px" }}>Delete</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Project detail (Surface 5) ───────────────────────────────────────────── */

function ProjectDetailSurface({ projectId }: { projectId: string }) {
  const { projects, ledger, navigate, regenerateSummary } = useApp();
  const p = projects.find((x) => x.id === projectId);
  const { pd, reload } = useProjectData(projectId);
  const [editing, setEditing] = useState(false);

  if (!p) return <EmptyState title="Project not found" body="It may have been deleted." actionLabel="Back to projects" onAction={() => navigate("projects")} />;

  const items = (ledger?.items || []).filter((li) => li.project_id === projectId);
  const open = items.filter((li) => li.kind !== "decision" && li.status === "open");
  const iOwe = open.filter((li) => li.owner === "i_owe");
  const waiting = open.filter((li) => li.owner === "waiting_for");
  const decisions = items.filter((li) => li.kind === "decision");
  const contributingMeetings = Array.from(new Set(items.filter((li) => li.source.kind === "meeting" && li.source.meeting_name).map((li) => li.source.meeting_name!)));
  const now = new Date();
  const sortSlipFirst = (a: LedgerItem, b: LedgerItem) => Number(isStale(b, now)) - Number(isStale(a, now));
  iOwe.sort(sortSlipFirst); waiting.sort(sortSlipFirst);

  return (
    <div>
      <Breadcrumb parent="Projects" onParent={() => navigate("projects")} label={p.name} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: SPACE.md, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ProjectDot color={p.dot_color} size={10} />
              <h1 style={{ ...TYPE.display, fontSize: "1.5rem", margin: 0 }}>{p.name}</h1>
            </div>
            <div style={{ ...TYPE.meta, marginTop: 6, fontVariantNumeric: "tabular-nums", textTransform: "capitalize" }}>
              {p.status.replace("_", " ")}{p.target_date ? ` · target ${fmtDate(p.target_date)}` : ""}{contributingMeetings.length ? ` · ${contributingMeetings.length} contributing meeting${contributingMeetings.length === 1 ? "" : "s"}` : ""}
            </div>
          </div>
          <Button variant="ghost" onClick={() => setEditing(true)} icon={<Pencil size={14} />}>Edit project</Button>
        </div>
        {p.status === "done" && open.length ? <div style={{ ...TYPE.meta, marginTop: 8, color: BRAND.secondaryText }}>Marked done, but {open.length} commitment{open.length === 1 ? " is" : "s are"} still open below.</div> : null}
      </Card>

      <div style={{ marginTop: SPACE.md }}><SummaryCard summary={pd?.summary || ""} onRegenerate={() => regenerateSummary("project", projectId)} /></div>

      <div style={{ marginTop: SPACE.md }}>
        <CardSection label="Open commitments">
          {!open.length ? <p style={{ ...TYPE.meta, margin: 0 }}>No open commitments. Tag items to this project from a meeting, or capture a project update.</p> : null}
          {iOwe.length ? (<><div style={{ ...TYPE.meta, fontWeight: 600, color: BRAND.slateDark, margin: "4px 0 6px" }}>I owe</div><div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>{iOwe.map((li) => <CommitmentRow key={li.id} li={li} slipping={isStale(li, now)} actions={["done", "owner", "dismiss"]} showProject={false} onChanged={reload} />)}</div></>) : null}
          {waiting.length ? (<><div style={{ ...TYPE.meta, fontWeight: 600, color: BRAND.slateDark, margin: "12px 0 6px" }}>Waiting for</div><div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>{waiting.map((li) => <CommitmentRow key={li.id} li={li} slipping={isStale(li, now)} actions={["done", "owner", "dismiss"]} showProject={false} onChanged={reload} />)}</div></>) : null}
        </CardSection>
      </div>

      {decisions.length ? (
        <div style={{ marginTop: SPACE.md }}>
          <CardSection label="Decisions">
            {decisions.map((d) => (
              <div key={d.id} style={{ padding: "6px 0", borderBottom: `1px solid ${BRAND.divider}` }}>
                <div style={{ ...TYPE.body, fontSize: "0.9375rem" }}>{d.text}</div>
                {d.quote ? <ProvenanceInset quote={d.quote} anchored={d.quote_anchored} label={`${d.source.kind === "meeting" ? d.source.meeting_name : "Direct update"}, ${fmtDate(d.source.date)}`} /> : null}
              </div>
            ))}
          </CardSection>
        </div>
      ) : null}

      {(pd?.updates || []).length ? (
        <div style={{ marginTop: SPACE.md }}>
          <CardSection label="Recent updates">
            {pd!.updates.slice(0, 8).map((u) => (
              <div key={u.id} style={{ padding: "6px 0", borderBottom: `1px solid ${BRAND.divider}` }}>
                <div style={{ ...TYPE.meta, fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>{fmtDate(u.timestamp)}</div>
                <div style={{ ...TYPE.body, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{u.content}</div>
              </div>
            ))}
          </CardSection>
        </div>
      ) : null}

      {contributingMeetings.length ? (
        <div style={{ marginTop: SPACE.md }}>
          <CardSection label="Contributing meetings">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {contributingMeetings.map((name) => <span key={name} style={{ ...TYPE.meta, background: BRAND.slateXLight, padding: "3px 9px", borderRadius: RADIUS.full }}>{name}</span>)}
            </div>
          </CardSection>
        </div>
      ) : null}

      {editing ? <ProjectSetupModal project={p} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

