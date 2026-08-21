import { describe, expect, it } from "vitest";
import { findMinigame, MINIGAMES, pickMinigame } from "./registry";

/**
 * 「registry.ts に足すだけで増やせる」という設計要件を固定するテスト
 * （CLAUDE.md セクション7）。
 */

describe("MINIGAMES", () => {
  it("3本が登録されている", () => {
    expect(MINIGAMES.map((game) => game.id)).toEqual([
      "tap-battle",
      "timing-stop",
      "reflex",
    ]);
  });

  it("ID が重複していない", () => {
    const ids = MINIGAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("どの定義も MinigameDef を満たしている", () => {
    for (const game of MINIGAMES) {
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.description.length).toBeGreaterThan(0);
      expect(game.durationMs).toBeGreaterThan(0);
      expect(typeof game.higherIsBetter).toBe("boolean");
      expect(typeof game.Component).toBe("function");
    }
  });
});

describe("findMinigame", () => {
  it("登録済みの ID を引ける", () => {
    for (const game of MINIGAMES) {
      expect(findMinigame(game.id)).toBe(game);
    }
  });

  it("未登録・null・undefined は null を返す", () => {
    expect(findMinigame("nope")).toBeNull();
    expect(findMinigame(null)).toBeNull();
    expect(findMinigame(undefined)).toBeNull();
  });
});

describe("pickMinigame", () => {
  it("0以上1未満のどの乱数でも登録済みの1本を返す", () => {
    for (let i = 0; i < 100; i++) {
      const picked = pickMinigame(i / 100);
      expect(picked).not.toBeNull();
      expect(MINIGAMES).toContain(picked);
    }
  });

  it("乱数の範囲によって全種類が選ばれる", () => {
    const picked = new Set(
      Array.from({ length: 300 }, (_, i) => pickMinigame(i / 300)?.id),
    );
    expect(picked).toEqual(new Set(MINIGAMES.map((game) => game.id)));
  });

  it("1.0 が来ても範囲外にならない", () => {
    expect(pickMinigame(1)).toBe(MINIGAMES[MINIGAMES.length - 1]);
  });
});
