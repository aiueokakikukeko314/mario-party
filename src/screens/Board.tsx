import { useEffect, useState } from "react";
import Board3D from "../components/Board3D";
import Dice from "../components/Dice";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { sendInput } from "../lib/dbGame";
import { selectPlayers, useRoom } from "../store/useRoom";
import { STAR_COST } from "../logic/board";

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
  const awaitingStar = board?.pending === "star";
  const canRoll = myTurn && !awaitingStar && board?.animating === false && !sent;

  async function roll(): Promise<void> {
    if (roomCode === null || myUid === null) return;
    setSent(true);
    await sendInput(roomCode, myUid, "roll");
  }

  async function chooseStar(buy: boolean): Promise<void> {
    if (roomCode === null || myUid === null) return;
    await sendInput(roomCode, myUid, "starChoice", buy);
  }

  return (
    <main className="flex h-full flex-col">
      <PlayerStatusBar players={players} currentUid={currentUid} />

      <Board3D players={players} currentUid={currentUid} />

      {awaitingStar && (
        <div className="shrink-0 px-6 pt-2">
          {myTurn ? (
            <div className="rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-400/40">
              <p className="text-center text-sm text-amber-200">
                ★のマスに とまりました。コイン {STAR_COST} 枚で スターを買いますか？
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void chooseStar(true)}
                  className="min-h-14 flex-1 rounded-xl bg-amber-400 text-base font-bold text-amber-950"
                >
                  買う
                </button>
                <button
                  type="button"
                  onClick={() => void chooseStar(false)}
                  className="min-h-14 flex-1 rounded-xl bg-slate-700 text-base font-bold"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-800 py-3 text-center text-sm text-slate-300">
              {current?.player.name ?? "だれか"} が スターを買うか えらんでいます…
            </p>
          )}
        </div>
      )}

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
                : awaitingStar
                  ? "★ をどうするか えらんでいます"
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
