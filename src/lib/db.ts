import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { db } from "./firebase";
import { parseRoom } from "./parse";
import { pickFreeSlot } from "../logic/lobby";
import { generateRoomCode } from "./roomCode";
import { serverNow } from "./time";
import {
  DEFAULT_BOARD_ID,
  DEFAULT_MAX_TURNS,
  DEFAULT_STARTING_COINS,
} from "../constants";
import { EMPTY_STATS } from "../logic/bonus";
import type { GameConfig, Player, Room } from "../types";

/**
 * RTDB への読み書きは必ずこのファイル経由（CLAUDE.md セクション10）。
 * コンポーネントから直接 ref() を触らないこと。
 */

const roomPath = (roomCode: string) => `rooms/${roomCode}`;

/** RTDB との接続状態（.info/connected）を購読する。 */
export function subscribeConnected(
  listener: (connected: boolean) => void,
): () => void {
  return onValue(ref(db, ".info/connected"), (snap) => {
    listener(snap.val() === true);
  });
}

/** ルーム全体を購読する。存在しない/壊れている場合は null を渡す。 */
export function subscribeRoom(
  roomCode: string,
  listener: (room: Room | null) => void,
): () => void {
  return onValue(ref(db, roomPath(roomCode)), (snap) => {
    listener(parseRoom(snap.val()));
  });
}

function newPlayer(name: string, slot: number): Player {
  return {
    name,
    colorIdx: slot as Player["colorIdx"],
    order: slot,
    // 参加時点では0。開始時にホストが startingCoins を配る
    coins: 0,
    stars: 0,
    pos: 0,
    connected: true,
    lastSeen: serverNow(),
    stats: { ...EMPTY_STATS },
  };
}

const DEFAULT_CONFIG: GameConfig = {
  boardId: DEFAULT_BOARD_ID,
  maxTurns: DEFAULT_MAX_TURNS,
  bonusAwardsEnabled: true,
  itemsEnabled: true,
  startingCoins: DEFAULT_STARTING_COINS,
};

export type CreateResult =
  | { ok: true; roomCode: string }
  | { ok: false; reason: "code-exhausted" };

/**
 * ルームを作成する。作成者がホストになる。
 * コード衝突は transaction で検出し、別のコードで retry する。
 */
export async function createRoom(
  uid: string,
  name: string,
  attempts = 10,
): Promise<CreateResult> {
  for (let i = 0; i < attempts; i++) {
    const roomCode = generateRoomCode();
    const roomRef = ref(db, roomPath(roomCode));

    const result = await runTransaction(roomRef, (current: unknown) => {
      // 既に存在するコードなら中断して次のコードを試す
      if (current !== null && current !== undefined) return;
      return {
        meta: {
          hostId: uid,
          hostEpoch: 1,
          phase: "lobby",
          // transaction 内では serverTimestamp() の番兵値を使わず、
          // コミット後に本物のサーバー時刻で上書きする（下の update）
          createdAt: serverNow(),
        },
        config: { ...DEFAULT_CONFIG },
        players: { [uid]: newPlayer(name, 0) },
      };
    });

    if (result.committed) {
      await update(ref(db, `${roomPath(roomCode)}/meta`), {
        createdAt: serverTimestamp(),
      });
      return { ok: true, roomCode };
    }
  }
  return { ok: false, reason: "code-exhausted" };
}

export type JoinFailReason = "not-found" | "full" | "in-progress";
export type JoinResult = { ok: true } | { ok: false; reason: JoinFailReason };

/**
 * 既存のルームに参加する。
 *
 * ここで transaction を使わないのは意図的:
 * RTDB の transaction はローカルキャッシュ未同期だと最初に null で呼ばれ、
 * そこで中断するとサーバーに問い合わせないまま「存在しない」と誤判定する。
 * また CLAUDE.md セクション9 では players/{uid} は本人のみ書き込み可なので、
 * 参加者が players 全体を書き換える形にはできない。
 * よって get() で検証してから自分のノードだけを書く。
 *
 * 残る競合: ちょうど同時に参加すると同じ席番号を取り得る。
 * その場合でも order の同着は uid で決定的に解決されるため手番順はズレず、
 * 影響は色が重複する見た目だけに留まる。
 */
export async function joinRoom(
  roomCode: string,
  uid: string,
  name: string,
): Promise<JoinResult> {
  const snapshot = await get(ref(db, roomPath(roomCode)));
  const room = parseRoom(snapshot.val());
  if (room === null) return { ok: false, reason: "not-found" };

  const players = room.players ?? {};
  const playerRef = ref(db, `${roomPath(roomCode)}/players/${uid}`);

  // 既に席がある場合は再入場（席はそのまま、名前だけ更新）
  if (players[uid]) {
    await update(playerRef, {
      name,
      connected: true,
      lastSeen: serverTimestamp(),
    });
    return { ok: true };
  }

  // 新規参加はロビー中のみ
  if (room.meta.phase !== "lobby") return { ok: false, reason: "in-progress" };

  const slot = pickFreeSlot(players);
  if (slot === null) return { ok: false, reason: "full" };

  await set(playerRef, newPlayer(name, slot));
  return { ok: true };
}

/**
 * 自分の接続状態を維持する（CLAUDE.md セクション12）。
 * .info/connected が true になるたびに onDisconnect を張り直す
 * （一度発火すると解除されるため、再接続時に再登録が必要）。
 */
export function setupPresence(roomCode: string, uid: string): () => void {
  const playerPath = `${roomPath(roomCode)}/players/${uid}`;
  return subscribeConnected((connected) => {
    if (!connected) return;
    void onDisconnect(ref(db, `${playerPath}/connected`)).set(false);
    void update(ref(db, playerPath), {
      connected: true,
      lastSeen: serverTimestamp(),
    });
  });
}

/**
 * ルームから退出する。
 * ホストが抜けた場合はルームごと削除する
 * （ホスト移譲は Phase 6。それまでは CLAUDE.md セクション12 の
 *   「ホストが落ちたらゲーム終了」に従う）。
 */
export async function leaveRoom(
  roomCode: string,
  uid: string,
  isHost: boolean,
): Promise<void> {
  const playerPath = `${roomPath(roomCode)}/players/${uid}`;
  await onDisconnect(ref(db, `${playerPath}/connected`)).cancel();
  await remove(ref(db, isHost ? roomPath(roomCode) : playerPath));
}

/**
 * ホストが切断したときに、自分がホストを引き継ぐ。
 *
 * 複数端末が同時に引き継ごうとしても1台しか成功しないよう transaction を使う
 * （CLAUDE.md セクション12）。すでに誰かが引き継いでいたら中断する。
 * 戻り値は引き継げたかどうか。
 */
export async function claimHost(
  roomCode: string,
  previousHostId: string,
  uid: string,
): Promise<boolean> {
  // hostId と hostEpoch を1つの transaction で同時に更新する。
  // epoch が上がることで、旧ホストの engine は自分が古いと気づいて停止する。
  const result = await runTransaction(
    ref(db, `${roomPath(roomCode)}/meta`),
    (current: unknown) => {
      if (typeof current !== "object" || current === null) return;
      const meta = current as Record<string, unknown>;
      // 先に誰かが取っていたら何もしない
      if (meta["hostId"] !== previousHostId) return;
      const epoch = typeof meta["hostEpoch"] === "number" ? meta["hostEpoch"] : 0;
      return { ...meta, hostId: uid, hostEpoch: epoch + 1 };
    },
  );
  return result.committed;
}

/**
 * ゲームを開始する（ホストのみ）。
 * 呼び出し側で isHost を確認すること（CLAUDE.md セクション3）。
 */
export async function startGame(roomCode: string): Promise<void> {
  // 実際の初期化（手番順・初期コイン・スター位置）はホストの engine が行う。
  // ここでは合図として phase を進めるだけ。
  await update(ref(db, `${roomPath(roomCode)}/meta`), { phase: "gameSetup" });
}

/** 【ホスト】ロビーで設定を変える。 */
export async function updateConfig(
  roomCode: string,
  patch: Partial<GameConfig>,
): Promise<void> {
  await update(ref(db, `${roomPath(roomCode)}/config`), patch);
}
