import type { BoardDef, BoardNode } from "../board/types";
import type { Player } from "../types";

/**
 * ボードの純関数（CLAUDE.md セクション8）。
 * React にも Firebase にも依存しない。乱数はここでは作らず、
 * ホストが生成した値を引数で受け取る（セクション3）。
 */

export type PlayersState = Record<string, Player>;

/** ノードを引く。無ければ null。 */
export function nodeAt(board: BoardDef, id: number): BoardNode | null {
  return board.nodes.find((node) => node.id === id) ?? null;
}

/** そのノードから進める先。 */
export function nextOf(board: BoardDef, id: number): number[] {
  return nodeAt(board, id)?.next ?? [];
}

/** 分岐（進める先が2つ以上）か。 */
export function isBranch(board: BoardDef, id: number): boolean {
  return nextOf(board, id).length >= 2;
}

/**
 * ボード定義が壊れていないか調べる。
 * 行き止まり・存在しない接続先があれば理由を返す。問題なければ空配列。
 */
export function validateBoard(board: BoardDef): string[] {
  const problems: string[] = [];
  const ids = new Set(board.nodes.map((node) => node.id));

  if (ids.size !== board.nodes.length) problems.push("id が重複している");
  if (!ids.has(board.startNodeId)) problems.push("startNodeId が存在しない");

  for (const node of board.nodes) {
    if (node.next.length === 0) problems.push(`${node.id} が行き止まり`);
    for (const next of node.next) {
      if (!ids.has(next)) problems.push(`${node.id} → ${next} は存在しない`);
      if (next === node.id) problems.push(`${node.id} が自分自身を指している`);
    }
    if (new Set(node.next).size !== node.next.length) {
      problems.push(`${node.id} の next が重複している`);
    }
    if (node.warpTo !== undefined && !ids.has(node.warpTo)) {
      problems.push(`${node.id} の warpTo が存在しない`);
    }
  }
  for (const candidate of board.starCandidates) {
    if (!ids.has(candidate)) problems.push(`スター候補 ${candidate} が存在しない`);
  }
  return problems;
}

/** 分岐の選択が正しいか。存在しないルートは拒否する。 */
export function isLegalStep(
  board: BoardDef,
  from: number,
  to: number,
): boolean {
  return nextOf(board, from).includes(to);
}

/**
 * 1マス進む。
 * 分岐がある場合は choice を使う。choice が不正なら先頭を選ぶ
 * （タイムアウト時にホストが自動で進めるときの既定動作）。
 */
export function stepFrom(
  board: BoardDef,
  from: number,
  choice?: number,
): number {
  const options = nextOf(board, from);
  const first = options[0];
  if (first === undefined) return from;
  if (choice !== undefined && options.includes(choice)) return choice;
  return first;
}

/** コインは0未満にしない。 */
export function clampCoins(value: number): number {
  return Math.max(0, Math.round(value));
}

/** サイコロの合計を出す。 */
export function totalOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}
