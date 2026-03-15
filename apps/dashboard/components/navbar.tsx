"use client";

import Link from "next/link";
import { Spotlight } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Spotlight className="h-6 w-6 text-primary" />
        <span className="ml-2">Playwright Manager</span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <ModeToggle />
      </div>
    </header>
  );
}
