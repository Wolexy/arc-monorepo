"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api/auth";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const verifiedToken = useRef<string | null>(null);

    const [message, setMessage] = useState("Verifying your email...");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setMessage("");
            setError("Verification token is missing.");
            return;
        }

        if (verifiedToken.current === token) {
            return;
        }

        verifiedToken.current = token;

        async function verify(token: string) {
            try {
                const result = await verifyEmail(token);
                setMessage(result.message);
            } catch (error) {
                setMessage("");
                setError(
                    error instanceof Error
                        ? error.message
                        : "Email verification failed.",
                );
            }
        }

        verify(token);
    }, [token]);

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="text-center">
                {message && (
                    <div>
                        <p className="text-xl font-semibold">{message}</p>

                        {message === "Email verified successfully" && (
                            <Link
                                href="/login"
                                className="mt-6 inline-block rounded-lg bg-black px-6 py-3 font-medium text-white hover:opacity-90"
                            >
                                Continue to Login
                            </Link>
                        )}
                    </div>
                )}

                {error && (
                    <p className="text-xl font-semibold text-red-600">
                        {error}
                    </p>
                )}
            </div>
        </main>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center px-4">
                    <p className="text-xl font-semibold">
                        Verifying your email...
                    </p>
                </main>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}