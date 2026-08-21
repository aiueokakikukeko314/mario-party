/** ゲーム全体の調整値。ルールを変えたいときはここを触る。 */

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const MAX_NAME_LENGTH = 8;

/** ロビーで選べるターン数 */
export const TURN_OPTIONS = [10, 15, 20] as const;
export const DEFAULT_MAX_TURNS = 10;
export const DEFAULT_STARTING_COINS = 10;
export const DEFAULT_BOARD_ID = "party-island";

/** サイコロの目 */
export const DICE_MIN = 1;
export const DICE_MAX = 6;

/** plus / minus の増減 */
export const COIN_DELTA = 3;
/** スター1つの値段 */
export const STAR_COST = 20;
/** 持てるアイテムの数 */
export const INVENTORY_SIZE = 3;
/** コインマグネットで奪える枚数 */
export const COIN_MAGNET_AMOUNT = 5;
/** ショップで1回の訪問に買える数 */
export const SHOP_BUY_LIMIT = 1;
/** ショップに並ぶ商品数 */
export const SHOP_STOCK_SIZE = 3;

/** ミニゲーム報酬（4人対戦）。順位 0..3 */
export const MINIGAME_REWARDS = [10, 5, 2, 0] as const;
/** minigame マスに止まっていた人の報酬 */
export const MINIGAME_BONUS_REWARDS = [20, 10, 4, 0] as const;
/** 2vs2 の勝ちチーム / 引き分け */
export const TEAM_WIN_COINS = 10;
export const TEAM_DRAW_COINS = 5;
/** 1vs3 の報酬 */
export const SOLO_WIN_COINS = 15;
export const TRIO_WIN_COINS = 7;

/** 終盤の盛り上げ（Final Rush） */
export const FINAL_RUSH_ENABLED = true;
/** 残りこのターン数になったら Final Rush */
export const FINAL_RUSH_TURNS = 3;
/** Final Rush 中のコイン増減の倍率 */
export const FINAL_RUSH_COIN_MULTIPLIER = 2;
/** Final Rush 中のミニゲーム報酬の倍率 */
export const FINAL_RUSH_REWARD_MULTIPLIER = 2;

/** ボーナス賞で配るスター数と、選ぶ賞の数 */
export const BONUS_AWARD_STARS = 1;
export const BONUS_AWARD_COUNT = 3;

/** 選択待ちの制限時間(ms) */
export const TIMEOUT_ITEM_MS = 15000;
export const TIMEOUT_DICE_MS = 15000;
export const TIMEOUT_BRANCH_MS = 15000;
export const TIMEOUT_STAR_MS = 15000;
export const TIMEOUT_SHOP_MS = 20000;

/** 直近この本数のミニゲームは再抽選しない */
export const RECENT_MINIGAME_MEMORY = 2;
