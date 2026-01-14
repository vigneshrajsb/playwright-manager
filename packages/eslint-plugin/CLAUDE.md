# @playwright-manager/eslint-plugin

ESLint plugin that enforces importing `test` and `expect` from `@playwright-manager/fixture` instead of `@playwright/test`.

## Usage

### Installation

```bash
npm install -D @playwright-manager/eslint-plugin
# or
pnpm add -D @playwright-manager/eslint-plugin
```

### Configuration

**Flat Config (ESLint 9+):**

```javascript
// eslint.config.mjs
import playwrightManager from "@playwright-manager/eslint-plugin";

export default [
  // Apply to all files
  ...playwrightManager.configs.recommended,

  // Or apply only to test files
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    plugins: { "@playwright-manager": playwrightManager },
    rules: { "@playwright-manager/require-fixture-imports": "error" },
  },
];
```

**Legacy Config (ESLint 8):**

```json
{
  "plugins": ["@playwright-manager"],
  "rules": {
    "@playwright-manager/require-fixture-imports": "error"
  }
}
```

### Rule Options

```javascript
{
  "@playwright-manager/require-fixture-imports": ["error", {
    // Flag additional imports beyond test and expect
    "additionalImports": ["mergeTests"]
  }]
}
```

### Rule Behavior

**Flags (error):**
- `import { test } from "@playwright/test"`
- `import { expect } from "@playwright/test"`
- `import { test, expect } from "@playwright/test"`
- `import test from "@playwright/test"` (default import)

**Allows:**
- `import { test, expect } from "@playwright-manager/fixture"` (correct)
- `import { Page, Browser } from "@playwright/test"` (utilities)
- `import type { TestInfo } from "@playwright/test"` (types)
- `import * as pw from "@playwright/test"` (namespace)

**Auto-fix:**
- Simple case: Changes import source to `@playwright-manager/fixture`
- Mixed imports: Splits into two import statements

## Development

```bash
# Build the package
pnpm --filter @playwright-manager/eslint-plugin build

# Watch mode
pnpm --filter @playwright-manager/eslint-plugin dev

# Clean build artifacts
pnpm --filter @playwright-manager/eslint-plugin clean
```

### Dependencies

- **Peer:** `eslint >=8.0.0`
- **Dev:** `@types/eslint`, `@types/estree`, `typescript`
