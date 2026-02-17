import { RuleTester } from "eslint";
import { describe } from "vitest";
import rule from "./require-fixture-imports";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

describe("require-fixture-imports", () => {
  ruleTester.run("require-fixture-imports", rule, {
    valid: [
      // Correct source: importing from @playwright-manager/fixture
      {
        code: `import { test, expect } from "@playwright-manager/fixture";`,
      },
      {
        code: `import { test } from "@playwright-manager/fixture";`,
      },
      {
        code: `import { expect } from "@playwright-manager/fixture";`,
      },
      // Non-flagged imports from @playwright/test are allowed
      {
        code: `import { Page, Browser } from "@playwright/test";`,
      },
      {
        code: `import { Page } from "@playwright/test";`,
      },
      // Namespace imports are allowed
      {
        code: `import * as pw from "@playwright/test";`,
      },
      // Side-effect import (no specifiers) is allowed
      {
        code: `import "@playwright/test";`,
      },
      // Unrelated packages are not checked
      {
        code: `import { something } from "other-package";`,
      },
      {
        code: `import { test } from "some-other-lib";`,
      },
    ],

    invalid: [
      // Single flagged: test
      {
        code: `import { test } from "@playwright/test";`,
        output: `import { test } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Single flagged: expect
      {
        code: `import { expect } from "@playwright/test";`,
        output: `import { expect } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Multiple flagged: test and expect
      {
        code: `import { test, expect } from "@playwright/test";`,
        output: `import { test, expect } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImportMultiple" }],
      },
      // Default import -> named import conversion
      {
        code: `import test from "@playwright/test";`,
        output: `import { test } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Named import with alias preserved
      {
        code: `import { test as myTest } from "@playwright/test";`,
        output: `import { test as myTest } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Default import with alias
      {
        code: `import myTest from "@playwright/test";`,
        output: `import { test as myTest } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Mixed: one flagged (test) + one other (Page) -> split into two imports
      {
        code: `import { test, Page } from "@playwright/test";`,
        output: `import { test } from "@playwright-manager/fixture";\nimport { Page } from "@playwright/test";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Mixed: multiple flagged + multiple remaining -> split
      {
        code: `import { test, expect, Page, Browser } from "@playwright/test";`,
        output: `import { test, expect } from "@playwright-manager/fixture";\nimport { Page, Browser } from "@playwright/test";`,
        errors: [{ messageId: "useFixtureImportMultiple" }],
      },
      // Mixed: one flagged + multiple remaining
      {
        code: `import { test, Page, Browser } from "@playwright/test";`,
        output: `import { test } from "@playwright-manager/fixture";\nimport { Page, Browser } from "@playwright/test";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // Mixed with alias on flagged import
      {
        code: `import { test as myTest, Page } from "@playwright/test";`,
        output: `import { test as myTest } from "@playwright-manager/fixture";\nimport { Page } from "@playwright/test";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
      // additionalImports option: mergeTests flagged
      {
        code: `import { mergeTests } from "@playwright/test";`,
        output: `import { mergeTests } from "@playwright-manager/fixture";`,
        options: [{ additionalImports: ["mergeTests"] }],
        errors: [{ messageId: "useFixtureImport" }],
      },
      // additionalImports with standard flagged imports
      {
        code: `import { test, mergeTests } from "@playwright/test";`,
        output: `import { test, mergeTests } from "@playwright-manager/fixture";`,
        options: [{ additionalImports: ["mergeTests"] }],
        errors: [{ messageId: "useFixtureImportMultiple" }],
      },
      // additionalImports mixed with non-flagged
      {
        code: `import { mergeTests, Page } from "@playwright/test";`,
        output: `import { mergeTests } from "@playwright-manager/fixture";\nimport { Page } from "@playwright/test";`,
        options: [{ additionalImports: ["mergeTests"] }],
        errors: [{ messageId: "useFixtureImport" }],
      },
      // expect with alias
      {
        code: `import { expect as myExpect } from "@playwright/test";`,
        output: `import { expect as myExpect } from "@playwright-manager/fixture";`,
        errors: [{ messageId: "useFixtureImport" }],
      },
    ],
  });
});
