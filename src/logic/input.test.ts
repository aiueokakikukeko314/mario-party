import { describe, expect, it } from "vitest";
import { isAcceptable, isPlausibleScore, rejectReason } from "./input";
import type { PlayerInput } from "../types";

const input = (over: Partial<PlayerInput> = {}): PlayerInput => ({
  seq: 5,
  actionId: "act-1",
  type: "roll",
  payload: null,
  ts: 0,
  ...over,
});

describe("入力の受理判定", () => {
  it("新しい seq は処理する", () => {
    expect(rejectReason(input({ seq: 5 }), 4)).toBeNull();
  });

  it("同じ seq は二重処理しない", () => {
    expect(rejectReason(input({ seq: 5 }), 5)).toBe("staleSeq");
  });

  it("古い seq は無視する（再接続後の遅延入力）", () => {
    expect(rejectReason(input({ seq: 3 }), 5)).toBe("staleSeq");
  });

  it("処理履歴が無ければ通す", () => {
    expect(rejectReason(input(), undefined)).toBeNull();
  });

  it("actionId が違う応答は無視する", () => {
    expect(rejectReason(input({ actionId: "old" }), 0, "current")).toBe("wrongAction");
    expect(rejectReason(input({ actionId: "current" }), 0, "current")).toBeNull();
  });

  it("知らない type は無視する", () => {
    const bad = { ...input(), type: "hack" } as unknown as PlayerInput;
    expect(rejectReason(bad, 0)).toBe("badType");
  });

  it("形が壊れていれば無視する", () => {
    expect(rejectReason(undefined, 0)).toBe("badShape");
    const noSeq = { ...input(), seq: "x" } as unknown as PlayerInput;
    expect(rejectReason(noSeq, 0)).toBe("badShape");
  });

  it("isAcceptable は判定を真偽で返す", () => {
    expect(isAcceptable(input({ seq: 9 }), 1)).toBe(true);
    expect(isAcceptable(input({ seq: 1 }), 9)).toBe(false);
  });
});

describe("スコアの妥当性", () => {
  it("現実的な数値だけ通す", () => {
    expect(isPlausibleScore(42)).toBe(true);
    expect(isPlausibleScore(0)).toBe(true);
    expect(isPlausibleScore(-50)).toBe(true);
  });

  it("極端な値・数値以外は弾く", () => {
    expect(isPlausibleScore(999999999)).toBe(false);
    expect(isPlausibleScore("100")).toBe(false);
    expect(isPlausibleScore(NaN)).toBe(false);
    expect(isPlausibleScore(null)).toBe(false);
  });
});
