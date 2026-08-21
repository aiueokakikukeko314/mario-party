import { describe, expect, it } from "vitest";
import {
  addItem,
  diceEffectOf,
  firstFreeSlot,
  hasSpace,
  inventoryCount,
  inventoryList,
  randomItemId,
  removeSlot,
} from "./items";
import { ITEMS } from "../board/items/registry";
import { INVENTORY_SIZE } from "../constants";

describe("持ち物", () => {
  it("3個までしか持てない", () => {
    let inv = {};
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const result = addItem(inv, "shield");
      expect(result.ok).toBe(true);
      inv = result.inventory;
    }
    expect(inventoryCount(inv)).toBe(INVENTORY_SIZE);
    expect(hasSpace(inv)).toBe(false);
    expect(addItem(inv, "shield").ok).toBe(false);
  });

  it("空きスロットの先頭から埋まる", () => {
    expect(firstFreeSlot({})).toBe("slot0");
    expect(firstFreeSlot({ slot0: "shield" })).toBe("slot1");
    expect(
      firstFreeSlot({ slot0: "shield", slot1: "reroll", slot2: "boost-die" }),
    ).toBeNull();
  });

  it("知らないアイテムは追加できない", () => {
    expect(addItem({}, "not-real").ok).toBe(false);
  });

  it("消したスロットは空く", () => {
    const inv = { slot0: "shield", slot1: "reroll" };
    const after = removeSlot(inv, "slot0");
    expect(after.slot0).toBeUndefined();
    expect(after.slot1).toBe("reroll");
  });

  it("壊れたIDは一覧に出ず、その枠は空きとして扱う", () => {
    expect(inventoryList({ slot0: "bogus" })).toEqual([]);
    expect(firstFreeSlot({ slot0: "bogus" })).toBe("slot0");
  });

  it("サイコロ系アイテムの効果", () => {
    expect(diceEffectOf("double-dice").count).toBe(2);
    expect(diceEffectOf("triple-dice").count).toBe(3);
    expect(diceEffectOf("boost-die").bonus).toBe(3);
    expect(diceEffectOf(null)).toEqual({ count: 1, bonus: 0 });
  });

  it("ランダム取得は必ず登録済みのID", () => {
    const ids = ITEMS.map((item) => item.id);
    for (let i = 0; i < 200; i++) {
      expect(ids).toContain(randomItemId(i / 200));
    }
  });
});
