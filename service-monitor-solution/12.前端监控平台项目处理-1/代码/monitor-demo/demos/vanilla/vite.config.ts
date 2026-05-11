import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/dsn-api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/dsn-api/, "")
      }
    }
  }
});
