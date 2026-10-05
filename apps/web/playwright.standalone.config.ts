import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "e2e-standalone.spec.ts", timeout: 60_000, use: { ...devices["Pixel 7"] } });
