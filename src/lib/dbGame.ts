import { ref, remove, serverTimestamp, set, update } from "firebase/database";
import { db } from "./firebase";
import type { BoardState, MinigameState, Phase, Player } from "../types";

/**
 * ボード進行に関する RTDB 書き込み（CLAUDE.md セクション10 の lib 層）。
 *
 * `board` / `meta` / `players.*.coins` を書けるのはホストだけ
 * （CLAUDE.md セクション3）。ここの関数はホスト用と明記したもの以外、
 * 呼び出し側で isHost を確認すること。
 */

const roomPath = (roomCode: string) => `rooms/${roomCode}`;

/** 【全員】自分の入力を送る。ホストがこれを見てロジックを実行する。 */
export async function sendInput(
  roomCode: string,
  uid: string,
  type: string,
  value: unknown = null,
): Promise<void> {
  await set(ref(db, `${roomPath(roomCode)}/inputs/${uid}`), {
    type,
    value,
    ts: serverTimestamp(),
  });
}

/** 【ホスト】処理済みの入力を消す。 */
export async function clearInput(
  roomCode: string,
  uid: string,
): Promise<void> {
  await remove(ref(db, `${roomPath(roomCode)}/inputs/${uid}`));
}

/** 【ホスト】ボードの状態を書き換える。 */
export async function updateBoard(
  roomCode: string,
  patch: Partial<BoardState>,
): Promise<void> {
  await update(ref(db, `${roomPath(roomCode)}/board`), patch);
}

/** 【ホスト】ボードを初期化する（ターン1、先頭プレイヤーの手番）。 */
export async function initBoard(
  roomCode: string,
  currentUid: string,
): Promise<void> {
  const board: BoardState = {
    turn: 1,
    currentUid,
    dice: null,
    animating: false,
    pending: null,
  };
  await set(ref(db, `${roomPath(roomCode)}/board`), board);
}

/** 【ホスト】プレイヤーのコイン・スター・位置を書き込む。 */
export async function writePlayerStats(
  roomCode: string,
  uid: string,
  stats: Pick<Player, "coins" | "stars" | "pos">,
): Promise<void> {
  await update(ref(db, `${roomPath(roomCode)}/players/${uid}`), stats);
}

/** 【ホスト】フェーズを変更する。遷移を起こしてよいのはホストだけ。 */
export async function setPhase(
  roomCode: string,
  phase: Phase,
): Promise<void> {
  await update(ref(db, `${roomPath(roomCode)}/meta`), { phase });
}

/**
 * 【ホスト】ミニゲームを開始する。
 * startAt / endAt は **サーバー時刻の絶対値**（CLAUDE.md セクション6）。
 * 各端末はこの絶対時刻を基準に同時に開始する。
 */
export async function startMinigame(
  roomCode: string,
  id: string,
  startAt: number,
  endAt: number,
): Promise<void> {
  const minigame: MinigameState = {
    id,
    startAt,
    endAt,
    ranking: null,
  };
  await set(ref(db, `${roomPath(roomCode)}/minigame`), minigame);
}

/** 【ホスト】受け取ったスコアを集計場所に書く。 */
export async function writeScore(
  roomCode: string,
  uid: string,
  score: number,
): Promise<void> {
  await set(ref(db, `${roomPath(roomCode)}/minigame/scores/${uid}`), score);
}

/** 【ホスト】確定した順位を書く。 */
export async function writeRanking(
  roomCode: string,
  ranking: string[],
): Promise<void> {
  await update(ref(db, `${roomPath(roomCode)}/minigame`), { ranking });
}

/**
 * 【ホスト】ミニゲームが終わったあとの後始末。
 * 最終ターンなら gameEnd、そうでなければ次のターンのボードへ。
 */
export async function finishTurn(
  roomCode: string,
  currentTurn: number,
  maxTurns: number,
  firstUid: string,
): Promise<void> {
  // 次のターンに前回のスコアが残らないよう消す
  await remove(ref(db, `${roomPath(roomCode)}/minigame`));

  if (currentTurn >= maxTurns) {
    await setPhase(roomCode, "gameEnd");
    return;
  }
  const board: BoardState = {
    turn: currentTurn + 1,
    currentUid: firstUid,
    dice: null,
    animating: false,
    pending: null,
  };
  await set(ref(db, `${roomPath(roomCode)}/board`), board);
  await setPhase(roomCode, "board");
}
