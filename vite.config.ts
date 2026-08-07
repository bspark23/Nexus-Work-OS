import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "server",
        // Mark firebase-admin and its ESM deps as external so they are not
        // bundled by esbuild (which would convert them to CJS, breaking jose).
        // The nft bundler in netlify.toml will include them via file tracing.
        externals: {
          external: [
            "firebase-admin",
            "firebase-admin/app",
            "firebase-admin/auth",
            "firebase-admin/firestore",
            "firebase-admin/storage",
            "jose",
            "jwks-rsa",
          ],
        },
      },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
