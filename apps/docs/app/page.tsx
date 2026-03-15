import Link from "next/link";
import {
  FlaskConical,
  ArrowRight,
  BookOpen,
  Package,
  Server,
  Code,
} from "lucide-react";

const sections = [
  {
    title: "Getting Started",
    description: "Install, configure, and run your first test suite.",
    href: "/docs/getting-started/installation",
    icon: BookOpen,
  },
  {
    title: "Package Guides",
    description: "Reporter, Fixture, and ESLint Plugin references.",
    href: "/docs/packages/reporter",
    icon: Package,
  },
  {
    title: "API Reference",
    description: "REST API endpoints for integrations and automation.",
    href: "/docs/api-reference/overview",
    icon: Code,
  },
  {
    title: "Self-Hosting",
    description: "Deploy with Docker, Helm, or your own infrastructure.",
    href: "/docs/self-hosting/docker",
    icon: Server,
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="mb-6 flex items-center gap-3">
          <FlaskConical className="h-10 w-10 text-fd-primary" />
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Playwright Manager
          </h1>
        </div>

        <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
          Self-hosted test management for Playwright. Track health, manage flaky
          tests, and control test execution remotely.
        </p>

        <div className="mb-16 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/docs/getting-started/installation"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/vigneshrajsb/playwright-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="group flex flex-col gap-2 rounded-lg border border-fd-border p-5 text-left transition-colors hover:bg-fd-accent"
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-5 w-5 text-fd-muted-foreground" />
                <h2 className="font-semibold">{section.title}</h2>
              </div>
              <p className="text-sm text-fd-muted-foreground">
                {section.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
