import { describe, expect, it } from "vitest";
import { buyBlockReason, rollStock, stockDefs } from "./shop";
import { findItem } from "../board/items/registry";
import { SHOP_STOCK_SIZE } from "../constants";

describe("ショップ", () => {
  it("同じ種からは必ず同じ品ぞろえになる", () => {
    for (let i = 0; i < 20; i++) {
      const seed = i / 20;
      expect(rollStock(seed)).toEqual(rollStock(seed));
    }
  });

  it("品ぞろえに重複が無い", () => {
    for (let i = 0; i < 50; i++) {
      const stock = rollStock(i / 50);
      expect(new Set(stock).size).toBe(stock.length);
      expect(stock).toHaveLength(SHOP_STOCK_SIZE);
    }
  });

  it("コインが足りなければ買えない", () => {
    const item = findItem("triple-dice");
    expect(item).not.toBeNull();
    expect(buyBlockReason("triple-dice", (item?.price ?? 0) - 1, {})).toBe("coins");
    expect(buyBlockReason("triple-dice", item?.price ?? 0, {})).toBeNull();
  });

  it("持ち物が満杯なら買えない", () => {
    const full = { slot0: "shield", slot1: "shield", slot2: "shield" };
    expect(buyBlockReason("shield", 999, full)).toBe("full");
  });

  it("知らない商品は買えない", () => {
    expect(buyBlockReason("bogus", 999, {})).toBe("unknown");
  });

  it("定義に変換できる", () => {
    expect(stockDefs(["shield", "bogus"]).map((i) => i.id)).toEqual(["shield"]);
  });
});
