import { onValue, ref } from "firebase/database";
import { db } from "./firebase";

/**
 * サーバー時刻の同期（CLAUDE.md セクション6）。
 * 端末のローカル時計は信用しない。ミニゲームの同時開始はここの serverNow() を基準にする。
 */

let serverOffset = 0;
let synced = false;

const listeners = new Set<(offset: number) => void>();

/** 起動時に一度だけ呼ぶ。.info/serverTimeOffset を購読し続ける。 */
export function startTimeSync(): void {
  onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
    const value: unknown = snap.val();
    serverOffset = typeof value === "number" ? value : 0;
    synced = true;
    for (const listener of listeners) listener(serverOffset);
  });
}

/** サーバー時刻に補正した現在時刻(ms)。 */
export function serverNow(): number {
  return Date.now() + serverOffset;
}

/** 端末時計とサーバーのズレ(ms)。デバッグ表示用。 */
export function getServerOffset(): number {
  return serverOffset;
}

/** 一度でも .info/serverTimeOffset を受け取ったか。 */
export function isTimeSynced(): boolean {
  return synced;
}

/** オフセットの変化を購読する。戻り値を呼ぶと解除。 */
export function subscribeServerOffset(
  listener: (offset: number) => void,
): () => void {
  listeners.add(listener);
  if (synced) listener(serverOffset);
  return () => {
    listeners.delete(listener);
  };
}
