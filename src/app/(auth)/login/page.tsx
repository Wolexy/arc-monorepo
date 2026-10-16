"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import Link from "next/link"

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            const { user } = await login(email, password);

            // Administrators land on their own dashboard. The backend
            // still enforces the ADMIN role on every /admin request.
            router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Login failed.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }
    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md">
                <h1 className="mb-8 text-center text-3xl font-bold">
                    Sign in to ARC
                </h1>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium"
                        >
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium"
                        >
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    {error && (
                        <p
                            className="text-sm text-red-600"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-50 rounded-lg bg-black px-4 mx-4 py-3 font-medium text-white disabled:opacity-50"
                    >
                        {isSubmitting ? "Signing in..." : "Sign in"}
                    </button>
                    <Link
                        href="/"
                        className="inline-flex rounded-lg border px-4 py-3 text-center font-medium  w-50 hover:bg-gray-50"
                    >
                        Back to home
                    </Link>
                    <div className="text-center text-sm text-gray-600">
                        Don't have an account?{" "}
                        <Link
                            href="/register"
                            className="font-medium text-black underline hover:text-gray-700"
                        >
                            Register
                        </Link>
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}