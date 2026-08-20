import tapBattle from "./tap-battle";
import type { MinigameDef } from "./types";

/**
 * ミニゲームの登録簿（CLAUDE.md セクション7）。
 * 新しいミニゲームは src/minigames/{id}/index.tsx を作り、
 * **この配列に足すだけ**で動くこと。他のファイルは変更しない。
 */
export const MINIGAMES: readonly MinigameDef[] = [tapBattle];

/** ID から定義を引く。未登録なら null。 */
export function findMinigame(id: string | null | undefined): MinigameDef | null {
  if (!id) return null;
  return MINIGAMES.find((game) => game.id === id) ?? null;
}

/**
 * ミニゲームを1本選ぶ。
 * 乱数はホストが生成するので、0以上1未満の値を引数で受け取る
 * （CLAUDE.md セクション3）。
 */
export function pickMinigame(random: number): MinigameDef | null {
  if (MINIGAMES.length === 0) return null;
  const index = Math.min(
    MINIGAMES.length - 1,
    Math.floor(random * MINIGAMES.length),
  );
  return MINIGAMES[index] ?? null;
}
