import { Howl } from "howler";

/**
 * 効果音（CLAUDE.md セクション2: Howler.js / セクション11）。
 *
 * iOS Safari は「ユーザー操作より前」に音を鳴らせないため、
 * 最初のタップまで Howl を作らない。initSound() を最初の操作で呼ぶこと。
 *
 * 音源は scripts/make-sounds.mjs で合成して public/sounds に置いている。
 */

const FILES = {
  dice: "dice.wav",
  coin: "coin.wav",
  lose: "lose.wav",
  tick: "tick.wav",
  start: "start.wav",
  tap: "tap.wav",
  star: "star.wav",
  item: "item.wav",
  branch: "branch.wav",
  shop: "shop.wav",
  event: "event.wav",
  win: "win.wav",
} as const;

export type SoundName = keyof typeof FILES;

const STORAGE_KEY = "party-game:muted";

let howls: Partial<Record<SoundName, Howl>> | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // プライベートモードなどで読めなくても止まらない
    return false;
  }
}

/**
 * 最初のユーザー操作で呼ぶ。2回目以降は何もしない。
 * GitHub Pages ではサブパス配信なので BASE_URL を前に付ける。
 */
export function initSound(): void {
  if (howls !== null) return;
  const base = import.meta.env.BASE_URL;
  howls = {};
  for (const [name, file] of Object.entries(FILES)) {
    howls[name as SoundName] = new Howl({
      src: [`${base}sounds/${file}`],
      volume: 0.6,
      preload: true,
    });
  }
}

/** 効果音を鳴らす。未初期化・ミュート時は何もしない。 */
export function playSound(name: SoundName): void {
  if (muted || howls === null) return;
  try {
    howls[name]?.play();
  } catch {
    // 再生できなくてもゲームは続ける
  }
}

export function isMuted(): boolean {
  return muted;
}

/** ミュートを切り替えて、次回起動にも引き継ぐ。 */
export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // 保存できなくても今回の設定は効く
  }
}
