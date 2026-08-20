import type { FC } from "react";

/**
 * ミニゲームの共通インターフェース（CLAUDE.md セクション7・**変更禁止**）。
 *
 * 原則: 各端末でローカルに動かし、終了時にスコアだけを送る。
 * 座標をリアルタイム同期する対戦型は作らない。
 */

export interface MinigameProps {
  /** 残り時間(ms)。0 で終了 */
  remainingMs: number;
  /** スコアを報告する。複数回呼んでよい（最後の値が採用） */
  onScore: (score: number) => void;
}

export interface MinigameDef {
  id: string;
  title: string;
  description: string; // ルール説明（イントロ画面で表示）
  durationMs: number;
  higherIsBetter: boolean; // スコアの大小どちらが good か
  Component: FC<MinigameProps>;
}
