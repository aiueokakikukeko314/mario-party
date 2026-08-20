import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root が見つかりません");
const root = createRoot(container);

/**
 * firebase.ts は .env.local が未設定だと読み込み時に例外を投げる。
 * 真っ白な画面にならないよう、動的 import して失敗時は設定手順を表示する。
 */
async function boot(): Promise<void> {
  try {
    const { default: App } = await import("./App");
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div className="flex h-full flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-bold text-red-400">初期化に失敗しました</h1>
        <pre className="whitespace-pre-wrap text-sm text-slate-300">
          {message}
        </pre>
      </div>,
    );
  }
}

void boot();
