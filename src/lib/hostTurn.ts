import {
  applySquareEffect,
  BOARD_SIZE,
  applyDice,
  needsStarChoice,
  type PlayersState,
} from "../logic/board";
import { sortPlayers } from "../logic/lobby";
import {
  clearInput,
  setPhase,
  updateBoard,
  writePlayerStats,
} from "./dbGame";
import { EFFECT_PAUSE_MS, LAND_PAUSE_MS, STEP_MS, wait } from "./hostTiming";
import type { Room } from "../types";

/**
 * ホストだけが実行するターン進行（CLAUDE.md セクション3）。
 * 乱数（サイコロ・ワープ先）はすべてここで生成する。
 */

/** 1〜6 の出目。ホストだけが呼ぶ。 */
function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** サイコロを振ってコマを進め、マス効果まで処理する。 */
export async function handleRoll(
  roomCode: string,
  room: Room,
  uid: string,
): Promise<void> {
  const players = room.players ?? {};
  if (!room.board) return;

  // 同じ入力を二度処理しないよう、先に消す
  await clearInput(roomCode, uid);

  const dice = rollDice();
  const moved = applyDice(players, uid, dice);
  const movedPlayer = moved[uid];
  if (!movedPlayer) return;

  // 出目を見せ、コマを進める（各端末が pos の変化をアニメーションする）
  await updateBoard(roomCode, { dice, animating: true });
  await writePlayerStats(roomCode, uid, {
    coins: movedPlayer.coins,
    stars: movedPlayer.stars,
    pos: movedPlayer.pos,
  });

  await wait(dice * STEP_MS + LAND_PAUSE_MS);

  // star マスは本人に買うかどうか聞く。返事は inputs 経由で戻ってくる
  if (needsStarChoice(moved, uid)) {
    await updateBoard(roomCode, { animating: false, pending: "star" });
    return;
  }

  // warp の移動先もホストが決める
  const warpTarget = Math.floor(Math.random() * BOARD_SIZE);
  await applyEffectAndAdvance(roomCode, moved, uid, {
    warpTarget,
    buyStar: false,
  });
}

/** 本人が選んだ「買う / やめる」を反映して手番を進める。 */
export async function handleStarChoice(
  roomCode: string,
  room: Room,
  uid: string,
  buyStar: boolean,
): Promise<void> {
  await clearInput(roomCode, uid);
  await updateBoard(roomCode, { pending: null });
  await applyEffectAndAdvance(roomCode, room.players ?? {}, uid, {
    warpTarget: 0, // star マスなので使われない
    buyStar,
  });
}

async function applyEffectAndAdvance(
  roomCode: string,
  players: PlayersState,
  uid: string,
  ctx: { warpTarget: number; buyStar: boolean },
): Promise<void> {
  const { players: after } = applySquareEffect(players, uid, ctx);
  const afterPlayer = after[uid];
  if (afterPlayer) {
    await writePlayerStats(roomCode, uid, {
      coins: afterPlayer.coins,
      stars: afterPlayer.stars,
      pos: afterPlayer.pos,
    });
  }

  await wait(EFFECT_PAUSE_MS);

  // 次の人へ。全員振り終わっていたらミニゲームへ
  const ordered = sortPlayers(players);
  const currentIndex = ordered.findIndex((entry) => entry.uid === uid);
  const next = ordered[currentIndex + 1];
  if (next) {
    await updateBoard(roomCode, {
      currentUid: next.uid,
      dice: null,
      animating: false,
    });
  } else {
    await updateBoard(roomCode, { animating: false });
    await setPhase(roomCode, "minigameIntro");
  }
}

