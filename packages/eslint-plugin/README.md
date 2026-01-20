# @playwright-manager/eslint-plugin

ESLint plugin to enforce importing `test` and `expect` from `@playwright-manager/fixture` instead of `@playwright/test`.

## Why?

When using `@playwright-manager/fixture`, you must import `test` and `expect` from the fixture package to enable:

- Auto-skip functionality from the dashboard
- Test health tracking
- Skip rule integration

If you accidentally import from `@playwright/test` directly (e.g., via IDE autocomplete), these features won't work for those tests.

## Installation

```bash
npm install -D @playwright-manager/eslint-plugin
# or
pnpm add -D @playwright-manager/eslint-plugin
```

## Configuration

### Flat Config (ESLint 9+)

```javascript
// eslint.config.mjs
import playwrightManager from "@playwright-manager/eslint-plugin";

export default [
  // Use the recommended config
  ...playwrightManager.configs.recommended,
];
```

Or apply only to test files:

```javascript
// eslint.config.mjs
import playwrightManager from "@playwright-manager/eslint-plugin";

export default [
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/tests/**/*.ts"],
    plugins: {
      "@playwright-manager": playwrightManager,
    },
    rules: {
      "@playwright-manager/require-fixture-imports": "error",
    },
  },
];
```

### Legacy Config (ESLint 8)

```json
{
  "plugins": ["@playwright-manager"],
  "rules": {
    "@playwright-manager/require-fixture-imports": "error"
  }
}
```

Or with overrides for test files only:

```json
{
  "overrides": [
    {
      "files": ["**/*.spec.ts", "**/*.test.ts"],
      "plugins": ["@playwright-manager"],
      "rules": {
        "@playwright-manager/require-fixture-imports": "error"
      }
    }
  ]
}
```

## Rules

### `@playwright-manager/require-fixture-imports`

Enforces that `test` and `expect` are imported from `@playwright-manager/fixture`.

#### Will Flag (Error)

```typescript
// Error: Import 'test' from '@playwright-manager/fixture' instead
import { test } from "@playwright/test";

// Error: Import 'expect' from '@playwright-manager/fixture' instead
import { expect } from "@playwright/test";

// Error: Import 'test' and 'expect' from '@playwright-manager/fixture' instead
import { test, expect } from "@playwright/test";

// Error: Import 'test' from '@playwright-manager/fixture' instead
import test from "@playwright/test";
```

#### Will NOT Flag (Allowed)

```typescript
// Correct usage
import { test, expect } from "@playwright-manager/fixture";

// Types and utilities from @playwright/test are allowed
import { Page, Browser, BrowserContext } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";

// Namespace imports are allowed
import * as pw from "@playwright/test";
```

#### Auto-fix

The rule provides automatic fixes:

**Simple case** - replaces import source:
```typescript
// Before
import { test, expect } from "@playwright/test";

// After fix
import { test, expect } from "@playwright-manager/fixture";
```

**Mixed imports** - splits into two imports:
```typescript
// Before
import { test, expect, Page } from "@playwright/test";

// After fix
import { test, expect } from "@playwright-manager/fixture";
import { Page } from "@playwright/test";
```

**Preserves aliases**:
```typescript
// Before
import { test as baseTest, expect } from "@playwright/test";

// After fix
import { test as baseTest, expect } from "@playwright-manager/fixture";
```

#### Options

```javascript
{
  "@playwright-manager/require-fixture-imports": ["error", {
    // Flag additional imports beyond test and expect
    "additionalImports": ["mergeTests"]
  }]
}
```

## Releasing

To release a new version:

1. Update version in `package.json`
2. Commit and push to main
3. Create a git tag: `git tag eslint-plugin-vX.Y.Z`
4. Push the tag: `git push origin eslint-plugin-vX.Y.Z`
5. Create a GitHub release with tag `eslint-plugin-vX.Y.Z` and title `ESLint Plugin vX.Y.Z`

The release triggers the npm publish workflow automatically.
