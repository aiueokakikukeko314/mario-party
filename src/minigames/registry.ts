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

/** そのゲームの対戦形式。未指定は ffa。 */
export function modeOf(game: MinigameDef): "ffa" | "twoVsTwo" | "oneVsThree" {
  return game.mode ?? "ffa";
}

/**
 * ミニゲームを1本選ぶ。
 * 乱数はホストが生成するので 0以上1未満の値を受け取る（セクション3）。
 *
 * - `excludeIds` に直近のゲームを渡すと、それらを除いて選ぶ
 * - `playerCount` に対応していない形式のゲームは候補にしない
 */
export function pickMinigame(
  random: number,
  excludeIds: readonly string[] = [],
  playerCount = 4,
): MinigameDef | null {
  if (MINIGAMES.length === 0) return null;

  const playable = MINIGAMES.filter((game) =>
    supportsCount(modeOf(game), playerCount),
  );
  const base = playable.length > 0 ? playable : MINIGAMES;
  const filtered = base.filter((game) => !excludeIds.includes(game.id));
  const pool = filtered.length > 0 ? filtered : base;

  const index = Math.min(pool.length - 1, Math.floor(random * pool.length));
  return pool[index] ?? null;
}

function supportsCount(
  mode: "ffa" | "twoVsTwo" | "oneVsThree",
  count: number,
): boolean {
  if (mode === "twoVsTwo" || mode === "oneVsThree") return count === 4;
  return count >= 2;
}
