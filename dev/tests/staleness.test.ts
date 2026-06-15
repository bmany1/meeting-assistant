import { describe, it, expect } from "vitest";
import {
  isStale,
  isOverdue,
  isUntouchedStale,
  staleSince,
  nDaysForCadence,
  isSnoozed,
  surfaceEligible,
  backoffInterval,
  escalationForm,
  sweepEngine,
  type StaleInput,
  type ItemState,
} from "../../meeting-assistant";

const NOW = new Date("2026-06-13T12:00:00Z");
function daysAgo(n: number): string { return new Date(NOW.getTime() - n * 86400000).toISOString(); }
function daysAhead(n: number): string { return new Date(NOW.getTime() + n * 86400000).toISOString(); }

function mk(p: Partial<StaleInput>): StaleInput {
  return { status: "open", due_date: null, due_confirmed: false, last_touched: daysAgo(0), interval_days: 7, interval_confirmed: true, ...p };
}

describe("isStale — overdue branch (AE3)", () => {
  it("a confirmed past-due item is stale", () => {
    expect(isStale(mk({ due_date: daysAgo(2), due_confirmed: true }), NOW)).toBe(true);
    expect(isOverdue(mk({ due_date: daysAgo(2), due_confirmed: true }), NOW)).toBe(true);
  });

  it("an INFERRED (unconfirmed) past-due date never trips overdue (R20)", () => {
    const it = mk({ due_date: daysAgo(2), due_confirmed: false, last_touched: daysAgo(0), interval_days: 7 });
    expect(isOverdue(it, NOW)).toBe(false);
    expect(isStale(it, NOW)).toBe(false);
  });
});

describe("isStale — untouched branch + R20 interval guard", () => {
  it("untouched beyond N days is stale when the interval is confirmed/defaulted", () => {
    expect(isUntouchedStale(mk({ last_touched: daysAgo(10), interval_days: 7, interval_confirmed: true }), NOW)).toBe(true);
  });

  it("an item with only an inferred (unconfirmed) interval is NOT auto-flagged", () => {
    const it = mk({ last_touched: daysAgo(30), interval_days: 7, interval_confirmed: false, due_confirmed: false });
    expect(isUntouchedStale(it, NOW)).toBe(false);
    expect(isStale(it, NOW)).toBe(false);
  });

  it("a confirmed past-due item flags even when its interval is unconfirmed (guard scopes only the untouched branch)", () => {
    const it = mk({ due_date: daysAgo(1), due_confirmed: true, interval_confirmed: false, last_touched: daysAgo(0) });
    expect(isStale(it, NOW)).toBe(true);
  });

  it("not stale when touched recently and not overdue", () => {
    expect(isStale(mk({ last_touched: daysAgo(1), interval_days: 7 }), NOW)).toBe(false);
  });

  it("completed items are never stale", () => {
    expect(isStale(mk({ status: "completed", due_date: daysAgo(5), due_confirmed: true }), NOW)).toBe(false);
  });
});

describe("nDaysForCadence", () => {
  it("maps cadence to N, defaulting to 14 for Ad hoc/unknown", () => {
    expect(nDaysForCadence("Weekly")).toBe(7);
    expect(nDaysForCadence("Biweekly")).toBe(14);
    expect(nDaysForCadence("Monthly")).toBe(30);
    expect(nDaysForCadence("Ad hoc")).toBe(14);
    expect(nDaysForCadence(null)).toBe(14);
  });
});

describe("staleSince", () => {
  it("returns the due date when overdue, the last-touched date when untouched-stale", () => {
    expect(staleSince(mk({ due_date: daysAgo(2), due_confirmed: true }), NOW)).toBe(daysAgo(2));
    expect(staleSince(mk({ last_touched: daysAgo(20), interval_days: 7 }), NOW)).toBe(daysAgo(20));
    expect(staleSince(mk({ last_touched: daysAgo(1) }), NOW)).toBeNull();
  });
});

describe("escalation: snooze + back-off + form", () => {
  it("a snooze in the future suppresses surfacing", () => {
    expect(isSnoozed({ escalation: 0, snooze_until: daysAhead(2), last_surfaced: null }, NOW)).toBe(true);
    expect(isSnoozed({ escalation: 0, snooze_until: daysAgo(1), last_surfaced: null }, NOW)).toBe(false);
  });

  it("back-off interval grows with escalation level", () => {
    expect(backoffInterval(0)).toBeLessThan(backoffInterval(3));
  });

  it("an item surfaced last open is NOT eligible the immediately-following open", () => {
    const state: ItemState = { escalation: 0, snooze_until: null, last_surfaced: 5 };
    expect(surfaceEligible(state, 6)).toBe(false); // backoff(0)=2, 6-5=1 < 2 -> backed off
    expect(surfaceEligible(state, 7)).toBe(true); // 7-5=2 >= 2 -> eligible
  });

  it("a never-surfaced item is eligible immediately", () => {
    expect(surfaceEligible({ escalation: 0, snooze_until: null, last_surfaced: null }, 3)).toBe(true);
  });

  it("escalation form varies (plain -> question -> consequence), never louder", () => {
    expect(escalationForm(0)).toBe("plain");
    expect(escalationForm(1)).toBe("question");
    expect(escalationForm(2)).toBe("consequence");
  });
});

describe("sweepEngine", () => {
  it("surfaces a never-seen stale item as plain, sets last_surfaced", () => {
    const res = sweepEngine(["k1"], {}, 1, NOW);
    expect(res.surfaced.k1.form).toBe("plain");
    expect(res.item_state.k1.last_surfaced).toBe(1);
    expect(res.item_state.k1.escalation).toBe(0);
  });

  it("escalates an ignored item one step when it resurfaces", () => {
    // surfaced at open 1; back-off(0)=2 so eligible again at open 3 -> escalates
    const first = sweepEngine(["k1"], {}, 1, NOW);
    const skipped = sweepEngine(["k1"], first.item_state, 2, NOW); // backed off, not surfaced
    expect(skipped.surfaced.k1).toBeUndefined();
    const second = sweepEngine(["k1"], skipped.item_state, 3, NOW);
    expect(second.item_state.k1.escalation).toBe(1);
    expect(second.surfaced.k1.form).toBe("question");
  });

  it("does not surface a snoozed item", () => {
    const state = { k1: { escalation: 0, snooze_until: daysAhead(2), last_surfaced: null } };
    const res = sweepEngine(["k1"], state, 5, NOW);
    expect(res.surfaced.k1).toBeUndefined();
  });
});
