"use client";

import Link from "next/link";
import {
  ArrowRight,
  Activity,
  ShieldOff,
  Workflow,
  HardDrive,
  ShieldCheck,
  FileCode,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Navbar } from "./_components/navbar";
import { Footer } from "./_components/footer";
import { TypingAnimation } from "./_components/typing-animation";

const features = [
  {
    icon: Activity,
    title: "Track Test Health",
    description:
      "Health scores from 0–100, pass rates, flakiness tracking, and trend analysis across every test in your suite.",
  },
  {
    icon: ShieldOff,
    title: "Quarantine Flaky Tests",
    description:
      "Create skip rules scoped by branch, environment, or project. Tests are silently skipped in CI with full audit trail.",
  },
  {
    icon: Workflow,
    title: "CI Auto-Detection",
    description:
      "Works out of the box with GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps, and Codefresh.",
  },
  {
    icon: HardDrive,
    title: "S3 Report Hosting",
    description:
      "Upload HTML reports to AWS S3, MinIO, Cloudflare R2, or any S3-compatible storage. View reports directly from the dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Block Guarantee",
    description:
      "Fail-silent by default. Dashboard outages never block your CI pipeline. Tests run normally when the API is unreachable.",
  },
  {
    icon: FileCode,
    title: "ESLint Integration",
    description:
      "Auto-fix imports to prevent accidental bypasses. Catches IDE autocomplete importing from @playwright/test.",
  },
];

const steps = [
  {
    step: "01",
    title: "Install Fixture",
    code: 'import { test, expect } from\n  "@playwright-manager/fixture";',
    description: "Replace your test imports",
  },
  {
    step: "02",
    title: "Add Reporter",
    code: '["@playwright-manager/reporter",\n  { apiUrl: "...", repository: "..." }]',
    description: "Configure in playwright.config.ts",
  },
  {
    step: "03",
    title: "View Dashboard",
    code: "Health scores · Skip rules\nPipeline history · HTML reports",
    description: "Monitor your test suite",
  },
];

function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--landing-bg)", color: "var(--landing-text)" }}
    >
      <Navbar />

      {/* Hero */}
      <section className="landing-grid-bg relative overflow-hidden pt-32 pb-20">
        <div className="landing-radial-glow pointer-events-none absolute inset-0 top-1/4" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <div
                  className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: "var(--landing-border)",
                    color: "var(--landing-text-muted)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--landing-accent)" }}
                  />
                  Self-hosted &middot; Open source
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Test management
                <br />
                <span style={{ color: "var(--landing-accent)" }}>
                  for Playwright
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-8 max-w-md text-lg leading-relaxed"
                style={{ color: "var(--landing-text-muted)" }}
              >
                Track health. Quarantine flaky tests. Control test execution
                remotely. All from a single dashboard.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-3"
              >
                <Link
                  href="/docs/getting-started/installation"
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "var(--landing-accent)",
                    color: "#000",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/vigneshrajsb/playwright-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: "var(--landing-border)",
                    color: "var(--landing-text-muted)",
                  }}
                >
                  View on GitHub
                </a>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            >
              <TypingAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24" style={{ background: "var(--landing-surface)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <AnimatedSection className="mb-16 text-center">
            <h2
              className="mb-4 text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Everything you need
            </h2>
            <p
              className="mx-auto max-w-xl text-base"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Three packages that integrate seamlessly into your existing
              Playwright setup. No vendor lock-in. No hosted dependency.
            </p>
          </AnimatedSection>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.08}>
                <div
                  className="landing-card-glow h-full rounded-lg border p-6 transition-all duration-300"
                  style={{
                    borderColor: "var(--landing-border)",
                    background: "var(--landing-bg)",
                  }}
                >
                  <feature.icon
                    className="mb-4 h-5 w-5"
                    style={{ color: "var(--landing-accent)" }}
                  />
                  <h3
                    className="mb-2 text-sm font-semibold"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--landing-text-muted)" }}
                  >
                    {feature.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <AnimatedSection className="mb-16 text-center">
            <h2
              className="mb-4 text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Three steps. That&apos;s it.
            </h2>
            <p
              className="mx-auto max-w-lg text-base"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Add two packages to your project, deploy the dashboard, and you're
              done.
            </p>
          </AnimatedSection>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <AnimatedSection key={step.step} delay={i * 0.15}>
                <div
                  className="relative rounded-lg border p-6"
                  style={{
                    borderColor: "var(--landing-border)",
                    background: "var(--landing-surface)",
                  }}
                >
                  <div
                    className="mb-4 text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--landing-accent)" }}
                  >
                    Step {step.step}
                  </div>
                  <h3
                    className="mb-2 text-lg font-semibold"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mb-4 text-sm"
                    style={{ color: "var(--landing-text-muted)" }}
                  >
                    {step.description}
                  </p>
                  <div
                    className="code-block whitespace-pre rounded-md p-4 text-xs leading-relaxed"
                    style={{ color: "var(--landing-text-muted)" }}
                  >
                    {step.code}
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Config Example */}
      <section className="py-24" style={{ background: "var(--landing-surface)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
              <h2
                className="mb-4 text-3xl font-bold tracking-tight"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Minimal config.
                <br />
                <span style={{ color: "var(--landing-accent)" }}>
                  Maximum insight.
                </span>
              </h2>
              <p
                className="mb-6 max-w-md leading-relaxed"
                style={{ color: "var(--landing-text-muted)" }}
              >
                Add two lines to your Playwright config and every test run is
                tracked. Health scores, flakiness trends, and skip rules — all
                managed from a single dashboard you own.
              </p>
              <Link
                href="/docs/packages/reporter"
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--landing-accent)" }}
              >
                View full configuration
                <ArrowRight className="h-4 w-4" />
              </Link>
            </AnimatedSection>

            <AnimatedSection delay={0.15}>
              <div className="code-block overflow-x-auto rounded-lg p-5">
                <div
                  className="mb-3 text-xs"
                  style={{ color: "var(--landing-text-muted)" }}
                >
                  playwright.config.ts
                </div>
                <pre className="text-[13px] leading-[1.8]">
                  <code>
                    <span className="code-keyword">export default</span>{" "}
                    <span className="code-property">defineConfig</span>
                    <span className="code-punctuation">{"({"}</span>
                    {"\n"}
                    {"  "}
                    <span className="code-property">reporter</span>
                    <span className="code-punctuation">: [</span>
                    {"\n"}
                    {"    "}
                    <span className="code-punctuation">[</span>
                    <span className="code-string">
                      &quot;@playwright-manager/reporter&quot;
                    </span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"      "}
                    <span className="code-punctuation">{"{"}</span>
                    {"\n"}
                    {"        "}
                    <span className="code-property">apiUrl</span>
                    <span className="code-punctuation">: </span>
                    <span className="code-string">
                      &quot;https://pw.example.com&quot;
                    </span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"        "}
                    <span className="code-property">repository</span>
                    <span className="code-punctuation">: </span>
                    <span className="code-string">
                      &quot;org/repo&quot;
                    </span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"      "}
                    <span className="code-punctuation">{"}"}</span>
                    <span className="code-punctuation">],</span>
                    {"\n"}
                    {"  "}
                    <span className="code-punctuation">],</span>
                    {"\n"}
                    {"  "}
                    <span className="code-property">use</span>
                    <span className="code-punctuation">: {"{"}</span>
                    {"\n"}
                    {"    "}
                    <span className="code-property">testManager</span>
                    <span className="code-punctuation">: {"{"}</span>
                    {"\n"}
                    {"      "}
                    <span className="code-property">apiUrl</span>
                    <span className="code-punctuation">: </span>
                    <span className="code-string">
                      &quot;https://pw.example.com&quot;
                    </span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"      "}
                    <span className="code-property">repository</span>
                    <span className="code-punctuation">: </span>
                    <span className="code-string">
                      &quot;org/repo&quot;
                    </span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"    "}
                    <span className="code-punctuation">{"}"}</span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    {"  "}
                    <span className="code-punctuation">{"}"}</span>
                    <span className="code-punctuation">,</span>
                    {"\n"}
                    <span className="code-punctuation">{"})"}</span>
                    <span className="code-punctuation">;</span>
                  </code>
                </pre>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <AnimatedSection className="text-center">
            <h2
              className="mb-4 text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Ready to take control?
            </h2>
            <p
              className="mx-auto mb-8 max-w-md"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Set up in under 5 minutes. Self-hosted. No accounts, no
              subscriptions, no data leaving your network.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/docs/getting-started/installation"
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
                style={{
                  background: "var(--landing-accent)",
                  color: "#000",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: "var(--landing-border)",
                  color: "var(--landing-text-muted)",
                }}
              >
                Read the Docs
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}
