import { describe, expect, it } from "vitest";
import { distributePoints, totalPoints, units } from "./points";

describe("exact exam points", () => {
  it("sums beyond floating point precision", () => {
    expect(totalPoints(["99999999999999999999.1234567891", "0.1234567891"])).toBe(
      "99999999999999999999.2469135782",
    );
    expect(totalPoints([])).toBe("0");
  });
  it("distributes remainder deterministically without changing the total", () => {
    expect(distributePoints("10", 40)).toEqual(Array(40).fill("0.25"));
    expect(distributePoints("1", 3)).toEqual(["0.3333333334", "0.3333333333", "0.3333333333"]);
    expect(totalPoints(distributePoints("99999999999999999999.1234567891", 7))).toBe(
      "99999999999999999999.1234567891",
    );
  });
  it.each(["0", "-1", "NaN", "1e2", "0.00000000001", "100000000000000000000", "1,5", ""])(
    "rejects invalid points %s",
    (value) => {
      expect(() => units(value)).toThrow();
    },
  );
  it("rejects zero-point allocations", () => {
    expect(() => distributePoints("0.0000000001", 2)).toThrow();
    expect(() => distributePoints("1", 0)).toThrow();
  });
});
