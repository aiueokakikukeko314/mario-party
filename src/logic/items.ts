import { findItem, ITEMS, type ItemDef } from "../board/items/registry";
import { INVENTORY_SIZE } from "../constants";
import type { Inventory } from "../types";

/** 持ち物まわりの純関数。 */

export type SlotKey = "slot0" | "slot1" | "slot2";

export const SLOT_KEYS: readonly SlotKey[] = ["slot0", "slot1", "slot2"];

/** 持ち物を [slot, ItemDef] の配列にする。空きは含めない。 */
export function inventoryList(
  inventory: Inventory | undefined,
): { slot: SlotKey; item: ItemDef }[] {
  const list: { slot: SlotKey; item: ItemDef }[] = [];
  for (const slot of SLOT_KEYS) {
    const item = findItem(inventory?.[slot]);
    if (item) list.push({ slot, item });
  }
  return list;
}

export function inventoryCount(inventory: Inventory | undefined): number {
  return inventoryList(inventory).length;
}

export function hasSpace(inventory: Inventory | undefined): boolean {
  return inventoryCount(inventory) < INVENTORY_SIZE;
}

/** 空いている最初のスロット。満杯なら null。 */
export function firstFreeSlot(
  inventory: Inventory | undefined,
): SlotKey | null {
  for (const slot of SLOT_KEYS) {
    if (!findItem(inventory?.[slot])) return slot;
  }
  return null;
}

/** アイテムを1つ加える。満杯なら追加せずに ok:false。 */
export function addItem(
  inventory: Inventory | undefined,
  itemId: string,
): { ok: boolean; inventory: Inventory } {
  const current: Inventory = { ...(inventory ?? {}) };
  if (!findItem(itemId)) return { ok: false, inventory: current };
  const slot = firstFreeSlot(current);
  if (slot === null) return { ok: false, inventory: current };
  current[slot] = itemId;
  return { ok: true, inventory: current };
}

/** スロットを空にする。 */
export function removeSlot(
  inventory: Inventory | undefined,
  slot: SlotKey,
): Inventory {
  const current: Inventory = { ...(inventory ?? {}) };
  delete current[slot];
  return current;
}

/** ランダムに1つ選ぶ。random は 0以上1未満。 */
export function randomItemId(random: number): string {
  const index = Math.min(ITEMS.length - 1, Math.floor(random * ITEMS.length));
  return ITEMS[index]?.id ?? "shield";
}

/** サイコロを何個ふるか・出目にいくつ足すか。 */
export function diceEffectOf(itemId: string | null): {
  count: number;
  bonus: number;
} {
  const item = findItem(itemId);
  return { count: item?.diceCount ?? 1, bonus: item?.diceBonus ?? 0 };
}
