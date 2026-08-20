import { describe, expect, it } from "vitest";
import { computeRewards, rewardFor } from "./reward";

describe("rewardFor", () => {
  it("通常は 1位+10 / 2位+5 / 3位+2 / 4位0", () => {
    expect([0, 1, 2, 3].map((i) => rewardFor(i, false))).toEqual([10, 5, 2, 0]);
  });

  it("minigame マスなら2倍 1位+20 / 2位+10 / 3位+4 / 4位0", () => {
    expect([0, 1, 2, 3].map((i) => rewardFor(i, true))).toEqual([20, 10, 4, 0]);
  });

  it("表にない順位は0", () => {
    expect(rewardFor(4, false)).toBe(0);
    expect(rewardFor(-1, true)).toBe(0);
  });
});

describe("computeRewards", () => {
  it("順位表から uid ごとの報酬を作る", () => {
    const rewards = computeRewards(["a", "b", "c"], new Set());
    expect(rewards).toEqual({ a: 10, b: 5, c: 2 });
  });

  it("2倍対象の人だけ報酬が倍になる", () => {
    const rewards = computeRewards(["a", "b", "c"], new Set(["b"]));
    expect(rewards).toEqual({ a: 10, b: 10, c: 2 });
  });

  it("2人だけでも1位2位の報酬が出る", () => {
    expect(computeRewards(["x", "y"], new Set())).toEqual({ x: 10, y: 5 });
  });
});
