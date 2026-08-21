import balloon from "./balloon";
import cupShuffle from "./cup-shuffle";
import dodge from "./dodge";
import iceStop from "./ice-stop";
import justStop from "./just-stop";
import memoryTouch from "./memory-touch";
import oddOne from "./odd-one";
import reflex from "./reflex";
import tapBattle from "./tap-battle";
import timingStop from "./timing-stop";
import whackMole from "./whack-mole";
import type { MinigameDef } from "./types";

/**
 * ミニゲームの登録簿（CLAUDE.md セクション7）。
 * 新しいミニゲームは src/minigames/{id}/index.tsx を作り、
 * **この配列に足すだけ**で動くこと。他のファイルは変更しない。
 */
export const MINIGAMES: readonly MinigameDef[] = [
  tapBattle,
  timingStop,
  reflex,
  whackMole,
  cupShuffle,
  memoryTouch,
  iceStop,
  justStop,
  dodge,
  oddOne,
  balloon,
];

/** ID から定義を引く。未登録なら null。 */
export function findMinigame(id: string | null | undefined): MinigameDef | null {
  if (!id) return null;
  return MINIGAMES.find((game) => game.id === id) ?? null;
}

/**
 * ミニゲームを1本選ぶ。
 * 乱数はホストが生成するので、0以上1未満の値を引数で受け取る
 * （CLAUDE.md セクション3）。
 *
 * `excludeId` に直前のゲームを渡すと、それを除いて選ぶ。
 * 同じゲームが2ターン続けて出るのを防ぐため。
 */
export function pickMinigame(
  random: number,
  excludeId?: string | null,
): MinigameDef | null {
  if (MINIGAMES.length === 0) return null;
  const filtered = MINIGAMES.filter((game) => game.id !== excludeId);
  // 除外すると空になる場合（登録が1本だけ）は全体から選ぶ
  const pool = filtered.length > 0 ? filtered : MINIGAMES;
  const index = Math.min(pool.length - 1, Math.floor(random * pool.length));
  return pool[index] ?? null;
}
