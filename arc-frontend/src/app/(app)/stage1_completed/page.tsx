"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser } from "@/lib/api/auth";

import { getStage2Access } from "@/lib/api/assessment";

import {
    getActiveAssessmentSession,
    getAssessmentProgress,
} from "@/lib/api/sessions";

// Stage 2 state as reported by the backend.
type Stage2Status =
    | { kind: "completed" }
    | { kind: "started" }
    | { kind: "eligible" }
    | { kind: "not_allowed"; reason?: string }
    | { kind: "unknown" };

const STAGE2_REASON_MESSAGES: Record<string, string> = {
    AUTH_REQUIRED:
        "Your Stage 1 assessment is complete. Access to the Personality Assessment has not yet been granted. You can view your Energy Center results now or contact the administrator to request Stage 2 access.",
    ACCOUNT_DISABLED:
        "Your account is currently disabled. Please contact the administrator for assistance.",
    EMAIL_NOT_VERIFIED:
        "Please verify your email address before continuing to the Personality Assessment.",
};

export default function Stage1CompletedPage() {
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [stage2, setStage2] = useState<Stage2Status>({ kind: "unknown" });

    // Read-only checks: this page never creates a session or submits answers.
    useEffect(() => {
        let isMounted = true;

        async function loadCompletionStatus() {
            try {
                const currentUser = await getCurrentUser();

                if (!isMounted) return;

                if (
                    !currentUser.accountEnabled ||
                    !currentUser.emailVerified
                ) {
                    setError(
                        "Your account must be enabled and your email verified to access the assessment.",
                    );
                    return;
                }

                const session = await getActiveAssessmentSession();

                if (!isMounted) return;

                if (!session) {
                    setError(
                        "No assessment session was found. Please begin your assessment first.",
                    );
                    return;
                }

                const progress = await getAssessmentProgress(session.id);

                if (!isMounted) return;

                // Stage 1 must be finished through the normal flow first.
                if (!progress.stage1Completed) {
                    router.replace("/energy_center_assessment");
                    return;
                }

                if (session.completedAt) {
                    setStage2({ kind: "completed" });
                    return;
                }

                // Access is checked for unfinished attempts too, so a working
                // Begin or Continue action is shown only when it is allowed.
                try {
                    const access = await getStage2Access(session.id);

                    if (!isMounted) return;

                    setStage2(
                        !access.allowed
                            ? { kind: "not_allowed", reason: access.reason }
                            : progress.stage2Started
                              ? { kind: "started" }
                              : { kind: "eligible" },
                    );
                } catch (accessError) {
                    if (!isMounted) return;

                    console.error(
                        "Unable to check Stage 2 access:",
                        accessError,
                    );
                    setStage2({ kind: "unknown" });
                }
            } catch (err) {
                if (!isMounted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your assessment status.",
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void loadCompletionStatus();

        return () => {
            isMounted = false;
        };
    }, [router]);

    if (isLoading) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    <p className="mt-5 text-sm font-medium text-slate-600">
                        Checking your assessment progress...
                    </p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Assessment Status Unavailable
                    </h1>

                    <p className="mt-4 leading-7 text-slate-600">{error}</p>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-7 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
                    >
                        Return to Dashboard
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="relative min-h-[75vh] overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12 sm:px-8">
            <DecorativeBackground />

            <section className="relative mx-auto max-w-3xl">
                <div className="rounded-3xl border border-white bg-white/90 p-6 shadow-2xl shadow-indigo-200/40 backdrop-blur-xl sm:p-10">
                    <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
                            ✓
                        </div>

                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                            Assessment Completed
                        </p>

                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                            Congratulations! You&apos;ve Completed the Energy
                            Center Assessment.
                        </h1>

                        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
                            Thank you for completing Stage 1 of your assessment.
                            Your responses have been saved successfully. You can
                            now explore your Energy Center results or continue
                            to the next stage of the assessment.
                        </p>
                    </div>

                    <Stage2Panel
                        status={stage2}
                        onNavigate={(href) => router.push(href)}
                    />

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => router.push("/stage1_results")}
                            className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                        >
                            View Energy Center Results
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}

function Stage2Panel({
    status,
    onNavigate,
}: {
    status: Stage2Status;
    onNavigate: (href: string) => void;
}) {
    if (status.kind === "completed") {
        return (
            <div className="mt-10 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6">
                <h2 className="font-semibold text-emerald-900">
                    Personality Assessment Completed
                </h2>

                <p className="mt-2 text-sm leading-6 text-emerald-900">
                    You have already completed Stage 2. Your personality
                    results are saved, and the assessment cannot be taken
                    again.
                </p>

                <button
                    type="button"
                    onClick={() => onNavigate("/personality_results")}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
                >
                    View Personality Results
                </button>
            </div>
        );
    }

    if (status.kind === "not_allowed") {
        return (
            <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="font-semibold text-amber-900">
                    Personality Assessment Access Required
                </h2>

                <p className="mt-2 text-sm leading-6 text-amber-900">
                    {(status.reason && STAGE2_REASON_MESSAGES[status.reason]) ??
                        "You cannot continue to the Personality Assessment yet. Please contact the administrator for assistance."}
                </p>
            </div>
        );
    }

    if (status.kind === "unknown") {
        return (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-semibold text-slate-900">
                    Personality Assessment
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                    We could not check your Personality Assessment access right
                    now. Please try again later.
                </p>
            </div>
        );
    }

    // Eligible or already started, with access confirmed by the backend.
    // The assessment page re-checks everything before anything is created.
    return (
        <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
            <h2 className="font-semibold text-slate-900">
                {status.kind === "started"
                    ? "Personality Assessment In Progress"
                    : "You're Eligible for the Personality Assessment"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
                {status.kind === "started"
                    ? "Your answers so far are saved. Continue from your next unanswered question."
                    : "Your access has been granted. You can begin Stage 2 of your assessment now."}
            </p>

            <button
                type="button"
                onClick={() => onNavigate("/personality_assessment")}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
            >
                {status.kind === "started"
                    ? "Continue Personality Assessment"
                    : "Begin Personality Assessment"}
            </button>
        </div>
    );
}

function DecorativeBackground() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl" />

            <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/25 blur-3xl" />

            <svg
                className="absolute right-0 top-0 h-80 w-80 text-indigo-400/15"
                viewBox="0 0 320 320"
                fill="none"
            >
                <circle cx="160" cy="160" r="110" stroke="currentColor" />
                <circle cx="160" cy="160" r="80" stroke="currentColor" />
                <circle cx="160" cy="160" r="50" stroke="currentColor" />
                <path
                    d="M160 20V300M20 160H300M61 61L259 259M259 61L61 259"
                    stroke="currentColor"
                />
            </svg>
        </div>
    );
}
