import { describe, expect, it } from "vitest";
import { rankPlayers, winnersOf } from "./result";
import type { Player } from "../types";

const player = (over: Partial<Player>): Player => ({
  name: "p",
  colorIdx: 0,
  coins: 0,
  stars: 0,
  pos: 0,
  order: 0,
  connected: true,
  lastSeen: 0,
  ...over,
});

describe("rankPlayers", () => {
  it("スターが多い人が上", () => {
    const ranked = rankPlayers({
      a: player({ stars: 1, coins: 99, order: 0 }),
      b: player({ stars: 3, coins: 0, order: 1 }),
    });
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("スターが同じならコインで決まる", () => {
    const ranked = rankPlayers({
      a: player({ stars: 2, coins: 10, order: 0 }),
      b: player({ stars: 2, coins: 40, order: 1 }),
    });
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("スターもコインも同じなら同順位で、次は順位が飛ぶ", () => {
    const ranked = rankPlayers({
      a: player({ stars: 2, coins: 10, order: 0 }),
      b: player({ stars: 2, coins: 10, order: 1 }),
      c: player({ stars: 0, coins: 5, order: 2 }),
    });
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("完全同点の並びは手番順で安定する", () => {
    const ranked = rankPlayers({
      z: player({ stars: 1, coins: 1, order: 3 }),
      a: player({ stars: 1, coins: 1, order: 1 }),
    });
    expect(ranked.map((r) => r.uid)).toEqual(["a", "z"]);
  });

  it("4人ぶんを正しく並べる", () => {
    const ranked = rankPlayers({
      a: player({ stars: 0, coins: 30, order: 0 }),
      b: player({ stars: 2, coins: 5, order: 1 }),
      c: player({ stars: 1, coins: 60, order: 2 }),
      d: player({ stars: 2, coins: 40, order: 3 }),
    });
    expect(ranked.map((r) => r.uid)).toEqual(["d", "b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("空でも落ちない", () => {
    expect(rankPlayers({})).toEqual([]);
  });
});

describe("winnersOf", () => {
  it("1位が1人なら1人", () => {
    const ranked = rankPlayers({
      a: player({ stars: 3, order: 0 }),
      b: player({ stars: 1, order: 1 }),
    });
    expect(winnersOf(ranked).map((r) => r.uid)).toEqual(["a"]);
  });

  it("同点1位なら全員返る", () => {
    const ranked = rankPlayers({
      a: player({ stars: 2, coins: 7, order: 0 }),
      b: player({ stars: 2, coins: 7, order: 1 }),
      c: player({ stars: 0, order: 2 }),
    });
    expect(winnersOf(ranked).map((r) => r.uid)).toEqual(["a", "b"]);
  });
});
