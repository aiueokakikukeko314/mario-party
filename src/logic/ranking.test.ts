import { describe, expect, it } from "vitest";
import { computeRanking } from "./ranking";

const UIDS = ["a", "b", "c", "d"];

describe("computeRanking", () => {
  it("higherIsBetter=true はスコアが大きい順", () => {
    const ranking = computeRanking(UIDS, { a: 3, b: 10, c: 7, d: 1 }, true);
    expect(ranking).toEqual(["b", "c", "a", "d"]);
  });

  it("higherIsBetter=false はスコアが小さい順", () => {
    const ranking = computeRanking(UIDS, { a: 3, b: 10, c: 7, d: 1 }, false);
    expect(ranking).toEqual(["d", "a", "c", "b"]);
  });

  it("同点は手番順で決まる", () => {
    const ranking = computeRanking(UIDS, { a: 5, b: 5, c: 5, d: 5 }, true);
    expect(ranking).toEqual(["a", "b", "c", "d"]);
  });

  it("スコアが無い人は最下位になる（higherIsBetter=true）", () => {
    const ranking = computeRanking(UIDS, { a: 1, c: 9 }, true);
    expect(ranking).toEqual(["c", "a", "b", "d"]);
  });

  it("スコアが無い人は最下位になる（higherIsBetter=false）", () => {
    // 0 を代入する実装だと未報告者が1位になってしまうケース
    const ranking = computeRanking(UIDS, { a: 120, c: 40 }, false);
    expect(ranking).toEqual(["c", "a", "b", "d"]);
  });

  it("スコアが1件も無ければ手番順のまま", () => {
    expect(computeRanking(UIDS, undefined, true)).toEqual(UIDS);
  });

  it("2人でも動く", () => {
    expect(computeRanking(["x", "y"], { x: 2, y: 8 }, true)).toEqual(["y", "x"]);
  });
});
