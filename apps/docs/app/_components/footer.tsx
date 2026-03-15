import Link from "next/link";
import { FlaskConical } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const footerLinks: Record<string, FooterLink[]> = {
  Documentation: [
    { label: "Getting Started", href: "/docs/getting-started/installation" },
    { label: "Reporter", href: "/docs/packages/reporter" },
    { label: "Fixture", href: "/docs/packages/fixture" },
    { label: "ESLint Plugin", href: "/docs/packages/eslint-plugin" },
  ],
  Community: [
    {
      label: "GitHub",
      href: "https://github.com/vigneshrajsb/playwright-manager",
      external: true,
    },
    {
      label: "Issues",
      href: "https://github.com/vigneshrajsb/playwright-manager/issues",
      external: true,
    },
    {
      label: "Discussions",
      href: "https://github.com/vigneshrajsb/playwright-manager/discussions",
      external: true,
    },
  ],
  Project: [
    {
      label: "Releases",
      href: "https://github.com/vigneshrajsb/playwright-manager/releases",
      external: true,
    },
    { label: "Self-Hosting", href: "/docs/self-hosting/docker" },
    { label: "API Reference", href: "/docs/api-reference/overview" },
  ],
};

export function Footer() {
  return (
    <footer
      className="border-t"
      style={{
        background: "var(--landing-bg)",
        borderColor: "var(--landing-border)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical
                className="h-5 w-5"
                style={{ color: "var(--landing-accent)" }}
              />
              <span
                className="text-sm font-semibold"
                style={{
                  color: "var(--landing-text)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Playwright Manager
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Self-hosted test management for Playwright.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--landing-text-muted)" }}
              >
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: "var(--landing-text-muted)" }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: "var(--landing-text-muted)" }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 border-t pt-6 text-center text-xs"
          style={{
            borderColor: "var(--landing-border)",
            color: "var(--landing-text-muted)",
          }}
        >
          Built for Playwright &middot; MIT License
        </div>
      </div>
    </footer>
  );
}
