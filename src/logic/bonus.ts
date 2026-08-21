import { BONUS_AWARD_COUNT, BONUS_AWARD_STARS } from "../constants";
import type { BonusAward, Player, PlayerStats } from "../types";

/** 最終ボーナス賞の純関数。 */

export interface AwardDef {
  id: string;
  title: string;
  description: string;
  /** 大きいほど良い値を取り出す */
  valueOf: (stats: PlayerStats) => number;
}

export const AWARD_DEFS: readonly AwardDef[] = [
  {
    id: "minigame-king",
    title: "ミニゲーム王",
    description: "ミニゲームで いちばん コインを かせいだ人",
    valueOf: (s) => s.minigameCoins,
  },
  {
    id: "walk-king",
    title: "いどう王",
    description: "いちばん たくさん すすんだ人",
    valueOf: (s) => s.spacesMoved,
  },
  {
    id: "item-king",
    title: "アイテム王",
    description: "アイテムを いちばん つかった人",
    valueOf: (s) => s.itemsUsed,
  },
  {
    id: "shop-king",
    title: "おかいもの王",
    description: "ショップで いちばん つかった人",
    valueOf: (s) => s.shopSpent,
  },
  {
    id: "lucky-king",
    title: "ラッキー王",
    description: "ラッキーマスに いちばん とまった人",
    valueOf: (s) => s.luckyLanded,
  },
  {
    id: "event-king",
    title: "イベント王",
    description: "イベントマスに いちばん とまった人",
    valueOf: (s) => s.eventLanded,
  },
];

export const EMPTY_STATS: PlayerStats = {
  spacesMoved: 0,
  minigameWins: 0,
  minigameCoins: 0,
  coinsEarned: 0,
  coinsLost: 0,
  itemsUsed: 0,
  shopSpent: 0,
  luckyLanded: 0,
  unluckyLanded: 0,
  eventLanded: 0,
  starsBought: 0,
};

export function statsOf(player: Player | undefined): PlayerStats {
  return { ...EMPTY_STATS, ...(player?.stats ?? {}) };
}

/**
 * 賞をいくつか選ぶ。random は 0以上1未満の配列（ホストが生成）。
 * 同じ賞は選ばない。
 */
export function pickAwards(
  randoms: readonly number[],
  count: number = BONUS_AWARD_COUNT,
): AwardDef[] {
  const pool = [...AWARD_DEFS];
  const picked: AwardDef[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const random = randoms[i] ?? 0;
    const index = Math.min(pool.length - 1, Math.floor(random * pool.length));
    const [award] = pool.splice(index, 1);
    if (award) picked.push(award);
  }
  return picked;
}

/**
 * 賞ごとの受賞者を決める。
 * 値が0の人しかいない賞は「該当なし」（winners が空）にする。
 * 同率なら全員が受賞する。
 */
export function decideAward(
  award: AwardDef,
  players: Record<string, Player>,
): BonusAward {
  let best = 0;
  const winners: string[] = [];
  for (const [uid, player] of Object.entries(players)) {
    const value = award.valueOf(statsOf(player));
    if (value <= 0) continue;
    if (value > best) {
      best = value;
      winners.length = 0;
      winners.push(uid);
    } else if (value === best) {
      winners.push(uid);
    }
  }
  return {
    id: award.id,
    title: award.title,
    description: award.description,
    winners,
  };
}

export function decideAwards(
  awards: readonly AwardDef[],
  players: Record<string, Player>,
): BonusAward[] {
  return awards.map((award) => decideAward(award, players));
}

export const AWARD_STARS = BONUS_AWARD_STARS;
