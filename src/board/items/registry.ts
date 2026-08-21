/**
 * アイテム定義。追加はこの配列に足すだけ。
 * 名称・効果はすべてオリジナル。
 */

export type ItemTarget = "self" | "player" | "board";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  target: ItemTarget;
  /** サイコロを振る個数を変える（未指定なら1個） */
  diceCount?: number;
  /** 出目に足す */
  diceBonus?: number;
}

export const ITEMS: readonly ItemDef[] = [
  {
    id: "boost-die",
    name: "ブーストダイス",
    icon: "🚀",
    description: "サイコロの目に +3 される",
    price: 6,
    target: "self",
    diceBonus: 3,
  },
  {
    id: "double-dice",
    name: "ツインダイス",
    icon: "🎲",
    description: "サイコロを2個ふって合計ぶん進む",
    price: 8,
    target: "self",
    diceCount: 2,
  },
  {
    id: "triple-dice",
    name: "トリプルダイス",
    icon: "🎰",
    description: "サイコロを3個ふって合計ぶん進む",
    price: 14,
    target: "self",
    diceCount: 3,
  },
  {
    id: "reroll",
    name: "ふりなおし",
    icon: "🔄",
    description: "出た目が気に入らなければ1回ふり直す",
    price: 5,
    target: "self",
  },
  {
    id: "warp-ticket",
    name: "ワープきっぷ",
    icon: "🎫",
    description: "えらんだ人のいる場所へ move する",
    price: 10,
    target: "player",
  },
  {
    id: "swap-ticket",
    name: "いれかえきっぷ",
    icon: "🔀",
    description: "えらんだ人と場所を入れかえる",
    price: 12,
    target: "player",
  },
  {
    id: "coin-magnet",
    name: "コインマグネット",
    icon: "🧲",
    description: "えらんだ人から 5 コインもらう",
    price: 7,
    target: "player",
  },
  {
    id: "shield",
    name: "まもりのおまもり",
    icon: "🛡️",
    description: "次にコインが減る効果を1回だけ防ぐ",
    price: 6,
    target: "self",
  },
] as const;

export function findItem(id: string | null | undefined): ItemDef | null {
  if (!id) return null;
  return ITEMS.find((item) => item.id === id) ?? null;
}
