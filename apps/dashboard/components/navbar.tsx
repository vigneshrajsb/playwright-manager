"use client";

import Link from "next/link";
import { Spotlight, LayoutDashboard, FileText, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Spotlight className="h-6 w-6 text-primary" />
        <span className="ml-2">Playwright Manager</span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="md:w-auto md:px-3"
          asChild
        >
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden md:inline md:ml-1">Dashboard</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="md:w-auto md:px-3"
          asChild
        >
          <Link href="/docs">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline md:ml-1">API Docs</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="md:w-auto md:px-3"
          asChild
        >
          <a
            href="https://github.com/vigneshrajsb/playwright-manager"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-4 w-4" />
            <span className="hidden md:inline md:ml-1">GitHub</span>
          </a>
        </Button>
        <ModeToggle />
      </div>
    </header>
  );
}
