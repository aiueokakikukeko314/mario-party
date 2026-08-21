import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { findBoard } from "../board/registry";
import { STEP_MS } from "../lib/hostTiming";
import { PLAYER_COLORS } from "./PlayerCard";
import type { BoardNode, NodeType } from "../board/types";
import type { Player } from "../types";

/**
 * CSS 3D Transform だけで作ったすごろく盤。
 * ドラッグで視点を自由に変えられ、手番の人へ自動でカメラが向く。
 * 3Dライブラリは使わない（CLAUDE.md セクション2 の技術スタックは変更禁止）。
 */

const TILE_STYLE: Record<NodeType, { className: string; label: string }> = {
  start: { className: "bg-slate-200 text-slate-800", label: "S" },
  plus: { className: "bg-emerald-500 text-white", label: "+3" },
  minus: { className: "bg-rose-500 text-white", label: "-3" },
  lucky: { className: "bg-amber-400 text-amber-950", label: "！" },
  unlucky: { className: "bg-purple-700 text-white", label: "？" },
  event: { className: "bg-fuchsia-500 text-white", label: "E" },
  item: { className: "bg-cyan-500 text-white", label: "◆" },
  warp: { className: "bg-sky-500 text-white", label: "⇄" },
  empty: { className: "bg-slate-600 text-slate-300", label: "" },
};

const TILE_SIZE = 34;
const DEFAULT_VIEW = { x: -58, y: 0 };
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface Props {
  boardId: string;
  players: { uid: string; player: Player }[];
  currentUid: string | null;
  starNodeId: number;
  /** 分岐で選べる候補（強調表示する） */
  branchOptions?: number[];
}

export default function Board3D({
  boardId,
  players,
  currentUid,
  starNodeId,
  branchOptions,
}: Props) {
  const board = useMemo(() => findBoard(boardId), [boardId]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const touchedRef = useRef(false);

  const currentPos = players.find((entry) => entry.uid === currentUid)?.player.pos;

  // 手番の人が見やすい向きへ自動で回す（自分でドラッグしたあとは追従しない）
  useEffect(() => {
    if (touchedRef.current || currentPos === undefined) return;
    const node = board.nodes.find((item) => item.id === currentPos);
    if (!node) return;
    const angle = (Math.atan2(node.z ?? 0, node.x) * 180) / Math.PI;
    setView((prev) => ({ ...prev, y: -angle - 90 }));
  }, [currentPos, board]);

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
          touchedRef.current = true;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          setView((prev) => ({
            x: clamp(prev.x - dy * 0.4, -88, -18),
            y: prev.y + dx * 0.4,
          }));
        }}
        onPointerUp={() => {
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
          {board.nodes.map((node) => (
            <Tile
              key={node.id}
              node={node}
              isStar={node.id === starNodeId}
              highlighted={branchOptions?.includes(node.id) ?? false}
            />
          ))}
          {players.map(({ uid, player }, index) => (
            <Token
              key={uid}
              node={board.nodes.find((item) => item.id === player.pos)}
              colorIdx={player.colorIdx}
              active={uid === currentUid}
              offset={offsetFor(players, player.pos, uid, index)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          touchedRef.current = false;
          setView(DEFAULT_VIEW);
        }}
        className="absolute right-2 top-2 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-200"
      >
        視点リセット
      </button>
      <p className="absolute bottom-1 w-full text-center text-[10px] text-slate-500">
        ドラッグで盤を回せます
      </p>
    </div>
  );
}

/** 同じマスに複数いるとき、少しずらして重ならないようにする。 */
function offsetFor(
  players: { uid: string; player: Player }[],
  pos: number,
  uid: string,
  fallback: number,
): number {
  const sameTile = players.filter((entry) => entry.player.pos === pos);
  if (sameTile.length <= 1) return 0;
  const index = sameTile.findIndex((entry) => entry.uid === uid);
  const slot = index >= 0 ? index : fallback;
  return (slot - (sameTile.length - 1) / 2) * 13;
}

function Tile({
  node,
  isStar,
  highlighted,
}: {
  node: BoardNode;
  isStar: boolean;
  highlighted: boolean;
}) {
  const style = TILE_STYLE[node.type];
  const facility = isStar ? "★" : node.facility === "shop" ? "🛒" : null;
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        marginLeft: -TILE_SIZE / 2,
        marginTop: -TILE_SIZE / 2,
        transform: `translate3d(${node.x}px, ${node.y}px, ${node.z ?? 0}px) rotateX(90deg)`,
      }}
    >
      <div
        className={`flex size-full items-center justify-center rounded-lg text-[11px] font-bold shadow-md ${style.className} ${
          highlighted ? "ring-4 ring-sky-300" : ""
        } ${isStar ? "ring-2 ring-amber-200" : ""}`}
      >
        {facility ?? style.label}
      </div>
    </div>
  );
}

function Token({
  node,
  colorIdx,
  active,
  offset,
}: {
  node: BoardNode | undefined;
  colorIdx: 0 | 1 | 2 | 3;
  active: boolean;
  offset: number;
}) {
  if (!node) return null;
  const color = PLAYER_COLORS[colorIdx];
  return (
    <motion.div
      className="absolute"
      animate={{
        x: node.x + offset,
        y: (node.y ?? 0) - 14,
        z: node.z ?? 0,
      }}
      transition={{ duration: STEP_MS / 1000, ease: "easeInOut" }}
      style={{ width: 20, height: 20, marginLeft: -10, marginTop: -10 }}
    >
      <div
        className={`size-full rounded-full border-2 border-white/70 ${color.dot} ${
          active ? "ring-4 ring-white/50" : ""
        }`}
      />
    </motion.div>
  );
}
