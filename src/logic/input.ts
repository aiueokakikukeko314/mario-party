import type { InputType, PlayerInput } from "../types";

/**
 * 入力の受理判定（純関数）。
 * 二重タップ・再接続後の古い入力・遅れて届いた入力を弾く。
 */

const VALID_TYPES: readonly InputType[] = [
  "roll",
  "decision",
  "minigameScore",
  "useItem",
  "startGame",
];

export type RejectReason =
  | "badShape"
  | "badType"
  | "staleSeq"
  | "wrongAction"
  | null;

/**
 * この入力を処理してよいか。null なら処理してよい。
 *
 * - seq が処理済み以下なら無視（二重処理防止）
 * - expectedActionId が指定されているのに一致しなければ無視
 *   （前の選択に対する遅れた応答を弾く）
 */
export function rejectReason(
  input: PlayerInput | undefined,
  lastProcessedSeq: number | undefined,
  expectedActionId?: string | null,
): RejectReason {
  if (!input) return "badShape";
  if (typeof input.seq !== "number" || !Number.isFinite(input.seq)) {
    return "badShape";
  }
  if (!VALID_TYPES.includes(input.type)) return "badType";
  if (lastProcessedSeq !== undefined && input.seq <= lastProcessedSeq) {
    return "staleSeq";
  }
  if (
    expectedActionId !== undefined &&
    expectedActionId !== null &&
    input.actionId !== expectedActionId
  ) {
    return "wrongAction";
  }
  return null;
}

export function isAcceptable(
  input: PlayerInput | undefined,
  lastProcessedSeq: number | undefined,
  expectedActionId?: string | null,
): boolean {
  return rejectReason(input, lastProcessedSeq, expectedActionId) === null;
}

/** ミニゲームのスコアとして現実的な範囲か。 */
export function isPlausibleScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= -100000 &&
    score <= 100000
  );
}
