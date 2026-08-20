import PlayerCard from "../components/PlayerCard";
import { selectIsHost, selectPlayers, useRoom } from "../store/useRoom";
import { MAX_PLAYERS, MIN_PLAYERS } from "../constants";
import { canStartGame } from "../logic/lobby";

/**
 * ロビー画面。参加者一覧をリアルタイム表示し、ホストだけが開始できる。
 */
export default function Lobby() {
  const roomCode = useRoom((s) => s.roomCode);
  const room = useRoom((s) => s.room);
  const myUid = useRoom((s) => s.myUid);
  const busy = useRoom((s) => s.busy);
  const leave = useRoom((s) => s.leave);
  const start = useRoom((s) => s.start);

  const players = selectPlayers(room);
  const isHost = selectIsHost(room, myUid);
  const canStart = room?.players ? canStartGame(room.players) : false;

  return (
    <main className="flex h-full flex-col gap-5 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="flex flex-col items-center gap-1">
        <p className="text-sm text-slate-400">ルームコード</p>
        <p className="text-5xl font-bold tracking-[0.2em]">{roomCode}</p>
        <p className="mt-1 text-xs text-slate-400">
          このコードを みんなに教えてください
        </p>
      </section>

      <section className="flex flex-1 flex-col gap-2 overflow-y-auto">
        <p className="text-sm text-slate-400">
          参加者 {players.length} / {MAX_PLAYERS}
        </p>
        <ul className="flex flex-col gap-2">
          {players.map(({ uid, player }) => (
            <PlayerCard
              key={uid}
              name={player.name}
              colorIdx={player.colorIdx}
              connected={player.connected}
              isHost={room?.meta.hostId === uid}
              isMe={uid === myUid}
            />
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        {isHost ? (
          <button
            type="button"
            disabled={!canStart || busy}
            onClick={() => void start()}
            className="min-h-14 rounded-xl bg-sky-500 text-base font-bold text-white disabled:opacity-40"
          >
            {canStart
              ? "ゲームを開始"
              : `あと ${MIN_PLAYERS - players.length} 人 待っています`}
          </button>
        ) : (
          <p className="min-h-14 content-center rounded-xl bg-slate-800 text-center text-sm text-slate-400">
            ホストが開始するのを待っています…
          </p>
        )}
        <button
          type="button"
          onClick={() => void leave()}
          className="min-h-14 rounded-xl bg-slate-700 text-base"
        >
          {isHost ? "ルームを解散する" : "退出する"}
        </button>
      </div>
    </main>
  );
}
