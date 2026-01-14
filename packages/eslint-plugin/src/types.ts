/**
 * Rule options for require-fixture-imports
 */
export interface RequireFixtureImportsOptions {
  /**
   * Additional imports to flag (beyond test and expect)
   * @default []
   */
  additionalImports?: string[];
}

/**
 * Plugin meta information
 */
export interface PluginMeta {
  name: string;
  version: string;
}

/**
 * ESLint rule severity level
 */
export type RuleSeverity = "off" | "warn" | "error" | 0 | 1 | 2;

/**
 * Plugin configuration object shape for flat config
 */
export interface FlatPluginConfig {
  plugins: Record<string, unknown>;
  rules: Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>;
}

/**
 * Plugin configuration object shape for legacy config
 */
export interface LegacyPluginConfig {
  plugins: string[];
  rules: Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>;
}
