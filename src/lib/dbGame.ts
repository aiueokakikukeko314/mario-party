import { ref, remove, serverTimestamp, set, update } from "firebase/database";
import { db } from "./firebase";
import type { InputType } from "../types";

/**
 * ゲーム進行の RTDB 書き込み（CLAUDE.md セクション10 の lib 層）。
 *
 * `board` / `meta` / `config` / `minigame` / `players.*` の権威データを
 * 書けるのはホストだけ（セクション3）。呼び出し側で isHost を確認すること。
 *
 * 複数の場所を同時に変えるときは set() を並べず、
 * 1回の update() で書く（multi-location update）。途中の状態が
 * 他端末に見えるのを防ぐため。
 */

export const roomPath = (roomCode: string) => `rooms/${roomCode}`;

/**
 * 【ホスト】ルーム配下を1回の書き込みでまとめて更新する。
 * paths は "board/action" のようにルーム直下からの相対パス。
 */
export async function applyRoomUpdate(
  roomCode: string,
  paths: Record<string, unknown>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...paths };
  payload["meta/updatedAt"] = serverTimestamp();
  await update(ref(db, roomPath(roomCode)), payload);
}

/** 【全員】自分の入力を送る。ホストがこれを見てロジックを実行する。 */
export async function sendInput(
  roomCode: string,
  uid: string,
  input: { seq: number; actionId: string; type: InputType; payload?: unknown },
): Promise<void> {
  await set(ref(db, `${roomPath(roomCode)}/inputs/${uid}`), {
    seq: input.seq,
    actionId: input.actionId,
    type: input.type,
    payload: input.payload ?? null,
    ts: serverTimestamp(),
  });
}

/** 【ホスト】処理済みの入力を消す。 */
export async function clearInput(roomCode: string, uid: string): Promise<void> {
  await remove(ref(db, `${roomPath(roomCode)}/inputs/${uid}`));
}

/** 【ホスト】フェーズを変更する。遷移を起こしてよいのはホストだけ。 */
export async function setPhase(
  roomCode: string,
  phase: string,
): Promise<void> {
  await applyRoomUpdate(roomCode, { "meta/phase": phase });
}

/** 【ホスト】ミニゲームのノードごと消す。 */
export async function clearMinigame(roomCode: string): Promise<void> {
  await remove(ref(db, `${roomPath(roomCode)}/minigame`));
}
