/**
 * database.rules.json を Realtime Database エミュレータで検証する。
 *
 *   端末A: npx firebase emulators:start --only database --project demo-party
 *   端末B: node scripts/test-rules.mjs
 *
 * CLAUDE.md セクション9 の要件を1つずつ実際に試して、
 * 許可されるべき操作が通り、拒否されるべき操作が弾かれることを確かめる。
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

const env = await initializeTestEnvironment({
  projectId: "demo-party",
  database: {
    host: "127.0.0.1",
    port: 9000,
    rules: readFileSync("database.rules.json", "utf8"),
  },
});

const ROOM = "AB2C";
const seed = {
  meta: { hostId: "host1", hostEpoch: 1, phase: "board", createdAt: 1 },
  config: { boardId: "party-island", maxTurns: 10, bonusAwardsEnabled: true, itemsEnabled: true, startingCoins: 10 },
  players: {
    host1: { name: "ホスト", colorIdx: 0, order: 0, coins: 10, stars: 1, pos: 3, connected: true, lastSeen: 1,
             inventory: { slot0: "shield" }, stats: { spacesMoved: 3 } },
    p2: { name: "ふたり", colorIdx: 1, order: 1, coins: 5, stars: 0, pos: 1, connected: true, lastSeen: 1 },
  },
  board: { turn: 1, currentUid: "host1", currentOrderIndex: 0, action: "diceRoll",
           diceTotal: null, movesRemaining: 0, starNodeId: 2, previousStarNodeId: null },
};

async function reset(overrides = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    // 前のケースが作った部屋を残さない（テスト同士が影響し合わないように）
    await ctx.database().ref("rooms").set(null);
    await ctx.database().ref(`rooms/${ROOM}`).set({ ...seed, ...overrides });
  });
}

const host = () => env.authenticatedContext("host1").database();
const other = () => env.authenticatedContext("p2").database();
const anon = () => env.unauthenticatedContext().database();

let pass = 0;
let fail = 0;

/** 特定の状態を作ってから試す。 */
async function expectIn(kind, label, overrides, action) {
  await reset(overrides);
  try {
    await (kind === "allow" ? assertSucceeds(action()) : assertFails(action()));
    console.log(`  ✅ ${label}`);
    pass++;
  } catch (error) {
    console.log(`  ❌ ${label}`);
    console.log(`     → ${String(error).split("\n")[0].slice(0, 120)}`);
    fail++;
  }
}

async function expect(kind, label, action) {
  await reset();
  try {
    await (kind === "allow" ? assertSucceeds(action()) : assertFails(action()));
    console.log(`  ✅ ${label}`);
    pass++;
  } catch (error) {
    console.log(`  ❌ ${label}`);
    console.log(`     → ${String(error).split("\n")[0].slice(0, 120)}`);
    fail++;
  }
}

console.log("── 読み取り ──");
await expect("allow", "認証済みなら誰でもルームを読める", () =>
  other().ref(`rooms/${ROOM}`).get());
await expect("deny", "未認証では読めない", () =>
  anon().ref(`rooms/${ROOM}`).get());

console.log("── ホストだけが書ける領域 ──");
await expect("allow", "ホストは board を書ける", () =>
  host().ref(`rooms/${ROOM}/board/dice`).set(6));
await expect("deny", "他人は board を書けない", () =>
  other().ref(`rooms/${ROOM}/board/dice`).set(6));
await expect("allow", "ホストは phase を進められる", () =>
  host().ref(`rooms/${ROOM}/meta/phase`).set("minigameIntro"));
await expect("deny", "他人は phase を変えられない", () =>
  other().ref(`rooms/${ROOM}/meta/phase`).set("gameEnd"));
await expect("deny", "知らない phase は弾かれる", () =>
  host().ref(`rooms/${ROOM}/meta/phase`).set("cheat"));
await expect("allow", "ホストは minigame を書ける", () =>
  host().ref(`rooms/${ROOM}/minigame`).set({ id: "tap-battle", startAt: 1, endAt: 2, ranking: null }));
await expect("deny", "他人は minigame を書けない", () =>
  other().ref(`rooms/${ROOM}/minigame/scores/p2`).set(9999));

console.log("── players（本人のみ、ただし coins/stars/pos はホストのみ）──");
await expectIn("allow", "ロビー中は自分の名前を変えられる", { meta: { ...seed.meta, phase: "lobby" } }, () =>
  other().ref(`rooms/${ROOM}/players/p2/name`).set("あたらしい"));
await expect("deny", "他人の名前は変えられない", () =>
  other().ref(`rooms/${ROOM}/players/host1/name`).set("のっとり"));
await expect("deny", "本人でもコインは増やせない", () =>
  other().ref(`rooms/${ROOM}/players/p2/coins`).set(999));
await expect("deny", "本人でもスターは増やせない", () =>
  other().ref(`rooms/${ROOM}/players/p2/stars`).set(99));
await expect("deny", "本人でもコマは動かせない", () =>
  other().ref(`rooms/${ROOM}/players/p2/pos`).set(20));
await expect("allow", "ホストはコインを変えられる", () =>
  host().ref(`rooms/${ROOM}/players/p2/coins`).set(40));
await expect("allow", "ホストはコマを動かせる", () =>
  host().ref(`rooms/${ROOM}/players/p2/pos`).set(7));
await expect("deny", "コインをマイナスにはできない", () =>
  host().ref(`rooms/${ROOM}/players/p2/coins`).set(-5));
await expect("allow", "本人は connected を書ける（onDisconnect 用）", () =>
  other().ref(`rooms/${ROOM}/players/p2/connected`).set(false));
await expect("deny", "名前は8文字まで", () =>
  other().ref(`rooms/${ROOM}/players/p2/name`).set("あいうえおかきくけこ"));

console.log("── プレイヤーが書けてはいけないもの ──");
await expect("deny", "自分の order を書き換えられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/order`).set(0));
await expect("deny", "自分の colorIdx を書き換えられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/colorIdx`).set(0));
await expect("deny", "自分の inventory を書き換えられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/inventory`).set({ slot0: "triple-dice" }));
await expect("deny", "自分の stats を書き換えられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/stats/minigameWins`).set(99));
await expect("deny", "自分に shield を付けられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/shielded`).set(true));
await expect("deny", "ゲーム中は名前を変えられない", () =>
  other().ref(`rooms/${ROOM}/players/p2/name`).set("べつめい"));
await expect("allow", "ホストは inventory を配れる", () =>
  host().ref(`rooms/${ROOM}/players/p2/inventory`).set({ slot0: "shield" }));
await expect("allow", "ホストは stats を更新できる", () =>
  host().ref(`rooms/${ROOM}/players/p2/stats/spacesMoved`).set(7));
await expect("allow", "再接続で connected と lastSeen は書ける", () =>
  other().ref(`rooms/${ROOM}/players/p2`).update({ connected: true, lastSeen: 2 }));

console.log("── config / bonus ──");
await expect("allow", "ホストは設定を変えられる", () =>
  host().ref(`rooms/${ROOM}/config/maxTurns`).set(15));
await expect("deny", "他人は設定を変えられない", () =>
  other().ref(`rooms/${ROOM}/config/maxTurns`).set(20));
await expect("deny", "ターン数に極端な値は入れられない", () =>
  host().ref(`rooms/${ROOM}/config/maxTurns`).set(9999));
await expect("deny", "他人は bonus を書けない", () =>
  other().ref(`rooms/${ROOM}/bonus`).set({ awards: [], revealed: 0 }));

console.log("── hostEpoch ──");
await expect("deny", "epoch を巻き戻せない", () =>
  host().ref(`rooms/${ROOM}/meta/hostEpoch`).set(0));
await expect("allow", "ホストは epoch を進められる", () =>
  host().ref(`rooms/${ROOM}/meta/hostEpoch`).set(2));

console.log("── inputs（自分の分だけ）──");
const goodInput = { seq: 1, actionId: "a", type: "roll", payload: null, ts: 1 };
await expect("allow", "自分の入力は書ける", () =>
  other().ref(`rooms/${ROOM}/inputs/p2`).set(goodInput));
await expect("deny", "他人になりすまして入力できない", () =>
  other().ref(`rooms/${ROOM}/inputs/host1`).set(goodInput));
await expect("deny", "知らない type の入力は書けない", () =>
  other().ref(`rooms/${ROOM}/inputs/p2`).set({ ...goodInput, type: "cheat" }));
await expect("deny", "seq がマイナスの入力は書けない", () =>
  other().ref(`rooms/${ROOM}/inputs/p2`).set({ ...goodInput, seq: -1 }));
await expect("deny", "actionId が長すぎる入力は書けない", () =>
  other().ref(`rooms/${ROOM}/inputs/p2`).set({ ...goodInput, actionId: "x".repeat(200) }));
await expect("allow", "ホストは処理済みの入力を消せる", () =>
  host().ref(`rooms/${ROOM}/inputs/p2`).remove());

console.log("── 参加（自分の players ノードを新規作成する）──");
await expectIn("allow", "ロビー中は新しい参加者が自分の席を作れる", { meta: { ...seed.meta, phase: "lobby" } }, () =>
  env.authenticatedContext("p3").database().ref(`rooms/${ROOM}/players/p3`).set(
    { name: "さん", colorIdx: 2, order: 2, coins: 0, stars: 0, pos: 0, connected: true, lastSeen: 1 }));
await expect("deny", "ゲーム開始後は新規参加できない", () =>
  env.authenticatedContext("p4").database().ref(`rooms/${ROOM}/players/p4`).set(
    { name: "よん", colorIdx: 3, order: 3, coins: 0, stars: 0, pos: 0, connected: true, lastSeen: 1 }));
await expect("deny", "有利な位置から参加できない", () =>
  env.authenticatedContext("p3").database().ref(`rooms/${ROOM}/players/p3`).set(
    { name: "さん", colorIdx: 2, order: 2, coins: 0, stars: 0, pos: 15, connected: true, lastSeen: 1 }));
await expect("deny", "コインを持った状態では参加できない", () =>
  env.authenticatedContext("p3").database().ref(`rooms/${ROOM}/players/p3`).set(
    { name: "さん", colorIdx: 2, order: 2, coins: 500, stars: 0, pos: 0, connected: true, lastSeen: 1 }));
await expect("deny", "スターを持った状態では参加できない", () =>
  env.authenticatedContext("p3").database().ref(`rooms/${ROOM}/players/p3`).set(
    { name: "さん", colorIdx: 2, order: 2, coins: 0, stars: 3, pos: 0, connected: true, lastSeen: 1 }));
await expect("allow", "退出（自分の席を消す）", () =>
  other().ref(`rooms/${ROOM}/players/p2`).remove());

console.log("── 部屋の作成・解散 ──");
await expect("allow", "自分をホストにして部屋を作れる", () =>
  other().ref("rooms/NEW1").set({
    meta: { hostId: "p2", phase: "lobby", createdAt: 1, maxTurns: 10 },
    players: { p2: { name: "新", colorIdx: 0, order: 0, coins: 0, stars: 0, pos: 0, connected: true, lastSeen: 1 } },
  }));
await expect("deny", "他人をホストにした部屋は作れない", () =>
  other().ref("rooms/NEW2").set({
    meta: { hostId: "someoneelse", phase: "lobby", createdAt: 1, maxTurns: 10 },
  }));
await expect("allow", "ホストは部屋を解散できる", () =>
  host().ref(`rooms/${ROOM}`).remove());
await expect("deny", "他人は部屋を消せない", () =>
  other().ref(`rooms/${ROOM}`).remove());

console.log("── ホスト移譲（セクション12）──");
// ホストが接続中のあいだは奪えない
await expect("deny", "ホストが生きているうちは乗っ取れない", () =>
  other().ref(`rooms/${ROOM}/meta/hostId`).set("p2"));
// ホストが切断したら引き継げる
const awayHost = {
  ...seed,
  players: {
    ...seed.players,
    host1: { ...seed.players.host1, connected: false },
  },
};
async function withAwayHost(action) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(`rooms/${ROOM}`).set(awayHost);
  });
  return action();
}
try {
  await assertSucceeds(withAwayHost(() =>
    other().ref(`rooms/${ROOM}/meta/hostId`).set("p2")));
  console.log("  ✅ ホストが切断したら接続中の人が引き継げる");
  pass++;
} catch (error) {
  console.log("  ❌ ホストが切断したら接続中の人が引き継げる");
  console.log(`     → ${String(error).split("\n")[0].slice(0, 120)}`);
  fail++;
}
try {
  await assertFails(withAwayHost(() =>
    other().ref(`rooms/${ROOM}/meta/hostId`).set("someoneelse")));
  console.log("  ✅ 引き継げるのは自分にだけ（別人を立てられない）");
  pass++;
} catch (error) {
  console.log("  ❌ 引き継げるのは自分にだけ（別人を立てられない）");
  console.log(`     → ${String(error).split("\n")[0].slice(0, 120)}`);
  fail++;
}

console.log(`\n合格 ${pass} 件 / 不合格 ${fail} 件`);
await env.cleanup();
process.exit(fail === 0 ? 0 : 1);
