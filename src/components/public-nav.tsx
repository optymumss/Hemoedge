import Link from "next/link";

export function PublicNav() {
  return (
    <header className="border-b border-line">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
      >
        <Link href="/" className="text-sm font-semibold">
          HemoEdge
        </Link>
        <div className="flex items-center gap-5 text-sm text-ink-dim">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
          <Link href="/team" className="hover:text-ink">
            Team
          </Link>
          <Link href="/contact" className="hover:text-ink">
            Contact
          </Link>
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
