"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";

import {
    getSavedEnergyResult,
    type EnergyAssessmentResult,
} from "@/lib/api/assessment";

import {
    getActiveAssessmentSession,
    getAssessmentProgress,
} from "@/lib/api/sessions";

const CENTER_STYLES: Record<
    string,
    { label: string; color: string; background: string }
> = {
    GUT: {
        label: "Gut",
        color: "text-rose-700",
        background: "bg-rose-100",
    },
    HEART: {
        label: "Heart",
        color: "text-pink-700",
        background: "bg-pink-100",
    },
    HEAD: {
        label: "Head",
        color: "text-indigo-700",
        background: "bg-indigo-100",
    },
};

export default function Stage1ResultsPage() {
    const router = useRouter();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [result, setResult] = useState<EnergyAssessmentResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let isMounted = true;

        async function loadResults() {
            try {
                const currentUser = await getCurrentUser();

                if (!isMounted) return;

                setUser(currentUser);

                if (
                    currentUser.role !== "ADMIN" &&
                    !currentUser.accessGranted
                ) {
                    setError(
                        "Your account does not currently have access to the assessment.",
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

                if (!progress.stage1Completed) {
                    router.replace("/energy_center_assessment");
                    return;
                }

                const savedResult = await getSavedEnergyResult(session.id);

                if (!isMounted) return;

                if (!savedResult) {
                    setError(
                        "Your assessment is marked as complete, but its saved results could not be found. Please contact the administrator.",
                    );
                    return;
                }

                setResult(savedResult);
            } catch (err) {
                if (!isMounted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your assessment results.",
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void loadResults();

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
                        Retrieving your Energy Center results...
                    </p>
                </div>
            </main>
        );
    }

    if (error || !result) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Results Unavailable
                    </h1>

                    <p className="mt-4 leading-7 text-slate-600">
                        {error || "Your results could not be loaded."}
                    </p>

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

    const centers = [
        {
            name: "Gut",
            score: result.gut,
            style: "border-rose-100 bg-rose-50 text-rose-700",
        },
        {
            name: "Heart",
            score: result.heart,
            style: "border-pink-100 bg-pink-50 text-pink-700",
        },
        {
            name: "Head",
            score: result.head,
            style: "border-indigo-100 bg-indigo-50 text-indigo-700",
        },
    ];

    return (
        <main className="relative min-h-[75vh] overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12 sm:px-8">
            <DecorativeBackground />

            <section className="relative mx-auto max-w-4xl">
                <div className="rounded-3xl border border-white bg-white/90 p-6 shadow-2xl shadow-indigo-200/40 backdrop-blur-xl sm:p-10">
                    <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
                            ✓
                        </div>

                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                            Stage One Complete
                        </p>

                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                            Your Energy Center Results
                        </h1>

                        <p className="mt-4 leading-7 text-slate-600">
                            You have completed the Energy Center assessment. Here is your
                            saved score breakdown.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-4 sm:grid-cols-3">
                        {centers.map((center) => (
                            <div
                                key={center.name}
                                className={`rounded-2xl border p-6 text-center ${center.style}`}
                            >
                                <p className="text-sm font-semibold">
                                    {center.name} Center
                                </p>

                                <p className="mt-3 text-4xl font-bold">{center.score}</p>

                                <p className="mt-2 text-xs opacity-75">Total score</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
                        <p className="text-sm font-semibold text-slate-700">
                            Dominant Energy Center
                        </p>

                        <p className="mt-2 text-2xl font-bold text-indigo-700">
                            {result.dominant
                                ? CENTER_STYLES[result.dominant]?.label ?? result.dominant
                                : "Shared top score"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {result.dominant
                                ? "Your results identify this as your highest-scoring Energy Center."
                                : "Your results do not identify a single dominant center."}
                        </p>
                    </div>

                    <div className="mt-6">
                        <p className="text-sm font-semibold text-slate-700">
                            Eligible Personality Assessment Centers
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {result.eligibleCenters.map((center) => {
                                const style = CENTER_STYLES[center];

                                return (
                                    <span
                                        key={center}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold ${style
                                            ? `${style.background} ${style.color}`
                                            : "bg-slate-100 text-slate-700"
                                            }`}
                                    >
                                        {style?.label ?? center}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="font-semibold text-slate-900">What happens next?</h2>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Your Energy Center results determine which centers you are
                            eligible to explore in Stage Two. Your results are saved, so
                            you can return to this page without repeating Stage One.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </section>
        </main>
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