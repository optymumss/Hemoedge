import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-sm text-ink-dim sm:flex-row sm:justify-between">
        <span>&copy; {new Date().getFullYear()} HemoEdge</span>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
          <Link href="/team" className="hover:text-ink">
            Team
          </Link>
          <Link href="/contact" className="hover:text-ink">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
