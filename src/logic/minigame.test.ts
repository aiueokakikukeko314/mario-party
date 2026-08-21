import { describe, expect, it } from "vitest";
import {
  assignTeams,
  ffaReward,
  supportsPlayerCount,
  teamRewards,
  teamTotals,
} from "./minigame";
import { TEAM_DRAW_COINS, TEAM_WIN_COINS } from "../constants";

const FOUR = ["a", "b", "c", "d"];

describe("チーム分け", () => {
  it("ffa はチーム無し", () => {
    expect(assignTeams(FOUR, "ffa")).toEqual({});
  });

  it("2vs2 は手番順で交互に分かれる", () => {
    expect(assignTeams(FOUR, "twoVsTwo")).toEqual({ a: 0, b: 1, c: 0, d: 1 });
  });

  it("1vs3 は1人だけ別チーム", () => {
    const teams = assignTeams(FOUR, "oneVsThree", 2);
    expect(teams["c"]).toBe(0);
    expect(teams["a"]).toBe(1);
    expect(Object.values(teams).filter((t) => t === 0)).toHaveLength(1);
  });

  it("人数に合わない形式は使わない", () => {
    expect(supportsPlayerCount("twoVsTwo", 3)).toBe(false);
    expect(supportsPlayerCount("oneVsThree", 2)).toBe(false);
    expect(supportsPlayerCount("twoVsTwo", 4)).toBe(true);
    expect(supportsPlayerCount("ffa", 2)).toBe(true);
  });
});

describe("報酬", () => {
  it("個人戦は 1位+10 / 2位+5 / 3位+2 / 4位0", () => {
    expect([0, 1, 2, 3].map((i) => ffaReward(i, false))).toEqual([10, 5, 2, 0]);
  });

  it("倍率がかかる（ラストスパート）", () => {
    expect(ffaReward(0, false, 2)).toBe(20);
  });

  it("チームの合計が出る", () => {
    const teams = { a: 0, b: 1, c: 0, d: 1 };
    expect(teamTotals(teams, { a: 3, b: 1, c: 4, d: 1 })).toEqual({ 0: 7, 1: 2 });
  });

  it("勝ったチーム全員がもらう", () => {
    const teams = { a: 0, b: 1, c: 0, d: 1 };
    const rewards = teamRewards(teams, { a: 5, c: 5, b: 1, d: 1 }, true, "twoVsTwo");
    expect(rewards["a"]).toBe(TEAM_WIN_COINS);
    expect(rewards["c"]).toBe(TEAM_WIN_COINS);
    expect(rewards["b"]).toBe(0);
  });

  it("小さいほど良いゲームでは逆になる", () => {
    const teams = { a: 0, b: 1, c: 0, d: 1 };
    const rewards = teamRewards(teams, { a: 1, c: 1, b: 9, d: 9 }, false, "twoVsTwo");
    expect(rewards["a"]).toBe(TEAM_WIN_COINS);
    expect(rewards["b"]).toBe(0);
  });

  it("引き分けは両チームに入る", () => {
    const teams = { a: 0, b: 1 };
    const rewards = teamRewards(teams, { a: 3, b: 3 }, true, "twoVsTwo");
    expect(rewards["a"]).toBe(TEAM_DRAW_COINS);
    expect(rewards["b"]).toBe(TEAM_DRAW_COINS);
  });

  it("1vs3 は1人側が勝つと多くもらえる", () => {
    const teams = { a: 0, b: 1, c: 1, d: 1 };
    const solo = teamRewards(teams, { a: 10, b: 1, c: 1, d: 1 }, true, "oneVsThree");
    expect(solo["a"]).toBeGreaterThan(solo["b"] ?? 0);
  });
});
