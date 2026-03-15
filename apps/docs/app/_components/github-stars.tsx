"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

const REPO = "vigneshrajsb/playwright-manager";
const CACHE_KEY = "pw-manager-stars";
const CACHE_TTL = 1000 * 60 * 60;

export function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { count, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        setStars(count);
        return;
      }
    }

    fetch(`https://api.github.com/repos/${REPO}`)
      .then((r) => r.json())
      .then((data) => {
        const count = data.stargazers_count ?? 0;
        setStars(count);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
      })
      .catch(() => setStars(0));
  }, []);

  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        borderColor: "var(--landing-border)",
        color: "var(--landing-text-muted)",
      }}
    >
      <Star className="h-3.5 w-3.5" />
      {stars === null ? (
        <span
          className="inline-block h-3 w-6 animate-pulse rounded"
          style={{ background: "var(--landing-border)" }}
        />
      ) : (
        <span>{stars}</span>
      )}
    </a>
  );
}
