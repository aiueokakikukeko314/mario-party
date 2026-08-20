import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BOARD, BOARD_SIZE, type SquareType } from "../logic/board";
import { STEP_MS } from "../lib/hostTiming";
import { PLAYER_COLORS } from "./PlayerCard";
import { TILE_SIZE, tilePos } from "./boardLayout";
import type { Player } from "../types";

/**
 * CSS 3D Transform だけで作ったすごろく盤。
 * ドラッグで視点(rotateX / rotateY)を自由に変えられる。
 * 3Dライブラリは使わない（CLAUDE.md セクション2 の技術スタックは変更禁止）。
 */

const TILE_STYLE: Record<SquareType, { className: string; label: string }> = {
  plus: { className: "bg-emerald-500 text-white", label: "+3" },
  minus: { className: "bg-rose-500 text-white", label: "-3" },
  star: { className: "bg-amber-400 text-amber-950", label: "★" },
  minigame: { className: "bg-violet-500 text-white", label: "2x" },
  warp: { className: "bg-sky-500 text-white", label: "⇄" },
  empty: { className: "bg-slate-600 text-slate-300", label: "" },
};

const DEFAULT_VIEW = { x: -58, y: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface Props {
  players: { uid: string; player: Player }[];
  currentUid: string | null;
}

export default function Board3D({ players, currentUid }: Props) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ perspective: "900px", touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const start = dragRef.current;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          setView((prev) => ({
            // 真上・真横まで行くと盤が潰れるので角度を制限する
            x: clamp(prev.x - dy * 0.4, -88, -18),
            y: prev.y + dx * 0.4,
          }));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${view.x}deg) rotateY(${view.y}deg)`,
          }}
        >
          {BOARD.map((type, index) => (
            <Tile key={index} index={index} type={type} />
          ))}
          {players.map(({ uid, player }) => {
            // 同じマスに乗っている人どうしだけ横にずらす
            const sameSquare = players.filter(
              (e) => e.player.pos === player.pos,
            );
            const stackIndex = sameSquare.findIndex((e) => e.uid === uid);
            return (
              <Token
                key={uid}
                player={player}
                stackIndex={stackIndex}
                stackSize={sameSquare.length}
                isCurrent={uid === currentUid}
                view={view}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setView(DEFAULT_VIEW)}
        className="absolute right-2 top-2 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-300"
      >
        視点リセット
      </button>
      <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">
        ドラッグで盤を回せます
      </p>
    </div>
  );
}

function Tile({ index, type }: { index: number; type: SquareType }) {
  const { x, y, z } = tilePos(index);
  const style = TILE_STYLE[type];
  return (
    <div
      className={`absolute flex items-center justify-center rounded-lg text-xs font-bold shadow-lg ${style.className}`}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        marginLeft: -TILE_SIZE / 2,
        marginTop: -TILE_SIZE / 2,
        // rotateX(90deg) で板を寝かせて地面にする
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(90deg)`,
      }}
    >
      {index === 0 ? "S" : style.label}
    </div>
  );
}

/**
 * pos の変化を1マスずつ辿る。
 * warp のような大きな移動は歩かずに直接飛ぶ。
 */
function useSteppedPos(actual: number): number {
  const [display, setDisplay] = useState(actual);

  useEffect(() => {
    if (display === actual) return;
    const forward = (actual - display + BOARD_SIZE) % BOARD_SIZE;
    if (forward < 1 || forward > 6) {
      setDisplay(actual);
      return;
    }
    const id = setTimeout(
      () => setDisplay((prev) => (prev + 1) % BOARD_SIZE),
      STEP_MS,
    );
    return () => clearTimeout(id);
  }, [actual, display]);

  return display;
}

function Token({
  player,
  stackIndex,
  stackSize,
  isCurrent,
  view,
}: {
  player: Player;
  stackIndex: number;
  stackSize: number;
  isCurrent: boolean;
  view: { x: number; y: number };
}) {
  const pos = useSteppedPos(player.pos);
  const { x, y, z } = tilePos(pos);
  const color = PLAYER_COLORS[player.colorIdx];
  // 同じマスに重なったときだけ左右に散らす
  const offsetX = (stackIndex - (stackSize - 1) / 2) * 11;

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ transformStyle: "preserve-3d" }}
      animate={{ x: x + offsetX, y: y - 4, z }}
      transition={{ duration: STEP_MS / 1000, ease: "easeInOut" }}
    >
      {/* 常に正面を向くよう、親の回転を打ち消す */}
      <div
        style={{
          transform: `rotateY(${-view.y}deg) rotateX(${-view.x}deg)`,
        }}
      >
        <div
          className={`size-6 rounded-full border-2 ${color.dot} ${
            isCurrent ? "border-white" : "border-black/40"
          } ${player.connected ? "" : "opacity-40"}`}
          style={{ marginLeft: -12, marginTop: -26 }}
        />
      </div>
    </motion.div>
  );
}
