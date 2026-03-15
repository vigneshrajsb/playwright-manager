import { RootProvider } from "fumadocs-ui/provider/next";
import "fumadocs-ui/style.css";
import type { ReactNode } from "react";

export const metadata = {
  title: {
    template: "%s | Playwright Manager",
    default: "Playwright Manager Docs",
  },
  description:
    "Documentation for Playwright Manager — self-hosted test management for Playwright.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
