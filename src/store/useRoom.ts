import { create } from "zustand";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setupPresence,
  startGame,
  subscribeRoom,
  type JoinFailReason,
} from "../lib/db";
import { normalizeRoomCode } from "../lib/roomCode";
import { sortPlayers } from "../logic/lobby";
import type { Player, Room } from "../types";

/**
 * ルームの購読を 1 か所に集約する（CLAUDE.md セクション10）。
 * コンポーネントはこのストア経由でのみルーム状態を読む。
 */

/**
 * リロードしても同じ席に戻れるよう、入っているルームを覚えておく。
 * 匿名認証の uid はブラウザに残るので、同じ uid で復帰できる。
 */
const SAVED_KEY = "party-game:session";

interface SavedSession {
  roomCode: string;
  name: string;
}

function saveSession(session: SavedSession | null): void {
  try {
    if (session === null) localStorage.removeItem(SAVED_KEY);
    else localStorage.setItem(SAVED_KEY, JSON.stringify(session));
  } catch {
    // 保存できなくても遊べる
  }
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const roomCode = record["roomCode"];
    const name = record["name"];
    if (typeof roomCode !== "string" || typeof name !== "string") return null;
    return { roomCode, name };
  } catch {
    return null;
  }
}

// 購読解除関数は state に入れない（再レンダリングと無関係なため）
let unsubscribeRoom: (() => void) | null = null;
let unsubscribePresence: (() => void) | null = null;

function teardown(): void {
  unsubscribeRoom?.();
  unsubscribeRoom = null;
  unsubscribePresence?.();
  unsubscribePresence = null;
}

const JOIN_ERROR_MESSAGE: Record<JoinFailReason, string> = {
  "not-found": "そのコードのルームは見つかりませんでした",
  full: "このルームは満員です",
  "in-progress": "このルームはすでにゲームが始まっています",
};

interface RoomStore {
  myUid: string | null;
  myName: string;
  roomCode: string | null;
  room: Room | null;
  /** ルームの最初のスナップショットを受け取ったか（読み込み中と解散の区別に使う） */
  roomLoaded: boolean;
  /** 通信中（ボタンの二重押し防止） */
  busy: boolean;
  /** ホーム画面に出すエラー文言 */
  error: string | null;

  /** 直前のルームに戻ろうとしている最中か */
  restoring: boolean;

  setMyUid: (uid: string) => void;
  setMyName: (name: string) => void;
  clearError: () => void;
  restore: () => Promise<void>;
  create: () => Promise<void>;
  join: (inputCode: string) => Promise<void>;
  leave: () => Promise<void>;
  start: () => Promise<void>;
}

export const useRoom = create<RoomStore>()((set, get) => ({
  myUid: null,
  myName: "",
  roomCode: null,
  room: null,
  roomLoaded: false,
  busy: false,
  error: null,
  restoring: loadSession() !== null,

  setMyUid: (uid) => {
    set({ myUid: uid });
    void get().restore();
  },

  /**
   * リロード前に入っていたルームへ戻る。
   * 部屋が消えていたり、すでに始まっていて入れない場合は忘れる。
   */
  restore: async () => {
    const saved = loadSession();
    const { myUid } = get();
    if (saved === null || myUid === null) {
      set({ restoring: false });
      return;
    }
    try {
      const result = await joinRoom(saved.roomCode, myUid, saved.name);
      if (result.ok) {
        set({ myName: saved.name });
        enterRoom(set, saved.roomCode, myUid, saved.name);
      } else {
        saveSession(null);
      }
    } catch {
      saveSession(null);
    } finally {
      set({ restoring: false });
    }
  },
  setMyName: (name) => set({ myName: name }),
  clearError: () => set({ error: null }),

  create: async () => {
    const { myUid, myName, busy } = get();
    if (busy || myUid === null) return;
    set({ busy: true, error: null });
    try {
      const result = await createRoom(myUid, myName.trim());
      if (!result.ok) {
        set({ error: "ルームを作成できませんでした。もう一度お試しください" });
        return;
      }
      enterRoom(set, result.roomCode, myUid, myName.trim());
    } catch {
      set({ error: "通信に失敗しました。電波状況を確認してください" });
    } finally {
      set({ busy: false });
    }
  },

  join: async (inputCode) => {
    const { myUid, myName, busy } = get();
    if (busy || myUid === null) return;
    const roomCode = normalizeRoomCode(inputCode);
    set({ busy: true, error: null });
    try {
      const result = await joinRoom(roomCode, myUid, myName.trim());
      if (!result.ok) {
        set({ error: JOIN_ERROR_MESSAGE[result.reason] });
        return;
      }
      enterRoom(set, roomCode, myUid, myName.trim());
    } catch {
      set({ error: "通信に失敗しました。電波状況を確認してください" });
    } finally {
      set({ busy: false });
    }
  },

  leave: async () => {
    const { roomCode, myUid, room } = get();
    teardown();
    saveSession(null);
    set({ roomCode: null, room: null, roomLoaded: false, error: null });
    if (roomCode === null || myUid === null) return;
    try {
      await leaveRoom(roomCode, myUid, room?.meta.hostId === myUid);
    } catch {
      // 退出の通知に失敗しても画面は戻す。onDisconnect が後始末する
    }
  },

  start: async () => {
    const { roomCode, room, myUid, busy } = get();
    // ホストだけが遷移を起こせる（CLAUDE.md セクション3・5）
    if (busy || roomCode === null || room === null) return;
    if (room.meta.hostId !== myUid) return;
    set({ busy: true });
    try {
      await startGame(roomCode);
    } finally {
      set({ busy: false });
    }
  },
}));

type SetState = (partial: Partial<RoomStore>) => void;

/** ルームの購読と接続監視を開始する。 */
function enterRoom(
  set: SetState,
  roomCode: string,
  uid: string,
  name?: string,
): void {
  teardown();
  set({ roomCode, room: null, roomLoaded: false, error: null });
  unsubscribeRoom = subscribeRoom(roomCode, (room) =>
    set({ room, roomLoaded: true }),
  );
  unsubscribePresence = setupPresence(roomCode, uid);
  if (name !== undefined) saveSession({ roomCode, name });
}

/** order 昇順のプレイヤー一覧。 */
export function selectPlayers(
  room: Room | null,
): { uid: string; player: Player }[] {
  return room?.players ? sortPlayers(room.players) : [];
}

/** 自分がホストか（CLAUDE.md セクション3）。 */
export function selectIsHost(room: Room | null, myUid: string | null): boolean {
  return room !== null && myUid !== null && room.meta.hostId === myUid;
}
