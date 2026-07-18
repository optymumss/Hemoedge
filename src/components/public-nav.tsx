import Link from "next/link";

export function PublicNav() {
  return (
    <header className="border-b border-neutral-200">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
      >
        <Link href="/" className="text-sm font-semibold">
          HemoEdge
        </Link>
        <div className="flex items-center gap-5 text-sm text-neutral-600">
          <Link href="/blog" className="hover:text-neutral-900">
            Blog
          </Link>
          <Link href="/team" className="hover:text-neutral-900">
            Team
          </Link>
          <Link href="/contact" className="hover:text-neutral-900">
            Contact
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
