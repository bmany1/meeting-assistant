import { describe, it, expect } from "vitest";
import { fmtDate } from "../../meeting-assistant";

// Local noon so the calendar day/year cannot slip across a UTC boundary.
const REF = new Date("2026-06-20T12:00:00"); // current-year reference

describe("fmtDate year-awareness (R10 / AE6)", () => {
  it("a current-year date shows month and day only", () => {
    expect(fmtDate("2026-03-05T12:00:00", REF)).toBe("Mar 5");
    expect(fmtDate("2026-12-31T12:00:00", REF)).toBe("Dec 31");
  });

  it("a prior-year date includes its year", () => {
    expect(fmtDate("2025-12-31T12:00:00", REF)).toBe("Dec 31, 2025");
    expect(fmtDate("2024-01-01T12:00:00", REF)).toBe("Jan 1, 2024");
  });

  it("a future-year date includes its year", () => {
    expect(fmtDate("2027-01-15T12:00:00", REF)).toBe("Jan 15, 2027");
  });

  it("null or invalid input returns an empty string", () => {
    expect(fmtDate(null, REF)).toBe("");
    expect(fmtDate("not-a-date", REF)).toBe("");
  });

  it("defaults the reference to now, so a current-real-year date carries no year", () => {
    const nowYear = new Date().getFullYear();
    expect(fmtDate(`${nowYear}-07-04T12:00:00`)).toBe("Jul 4");
  });
});
