import { describe, expect, test } from "bun:test";
import { readHeadPosition, snapHead } from "../src/components/shell/HelpLauncher";

describe("the floating help head", () => {
  test("a drag that ends on the left half rests on the left edge", () => {
    expect(snapHead(200, 450, 1440, 900).side).toBe("left");
    expect(snapHead(1300, 450, 1440, 900).side).toBe("right");
  });

  test("it never rests off screen", () => {
    const top = snapHead(1300, 5000, 1440, 900).ratio * 900;
    expect(top).toBeLessThanOrEqual(900 - 52 - 12);
    expect(snapHead(1300, -40, 1440, 900).ratio * 900).toBeGreaterThanOrEqual(12);
  });

  test("a saved position is remembered and a broken one falls back to the right side", () => {
    expect(readHeadPosition(JSON.stringify({ side: "left", ratio: 0.3 }))).toEqual({ side: "left", ratio: 0.3 });
    expect(readHeadPosition("not json").side).toBe("right");
    expect(readHeadPosition(null).side).toBe("right");
  });
});
