import { describe, expect, it } from "vitest";
import { AWARD_DEFS, decideAward, EMPTY_STATS, pickAwards, statsOf } from "./bonus";
import type { Player, PlayerStats } from "../types";

const player = (stats: Partial<PlayerStats>, order = 0): Player => ({
  name: "p",
  colorIdx: 0,
  coins: 0,
  stars: 0,
  pos: 0,
  order,
  connected: true,
  lastSeen: 0,
  stats: { ...EMPTY_STATS, ...stats },
});

const award = (id: string) => {
  const found = AWARD_DEFS.find((a) => a.id === id);
  if (!found) throw new Error(`no award ${id}`);
  return found;
};

describe("ボーナス賞", () => {
  it("いちばん多い人が受賞する", () => {
    const result = decideAward(award("walk-king"), {
      a: player({ spacesMoved: 10 }),
      b: player({ spacesMoved: 25 }, 1),
      c: player({ spacesMoved: 3 }, 2),
    });
    expect(result.winners).toEqual(["b"]);
  });

  it("同率なら全員が受賞する", () => {
    const result = decideAward(award("item-king"), {
      a: player({ itemsUsed: 4 }),
      b: player({ itemsUsed: 4 }, 1),
      c: player({ itemsUsed: 1 }, 2),
    });
    expect(result.winners).toEqual(["a", "b"]);
  });

  it("全員0なら該当なし", () => {
    const result = decideAward(award("shop-king"), {
      a: player({}),
      b: player({}, 1),
    });
    expect(result.winners).toEqual([]);
  });

  it("賞は重複せずに選ばれる", () => {
    const picked = pickAwards([0.1, 0.5, 0.9], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((a) => a.id)).size).toBe(3);
  });

  it("賞の数が定義数を超えても落ちない", () => {
    expect(pickAwards([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 99).length)
      .toBe(AWARD_DEFS.length);
  });

  it("stats が無いプレイヤーでも0扱いになる", () => {
    const bare: Player = {
      name: "x", colorIdx: 0, coins: 0, stars: 0, pos: 0,
      order: 0, connected: true, lastSeen: 0,
    };
    expect(statsOf(bare)).toEqual(EMPTY_STATS);
  });
});
