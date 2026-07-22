import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          HemoEdge
        </Link>
        <div className="flex items-center gap-6 text-sm text-ink-dim">
          <Link href="/blog" className="hidden hover:text-ink sm:inline">
            Blog
          </Link>
          <Link href="/team" className="hidden hover:text-ink sm:inline">
            Team
          </Link>
          <Link href="/contact" className="hidden hover:text-ink sm:inline">
            Contact
          </Link>
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md bg-accent px-3 py-1.5 text-accent-ink hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
