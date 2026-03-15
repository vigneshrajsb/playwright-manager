"use client";

import Link from "next/link";
import { FlaskConical, Github, BookOpen } from "lucide-react";
import { GitHubStars } from "./github-stars";
import { motion } from "motion/react";

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 z-50 w-full border-b backdrop-blur-md"
      style={{
        background: "rgba(6, 6, 11, 0.85)",
        borderColor: "var(--landing-border)",
      }}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <FlaskConical
            className="h-5 w-5"
            style={{ color: "var(--landing-accent)" }}
          />
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              color: "var(--landing-text)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Playwright Manager
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/docs"
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--landing-text-muted)" }}
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/vigneshrajsb/playwright-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center transition-colors hover:opacity-80"
              style={{ color: "var(--landing-text-muted)" }}
            >
              <Github className="h-5 w-5" />
            </a>
            <GitHubStars />
          </div>
        </div>
      </nav>
    </motion.header>
  );
}
