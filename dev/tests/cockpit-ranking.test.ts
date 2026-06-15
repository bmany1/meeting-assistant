import { describe, it, expect } from "vitest";
import {
  rankCockpit,
  synthesizeProjectTargets,
  ledgerItemKey,
  type LedgerItem,
  type Project,
} from "../../meeting-assistant";

const NOW = new Date("2026-06-13T12:00:00Z");
function daysAgo(n: number) { return new Date(NOW.getTime() - n * 86400000).toISOString(); }
function daysAhead(n: number) { return new Date(NOW.getTime() + n * 86400000).toISOString(); }

function li(p: Partial<LedgerItem>): LedgerItem {
  const base: LedgerItem = {
    id: p.id || "x", key: "", kind: "todo", text: p.text || "do x", owner: "i_owe", waiting_on: null, priority: "Medium",
    due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open",
    project_id: null, project_name: null, project_dot: null,
    source: { kind: "meeting", meeting_id: "m1", meeting_name: "Team weekly", note_id: null, date: daysAgo(0) },
    cadence: "Weekly", interval_days: 7, quote: "", quote_anchored: false, last_touched: daysAgo(0), created_at: daysAgo(0), ...p,
  };
  base.key = base.key || ledgerItemKey({ text: base.text, source: base.source as any, occurrence: 0 });
  return base;
}

describe("rankCockpit grouping (AE4 deterministic)", () => {
  it("urgent+important and important-not-urgent both reach do-next", () => {
    const g = rankCockpit([
      li({ id: "ui", priority: "High", due_date: daysAhead(1), due_confirmed: true }),
      li({ id: "imp", priority: "High", due_date: null }),
    ], { now: NOW });
    expect(g.doNext.map((i) => i.id).sort()).toEqual(["imp", "ui"]);
    expect(g.doNext.find((i) => i.id === "ui")!._slot).toBe(0); // urgent+important first
    expect(g.doNext.find((i) => i.id === "imp")!._slot).toBe(1);
  });

  it("urgent-not-important goes to due-soon, neither-axis is not surfaced", () => {
    const g = rankCockpit([
      li({ id: "urg", priority: "Low", due_date: daysAhead(2), due_confirmed: true }),
      li({ id: "meh", priority: "Low", due_date: null }),
    ], { now: NOW });
    expect(g.dueSoon.map((i) => i.id)).toEqual(["urg"]);
    expect(g.doNext.length).toBe(0);
    // "meh" (neither urgent nor important, not stale) surfaces nowhere
    const all = [...g.doNext, ...g.dueSoon, ...g.waiting, ...g.slipping];
    expect(all.find((i) => i.id === "meh")).toBeUndefined();
  });

  it("a waiting-for item lands in waiting-on-others, not do-next", () => {
    const g = rankCockpit([li({ id: "w", owner: "waiting_for", waiting_on: "Maria", priority: "High", due_date: daysAhead(1), due_confirmed: true })], { now: NOW });
    expect(g.waiting.map((i) => i.id)).toEqual(["w"]);
    expect(g.doNext.length).toBe(0);
  });

  it("a confirmed past-due item slips; an INFERRED-due item never overdue/slipping (R20)", () => {
    const g = rankCockpit([
      li({ id: "overdue", priority: "High", due_date: daysAgo(2), due_confirmed: true }),
      li({ id: "inf", priority: "Low", due_date: daysAhead(1), due_confirmed: false }), // inferred, soon
    ], { now: NOW });
    expect(g.slipping.map((i) => i.id)).toEqual(["overdue"]);
    expect(g.dueSoon.map((i) => i.id)).toEqual(["inf"]); // inferred -> due-soon, marked
    expect(g.slipping.find((i) => i.id === "inf")).toBeUndefined();
  });

  it("an important item with an inferred due date reaches do-next via the importance slot", () => {
    const g = rankCockpit([li({ id: "impInf", priority: "High", due_date: daysAhead(1), due_confirmed: false })], { now: NOW });
    expect(g.doNext.map((i) => i.id)).toEqual(["impInf"]);
  });

  it("do-next never exceeds the cap; overflow demotes to due-soon", () => {
    const many = Array.from({ length: 8 }, (_, i) => li({ id: "n" + i, priority: "High", due_date: null }));
    const g = rankCockpit(many, { now: NOW, doNextCap: 5 });
    expect(g.doNext.length).toBe(5);
    expect(g.overflow).toBe(3);
    expect(g.dueSoon.length).toBe(3); // overflow lands in due-soon
  });

  it("project filter narrows to one project", () => {
    const g = rankCockpit([
      li({ id: "a", priority: "High", project_id: "p1" }),
      li({ id: "b", priority: "High", project_id: "p2" }),
    ], { now: NOW, projectFilter: "p1" });
    const all = [...g.doNext, ...g.dueSoon, ...g.waiting, ...g.slipping];
    expect(all.map((i) => i.id)).toEqual(["a"]);
  });

  it("snoozed items are excluded from all groups", () => {
    const item = li({ id: "s", priority: "High" });
    const g = rankCockpit([item], { now: NOW, snoozed: new Set([item.key]) });
    expect(g.doNext.length + g.dueSoon.length + g.waiting.length + g.slipping.length).toBe(0);
  });

  it("a backed-off stale item (not surfaced) is excluded from slipping this open", () => {
    const item = li({ id: "st", priority: "Medium", due_date: daysAgo(5), due_confirmed: true });
    const withSurface = rankCockpit([item], { now: NOW, surfaced: { [item.key]: { form: "plain", level: 0 } } });
    expect(withSurface.slipping.map((i) => i.id)).toEqual(["st"]);
    const backedOff = rankCockpit([item], { now: NOW, surfaced: {} }); // not in surfaced
    expect(backedOff.slipping.length).toBe(0);
  });
});

describe("synthesizeProjectTargets", () => {
  const proj = (over: Partial<Project>): Project => ({ id: "p1", name: "Atlas", status: "active", target_date: null, dot_color: "#CE5780", created_at: daysAgo(30), ...over });

  it("an overdue project target appears in slipping", () => {
    const targets = synthesizeProjectTargets([proj({ target_date: daysAgo(3) })]);
    const g = rankCockpit(targets, { now: NOW });
    expect(g.slipping.some((i) => (i.kind as any) === "project_target")).toBe(true);
  });

  it("a soon project target appears in due-soon; a done project's target is omitted", () => {
    const soon = synthesizeProjectTargets([proj({ target_date: daysAhead(2) })]);
    expect(rankCockpit(soon, { now: NOW }).dueSoon.length).toBe(1);
    expect(synthesizeProjectTargets([proj({ status: "done", target_date: daysAgo(3) })]).length).toBe(0);
  });
});
