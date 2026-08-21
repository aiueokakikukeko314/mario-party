/**
 * 効果音を合成して public/sounds/*.wav に書き出す。
 * 外部から音源を持ってこなくて済むよう、単純な波形から作っている。
 *
 *   node scripts/make-sounds.mjs
 *
 * 音を変えたいときはこのファイルを編集して再生成する。
 */
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;

/** 16bit モノラル WAV を組み立てる */
function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const wave = {
  square: (phase) => (phase % 1 < 0.5 ? 1 : -1),
  triangle: (phase) => 4 * Math.abs(((phase % 1) + 0.75) % 1 - 0.5) - 1,
  sine: (phase) => Math.sin(phase * Math.PI * 2),
  noise: () => Math.random() * 2 - 1,
};

/** 単音を書き込む。freq は数値か (t01)=>freq */
function tone(buffer, startSec, durSec, freq, { type = "square", gain = 0.3, decay = 3 } = {}) {
  const start = Math.floor(startSec * RATE);
  const length = Math.floor(durSec * RATE);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const index = start + i;
    if (index >= buffer.length) break;
    const t01 = i / length;
    const f = typeof freq === "function" ? freq(t01) : freq;
    phase += f / RATE;
    // 立ち上がりを少しつけて、プチッというノイズを防ぐ
    const attack = Math.min(1, t01 * 25);
    const env = attack * Math.exp(-decay * t01);
    buffer[index] += wave[type](phase) * gain * env;
  }
}

const make = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

const sounds = {
  // サイコロ: カラカラという転がり音
  dice: () => {
    const buf = make(0.5);
    for (let i = 0; i < 7; i++) {
      tone(buf, i * 0.055, 0.045, 200 + Math.random() * 500, {
        type: "noise", gain: 0.28, decay: 12,
      });
    }
    return buf;
  },
  // コイン取得: 2音の上昇
  coin: () => {
    const buf = make(0.45);
    tone(buf, 0, 0.08, 988, { type: "square", gain: 0.22, decay: 2 });
    tone(buf, 0.07, 0.32, 1319, { type: "square", gain: 0.22, decay: 4 });
    return buf;
  },
  // コインを失う: 下降
  lose: () => {
    const buf = make(0.4);
    tone(buf, 0, 0.35, (t) => 440 - t * 220, { type: "square", gain: 0.2, decay: 4 });
    return buf;
  },
  // カウントダウンの「ピッ」
  tick: () => {
    const buf = make(0.16);
    tone(buf, 0, 0.12, 880, { type: "square", gain: 0.2, decay: 8 });
    return buf;
  },
  // 開始の「ポーン」
  start: () => {
    const buf = make(0.5);
    tone(buf, 0, 0.45, (t) => 660 + t * 660, { type: "triangle", gain: 0.28, decay: 3 });
    return buf;
  },
  // ボタンのタップ
  tap: () => {
    const buf = make(0.1);
    tone(buf, 0, 0.07, 1200, { type: "square", gain: 0.14, decay: 12 });
    return buf;
  },
  // スター購入
  star: () => {
    const buf = make(0.8);
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(buf, i * 0.09, 0.5, f, { type: "triangle", gain: 0.22, decay: 3 });
    });
    return buf;
  },
  // 勝利のファンファーレ
  win: () => {
    const buf = make(1.6);
    const melody = [
      [523, 0.0, 0.18], [659, 0.16, 0.18], [784, 0.32, 0.18],
      [1047, 0.48, 0.5], [784, 0.95, 0.16], [1047, 1.1, 0.45],
    ];
    for (const [f, at, dur] of melody) {
      tone(buf, at, dur, f, { type: "square", gain: 0.2, decay: 2 });
      tone(buf, at, dur, f / 2, { type: "triangle", gain: 0.12, decay: 2 });
    }
    return buf;
  },
};

mkdirSync("public/sounds", { recursive: true });
let total = 0;
for (const [name, build] of Object.entries(sounds)) {
  const wav = toWav(build());
  writeFileSync(`public/sounds/${name}.wav`, wav);
  total += wav.length;
  console.log(`  ${name}.wav  ${(wav.length / 1024).toFixed(1)} KB`);
}
console.log(`合計 ${(total / 1024).toFixed(1)} KB`);
