import { onValue, ref } from "firebase/database";
import { db } from "./firebase";

/**
 * RTDB への読み書きは必ずこのファイル経由（CLAUDE.md セクション10）。
 * コンポーネントから直接 ref() を触らないこと。
 *
 * Phase 0 の時点では接続状態の購読だけ。ルーム関連の関数は Phase 1 で追加する。
 */

/**
 * RTDB との接続状態（.info/connected）を購読する。
 * 戻り値を呼ぶと解除。
 */
export function subscribeConnected(
  listener: (connected: boolean) => void,
): () => void {
  return onValue(ref(db, ".info/connected"), (snap) => {
    listener(snap.val() === true);
  });
}
