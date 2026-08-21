import { describe, expect, it } from "vitest";
import { partyIsland } from "../board/boards/partyIsland";
import { BOARDS } from "../board/registry";
import {
  clampCoins,
  isBranch,
  isLegalStep,
  nextOf,
  nodeAt,
  stepFrom,
  totalOf,
  validateBoard,
} from "./board";
import type { BoardDef } from "../board/types";

describe("ボード定義の健全性", () => {
  it("登録されている全ボードに行き止まり・不正な接続が無い", () => {
    for (const board of BOARDS) {
      expect(validateBoard(board)).toEqual([]);
    }
  });

  it("行き止まりを検出できる", () => {
    const broken: BoardDef = {
      id: "x", name: "x", startNodeId: 0, starCandidates: [],
      nodes: [{ id: 0, x: 0, y: 0, type: "start", next: [] }],
    };
    expect(validateBoard(broken)).toContain("0 が行き止まり");
  });

  it("存在しない接続先を検出できる", () => {
    const broken: BoardDef = {
      id: "x", name: "x", startNodeId: 0, starCandidates: [],
      nodes: [{ id: 0, x: 0, y: 0, type: "start", next: [99] }],
    };
    expect(validateBoard(broken)).toContain("0 → 99 は存在しない");
  });

  it("スター候補は必ず存在するノードを指す", () => {
    const ids = new Set(partyIsland.nodes.map((n) => n.id));
    for (const candidate of partyIsland.starCandidates) {
      expect(ids.has(candidate)).toBe(true);
    }
  });

  it("本道をたどると必ずスタートへ戻る（ループしている）", () => {
    let pos = partyIsland.startNodeId;
    for (let i = 0; i < 24; i++) pos = stepFrom(partyIsland, pos);
    expect(pos).toBe(partyIsland.startNodeId);
  });
});

describe("分岐", () => {
  it("4番と16番が分岐点になっている", () => {
    expect(isBranch(partyIsland, 4)).toBe(true);
    expect(isBranch(partyIsland, 16)).toBe(true);
  });

  it("分岐でない場所は1本道", () => {
    expect(isBranch(partyIsland, 0)).toBe(false);
    expect(nextOf(partyIsland, 0)).toEqual([1]);
  });

  it("近道を選ぶと本道を飛ばして合流する", () => {
    let pos = stepFrom(partyIsland, 4, 24);
    expect(pos).toBe(24);
    pos = stepFrom(partyIsland, pos);
    pos = stepFrom(partyIsland, pos);
    pos = stepFrom(partyIsland, pos);
    expect(pos).toBe(12); // 26 の次が本道12へ合流
  });

  it("不正なルート指定は拒否され、既定の1本目に進む", () => {
    expect(isLegalStep(partyIsland, 4, 99)).toBe(false);
    expect(stepFrom(partyIsland, 4, 99)).toBe(5);
  });

  it("正しいルート指定は許可される", () => {
    expect(isLegalStep(partyIsland, 4, 24)).toBe(true);
    expect(isLegalStep(partyIsland, 4, 5)).toBe(true);
  });
});

describe("小さな純関数", () => {
  it("コインは0未満にならない", () => {
    expect(clampCoins(-10)).toBe(0);
    expect(clampCoins(0)).toBe(0);
    expect(clampCoins(7)).toBe(7);
  });

  it("サイコロの合計", () => {
    expect(totalOf([3])).toBe(3);
    expect(totalOf([1, 6, 2])).toBe(9);
    expect(totalOf([])).toBe(0);
  });

  it("存在しないノードは null", () => {
    expect(nodeAt(partyIsland, 999)).toBeNull();
  });
});
