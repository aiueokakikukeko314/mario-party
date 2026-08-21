import type { BoardDef, BoardNode } from "../types";

/**
 * 標準ボード「パーティアイランド」。
 *
 * 24マスの本道に、内側を通る近道を2本つないだグラフ。
 * 近道の入口（4番と16番）が分岐点になる。
 *
 * 座標は見た目だけのもので、進行はすべて next[] で決まる。
 */

const RING = 24;
/** 本道の基準半径(px) */
const RADIUS = 140;
/** 半径のうねり */
const WOBBLE = 0.18;
/** 高さのうねり(px) */
const RISE = 20;
const WAVES = 3;

const angleOf = (index: number): number => (index / RING) * Math.PI * 2;

function ringPos(index: number): { x: number; y: number; z: number } {
  const t = angleOf(index);
  const radius = RADIUS * (1 + WOBBLE * Math.cos(WAVES * t));
  return {
    x: radius * Math.cos(t),
    y: -RISE * Math.sin(WAVES * t),
    z: radius * Math.sin(t),
  };
}

/** 近道のノード位置。始点と終点の角度の間を内側で結ぶ。 */
function innerPos(
  fromIndex: number,
  toIndex: number,
  step: number,
  steps: number,
): { x: number; y: number; z: number } {
  const from = angleOf(fromIndex);
  const to = angleOf(toIndex);
  const t = from + ((to - from) * (step + 1)) / (steps + 1);
  const radius = RADIUS * 0.44;
  return { x: radius * Math.cos(t), y: 12, z: radius * Math.sin(t) };
}

/** 本道のマス種別。0 はスタート。 */
const RING_TYPES: BoardNode["type"][] = [
  "start", "plus", "lucky", "minus",
  "empty", "plus", "item", "minus",
  "empty", "warp", "lucky", "event",
  "plus", "minus", "unlucky", "plus",
  "empty", "item", "empty", "lucky",
  "minus", "event", "plus", "unlucky",
];

const nodes: BoardNode[] = [];

for (let i = 0; i < RING; i++) {
  const pos = ringPos(i);
  const node: BoardNode = {
    id: i,
    ...pos,
    type: RING_TYPES[i] ?? "empty",
    next: [(i + 1) % RING],
  };
  if (i === 8 || i === 18) node.facility = "shop";
  if (i === 9) node.warpTo = 21;
  if (i === 11) node.eventId = "bridge-shift";
  if (i === 21) node.eventId = "coin-shuffle";
  nodes.push(node);
}

/** 近道1: 4 → 24 → 25 → 26 → 12 */
const SHORTCUT_A = [24, 25, 26];
const SHORTCUT_A_TYPES: BoardNode["type"][] = ["plus", "unlucky", "item"];
SHORTCUT_A.forEach((id, step) => {
  nodes.push({
    id,
    ...innerPos(4, 12, step, SHORTCUT_A.length),
    type: SHORTCUT_A_TYPES[step] ?? "empty",
    next: [step === SHORTCUT_A.length - 1 ? 12 : id + 1],
  });
});

/** 近道2: 16 → 27 → 28 → 20 */
const SHORTCUT_B = [27, 28];
const SHORTCUT_B_TYPES: BoardNode["type"][] = ["lucky", "minus"];
SHORTCUT_B.forEach((id, step) => {
  nodes.push({
    id,
    ...innerPos(16, 20, step, SHORTCUT_B.length),
    type: SHORTCUT_B_TYPES[step] ?? "empty",
    next: [step === SHORTCUT_B.length - 1 ? 20 : id + 1],
  });
});

// 分岐点を設定する（本道 or 近道）
const branchA = nodes[4];
if (branchA) branchA.next = [5, 24];
const branchB = nodes[16];
if (branchB) branchB.next = [17, 27];

export const partyIsland: BoardDef = {
  id: "party-island",
  name: "パーティアイランド",
  startNodeId: 0,
  // スターが置かれうる場所。本道と近道の両方に散らす
  starCandidates: [2, 6, 10, 14, 19, 22, 26, 27],
  nodes,
  // 近道2は「はしのむき」イベントで開け閉めする。
  // 初期状態は開いている（フラグ未設定 = 開）
  gates: [{ from: 16, to: 27, flag: "bridgeOpen" }],
};
