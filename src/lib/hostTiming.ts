/**
 * ホストの進行タイミング（ms）。演出の尺合わせに使う。
 *
 * ミニゲームの「同時開始」はここではなく startAt の絶対時刻で行う
 * （CLAUDE.md セクション6）。この定数は尺の調整専用。
 */

/** 1マス進むのにかける時間。Board3D の演出と揃える */
export const STEP_MS = 260;
/** 移動しきってからマス効果を出すまでの間 */
export const LAND_PAUSE_MS = 350;
/** マス効果を見せてから次の人に渡すまでの間 */
export const EFFECT_PAUSE_MS = 900;
/** star の購入確認に返事が来ないときに「やめる」とみなすまでの時間 */
export const STAR_CHOICE_TIMEOUT_MS = 15000;
/** ルール説明を読む時間。この分だけ先の絶対時刻を startAt にする */
export const INTRO_MS = 5000;
/** endAt を過ぎてもスコアが揃わないときに締め切るまでの猶予 */
export const SCORE_GRACE_MS = 3000;
/** 結果を見せてから次のターンへ移るまでの時間 */
export const RESULT_MS = 3000;
/** 切断中プレイヤーの手番を、待たずに自動で進めるまでの時間 */
export const DISCONNECT_ROLL_MS = 15000;
/** ホストが切断してから、次の人が引き継ぐまでの待ち時間 */
export const HANDOVER_DELAY_MS = 6000;
/** 時刻で進むフェーズの間だけ回す再評価の間隔 */
export const TICK_MS = 250;

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
