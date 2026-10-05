import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/web/src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/calc/src/**", "packages/learning/src/**"],
      reporter: ["text-summary", "text"],
    },
  },
});
