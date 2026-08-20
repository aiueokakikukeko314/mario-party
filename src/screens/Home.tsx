import { useState } from "react";
import { useRoom } from "../store/useRoom";
import { MAX_NAME_LENGTH } from "../constants";
import { isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";

/**
 * ホーム画面。名前を入れて「ルームを作る」か「コードで参加」。
 * ルームに入る前は meta.phase が存在しないため、ここだけローカル状態で切り替える。
 */
export default function Home() {
  const myName = useRoom((s) => s.myName);
  const setMyName = useRoom((s) => s.setMyName);
  const busy = useRoom((s) => s.busy);
  const error = useRoom((s) => s.error);
  const clearError = useRoom((s) => s.clearError);
  const create = useRoom((s) => s.create);
  const join = useRoom((s) => s.join);

  const [mode, setMode] = useState<"top" | "join">("top");
  const [code, setCode] = useState("");

  const nameReady = myName.trim().length > 0;
  const codeReady = isValidRoomCode(code);

  return (
    <main className="flex h-full flex-col justify-between p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="text-center text-3xl font-bold">パーティゲーム</h1>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-slate-400">なまえ</span>
          <input
            type="text"
            value={myName}
            onChange={(e) => {
              setMyName(e.target.value.slice(0, MAX_NAME_LENGTH));
              clearError();
            }}
            placeholder="なまえを入力"
            maxLength={MAX_NAME_LENGTH}
            // text-base = 16px。これ未満だと iOS Safari が自動ズームする
            className="min-h-14 rounded-xl bg-slate-800 px-4 text-base outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        {mode === "join" && (
          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">ルームコード（4桁）</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(normalizeRoomCode(e.target.value));
                clearError();
              }}
              placeholder="ABCD"
              className="min-h-14 rounded-xl bg-slate-800 px-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        )}

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {mode === "top" ? (
          <>
            <button
              type="button"
              disabled={!nameReady || busy}
              onClick={() => void create()}
              className="min-h-14 rounded-xl bg-sky-500 text-base font-bold text-white disabled:opacity-40"
            >
              ルームを作る
            </button>
            <button
              type="button"
              disabled={!nameReady || busy}
              onClick={() => {
                clearError();
                setMode("join");
              }}
              className="min-h-14 rounded-xl bg-slate-700 text-base font-bold disabled:opacity-40"
            >
              コードで参加
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!nameReady || !codeReady || busy}
              onClick={() => void join(code)}
              className="min-h-14 rounded-xl bg-sky-500 text-base font-bold text-white disabled:opacity-40"
            >
              {busy ? "参加しています…" : "参加する"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                clearError();
                setMode("top");
                setCode("");
              }}
              className="min-h-14 rounded-xl bg-slate-700 text-base disabled:opacity-40"
            >
              もどる
            </button>
          </>
        )}
      </div>
    </main>
  );
}
