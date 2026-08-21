import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Board3D from "../components/Board3D";
import DecisionPanel from "../components/DecisionPanel";
import Dice from "../components/Dice";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { inventoryList } from "../logic/items";
import { playSound } from "../lib/sound";
import { selectPlayers, useRoom } from "../store/useRoom";

/**
 * すごろく画面。
 * 進行状態（board.action）に応じて出すものを変えるだけで、
 * 判定はすべてホストが行う（CLAUDE.md セクション3）。
 */
export default function Board() {
  const room = useRoom((s) => s.room);
  const myUid = useRoom((s) => s.myUid);
  const send = useRoom((s) => s.send);
  const players = selectPlayers(room);

  const board = room?.board;
  const config = room?.config;
  const currentUid = board?.currentUid ?? null;
  const current = players.find((entry) => entry.uid === currentUid);
  const me = players.find((entry) => entry.uid === myUid)?.player;
  const myTurn = currentUid !== null && currentUid === myUid;

  const decision = board?.pendingDecision ?? null;
  const action = board?.action ?? "waiting";
  const [sent, setSent] = useState(false);

  // 手番や選択が変わったら送信済みフラグを戻す
  useEffect(() => {
    setSent(false);
  }, [currentUid, decision?.id, action]);

  // 効果音
  const dice = board?.diceTotal ?? null;
  const prevRef = useRef<{ coins: number | null; stars: number | null }>({
    coins: null,
    stars: null,
  });
  useEffect(() => {
    if (dice !== null) playSound("dice");
  }, [dice]);
  useEffect(() => {
    const prev = prevRef.current;
    const coins = me?.coins ?? null;
    const stars = me?.stars ?? null;
    prevRef.current = { coins, stars };
    if (prev.coins === null || coins === null) return;
    if (stars !== null && prev.stars !== null && stars > prev.stars) {
      playSound("star");
      return;
    }
    if (coins > prev.coins) playSound("coin");
    else if (coins < prev.coins) playSound("lose");
  }, [me?.coins, me?.stars]);

  const canRoll = myTurn && action === "diceRoll" && !sent;
  const branchOptions =
    decision?.type === "branch"
      ? ((decision.options as { options?: number[] })?.options ?? [])
      : undefined;

  async function roll(): Promise<void> {
    if (!canRoll) return;
    setSent(true);
    await send("roll", decision?.id ?? "dice");
  }

  async function answer(payload: unknown): Promise<void> {
    if (!decision || sent) return;
    setSent(true);
    await send("decision", decision.id, payload);
  }

  return (
    <main className="flex h-full flex-col">
      <PlayerStatusBar players={players} currentUid={currentUid} />

      <Board3D
        boardId={config?.boardId ?? "party-island"}
        players={players}
        currentUid={currentUid}
        starNodeId={board?.starNodeId ?? -1}
        {...(branchOptions ? { branchOptions } : {})}
      />

      {board?.lastEvent && (
        <motion.p
          key={board.lastEvent.at}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 px-6 text-center text-sm text-slate-300"
        >
          {board.lastEvent.text}
        </motion.p>
      )}

      {decision && (
        <div className="shrink-0 px-4 pt-2">
          <DecisionPanel
            decision={decision}
            isMine={decision.uid === myUid}
            currentName={current?.player.name ?? "だれか"}
            me={me}
            onAnswer={(payload) => void answer(payload)}
          />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-4 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Dice value={board?.diceTotal ?? null} rolling={action === "moving"} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">
            ターン {board?.turn ?? 1} / {config?.maxTurns ?? 10}
            {board?.finalRush === true && (
              <span className="ml-2 font-bold text-rose-300">ラストスパート！</span>
            )}
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
            <p className="mt-1 min-h-14 content-center rounded-xl bg-slate-800 px-4 text-center text-sm text-slate-300">
              {action === "moving"
                ? `のこり ${board?.movesRemaining ?? 0} マス`
                : myTurn
                  ? "まっています…"
                  : `${current?.player.name ?? "だれか"} のばん`}
            </p>
          )}
        </div>
      </div>

      {me && inventoryList(me.inventory).length > 0 && (
        <div className="flex shrink-0 justify-center gap-2 pb-2">
          {inventoryList(me.inventory).map(({ slot, item }) => (
            <span key={slot} className="text-xl" title={item.name}>
              {item.icon}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
