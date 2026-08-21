import { useEffect, useRef } from "react";
import { claimHost } from "../lib/db";
import { sortPlayers } from "../logic/lobby";
import { HANDOVER_DELAY_MS } from "../lib/hostTiming";
import { useRoom } from "../store/useRoom";

/**
 * ホストが切断したときに、order が最小の接続中プレイヤーが引き継ぐ
 * （CLAUDE.md セクション12）。
 *
 * これはホスト以外の端末で動く必要があるので useHost とは別にしている。
 * 引き継ぐ資格があるのは1人だけになるように候補を選ぶが、
 * 判定のタイミングがズレて複数が動いても、実際の書き込みは
 * transaction なので1台しか成功しない。
 */
export function useHostHandover(): void {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (room === null || roomCode === null || myUid === null) return clear;

    const hostId = room.meta.hostId;
    // 自分がホストなら何もしない
    if (hostId === myUid) return clear;

    const players = room.players ?? {};
    const host = players[hostId];
    // ホストが生きているなら何もしない
    if (host !== undefined && host.connected) return clear;

    // 接続中のうち order が最小の人が引き継ぐ
    const heir = sortPlayers(players).find((entry) => entry.player.connected);
    if (heir === undefined || heir.uid !== myUid) return clear;

    // すでに待っている最中なら二重に仕掛けない
    if (timerRef.current !== null) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void claimHost(roomCode, hostId, myUid);
    }, HANDOVER_DELAY_MS);

    return clear;
  }, [room, roomCode, myUid]);
}
