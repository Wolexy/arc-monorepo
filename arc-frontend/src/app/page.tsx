import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium text-gray-500">
          ARC Assessment
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to ARC
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600">
          Discover your personality through the ARC assessment.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-lg bg-black px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="rounded-lg border px-6 py-3 font-medium hover:bg-gray-50"
          >
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}