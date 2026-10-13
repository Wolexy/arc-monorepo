"use client";

import { useState } from "react";
import { register } from "@/lib/api/auth";
import type { FormEvent } from 'react'
import { useRouter } from "next/navigation";
import Link from 'next/link'

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const router = useRouter()

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            setLoading(true);

            await register(
                email,
                password,
                confirmPassword,
            );

            router.push('/check-email');
        } catch (error) {
            setError(
                error instanceof Error ? error.message : "Registration failed.",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md">
                <h1 className="mb-2 text-3xl font-bold">Create your ARC account</h1>

                <p className="mb-8 text-gray-600">
                    Create an account to begin your assessment.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            className="w-full rounded-md border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1 block text-sm font-medium"
                        >
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={6}
                            className="w-full rounded-md border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassword"
                            className="mb-1 block text-sm font-medium"
                        >
                            Confirm password
                        </label>

                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            required
                            minLength={6}
                            className="w-full rounded-md border px-3 py-2"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-40 rounded-md bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
                    >
                        {loading ? "Creating account..." : "Create account"}
                    </button>
                    <Link
                        href="/"
                        className="  w-40 rounded-lg border px-4 py-3 mx-4 text-center font-medium hover:bg-gray-50"
                    >
                        Back to home
                    </Link>
                </form>
            </div>
        </main>
    );
}