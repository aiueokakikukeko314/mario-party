import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages のプロジェクトサイトは /<repo>/ 配下に置かれるため、
  // CI では VITE_BASE=/mario-party/ を渡す。ローカル開発では "/" のまま。
  base: process.env["VITE_BASE"] ?? "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // 音とアイコンもオフラインで使えるようにする
      includeAssets: ["icons/*.png", "sounds/*.wav"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,wav}"],
        // 更新後に古いチャンクを掴み続けないよう、すぐ有効化する
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: "パーティゲーム",
        short_name: "パーティ",
        description: "スマホで遊ぶ すごろく＋ミニゲーム",
        lang: "ja",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    // npm run dev -- --host で LAN 内の実機から接続する運用
    host: true,
  },
});
