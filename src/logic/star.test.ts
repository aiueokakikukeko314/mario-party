import { describe, expect, it } from "vitest";
import { applyStarPurchase, canBuyStar, pickNextStarNode } from "./star";
import { partyIsland } from "../board/boards/partyIsland";
import { STAR_COST } from "../constants";

describe("スター", () => {
  it("20コイン未満では買えない", () => {
    expect(canBuyStar(STAR_COST - 1)).toBe(false);
    const result = applyStarPurchase(STAR_COST - 1, 0);
    expect(result.bought).toBe(false);
    expect(result.coins).toBe(STAR_COST - 1);
    expect(result.stars).toBe(0);
  });

  it("20コインちょうどで買える", () => {
    const result = applyStarPurchase(STAR_COST, 1);
    expect(result.bought).toBe(true);
    expect(result.coins).toBe(0);
    expect(result.stars).toBe(2);
  });

  it("買うとコインが20減ってスターが1増える", () => {
    const result = applyStarPurchase(45, 2);
    expect(result.coins).toBe(25);
    expect(result.stars).toBe(3);
  });

  it("次のスターは今の位置に置かれない", () => {
    for (const current of partyIsland.starCandidates) {
      for (let i = 0; i < 30; i++) {
        expect(pickNextStarNode(partyIsland, current, null, i / 30)).not.toBe(current);
      }
    }
  });

  it("直前の位置も避ける", () => {
    const [a, b] = partyIsland.starCandidates;
    if (a === undefined || b === undefined) return;
    for (let i = 0; i < 30; i++) {
      const next = pickNextStarNode(partyIsland, a, b, i / 30);
      expect(next).not.toBe(a);
      expect(next).not.toBe(b);
    }
  });

  it("必ず候補の中から選ばれる", () => {
    for (let i = 0; i < 50; i++) {
      const next = pickNextStarNode(partyIsland, 2, 6, i / 50);
      expect(partyIsland.starCandidates).toContain(next);
    }
  });
});
