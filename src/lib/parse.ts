import { DEFAULT_BOARD_ID, DEFAULT_MAX_TURNS, DEFAULT_STARTING_COINS } from "../constants";
import type {
  BoardAction,
  BoardEventLog,
  BoardState,
  BonusAward,
  ColorIdx,
  DecisionType,
  GameConfig,
  Inventory,
  InputType,
  MinigameMode,
  MinigameState,
  PendingDecision,
  Phase,
  Player,
  PlayerInput,
  PlayerStats,
  Room,
  RoomMeta,
} from "../types";

/**
 * RTDB から降ってくる値は型が保証されないため、必ずここで検証してから使う。
 * CLAUDE.md セクション10 の「any 禁止 / unknown + 型ガード」に従う。
 *
 * 古い形の部屋が残っていてもクラッシュしないよう、
 * 新しく増えた項目には必ず既定値を入れる。
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

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const PHASES: readonly string[] = [
  "lobby", "gameSetup", "board", "minigameIntro",
  "minigame", "minigameResult", "finalBonus", "gameEnd",
];
const ACTIONS: readonly string[] = [
  "turnStart", "itemChoice", "diceRoll", "moving", "branchChoice",
  "passingEvent", "landingEvent", "playerEnd", "waiting",
];
const DECISIONS: readonly string[] = [
  "branch", "starPurchase", "shop", "itemChoice", "itemTarget", "eventChoice",
];
const INPUT_TYPES: readonly string[] = [
  "roll", "decision", "minigameScore", "useItem", "startGame",
];
const MODES: readonly string[] = ["ffa", "twoVsTwo", "oneVsThree"];

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
  const meta: RoomMeta = {
    hostId,
    phase,
    hostEpoch: asNumber(value["hostEpoch"]) ?? 0,
    createdAt: asNumber(value["createdAt"]) ?? 0,
  };
  const updatedAt = asNumber(value["updatedAt"]);
  if (updatedAt !== null) meta.updatedAt = updatedAt;
  return meta;
}

export function parseConfig(value: unknown): GameConfig {
  const record = isObject(value) ? value : {};
  return {
    boardId: asString(record["boardId"]) ?? DEFAULT_BOARD_ID,
    maxTurns: asNumber(record["maxTurns"]) ?? DEFAULT_MAX_TURNS,
    bonusAwardsEnabled: record["bonusAwardsEnabled"] !== false,
    itemsEnabled: record["itemsEnabled"] !== false,
    startingCoins: asNumber(record["startingCoins"]) ?? DEFAULT_STARTING_COINS,
  };
}

function parseStats(value: unknown): PlayerStats | null {
  if (!isObject(value)) return null;
  const pick = (key: string): number => asNumber(value[key]) ?? 0;
  return {
    spacesMoved: pick("spacesMoved"),
    minigameWins: pick("minigameWins"),
    minigameCoins: pick("minigameCoins"),
    coinsEarned: pick("coinsEarned"),
    coinsLost: pick("coinsLost"),
    itemsUsed: pick("itemsUsed"),
    shopSpent: pick("shopSpent"),
    luckyLanded: pick("luckyLanded"),
    unluckyLanded: pick("unluckyLanded"),
    eventLanded: pick("eventLanded"),
    starsBought: pick("starsBought"),
  };
}

function parseInventory(value: unknown): Inventory | null {
  if (!isObject(value)) return null;
  const inventory: Inventory = {};
  for (const slot of ["slot0", "slot1", "slot2"] as const) {
    const id = asString(value[slot]);
    if (id !== null) inventory[slot] = id;
  }
  return inventory;
}

export function parsePlayer(value: unknown): Player | null {
  if (!isObject(value)) return null;
  const name = asString(value["name"]);
  const colorIdx = asColorIdx(value["colorIdx"]);
  const order = asNumber(value["order"]);
  if (name === null || colorIdx === null || order === null) return null;

  const player: Player = {
    name,
    colorIdx,
    order,
    coins: asNumber(value["coins"]) ?? 0,
    stars: asNumber(value["stars"]) ?? 0,
    pos: asNumber(value["pos"]) ?? 0,
    connected: value["connected"] === true,
    lastSeen: asNumber(value["lastSeen"]) ?? 0,
  };
  const inventory = parseInventory(value["inventory"]);
  if (inventory) player.inventory = inventory;
  const stats = parseStats(value["stats"]);
  if (stats) player.stats = stats;
  if (value["shielded"] === true) player.shielded = true;
  return player;
}

function parsePlayers(value: unknown): Record<string, Player> | null {
  if (!isObject(value)) return null;
  const players: Record<string, Player> = {};
  for (const [uid, raw] of Object.entries(value)) {
    const player = parsePlayer(raw);
    if (player) players[uid] = player;
  }
  return players;
}

function parsePending(value: unknown): PendingDecision | null {
  if (!isObject(value)) return null;
  const id = asString(value["id"]);
  const uid = asString(value["uid"]);
  const type = asString(value["type"]);
  if (id === null || uid === null || type === null) return null;
  if (!DECISIONS.includes(type)) return null;
  return {
    id,
    uid,
    type: type as DecisionType,
    options: value["options"] ?? null,
    createdAt: asNumber(value["createdAt"]) ?? 0,
    timeoutAt: asNumber(value["timeoutAt"]) ?? 0,
  };
}

function parseEventLog(value: unknown): BoardEventLog | null {
  if (!isObject(value)) return null;
  const kind = asString(value["kind"]);
  const uid = asString(value["uid"]);
  const text = asString(value["text"]);
  if (kind === null || uid === null || text === null) return null;
  const log: BoardEventLog = { kind, uid, text, at: asNumber(value["at"]) ?? 0 };
  const coinDelta = asNumber(value["coinDelta"]);
  if (coinDelta !== null) log.coinDelta = coinDelta;
  const starDelta = asNumber(value["starDelta"]);
  if (starDelta !== null) log.starDelta = starDelta;
  return log;
}

function parseFlags(
  value: unknown,
): Record<string, boolean | number | string> | null {
  if (!isObject(value)) return null;
  const flags: Record<string, boolean | number | string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "boolean" || typeof raw === "number" || typeof raw === "string") {
      flags[key] = raw;
    }
  }
  return flags;
}

function parseNumberMap(value: unknown): Record<string, number> | null {
  if (!isObject(value)) return null;
  const map: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const num = asNumber(raw);
    if (num !== null) map[key] = num;
  }
  return map;
}

export function parseBoard(value: unknown): BoardState | null {
  if (!isObject(value)) return null;
  const turn = asNumber(value["turn"]);
  const currentUid = asString(value["currentUid"]);
  if (turn === null || currentUid === null) return null;

  const rawAction = asString(value["action"]);
  const board: BoardState = {
    turn,
    currentUid,
    currentOrderIndex: asNumber(value["currentOrderIndex"]) ?? 0,
    action:
      rawAction !== null && ACTIONS.includes(rawAction)
        ? (rawAction as BoardAction)
        : "waiting",
    diceTotal: asNumber(value["diceTotal"]),
    movesRemaining: asNumber(value["movesRemaining"]) ?? 0,
    starNodeId: asNumber(value["starNodeId"]) ?? 0,
    previousStarNodeId: asNumber(value["previousStarNodeId"]),
  };

  const diceValues = asNumberArray(value["diceValues"]);
  if (diceValues.length > 0) board.diceValues = diceValues;
  const pending = parsePending(value["pendingDecision"]);
  if (pending) board.pendingDecision = pending;
  const lastEvent = parseEventLog(value["lastEvent"]);
  if (lastEvent) board.lastEvent = lastEvent;
  const flags = parseFlags(value["boardFlags"]);
  if (flags) board.boardFlags = flags;
  const recent = asStringArray(value["recentMinigameIds"]);
  if (recent.length > 0) board.recentMinigameIds = recent;
  const seqs = parseNumberMap(value["lastProcessedInputSeq"]);
  if (seqs) board.lastProcessedInputSeq = seqs;
  if (value["finalRush"] === true) board.finalRush = true;
  return board;
}

function parseMinigame(value: unknown): MinigameState | null {
  if (!isObject(value)) return null;
  const rawMode = asString(value["mode"]);
  const state: MinigameState = {
    id: asString(value["id"]),
    startAt: asNumber(value["startAt"]),
    endAt: asNumber(value["endAt"]),
    ranking: asStringArray(value["ranking"]).length > 0
      ? asStringArray(value["ranking"])
      : Array.isArray(value["ranking"]) ? [] : null,
  };
  if (rawMode !== null && MODES.includes(rawMode)) {
    state.mode = rawMode as MinigameMode;
  }
  const seed = asNumber(value["seed"]);
  if (seed !== null) state.seed = seed;
  const teams = parseNumberMap(value["teams"]);
  if (teams) state.teams = teams;
  const scores = parseNumberMap(value["scores"]);
  if (scores) state.scores = scores;
  if (isObject(value["submitted"])) {
    const submitted: Record<string, boolean> = {};
    for (const [uid, raw] of Object.entries(value["submitted"])) {
      if (raw === true) submitted[uid] = true;
    }
    state.submitted = submitted;
  }
  return state;
}

function parseAwards(value: unknown): BonusAward[] {
  if (!Array.isArray(value)) return [];
  const awards: BonusAward[] = [];
  for (const raw of value) {
    if (!isObject(raw)) continue;
    const id = asString(raw["id"]);
    const title = asString(raw["title"]);
    if (id === null || title === null) continue;
    awards.push({
      id,
      title,
      description: asString(raw["description"]) ?? "",
      winners: asStringArray(raw["winners"]),
    });
  }
  return awards;
}

function parseInput(value: unknown): PlayerInput | null {
  if (!isObject(value)) return null;
  const type = asString(value["type"]);
  if (type === null || !INPUT_TYPES.includes(type)) return null;
  return {
    seq: asNumber(value["seq"]) ?? 0,
    actionId: asString(value["actionId"]) ?? "",
    type: type as InputType,
    payload: value["payload"] ?? null,
    ts: asNumber(value["ts"]) ?? 0,
  };
}

function parseInputs(value: unknown): Record<string, PlayerInput> | null {
  if (!isObject(value)) return null;
  const inputs: Record<string, PlayerInput> = {};
  for (const [uid, raw] of Object.entries(value)) {
    const input = parseInput(raw);
    if (input) inputs[uid] = input;
  }
  return inputs;
}

/** ルーム全体を検証する。meta が無いものはルームとして扱わない。 */
export function parseRoom(value: unknown): Room | null {
  if (!isObject(value)) return null;
  const meta = parseMeta(value["meta"]);
  if (meta === null) return null;

  const room: Room = { meta, config: parseConfig(value["config"]) };
  const players = parsePlayers(value["players"]);
  if (players) room.players = players;
  const board = parseBoard(value["board"]);
  if (board) room.board = board;
  const minigame = parseMinigame(value["minigame"]);
  if (minigame) room.minigame = minigame;
  const inputs = parseInputs(value["inputs"]);
  if (inputs) room.inputs = inputs;

  if (isObject(value["bonus"])) {
    room.bonus = {
      awards: parseAwards(value["bonus"]["awards"]),
      revealed: asNumber(value["bonus"]["revealed"]) ?? 0,
    };
  }
  return room;
}
