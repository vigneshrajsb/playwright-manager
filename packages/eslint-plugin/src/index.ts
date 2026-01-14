import requireFixtureImports from "./rules/require-fixture-imports";
import type { PluginMeta, FlatPluginConfig, LegacyPluginConfig } from "./types";

const meta: PluginMeta = {
  name: "@playwright-manager/eslint-plugin",
  version: "0.1.0",
};

/**
 * ESLint plugin for @playwright-manager
 * Enforces correct import patterns for Playwright test integration
 */
const plugin = {
  meta,
  rules: {
    "require-fixture-imports": requireFixtureImports,
  },
  configs: {} as {
    recommended: FlatPluginConfig[];
    "legacy-recommended": LegacyPluginConfig;
  },
};

// Define configs after plugin object is created (for self-reference)
plugin.configs = {
  // Flat config format (ESLint 9+)
  recommended: [
    {
      plugins: {
        "@playwright-manager": plugin,
      },
      rules: {
        "@playwright-manager/require-fixture-imports": "error",
      },
    },
  ],

  // Legacy config format (ESLint 8 and below)
  "legacy-recommended": {
    plugins: ["@playwright-manager"],
    rules: {
      "@playwright-manager/require-fixture-imports": "error",
    },
  },
};

export = plugin;
