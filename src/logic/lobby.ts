import type { ColorIdx, Player } from "../types";
import { MAX_PLAYERS, MIN_PLAYERS } from "../constants";

/**
 * ロビーに関する純関数（CLAUDE.md セクション10: React 非依存）。
 */

/** order 昇順に並べたプレイヤー一覧。同着は uid で安定化する。 */
export function sortPlayers(
  players: Record<string, Player>,
): { uid: string; player: Player }[] {
  return Object.entries(players)
    .map(([uid, player]) => ({ uid, player }))
    .sort((a, b) =>
      a.player.order !== b.player.order
        ? a.player.order - b.player.order
        : a.uid.localeCompare(b.uid),
    );
}

/**
 * 空いている席番号（0..MAX_PLAYERS-1）のうち最小のものを返す。
 * 満員なら null。colorIdx と order の両方にこの番号を使うので、
 * 途中で誰かが抜けても番号が衝突しない。
 */
export function pickFreeSlot(players: Record<string, Player>): ColorIdx | null {
  const used = new Set<number>();
  for (const player of Object.values(players)) {
    used.add(player.colorIdx);
    used.add(player.order);
  }
  for (let slot = 0; slot < MAX_PLAYERS; slot++) {
    if (!used.has(slot)) return slot as ColorIdx;
  }
  return null;
}

/** ゲームを開始できるか（ホストのみが呼ぶ想定）。 */
export function canStartGame(players: Record<string, Player>): boolean {
  return Object.keys(players).length >= MIN_PLAYERS;
}
