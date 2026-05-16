import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.{js,mjs}"],
    environment: "node",
    testTimeout: 20000,
    // Migration test mutates process.env.DATA_DIR and opens a real SQLite
    // file; isolate it from other tests by running suites sequentially.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
