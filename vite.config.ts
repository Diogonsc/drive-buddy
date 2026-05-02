import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "logo.png"],
      manifest: {
        name: "Swiftwapdrive - WhatsApp to Google Drive",
        short_name: "Swiftwapdrive",
        description: "Sincronize mídias do WhatsApp direto para o Google Drive",
        theme_color: "#24b59f",
        background_color: "#24b59f",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "/logo.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
