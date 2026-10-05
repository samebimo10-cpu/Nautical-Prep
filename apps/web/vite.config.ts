import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";

const STANDALONE = process.env.VITE_STANDALONE === "1";

export default defineConfig({
  ...(STANDALONE ? { base: "./", resolve: { alias: { "virtual:pwa-register": new URL("./src/lib/pwa-stub.ts", import.meta.url).pathname } } } : {}),
  plugins: [
    react(),
    ...(STANDALONE ? [viteSingleFile()] : []),
    !STANDALONE && VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Chief Mate Prep",
        short_name: "Chief Mate",
        description: "Offline-first Chief Mate CoC (STCW II/2) exam preparation with an oral examiner.",
        theme_color: "#0b2545",
        background_color: "#0b2545",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/bundles\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/bundles/manifest.json",
            handler: "NetworkFirst",
            options: { cacheName: "bundle-manifest", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/bundles/") && url.pathname.endsWith(".gz"),
            handler: "CacheFirst",
            options: { cacheName: "content-bundles", expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2020",
    outDir: STANDALONE ? "dist-standalone" : "dist",
    copyPublicDir: !STANDALONE,
    chunkSizeWarningLimit: 600,
    rollupOptions: STANDALONE ? {} : {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          data: ["dexie", "dexie-react-hooks", "zod"],
        },
      },
    },
  },
});
