import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Run tests sequentially to avoid database conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", ".next/", "test/", "*.config.ts", "*.config.js"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/app": path.resolve(__dirname, "./app"),
      "@/components": path.resolve(__dirname, "./components"),
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/core": path.resolve(__dirname, "./core"),
      "@/data": path.resolve(__dirname, "./data"),
      "@/types": path.resolve(__dirname, "./types"),
      "@/schemas": path.resolve(__dirname, "./schemas"),
    },
  },
})
