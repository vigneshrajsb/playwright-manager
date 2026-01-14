import type { Rule } from "eslint";
import type {
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
} from "estree";
import type { RequireFixtureImportsOptions } from "../types";

// Imports that must come from @playwright-manager/fixture
const REQUIRED_FIXTURE_IMPORTS = new Set(["test", "expect"]);

const SOURCE_PLAYWRIGHT_TEST = "@playwright/test";
const SOURCE_FIXTURE = "@playwright-manager/fixture";

type AnyImportSpecifier =
  | ImportSpecifier
  | ImportDefaultSpecifier
  | ImportNamespaceSpecifier;

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce importing 'test' and 'expect' from '@playwright-manager/fixture' instead of '@playwright/test'",
      recommended: true,
      url: "https://github.com/anthropics/playwright-manager/blob/main/packages/eslint-plugin/README.md",
    },
    fixable: "code",
    hasSuggestions: true,
    messages: {
      useFixtureImport:
        "Import '{{ importName }}' from '@playwright-manager/fixture' instead of '@playwright/test'. " +
        "This enables the auto-skip functionality from the dashboard.",
      useFixtureImportMultiple:
        "Import {{ importNames }} from '@playwright-manager/fixture' instead of '@playwright/test'. " +
        "This enables the auto-skip functionality from the dashboard.",
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalImports: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
            description:
              "Additional import names to flag beyond 'test' and 'expect'",
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = (context.options[0] || {}) as RequireFixtureImportsOptions;
    const additionalImports = new Set<string>(options.additionalImports || []);
    const flaggedImports = new Set([
      ...REQUIRED_FIXTURE_IMPORTS,
      ...additionalImports,
    ]);

    return {
      ImportDeclaration(node: ImportDeclaration) {
        // Only check imports from @playwright/test
        if (node.source.value !== SOURCE_PLAYWRIGHT_TEST) {
          return;
        }

        const specifiers = node.specifiers;
        if (!specifiers || specifiers.length === 0) {
          return;
        }

        // Collect flagged imports and other imports separately
        const flaggedSpecifiers: AnyImportSpecifier[] = [];
        const otherSpecifiers: AnyImportSpecifier[] = [];
        const flaggedNames: string[] = [];

        for (const specifier of specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            // import test from '@playwright/test'
            // Default import is treated as importing "test"
            if (flaggedImports.has("test")) {
              flaggedSpecifiers.push(specifier);
              flaggedNames.push("test");
            } else {
              otherSpecifiers.push(specifier);
            }
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            // import * as pw from '@playwright/test'
            // Namespace imports are allowed - they might be used for types
            otherSpecifiers.push(specifier);
          } else if (specifier.type === "ImportSpecifier") {
            // import { test, expect, Page } from '@playwright/test'
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : String(specifier.imported.value);

            if (flaggedImports.has(importedName)) {
              flaggedSpecifiers.push(specifier);
              flaggedNames.push(importedName);
            } else {
              otherSpecifiers.push(specifier);
            }
          }
        }

        // No flagged imports found
        if (flaggedSpecifiers.length === 0) {
          return;
        }

        // Determine the message and data
        const messageId =
          flaggedNames.length === 1
            ? "useFixtureImport"
            : "useFixtureImportMultiple";
        const messageData =
          flaggedNames.length === 1
            ? { importName: flaggedNames[0] }
            : { importNames: formatImportNames(flaggedNames) };

        // Report with fix
        context.report({
          node,
          messageId,
          data: messageData,
          fix(fixer) {
            const fixes: Rule.Fix[] = [];

            // Build the new fixture import specifiers
            const fixtureImportNames = flaggedNames.map((name) => {
              const specifier = flaggedSpecifiers.find((s) => {
                if (s.type === "ImportDefaultSpecifier") return name === "test";
                if (s.type === "ImportSpecifier") {
                  const imported =
                    s.imported.type === "Identifier"
                      ? s.imported.name
                      : String(s.imported.value);
                  return imported === name;
                }
                return false;
              });

              // Preserve alias if present
              if (
                specifier?.type === "ImportSpecifier" &&
                specifier.local.name !== name
              ) {
                return `${name} as ${specifier.local.name}`;
              }
              // Handle default import aliased differently
              if (
                specifier?.type === "ImportDefaultSpecifier" &&
                specifier.local.name !== "test"
              ) {
                return `test as ${specifier.local.name}`;
              }
              return name;
            });

            const newFixtureImport = `import { ${fixtureImportNames.join(", ")} } from "${SOURCE_FIXTURE}";`;

            if (otherSpecifiers.length === 0) {
              // Replace the entire import statement
              fixes.push(fixer.replaceText(node, newFixtureImport));
            } else {
              // Keep the @playwright/test import for other specifiers, add new fixture import
              const remainingImport = buildRemainingImport(otherSpecifiers);

              // Insert the fixture import before the original import
              fixes.push(fixer.insertTextBefore(node, newFixtureImport + "\n"));
              // Replace the original import with remaining specifiers
              fixes.push(fixer.replaceText(node, remainingImport));
            }

            return fixes;
          },
        });
      },
    };
  },
};

/**
 * Format multiple import names for error message
 */
function formatImportNames(names: string[]): string {
  if (names.length === 1) return `'${names[0]}'`;
  if (names.length === 2) return `'${names[0]}' and '${names[1]}'`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1);
  return `${rest.map((n) => `'${n}'`).join(", ")}, and '${last}'`;
}

/**
 * Build the remaining import statement for non-flagged specifiers
 */
function buildRemainingImport(specifiers: AnyImportSpecifier[]): string {
  const defaultSpec = specifiers.find(
    (s) => s.type === "ImportDefaultSpecifier"
  ) as ImportDefaultSpecifier | undefined;
  const namespaceSpec = specifiers.find(
    (s) => s.type === "ImportNamespaceSpecifier"
  ) as ImportNamespaceSpecifier | undefined;
  const namedSpecs = specifiers.filter(
    (s) => s.type === "ImportSpecifier"
  ) as ImportSpecifier[];

  const parts: string[] = [];

  // Handle default import
  if (defaultSpec) {
    parts.push(defaultSpec.local.name);
  }

  // Handle namespace import
  if (namespaceSpec) {
    parts.push(`* as ${namespaceSpec.local.name}`);
  }

  // Handle named imports
  if (namedSpecs.length > 0) {
    const namedImports = namedSpecs.map((s) => {
      const imported =
        s.imported.type === "Identifier"
          ? s.imported.name
          : String(s.imported.value);
      if (s.local.name !== imported) {
        return `${imported} as ${s.local.name}`;
      }
      return imported;
    });
    parts.push(`{ ${namedImports.join(", ")} }`);
  }

  return `import ${parts.join(", ")} from "${SOURCE_PLAYWRIGHT_TEST}";`;
}

export default rule;
