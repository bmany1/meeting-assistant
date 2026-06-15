import { describe, it, expect } from "vitest";
import { isFocusValid, localDateString, buildFocusPrompt, type FocusCache } from "../../meeting-assistant";

const cache: FocusCache = { date: "2026-06-13", accept_marker: "acc_1", narrative: "Focus on the cutover.", built_at: "2026-06-13T08:00:00Z" };

describe("focus cache validity (AE4 cache half)", () => {
  it("returns the cached focus when same day and same accept marker (no recompute)", () => {
    expect(isFocusValid(cache, "2026-06-13", "acc_1")).toBe(true);
  });

  it("an accept (new marker) invalidates the cache -> recompute", () => {
    expect(isFocusValid(cache, "2026-06-13", "acc_2")).toBe(false);
  });

  it("a day-roll (new local date) invalidates the cache -> recompute", () => {
    expect(isFocusValid(cache, "2026-06-14", "acc_1")).toBe(false);
  });

  it("a missing cache is invalid", () => {
    expect(isFocusValid(null, "2026-06-13", "acc_1")).toBe(false);
  });
});

describe("localDateString", () => {
  it("formats a local YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 5, 7))).toBe("2026-06-07"); // month is 0-indexed -> June
  });
});

describe("buildFocusPrompt", () => {
  const top = [
    { text: "Send Priya the cutover plan", owner: "i_owe" as const, due: "Jun 14", project: "Atlas", slipping: false },
    { text: "Hear back from Maria", owner: "waiting_for" as const, due: null, project: "Hiring Q3", slipping: true },
  ];
  it("asks for consequence framing, not a rank restatement, and forbids em dashes", () => {
    const p = buildFocusPrompt(top, "2026-06-13");
    expect(p.toLowerCase()).toContain("consequence framing");
    expect(p.toLowerCase()).toContain("not a list");
    expect(p.toLowerCase()).toContain("do not restate the ranking");
    expect(p.toLowerCase()).toContain("no em dashes");
    expect(p).toContain("Send Priya the cutover plan");
  });
});
