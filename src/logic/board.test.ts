import { describe, expect, it } from "vitest";
import {
  applyDice,
  applySquareEffect,
  BOARD,
  BOARD_SIZE,
  COIN_DELTA,
  hasMinigameBonus,
  squareAt,
  STAR_COST,
  stepPath,
  type PlayersState,
} from "./board";
import type { Player } from "../types";

function player(overrides: Partial<Player> = {}): Player {
  return {
    name: "テスト",
    colorIdx: 0,
    order: 0,
    coins: 0,
    stars: 0,
    pos: 0,
    connected: true,
    lastSeen: 0,
    ...overrides,
  };
}

/** 指定の種類のマスの位置を1つ返す。 */
function posOf(type: (typeof BOARD)[number]): number {
  const index = BOARD.indexOf(type);
  if (index < 0) throw new Error(`${type} のマスが盤面にありません`);
  return index;
}

describe("盤面の定義", () => {
  it("24マスある", () => {
    expect(BOARD_SIZE).toBe(24);
  });

  it("必要なマス種別がすべて含まれる", () => {
    for (const type of ["plus", "minus", "star", "minigame", "warp", "empty"]) {
      expect(BOARD).toContain(type);
    }
  });

  it("squareAt はリング状に丸める", () => {
    expect(squareAt(BOARD_SIZE)).toBe(squareAt(0));
    expect(squareAt(BOARD_SIZE + 5)).toBe(squareAt(5));
    expect(squareAt(-1)).toBe(squareAt(BOARD_SIZE - 1));
  });
});

describe("applyDice", () => {
  it("出目のぶんだけ進む", () => {
    const before: PlayersState = { me: player({ pos: 0 }) };
    expect(applyDice(before, "me", 4)["me"]?.pos).toBe(4);
  });

  it("1周したら先頭に戻る", () => {
    const before: PlayersState = { me: player({ pos: BOARD_SIZE - 2 }) };
    expect(applyDice(before, "me", 5)["me"]?.pos).toBe(3);
  });

  it("元のオブジェクトを書き換えない", () => {
    const before: PlayersState = { me: player({ pos: 0 }) };
    applyDice(before, "me", 3);
    expect(before["me"]?.pos).toBe(0);
  });

  it("存在しない uid なら何もしない", () => {
    const before: PlayersState = { me: player() };
    expect(applyDice(before, "unknown", 3)).toBe(before);
  });
});

describe("applySquareEffect", () => {
  it("plus は +3 コイン", () => {
    const state: PlayersState = { me: player({ pos: posOf("plus"), coins: 5 }) };
    const { players, result } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(5 + COIN_DELTA);
    expect(result.coinDelta).toBe(COIN_DELTA);
  });

  it("minus は -3 コイン", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("minus"), coins: 10 }),
    };
    expect(applySquareEffect(state, "me", 0).players["me"]?.coins).toBe(7);
  });

  it("minus でコインは0未満にならない", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("minus"), coins: 1 }),
    };
    const { players, result } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(0);
    expect(result.coinDelta).toBe(-1);
  });

  it("star はコイン20枚でスター1つ", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("star"), coins: 25, stars: 1 }),
    };
    const { players } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(25 - STAR_COST);
    expect(players["me"]?.stars).toBe(2);
  });

  it("star はコインが足りなければ何も起きない", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("star"), coins: 19, stars: 0 }),
    };
    const { players } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(19);
    expect(players["me"]?.stars).toBe(0);
  });

  it("warp はホストが渡した位置へ移動する", () => {
    const state: PlayersState = { me: player({ pos: posOf("warp") }) };
    const { players, result } = applySquareEffect(state, "me", 7);
    expect(players["me"]?.pos).toBe(7);
    expect(result.movedTo).toBe(7);
  });

  it("warp の移動先もリング状に丸める", () => {
    const state: PlayersState = { me: player({ pos: posOf("warp") }) };
    expect(applySquareEffect(state, "me", BOARD_SIZE + 2).players["me"]?.pos).toBe(2);
  });

  it("minigame マスはこの時点では増減なし", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("minigame"), coins: 5 }),
    };
    const { players, result } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(5);
    expect(result.coinDelta).toBe(0);
    expect(result.type).toBe("minigame");
  });

  it("empty は何も起きない", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("empty"), coins: 5, stars: 1 }),
    };
    const { players } = applySquareEffect(state, "me", 0);
    expect(players["me"]?.coins).toBe(5);
    expect(players["me"]?.stars).toBe(1);
  });

  it("他のプレイヤーには影響しない", () => {
    const state: PlayersState = {
      me: player({ pos: posOf("plus"), coins: 0 }),
      other: player({ coins: 99 }),
    };
    expect(applySquareEffect(state, "me", 0).players["other"]?.coins).toBe(99);
  });
});

describe("hasMinigameBonus", () => {
  it("minigame マスの上ならボーナスあり", () => {
    expect(hasMinigameBonus(posOf("minigame"))).toBe(true);
  });
  it("それ以外はボーナスなし", () => {
    expect(hasMinigameBonus(posOf("plus"))).toBe(false);
  });
});

describe("stepPath", () => {
  it("通過するマスを順に返す", () => {
    expect(stepPath(0, 3)).toEqual([1, 2, 3]);
  });
  it("周回をまたぐ", () => {
    expect(stepPath(BOARD_SIZE - 2, 3)).toEqual([BOARD_SIZE - 1, 0, 1]);
  });
});
