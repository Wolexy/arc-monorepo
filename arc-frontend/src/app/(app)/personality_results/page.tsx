"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser } from "@/lib/api/auth";

import {
    ApiError,
    getPersonalityReport,
    type PersonalityReport,
} from "@/lib/api/assessment";

import { getActiveAssessmentSession } from "@/lib/api/sessions";

// Read-only page: it shows the report the backend returns and never
// starts, finalises or recalculates anything.
type ResultsState =
    | { kind: "loading" }
    | { kind: "signin" }
    | { kind: "ready"; report: PersonalityReport }
    | { kind: "accessDenied" }
    | { kind: "missing" }
    | { kind: "error"; message: string };

const CONFIDENCE_LABELS: Record<string, string> = {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
};

export default function PersonalityResultsPage() {
    const router = useRouter();

    const [state, setState] = useState<ResultsState>({ kind: "loading" });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let isMounted = true;

        async function loadReport() {
            try {
                const currentUser = await getCurrentUser();

                if (!isMounted) return;

                if (
                    !currentUser.accountEnabled ||
                    !currentUser.emailVerified
                ) {
                    setState({
                        kind: "error",
                        message:
                            "Your account must be enabled and your email verified to access the assessment.",
                    });
                    return;
                }
            } catch {
                if (isMounted) setState({ kind: "signin" });
                return;
            }

            try {
                const session = await getActiveAssessmentSession();

                if (!isMounted) return;

                // Results exist only once Stage 2 is complete.
                if (!session || !session.completedAt) {
                    router.replace("/personality_assessment");
                    return;
                }

                const report = await getPersonalityReport(session.id);

                if (!isMounted) return;

                setState({ kind: "ready", report });
            } catch (error) {
                if (!isMounted) return;

                if (error instanceof ApiError) {
                    if (error.status === 401) {
                        setState({ kind: "signin" });
                        return;
                    }

                    if (error.status === 403) {
                        setState({ kind: "accessDenied" });
                        return;
                    }

                    if (error.status === 404) {
                        setState({ kind: "missing" });
                        return;
                    }
                }

                setState({
                    kind: "error",
                    message:
                        error instanceof Error && error.message
                            ? error.message
                            : "Unable to load your Personality Assessment results.",
                });
            }
        }

        void loadReport();

        return () => {
            isMounted = false;
        };
    }, [router, reloadKey]);

    function retry() {
        setState({ kind: "loading" });
        setReloadKey((key) => key + 1);
    }

    if (state.kind === "loading") {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    <p className="mt-5 text-sm font-medium text-slate-600">
                        Retrieving your Personality Assessment results...
                    </p>
                </div>
            </main>
        );
    }

    if (state.kind !== "ready") {
        const content = {
            signin: {
                title: "Session expired",
                message: "Your session has expired. Please sign in again.",
            },
            accessDenied: {
                title: "Results Access Required",
                message:
                    "Your Personality Assessment is complete and your results are saved. Viewing them requires Stage 2 access. Please contact the administrator for assistance.",
            },
            missing: {
                title: "Results Unavailable",
                message:
                    "Your Personality Assessment is marked as complete, but its saved results could not be found. Please contact the administrator.",
            },
            error: {
                title: "Unable to Load Results",
                message: state.kind === "error" ? state.message : "",
            },
        }[state.kind];

        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-slate-900">
                        {content.title}
                    </h1>

                    <p className="mt-4 leading-7 text-slate-600">
                        {content.message}
                    </p>

                    {state.kind === "signin" ? (
                        <button
                            type="button"
                            onClick={() => router.push("/login")}
                            className="mt-7 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
                        >
                            Sign in
                        </button>
                    ) : (
                        <div className="mt-7 flex flex-col gap-3">
                            {state.kind === "error" && (
                                <button
                                    type="button"
                                    onClick={retry}
                                    className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
                                >
                                    Try Again
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => router.push("/dashboard")}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    const { report } = state;
    const isTie = report.dominantTypes.length > 1;

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
                            Stage Two Complete
                        </p>

                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                            Your Personality Results
                        </h1>

                        <p className="mt-4 leading-7 text-slate-600">
                            {isTie
                                ? "Your results show more than one dominant personality type."
                                : "Here is your dominant personality type from your saved results."}
                        </p>
                    </div>

                    <div className="mt-10 space-y-6">
                        {report.dominantTypes.map((type) => (
                            <article
                                key={type.personalityTypeId}
                                className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-indigo-600">
                                            Dominant Type
                                        </p>
                                        <h2 className="mt-1 text-2xl font-bold text-slate-900">
                                            {type.name ?? type.code ?? `Type ${type.personalityTypeId}`}
                                        </h2>
                                        {type.title && (
                                            <p className="mt-1 text-slate-600">
                                                {type.title}
                                            </p>
                                        )}
                                    </div>

                                    <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700">
                                        Score {type.score}
                                    </span>
                                </div>

                                <ReportSection title="Overview" text={type.overview} />
                                <ReportSection title="Strengths" text={type.strengths} />
                                <ReportSection title="Weaknesses" text={type.weaknesses} />
                                <ReportSection title="Growth Path" text={type.growthPath} />
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        {report.runnerUp && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                <p className="text-sm font-semibold text-slate-700">
                                    Runner-up
                                </p>
                                <p className="mt-2 text-lg font-bold text-slate-900">
                                    {report.runnerUp.name ??
                                        report.runnerUp.code ??
                                        `Type ${report.runnerUp.personalityTypeId}`}
                                </p>
                                {report.runnerUp.title && (
                                    <p className="text-sm text-slate-600">
                                        {report.runnerUp.title}
                                    </p>
                                )}
                                <p className="mt-2 text-sm text-slate-500">
                                    Score {report.runnerUp.score}
                                </p>
                            </div>
                        )}

                        {report.confidence && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                <p className="text-sm font-semibold text-slate-700">
                                    Confidence
                                </p>
                                <p className="mt-2 text-lg font-bold text-slate-900">
                                    {CONFIDENCE_LABELS[report.confidence.level] ??
                                        report.confidence.level}
                                </p>
                                <p className="mt-2 text-sm text-slate-500">
                                    Score gap {report.confidence.score}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => router.push("/stage1_results")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            View Energy Center Results
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}

function ReportSection({ title, text }: { title: string; text: string }) {
    if (!text) return null;

    return (
        <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                {text}
            </p>
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
