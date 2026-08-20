import type {
  BoardState,
  ColorIdx,
  MinigameState,
  Phase,
  Player,
  PlayerInput,
  Room,
  RoomMeta,
} from "../types";

/**
 * RTDB から降ってくる値は型が保証されないため、必ずここで検証してから使う。
 * CLAUDE.md セクション10 の「any 禁止 / unknown + 型ガード」に従う。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const PHASES: readonly string[] = [
  "lobby",
  "board",
  "minigameIntro",
  "minigame",
  "minigameResult",
  "gameEnd",
];

function asPhase(value: unknown): Phase | null {
  return typeof value === "string" && PHASES.includes(value)
    ? (value as Phase)
    : null;
}

function asColorIdx(value: unknown): ColorIdx | null {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
}

export function parseMeta(value: unknown): RoomMeta | null {
  if (!isObject(value)) return null;
  const hostId = asString(value["hostId"]);
  const phase = asPhase(value["phase"]);
  if (hostId === null || phase === null) return null;
  return {
    hostId,
    phase,
    createdAt: asNumber(value["createdAt"]) ?? 0,
    maxTurns: asNumber(value["maxTurns"]) ?? 0,
  };
}

export function parsePlayer(value: unknown): Player | null {
  if (!isObject(value)) return null;
  const name = asString(value["name"]);
  const colorIdx = asColorIdx(value["colorIdx"]);
  const order = asNumber(value["order"]);
  if (name === null || colorIdx === null || order === null) return null;
  return {
    name,
    colorIdx,
    order,
    coins: asNumber(value["coins"]) ?? 0,
    stars: asNumber(value["stars"]) ?? 0,
    pos: asNumber(value["pos"]) ?? 0,
    connected: value["connected"] === true,
    lastSeen: asNumber(value["lastSeen"]) ?? 0,
  };
}

function parsePlayers(value: unknown): Record<string, Player> | null {
  if (!isObject(value)) return null;
  const players: Record<string, Player> = {};
  for (const [uid, raw] of Object.entries(value)) {
    const player = parsePlayer(raw);
    // 壊れたレコードは黙って捨てる（1人分の欠損で全体を落とさない）
    if (player) players[uid] = player;
  }
  return players;
}

function parseBoard(value: unknown): BoardState | null {
  if (!isObject(value)) return null;
  const turn = asNumber(value["turn"]);
  const currentUid = asString(value["currentUid"]);
  if (turn === null || currentUid === null) return null;
  return {
    turn,
    currentUid,
    dice: asNumber(value["dice"]),
    animating: value["animating"] === true,
  };
}

function parseMinigame(value: unknown): MinigameState | null {
  if (!isObject(value)) return null;
  const rawRanking = value["ranking"];
  const ranking = Array.isArray(rawRanking)
    ? rawRanking.filter((uid): uid is string => typeof uid === "string")
    : null;

  const state: MinigameState = {
    id: asString(value["id"]),
    startAt: asNumber(value["startAt"]),
    endAt: asNumber(value["endAt"]),
    ranking,
  };

  const rawScores = value["scores"];
  if (isObject(rawScores)) {
    const scores: Record<string, number> = {};
    for (const [uid, raw] of Object.entries(rawScores)) {
      const score = asNumber(raw);
      if (score !== null) scores[uid] = score;
    }
    state.scores = scores;
  }
  return state;
}

function parseInputs(value: unknown): Record<string, PlayerInput> | null {
  if (!isObject(value)) return null;
  const inputs: Record<string, PlayerInput> = {};
  for (const [uid, raw] of Object.entries(value)) {
    if (!isObject(raw)) continue;
    const type = asString(raw["type"]);
    if (type === null) continue;
    inputs[uid] = { type, value: raw["value"], ts: asNumber(raw["ts"]) ?? 0 };
  }
  return inputs;
}

/** ルーム全体を検証する。meta が無いものはルームとして扱わない。 */
export function parseRoom(value: unknown): Room | null {
  if (!isObject(value)) return null;
  const meta = parseMeta(value["meta"]);
  if (meta === null) return null;

  const room: Room = { meta };
  // exactOptionalPropertyTypes のため、値がある時だけキーを生やす
  const players = parsePlayers(value["players"]);
  if (players) room.players = players;
  const board = parseBoard(value["board"]);
  if (board) room.board = board;
  const minigame = parseMinigame(value["minigame"]);
  if (minigame) room.minigame = minigame;
  const inputs = parseInputs(value["inputs"]);
  if (inputs) room.inputs = inputs;
  return room;
}
