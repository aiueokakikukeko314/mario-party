import { findItem, ITEMS, type ItemDef } from "../board/items/registry";
import { hasSpace } from "./items";
import { SHOP_STOCK_SIZE } from "../constants";
import type { Inventory } from "../types";

/** ショップの純関数。品ぞろえの抽選と購入可否。 */

/**
 * 品ぞろえを決める。random は 0以上1未満を1つ渡し、そこから決定的に選ぶので
 * 全端末で同じ並びになる（ホストが保存した値を使う）。
 */
export function rollStock(
  random: number,
  size: number = SHOP_STOCK_SIZE,
): string[] {
  const pool = ITEMS.map((item) => item.id);

  // random を種にした線形合同法。同じ種なら必ず同じ品ぞろえになる。
  // 下位ビットは周期が極端に短く同じ値ばかり出るので、上位ビットだけ使う。
  let state = (Math.floor(random * 0x7fffffff) + 1) & 0x7fffffff;
  const nextInt = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state >>> 8;
  };

  // シャッフルしてから先頭を取る。必ず有限回で終わり、重複も出ない
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = nextInt() % (i + 1);
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return shuffled.slice(0, Math.max(0, Math.min(size, pool.length)));
}

export type BuyBlockReason = "coins" | "full" | "unknown" | null;

/** 買えない理由。買えるなら null。 */
export function buyBlockReason(
  itemId: string,
  coins: number,
  inventory: Inventory | undefined,
): BuyBlockReason {
  const item = findItem(itemId);
  if (!item) return "unknown";
  if (!hasSpace(inventory)) return "full";
  if (coins < item.price) return "coins";
  return null;
}

export function stockDefs(stock: readonly string[]): ItemDef[] {
  return stock
    .map((id) => findItem(id))
    .filter((item): item is ItemDef => item !== null);
}
