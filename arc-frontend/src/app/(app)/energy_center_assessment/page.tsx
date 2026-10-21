"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
    getCurrentUser,
    type CurrentUser,
} from "@/lib/api/auth";

import {
    startAssessment,
    getNextEnergyGroup,
    submitEnergyGroup,
    finishEnergyAssessment,
    getSavedEnergyResult,
    type EnergyGroup,
    type EnergyAssessmentResult,
} from "@/lib/api/assessment";

import {
    getActiveAssessmentSession,
    getAssessmentProgress,
} from "@/lib/api/sessions";

const RANK_OPTIONS = [
    { id: 3, label: "Most True", description: "Best describes me" },
    { id: 2, label: "True", description: "Generally describes me" },
    { id: 1, label: "Least True", description: "Least describes me" },
];

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

export default function AssessmentPage() {
    const router = useRouter();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [group, setGroup] = useState<EnergyGroup | null>(null);

    const [rankings, setRankings] = useState<Record<number, number>>({});
    const [result, setResult] = useState<EnergyAssessmentResult | null>(null);

    const [isStarting, setIsStarting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);

    const [flowError, setFlowError] = useState("");

    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [stage1Completed, setStage1Completed] = useState(false);
    const [isCheckingProgress, setIsCheckingProgress] = useState(false);

    // Load the authenticated user.
    useEffect(() => {
        let isMounted = true;

        async function loadUser() {
            try {
                const currentUser = await getCurrentUser();

                if (isMounted) {
                    setUser(currentUser);
                }
            } catch (error) {
                if (!isMounted) return;

                setLoadError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load your account.",
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void loadUser();

        return () => {
            isMounted = false;
        };
    }, []);

    // Check the user's existing assessment progress.
    useEffect(() => {
        if (!user || !user.emailVerified || !user.accountEnabled) {
            return;
        }

        let isMounted = true;

        async function checkProgress() {
            setIsCheckingProgress(true);

            try {
                const session = await getActiveAssessmentSession();

                if (!isMounted) return;

                if (!session) {
                    setHasActiveSession(false);
                    setStage1Completed(false);
                    return;
                }

                setSessionId(session.id);
                setHasActiveSession(true);

                const progress = await getAssessmentProgress(session.id);

                if (!isMounted) return;

                setStage1Completed(progress.stage1Completed);
            } catch (error) {
                if (!isMounted) return;

                setFlowError(
                    error instanceof Error
                        ? error.message
                        : "Unable to check your assessment progress.",
                );
            } finally {
                if (isMounted) {
                    setIsCheckingProgress(false);
                }
            }
        }

        void checkProgress();

        return () => {
            isMounted = false;
        };
    }, [user]);

    // Load the next group, or calculate the results when all groups are done.

    async function loadNextGroup(currentSessionId: string) {
        setFlowError('');

        const next = await getNextEnergyGroup(currentSessionId);

        if ('completed' in next && next.completed) {
            setGroup(null);
            setIsFinishing(true);

            try {
                // First, look for an existing saved result.
                const savedResult =
                    await getSavedEnergyResult(currentSessionId);

                if (!savedResult) {
                    // Recovery: all groups are answered, but no result exists.
                    await finishEnergyAssessment(currentSessionId);
                }

                // Show the completion page before the Stage 1 results.
                router.replace('/stage1_completed');
                return;
            } finally {
                setIsFinishing(false);
            }
        }

        setGroup(next as EnergyGroup);
        setRankings({});
    }


    // Start a new assessment or resume an unfinished session.
    async function handleStartAssessment() {
        setIsStarting(true);
        setFlowError("");

        try {
            const session = await startAssessment();

            setSessionId(session.id);

            await loadNextGroup(session.id);
        } catch (error) {
            setFlowError(
                error instanceof Error
                    ? error.message
                    : "Unable to start your assessment. Please try again.",
            );
        } finally {
            setIsStarting(false);
        }
    }

    // A rank can only be assigned to one statement in each group.
    function handleRank(statementId: number, rankId: number) {
        setRankings((previous) => {
            const updated = { ...previous };

            // Clicking the selected rank again clears it and frees it up.
            if (previous[statementId] === rankId) {
                delete updated[statementId];
                return updated;
            }

            // Remove the same rank from any other statement.
            for (const key of Object.keys(updated)) {
                if (updated[Number(key)] === rankId) {
                    delete updated[Number(key)];
                }
            }

            updated[statementId] = rankId;

            return updated;
        });
    }

    function isRankUsedByAnotherStatement(
        statementId: number,
        rankId: number,
    ) {
        return Object.entries(rankings).some(
            ([id, assignedRank]) =>
                Number(id) !== statementId && assignedRank === rankId,
        );
    }

    // Submit the current group's rankings.
    async function handleSubmitGroup() {
        if (!sessionId || !group) return;

        if (Object.keys(rankings).length !== group.statements.length) {
            setFlowError("Please rank every statement before continuing.");
            return;
        }

        const assignedRanks = Object.values(rankings);

        if (new Set(assignedRanks).size !== assignedRanks.length) {
            setFlowError("Each ranking must be used only once.");
            return;
        }

        setIsSubmitting(true);
        setFlowError("");

        try {
            await submitEnergyGroup({
                sessionId,
                energyStatementGroupId: group.groupId,
                rankings: group.statements.map((statement) => ({
                    statementId: statement.id,
                    rankId: rankings[statement.id],
                })),
            });

            await loadNextGroup(sessionId);
        } catch (error) {
            setFlowError(
                error instanceof Error
                    ? error.message
                    : "Unable to submit your answers. Please try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    // Loading screen.
    if (isLoading) {
        return (
            <main className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />

                    <p className="mt-5 text-sm font-medium text-slate-600">
                        Preparing your ARC experience...
                    </p>
                </div>
            </main>
        );
    }

    // Account loading error.
    if (loadError) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4">
                <div className="max-w-md rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Unable to Load Assessment
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        {loadError}
                    </p>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </main>
        );
    }

    if (!user) return null;

    const hasAccess =
        user.role === "ADMIN" || user.accountEnabled && user.emailVerified;

    // Access restriction.
    if (!hasAccess) {
        return (
            <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <DecorativeBackground />

                <section className="relative w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-2xl shadow-indigo-200/40 backdrop-blur-xl sm:p-10">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl">
                        🔐
                    </div>

                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                        ARC Personality Assessment
                    </p>

                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        Your next step starts here.
                    </h1>

                    <p className="mx-auto mt-4 max-w-sm leading-7 text-slate-600">
                        Your account does not currently have access to the
                        assessment. Please contact the administrator for
                        assistance.
                    </p>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                    >
                        Return to Dashboard
                    </button>
                </section>
            </main>
        );
    }

    // Completed assessment results.
    if (result) {
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
                                You have completed the Energy Center assessment.
                                Here is your score breakdown.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4 sm:grid-cols-3">
                            {[
                                {
                                    name: "Gut",
                                    score: result.gut,
                                    style: "bg-rose-50 border-rose-100 text-rose-700",
                                },
                                {
                                    name: "Heart",
                                    score: result.heart,
                                    style: "bg-pink-50 border-pink-100 text-pink-700",
                                },
                                {
                                    name: "Head",
                                    score: result.head,
                                    style: "bg-indigo-50 border-indigo-100 text-indigo-700",
                                },
                            ].map((center) => (
                                <div
                                    key={center.name}
                                    className={`rounded-2xl border p-6 text-center ${center.style}`}
                                >
                                    <p className="text-sm font-semibold">
                                        {center.name} Center
                                    </p>

                                    <p className="mt-3 text-4xl font-bold">
                                        {center.score}
                                    </p>

                                    <p className="mt-2 text-xs opacity-75">
                                        Total score
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
                            <p className="text-sm font-semibold text-slate-700">
                                Dominant Energy Center
                            </p>

                            <p className="mt-2 text-2xl font-bold text-indigo-700">
                                {result.dominant
                                    ? CENTER_STYLES[result.dominant]?.label ??
                                    result.dominant
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
                            <h2 className="font-semibold text-slate-900">
                                What happens next?
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Your eligibility for Stage Two is determined by
                                your results and the assessment's access rules.
                                Continue to your dashboard to review your
                                assessment status.
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

    // Finishing Stage One.
    if (isFinishing) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />

                    <h1 className="mt-5 text-xl font-bold text-slate-900">
                        Calculating Your Results
                    </h1>

                    <p className="mt-2 text-sm text-slate-600">
                        Please wait while we process your assessment.
                    </p>
                </div>
            </main>
        );
    }

    // Display the appropriate screen based on assessment progress.
    if (!group) {
        const isAuthorized =
            user?.role === "ADMIN" || (user?.accountEnabled === true && user?.emailVerified === true);

        const isCompleted = stage1Completed;
        const isInProgress = hasActiveSession && !isCompleted;

        const heading = isFinishing
            ? "Preparing Your Results"
            : isStarting
                ? "Preparing Your Assessment"
                : isCheckingProgress || isLoading
                    ? "Checking Your Assessment"
                    : isCompleted
                        ? "Energy Center Assessment Completed!"
                        : isInProgress
                            ? "Welcome Back!"
                            : "Begin Your Assessment";

        const message = isFinishing
            ? "Your responses are being processed. Please wait."
            : isStarting
                ? "Please wait while we prepare your assessment."
                : isCheckingProgress || isLoading
                    ? "Please wait while we check your assessment progress."
                    : isCompleted
                        ? "Your Energy Center assessment is complete. Your results are ready."
                        : isInProgress
                            ? "Your assessment is in progress. Continue where you left off."
                            : "Discover your Energy Center by completing the assessment.";

        const buttonLabel = isCompleted
            ? "View My Results"
            : isInProgress
                ? "Continue Assessment"
                : "Begin Assessment";

        return (
            <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <DecorativeBackground />

                <section className="relative w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl shadow-indigo-200/40 backdrop-blur-xl">
                    {!isAuthorized && !isLoading ? (
                        <>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">
                                !
                            </div>

                            <h1 className="mt-5 text-2xl font-bold text-slate-900">
                                Your Next Step Starts Here
                            </h1>

                            <p className="mt-4 text-sm leading-6 text-slate-600">
                                Your account does not currently have access to
                                the assessment. Please contact the administrator
                                for assistance.
                            </p>

                            <button
                                type="button"
                                onClick={() => router.push("/dashboard")}
                                className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
                            >
                                Return to Dashboard
                            </button>
                        </>
                    ) : loadError ? (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Unable to Load Your Account
                            </h1>

                            <p
                                role="alert"
                                className="mt-4 text-sm leading-6 text-rose-600"
                            >
                                {loadError}
                            </p>

                            <button
                                type="button"
                                onClick={() => router.push("/dashboard")}
                                className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
                            >
                                Return to Dashboard
                            </button>
                        </>
                    ) : flowError ? (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Unable to Load Assessment
                            </h1>

                            <p
                                role="alert"
                                className="mt-4 text-sm leading-6 text-rose-600"
                            >
                                {flowError}
                            </p>

                            <button
                                type="button"
                                onClick={handleStartAssessment}
                                disabled={isStarting || isCheckingProgress}
                                className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Try Again
                            </button>

                            {/* Navigation only: no session is created, deleted, or reset. */}
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard")}
                                disabled={isStarting}
                                className="mx-auto mt-3 block rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-700">
                                {isCompleted ? "✓" : "✦"}
                            </div>

                            <h1 className="mt-5 text-2xl font-bold text-slate-900">
                                {heading}
                            </h1>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {message}
                            </p>

                            {!isLoading &&
                                !isCheckingProgress &&
                                !isStarting &&
                                !isFinishing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isCompleted) {
                                                router.push("/stage1_results");
                                            } else {
                                                void handleStartAssessment();
                                            }
                                        }}
                                        className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
                                    >
                                        {buttonLabel}
                                    </button>
                                )}

                            {/* Navigation only: no session is created, deleted, or reset. */}
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard")}
                                disabled={isStarting || isFinishing}
                                className="mx-auto mt-3 block rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </section>
            </main>
        );
    }

    // Active assessment group.
    const answeredCount = Object.keys(rankings).length;

    const progressPercentage = Math.round(
        ((group.groupNo - 1 + answeredCount / group.statements.length) /
            group.totalGroups) *
        100,
    );

    return (
        <main className="relative min-h-[75vh] overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-10 sm:px-8 sm:py-14">
            <DecorativeBackground />

            <section className="relative mx-auto max-w-4xl">
                <div className="mb-8">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                        ARC Core Assessment
                    </p>

                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        Energy Center Assessment
                    </h1>

                    <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                        Read each statement carefully. Assign one ranking to
                        each statement based on how accurately it describes
                        you.
                    </p>
                </div>

                <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-xl shadow-indigo-200/30 backdrop-blur-xl sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                Group {group.groupNo} of {group.totalGroups}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                {answeredCount} of {group.statements.length} statements ranked
                            </p>
                        </div>

                        <span className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                            {progressPercentage}% complete
                        </span>
                    </div>

                    <div
                        className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label="Assessment progress"
                        aria-valuenow={progressPercentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>

                    <div className="mt-8 space-y-5">
                        {group.statements.map((statement, index) => {
                            const centerStyle =
                                CENTER_STYLES[statement.personalityType];

                            return (
                                <article
                                    key={statement.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md sm:p-6"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-sm font-bold text-indigo-700">
                                            {String(index + 1).padStart(2, "0")}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                    Statement {index + 1}
                                                </span>

                                                {centerStyle && (
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${centerStyle.background} ${centerStyle.color}`}
                                                    >
                                                        {centerStyle.label}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-3 text-base font-medium leading-7 text-slate-800 sm:text-lg">
                                                {statement.text}
                                            </p>

                                            <fieldset className="mt-5">
                                                <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    How true is this for you?
                                                </legend>

                                                <div className="grid gap-2 sm:grid-cols-3">
                                                    {RANK_OPTIONS.map((option) => {
                                                        const selected =
                                                            rankings[statement.id] === option.id;

                                                        const disabled =
                                                            isRankUsedByAnotherStatement(
                                                                statement.id,
                                                                option.id,
                                                            );

                                                        return (
                                                            <button
                                                                key={option.id}
                                                                type="button"
                                                                disabled={isSubmitting || disabled}
                                                                aria-pressed={selected}
                                                                onClick={() =>
                                                                    handleRank(statement.id, option.id)
                                                                }
                                                                className={`rounded-xl border px-3 py-3 text-left transition ${selected
                                                                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                                                                    : disabled
                                                                        ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-40"
                                                                        : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50"
                                                                    }`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <span
                                                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected
                                                                            ? "border-indigo-600 bg-indigo-600 text-white"
                                                                            : "border-slate-300 bg-white"
                                                                            }`}
                                                                    >
                                                                        {selected && (
                                                                            <span className="text-xs">✓</span>
                                                                        )}
                                                                    </span>

                                                                    <span
                                                                        className={`text-sm font-semibold ${selected
                                                                            ? "text-indigo-700"
                                                                            : "text-slate-700"
                                                                            }`}
                                                                    >
                                                                        {option.label}
                                                                    </span>
                                                                </span>

                                                                <span className="mt-2 block pl-7 text-xs leading-5 text-slate-500">
                                                                    {option.description}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </fieldset>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {flowError && (
                        <div
                            role="alert"
                            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700"
                        >
                            {flowError}
                        </div>
                    )}

                    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            disabled={isSubmitting}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmitGroup}
                            disabled={
                                isSubmitting ||
                                answeredCount !== group.statements.length
                            }
                            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting
                                ? "Saving your answers..."
                                : group.groupNo === group.totalGroups
                                    ? "Submit & View Results"
                                    : "Save & Continue →"}
                        </button>
                    </div>

                    <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                        Each ranking can be used only once per group. Click a
                        selected ranking to clear it.
                    </p>
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

            <svg
                className="absolute bottom-0 left-0 h-64 w-64 text-violet-400/10"
                viewBox="0 0 256 256"
                fill="none"
            >
                {Array.from({ length: 7 }, (_, index) => (
                    <circle
                        key={index}
                        cx="0"
                        cy="256"
                        r={24 + index * 22}
                        stroke="currentColor"
                    />
                ))}
            </svg>
        </div>
    );
}