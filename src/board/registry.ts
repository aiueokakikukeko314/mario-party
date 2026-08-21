import { partyIsland } from "./boards/partyIsland";
import type { BoardDef } from "./types";

/** 使えるボードの一覧。新しいボードはここに足すだけ。 */
export const BOARDS: readonly BoardDef[] = [partyIsland];

export const DEFAULT_BOARD = partyIsland;

export function findBoard(id: string | null | undefined): BoardDef {
  if (!id) return DEFAULT_BOARD;
  return BOARDS.find((board) => board.id === id) ?? DEFAULT_BOARD;
}
