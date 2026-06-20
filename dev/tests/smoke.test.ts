import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import MeetingAssistant, { storage, todayDateInput } from "../../meeting-assistant";

// Catches runtime render crashes the transpile-only build cannot (bad hook
// order, undefined access, missing store members). AI/persistence still only
// truly run inside claude.ai; here the in-memory shim stands in.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom does not implement scrollTo; navigation calls it. Stub to silence noise.
if (typeof window !== "undefined") (window as any).scrollTo = () => {};

async function flush(n = 4) {
  for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

// Anchor fixtures to the real clock the live <App> reads (it uses new Date()),
// so date-sensitive assertions do not rot as wall-clock time advances past a
// hardcoded fixture date. Mirrors the fixed-NOW + daysAgo() convention used by
// the hermetic suites, but relative to now since the App has no injectable now.
const recentISO = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toISOString();

async function seedMeeting() {
  await storage.set("meetings:list", [{ id: "m1", name: "Team weekly", cadence: "Weekly", purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: recentISO(1) }]);
  await storage.set("meeting:m1", { summary: "", notes: [], todos: [], decisions: [], talking_points: [], chat: [], updated_at: recentISO(1) });
}

// Drive navigation by clicking a button by its exact trimmed text. The desktop
// rail (jsdom default width) renders nav items as <button>s; React's delegated
// onClick fires on the bubbled native click.
function clickButtonByText(container: HTMLElement, text: string) {
  const btns = Array.from(container.querySelectorAll("button"));
  const btn = btns.find((b) => (b.textContent || "").trim() === text);
  if (!btn) throw new Error(`button "${text}" not found; available: ${btns.map((b) => JSON.stringify((b.textContent || "").trim())).join(", ")}`);
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("smoke: the app mounts and boots without throwing", () => {
  beforeEach(async () => { for (const k of await storage.list("")) await storage.delete(k); });

  it("renders the first-run home on empty storage", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(MeetingAssistant)); });
    await flush();
    expect(container.textContent || "").toContain("Meeting Assistant");
    expect(container.textContent || "").toContain("sample note");
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("renders the cockpit groups when a ledger has open items", async () => {
    // Seed one meeting + an open to-do so the cockpit (not first-run) renders.
    await storage.set("meetings:list", [{ id: "m1", name: "Team weekly", cadence: "Weekly", purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: recentISO(1) }]);
    await storage.set("meeting:m1", { summary: "", notes: [], todos: [{ id: "t1", key: "send the deck::meeting:m1::0", kind: "todo", text: "send the deck", owner: "i_owe", waiting_on: null, priority: "High", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open", project_id: null, source: { kind: "meeting", meeting_id: "m1", note_id: null, date: recentISO(1) }, quote: "", quote_anchored: false, occurrence: 0, created_at: recentISO(1), completed_at: null, last_touched: recentISO(1) }], decisions: [], talking_points: [], chat: [], updated_at: recentISO(1) });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(MeetingAssistant)); });
    await flush();
    const text = container.textContent || "";
    expect(text).toContain("Do next"); // High-priority i-owe -> do-next group
    expect(text).toContain("send the deck");
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("U3: CaptureSurface renders a labelled meeting-date input defaulting to today, max today (R1/R3)", async () => {
    await seedMeeting();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(MeetingAssistant)); });
    await flush();
    await act(async () => { clickButtonByText(container, "Capture"); });
    await flush();
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.value).toBe(todayDateInput());
    expect(dateInput.getAttribute("max")).toBe(todayDateInput());
    expect(container.textContent || "").toContain("Meeting date");
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("U3: ScopedCapture (meeting detail) renders an inline meeting-date input defaulting to today (R1)", async () => {
    await seedMeeting();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(MeetingAssistant)); });
    await flush();
    await act(async () => { clickButtonByText(container, "Meetings"); });
    await flush();
    await act(async () => { clickButtonByText(container, "Brief me"); }); // navigates to the meeting detail
    await flush();
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.value).toBe(todayDateInput());
    expect(dateInput.getAttribute("max")).toBe(todayDateInput());
    await act(async () => { root.unmount(); });
    container.remove();
  });
});
