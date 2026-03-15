"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface TerminalLine {
  text: string;
  color?: string;
  prefix?: string;
  prefixColor?: string;
  indent?: number;
}

const lines: TerminalLine[] = [
  { text: "$ npx playwright test", color: "#e2e2e8" },
  { text: "" },
  { text: "Running 24 tests using 4 workers", color: "#6b6b80" },
  { text: "" },
  {
    prefix: "  ✓ ",
    prefixColor: "#22c55e",
    text: "login.spec.ts:12 — should login with valid credentials",
    color: "#6b6b80",
  },
  {
    prefix: "  ✓ ",
    prefixColor: "#22c55e",
    text: "login.spec.ts:28 — should show error for invalid password",
    color: "#6b6b80",
  },
  {
    prefix: "  ⊘ ",
    prefixColor: "#eab308",
    text: "checkout.spec.ts:15 — should apply discount code",
    color: "#6b6b80",
  },
  {
    prefix: "    ",
    prefixColor: "#6b6b80",
    text: "↳ skipped by dashboard: \"Flaky on staging\"",
    color: "#eab308",
  },
  {
    prefix: "  ✓ ",
    prefixColor: "#22c55e",
    text: "search.spec.ts:8 — should return matching results",
    color: "#6b6b80",
  },
  {
    prefix: "  ✓ ",
    prefixColor: "#22c55e",
    text: "cart.spec.ts:42 — should update item quantity",
    color: "#6b6b80",
  },
  {
    prefix: "  ✓ ",
    prefixColor: "#22c55e",
    text: "profile.spec.ts:19 — should update user email",
    color: "#6b6b80",
  },
  { text: "" },
  { text: "  23 passed  1 skipped", color: "#22c55e" },
  { text: "" },
  { text: "[Playwright Manager] Results uploaded successfully", color: "#e2e2e8" },
  {
    prefix: "  Branch:     ",
    prefixColor: "#6b6b80",
    text: "feat/checkout-v2 (a1b2c3d)",
    color: "#e2e2e8",
  },
  {
    prefix: "  Report:     ",
    prefixColor: "#6b6b80",
    text: "Uploaded",
    color: "#e2e2e8",
  },
  {
    prefix: "  Dashboard:  ",
    prefixColor: "#6b6b80",
    text: "https://pw.example.com/pipelines?id=gh-4821",
    color: "#82aaff",
  },
];

export function TypingAnimation() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const delays = lines.map((line) => (line.text === "" ? 80 : 120));
    let currentLine = 0;
    let timeout: NodeJS.Timeout;

    const showNext = () => {
      if (currentLine < lines.length) {
        currentLine++;
        setVisibleLines(currentLine);
        timeout = setTimeout(showNext, delays[currentLine - 1]);
      } else {
        setTimeout(() => setShowCursor(true), 300);
      }
    };

    const startDelay = setTimeout(showNext, 800);
    return () => {
      clearTimeout(startDelay);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="terminal-window overflow-hidden rounded-lg">
      <div
        className="flex items-center gap-1.5 border-b px-4 py-2.5"
        style={{ borderColor: "var(--landing-border)" }}
      >
        <div className="terminal-dot" style={{ background: "#ff5f57" }} />
        <div className="terminal-dot" style={{ background: "#febc2e" }} />
        <div className="terminal-dot" style={{ background: "#28c840" }} />
        <span
          className="ml-2 text-xs"
          style={{
            color: "var(--landing-text-muted)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          terminal
        </span>
      </div>
      <div className="overflow-x-auto p-4" style={{ minHeight: 380 }}>
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="terminal-line whitespace-pre"
            style={{ paddingLeft: line.indent ? line.indent * 16 : 0 }}
          >
            {line.prefix && (
              <span style={{ color: line.prefixColor }}>{line.prefix}</span>
            )}
            <span style={{ color: line.color }}>{line.text}</span>
          </motion.div>
        ))}
        {showCursor && visibleLines >= lines.length && (
          <span
            className="terminal-cursor terminal-line inline-block"
            style={{ color: "var(--landing-accent)" }}
          >
            ▌
          </span>
        )}
      </div>
    </div>
  );
}
