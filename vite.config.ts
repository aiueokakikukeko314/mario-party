import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // GitHub Pages のプロジェクトサイトは /<repo>/ 配下に置かれるため、
  // CI では VITE_BASE=/mario-party/ を渡す。ローカル開発では "/" のまま。
  base: process.env["VITE_BASE"] ?? "/",
  plugins: [react(), tailwindcss()],
  server: {
    // npm run dev -- --host で LAN 内の実機から接続する運用
    host: true,
  },
});
