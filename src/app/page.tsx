import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">HemoEdge</h1>
      <p className="max-w-sm text-sm text-neutral-600">
        WSI-based blood cell morphology training for laboratory professionals.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Sign in
      </Link>
    </main>
  );
}
