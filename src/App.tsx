import { useEffect, useState } from "react";
import { authReady } from "./lib/firebase";
import { subscribeConnected } from "./lib/db";
import { getServerOffset, startTimeSync, subscribeServerOffset } from "./lib/time";

/**
 * Phase 0 の確認用画面。
 * RTDB への接続状態・匿名認証で得た uid・サーバー時刻とのズレを表示するだけ。
 * ロビー以降の画面は Phase 1 で meta.phase に従って出し分ける。
 */
export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [offset, setOffset] = useState(getServerOffset());

  useEffect(() => {
    startTimeSync();
  }, []);

  useEffect(() => {
    let alive = true;
    authReady.then(
      (value) => {
        if (alive) setUid(value);
      },
      (error: unknown) => {
        if (alive) {
          setAuthError(error instanceof Error ? error.message : String(error));
        }
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => subscribeConnected(setConnected), []);
  useEffect(() => subscribeServerOffset(setOffset), []);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">パーティゲーム — Phase 0</h1>

      <dl className="w-full max-w-sm space-y-3 rounded-xl bg-slate-800 p-5 text-sm">
        <Row label="RTDB 接続">
          <span className={connected ? "text-emerald-400" : "text-amber-400"}>
            {connected ? "接続中" : "未接続"}
          </span>
        </Row>

        <Row label="自分の UID">
          {authError ? (
            <span className="text-red-400">{authError}</span>
          ) : uid ? (
            <span className="font-mono break-all">{uid}</span>
          ) : (
            <span className="text-slate-400">サインイン中…</span>
          )}
        </Row>

        <Row label="サーバー時刻とのズレ">
          <span className="font-mono">{offset} ms</span>
        </Row>
      </dl>

      <p className="max-w-sm text-center text-xs text-slate-400">
        接続中になり UID が表示されれば Phase 0 は完了です。
      </p>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className="ml-0">{children}</dd>
    </div>
  );
}
