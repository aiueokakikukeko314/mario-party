import { useEffect, useState } from "react";
import Board3D from "../components/Board3D";
import Dice from "../components/Dice";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { sendInput } from "../lib/dbGame";
import { selectPlayers, useRoom } from "../store/useRoom";

/**
 * すごろく画面。
 * 手番のプレイヤーだけがサイコロを振れる。振ると inputs/{uid} に書き込むだけで、
 * 出目の決定と状態更新はホストが行う（CLAUDE.md セクション3）。
 */
export default function Board() {
  const room = useRoom((s) => s.room);
  const roomCode = useRoom((s) => s.roomCode);
  const myUid = useRoom((s) => s.myUid);
  const players = selectPlayers(room);

  const board = room?.board;
  const currentUid = board?.currentUid ?? null;
  const current = players.find((entry) => entry.uid === currentUid);

  // 連打で同じ入力を何度も送らないようにする
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setSent(false);
  }, [currentUid, board?.turn]);

  const myTurn = currentUid !== null && currentUid === myUid;
  const canRoll = myTurn && board?.animating === false && !sent;

  async function roll(): Promise<void> {
    if (roomCode === null || myUid === null) return;
    setSent(true);
    await sendInput(roomCode, myUid, "roll");
  }

  return (
    <main className="flex h-full flex-col">
      <PlayerStatusBar players={players} currentUid={currentUid} />

      <Board3D players={players} currentUid={currentUid} />

      <div className="flex shrink-0 items-center gap-4 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Dice value={board?.dice ?? null} rolling={board?.animating === true} />

        <div className="flex-1">
          <p className="text-xs text-slate-400">
            ターン {board?.turn ?? "-"} / {room?.meta.maxTurns ?? "-"}
          </p>
          {canRoll ? (
            <button
              type="button"
              onClick={() => void roll()}
              className="mt-1 min-h-14 w-full rounded-xl bg-sky-500 text-base font-bold text-white"
            >
              サイコロを振る
            </button>
          ) : (
            <p className="mt-1 flex min-h-14 items-center justify-center rounded-xl bg-slate-800 text-sm text-slate-300">
              {board?.animating === true
                ? "うごいています…"
                : myTurn
                  ? "まっています…"
                  : `${current?.player.name ?? "だれか"} のばん`}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
