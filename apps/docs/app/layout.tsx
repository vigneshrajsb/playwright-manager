import { RootProvider } from "fumadocs-ui/provider/next";
import "fumadocs-ui/style.css";
import "./global.css";
import type { ReactNode } from "react";

export const metadata = {
  title: {
    template: "%s | Playwright Manager",
    default: "Playwright Manager — Self-hosted Test Management for Playwright",
  },
  description:
    "Track test health, manage flaky tests, and control test execution remotely. Self-hosted, open source.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootProvider
          theme={{ defaultTheme: "dark", enabled: false }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
