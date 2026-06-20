import { describe, it, expect } from "vitest";
import {
  fromDateInput,
  toDateInput,
  todayDateInput,
  isFutureDateInput,
  latestMeetingDate,
  fmtDate,
} from "../../meeting-assistant";

// Pure date helpers behind the meeting-date backfill (U2). The capture
// orchestrator that consumes them is an in-App closure exercised by the smoke
// test; the load-bearing conversions are unit-tested here.

describe("fromDateInput / toDateInput round-trip (KTD6, no off-by-one)", () => {
  it("a picked date round-trips to the same calendar day", () => {
    // Local-noon anchor keeps the stored date's calendar day equal to the pick,
    // where new Date('YYYY-MM-DD') (UTC midnight) would slip a day in -UTC zones.
    expect(toDateInput(fromDateInput("2026-06-20"))).toBe("2026-06-20");
    expect(toDateInput(fromDateInput("2026-01-01"))).toBe("2026-01-01");
    expect(toDateInput(fromDateInput("2025-12-31"))).toBe("2025-12-31");
  });
  it("fromDateInput produces a valid ISO and renders the picked day", () => {
    expect(Number.isNaN(new Date(fromDateInput("2026-06-20")).getTime())).toBe(false);
    expect(fmtDate(fromDateInput("2026-06-20"))).toContain("Jun 20");
  });
  it("empty / malformed input falls back to a valid ISO instant", () => {
    expect(Number.isNaN(new Date(fromDateInput("")).getTime())).toBe(false);
    expect(Number.isNaN(new Date(fromDateInput("not-a-date")).getTime())).toBe(false);
  });
});

describe("todayDateInput (local calendar day, not UTC)", () => {
  it("returns the local YYYY-MM-DD even late in the day", () => {
    // 11:59pm local on Jun 20 is the 21st in UTC for -offset zones; the helper
    // must report the LOCAL day so the default/max is not a future date.
    expect(todayDateInput(new Date(2026, 5, 20, 23, 59, 0))).toBe("2026-06-20");
    expect(todayDateInput(new Date(2026, 0, 1, 0, 1, 0))).toBe("2026-01-01");
  });
  it("the chosen date is the extraction anchor verbatim (R8 wiring)", () => {
    // The orchestrator sets ctx.today to the picked YYYY-MM-DD with no transform,
    // so relative-due inference resolves against the meeting's day. The picked
    // value survives a fromDateInput/toDateInput round-trip unchanged.
    const picked = "2026-06-13";
    expect(toDateInput(fromDateInput(picked))).toBe(picked);
  });
});

describe("isFutureDateInput (R3 / KTD4 guard)", () => {
  const now = new Date(2026, 5, 20, 9, 0, 0); // local Jun 20 2026, 9am
  it("rejects a date after today, accepts today and earlier", () => {
    expect(isFutureDateInput("2026-06-21", now)).toBe(true);
    expect(isFutureDateInput("2026-06-20", now)).toBe(false);
    expect(isFutureDateInput("2026-06-19", now)).toBe(false);
    expect(isFutureDateInput("2025-12-31", now)).toBe(false);
  });
});

describe("latestMeetingDate (R9 / AE5, last-met never regresses)", () => {
  const older = "2026-06-01T12:00:00.000Z";
  const newer = "2026-06-15T12:00:00.000Z";
  it("returns the existing date when the chosen date is older (no regression)", () => {
    expect(latestMeetingDate(newer, older)).toBe(newer);
  });
  it("returns the chosen date when it is newer", () => {
    expect(latestMeetingDate(older, newer)).toBe(newer);
  });
  it("returns the chosen date when there is no existing last-met", () => {
    expect(latestMeetingDate(null, older)).toBe(older);
  });
});
