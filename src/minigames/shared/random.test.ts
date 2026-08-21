import { describe, expect, it } from "vitest";
import { hashStep, pickFrom } from "./random";

describe("決定的な擬似乱数", () => {
  it("同じ入力からは必ず同じ値が出る（全端末で同じ配置になる）", () => {
    for (let step = 0; step < 50; step++) {
      expect(hashStep(step, 7)).toBe(hashStep(step, 7));
      expect(pickFrom(step, 7, 9)).toBe(pickFrom(step, 7, 9));
    }
  });

  it("step が違えば値も変わる", () => {
    const values = new Set(
      Array.from({ length: 200 }, (_, step) => hashStep(step, 1)),
    );
    expect(values.size).toBeGreaterThan(190);
  });

  it("salt が違えば値も変わる", () => {
    expect(hashStep(5, 1)).not.toBe(hashStep(5, 2));
  });

  it("pickFrom は必ず 0 以上 max 未満", () => {
    for (let step = 0; step < 500; step++) {
      const value = pickFrom(step, 3, 9);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(9);
    }
  });

  it("偏りが極端でない（9マスに散る）", () => {
    const counts = new Array<number>(9).fill(0);
    for (let step = 0; step < 900; step++) {
      const index = pickFrom(step, 11, 9);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(40); // 均等なら100
    }
  });

  it("max が 0 以下でも落ちない", () => {
    expect(pickFrom(1, 1, 0)).toBe(0);
  });
});
