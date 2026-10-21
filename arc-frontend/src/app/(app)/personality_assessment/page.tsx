"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser } from "@/lib/api/auth";

import {
    ApiError,
    finalizePersonalityAssessment,
    getNextPersonalityCenter,
    getNextPersonalityQuestion,
    getSavedEnergyResult,
    getStage2Access,
    startPersonalityAssessment,
    submitPersonalityAnswer,
    type EnergyCenterCode,
    type PersonalityQuestion,
    type PersonalityRankChoice,
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

const ENERGY_CENTER_CODES: readonly EnergyCenterCode[] = ["GUT", "HEART", "HEAD"];

// Every center has 45 questions in the current question bank; used only
// for the expected total on the introduction, never for progress.
const QUESTIONS_PER_CENTER = 45;

// The answer scale stored in personality_rank_choices. Shown on the
// introduction only; questions always render the options the API returns.
const ANSWER_SCALE = [
    { score: 1, label: "TOTALLY FALSE" },
    { score: 2, label: "NOT TRUE" },
    { score: 3, label: "INDIFFERENT" },
    { score: 4, label: "TRUE" },
    { score: 5, label: "VERY TRUE" },
];

const STAGE2_REASON_MESSAGES: Record<string, string> = {
    AUTH_REQUIRED:
        "Your Stage 1 assessment is complete. Access to the Personality Assessment has not yet been granted. Please contact the administrator to request Stage 2 access.",
    ACCOUNT_DISABLED:
        "Your account is currently disabled. Please contact the administrator for assistance.",
    EMAIL_NOT_VERIFIED:
        "Please verify your email address before continuing to the Personality Assessment.",
};

// Every screen is derived from backend responses; nothing is kept in
// localStorage or the URL, so a refresh always resumes from the server.
type Screen =
    | { kind: "loading"; message: string }
    | { kind: "signin" }
    | { kind: "blocked"; title: string; message: string }
    // centers is null when the order could not be confirmed.
    | { kind: "intro"; centers: EnergyCenterCode[] | null }
    | { kind: "welcome"; center: EnergyCenterCode }
    | {
          kind: "question";
          center: EnergyCenterCode;
          question: PersonalityQuestion;
          options: PersonalityRankChoice[];
      }
    | { kind: "centerComplete"; center: EnergyCenterCode }
    | { kind: "finalising" }
    | { kind: "stage2Complete" }
    | { kind: "error"; message: string };

function centerLabel(center: string) {
    return CENTER_STYLES[center]?.label ?? center;
}

export default function PersonalityAssessmentPage() {
    const router = useRouter();

    const [screen, setScreen] = useState<Screen>({
        kind: "loading",
        message: "Checking your assessment progress...",
    });
    const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(
        null,
    );
    const [notice, setNotice] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const sessionIdRef = useRef<string | null>(null);
    const currentQuestionIdRef = useRef<number | null>(null);
    // Guards against double clicks before React re-renders the disabled state.
    const busyRef = useRef(false);
    const isMountedRef = useRef(true);

    function accessMessage(reason?: string) {
        return (
            (reason && STAGE2_REASON_MESSAGES[reason]) ??
            "You cannot continue to the Personality Assessment yet. Please contact the administrator for assistance."
        );
    }

    // Safe to repeat: the backend returns stored results if they exist.
    async function finalise(sessionId: string) {
        setScreen({ kind: "finalising" });

        await finalizePersonalityAssessment(sessionId);

        // Results are calculated and saved; let the user open them.
        if (isMountedRef.current) {
            setScreen({ kind: "stage2Complete" });
        }
    }

    async function loadQuestion(sessionId: string, center: EnergyCenterCode) {
        const next = await getNextPersonalityQuestion(sessionId, center);

        if (!isMountedRef.current) return;

        if ("completed" in next) {
            setScreen({ kind: "centerComplete", center });
            return;
        }

        // Keep the selection only if the backend returned the same question.
        if (currentQuestionIdRef.current !== next.question.id) {
            setSelectedChoiceId(null);
        }
        currentQuestionIdRef.current = next.question.id;

        setScreen({
            kind: "question",
            center,
            question: next.question,
            options: next.options,
        });
    }

    // The backend decides the current center and its next question.
    async function continueAssessment(sessionId: string) {
        setScreen({ kind: "loading", message: "Loading your next question..." });

        const next = await getNextPersonalityCenter(sessionId);

        if (!isMountedRef.current) return;

        if (next.completed) {
            await finalise(sessionId);
            return;
        }

        await loadQuestion(sessionId, next.next);
    }

    async function loadInitialState() {
        try {
            const currentUser = await getCurrentUser();

            if (!isMountedRef.current) return;

            if (!currentUser.accountEnabled || !currentUser.emailVerified) {
                setScreen({
                    kind: "blocked",
                    title: "Assessment Access Required",
                    message:
                        "Your account must be enabled and your email verified to access the assessment.",
                });
                return;
            }
        } catch {
            if (isMountedRef.current) setScreen({ kind: "signin" });
            return;
        }

        const session = await getActiveAssessmentSession();

        if (!isMountedRef.current) return;

        if (!session) {
            router.replace("/energy_center_assessment");
            return;
        }

        const progress = await getAssessmentProgress(session.id);

        if (!isMountedRef.current) return;

        // Stage 1 must be finished through the normal flow first.
        if (!progress.stage1Completed) {
            router.replace("/energy_center_assessment");
            return;
        }

        // Completed Stage 2, including legacy attempts: never start again.
        if (session.completedAt) {
            router.replace("/personality_results");
            return;
        }

        sessionIdRef.current = session.id;

        const access = await getStage2Access(session.id);

        if (!isMountedRef.current) return;

        if (!access.allowed) {
            setScreen({
                kind: "blocked",
                title: "Personality Assessment Access Required",
                message: accessMessage(access.reason),
            });
            return;
        }

        const next = await getNextPersonalityCenter(session.id);

        if (!isMountedRef.current) return;

        // Every eligible center is answered but Stage 2 was not finalised,
        // for example after a dropped request: finish it now.
        if (next.completed) {
            await finalise(session.id);
            return;
        }

        if (progress.stage2Started) {
            setScreen({ kind: "welcome", center: next.next });
            return;
        }

        // The saved Stage 1 result lists eligible centers ordered by id,
        // the same order Stage 2 follows. Reading it creates nothing.
        const energyResult = await getSavedEnergyResult(session.id);

        if (!isMountedRef.current) return;

        const centers = (energyResult?.eligibleCenters ?? []).filter(
            (center): center is EnergyCenterCode =>
                ENERGY_CENTER_CODES.includes(center as EnergyCenterCode),
        );

        // Only show an order that agrees with the backend's first center.
        setScreen({
            kind: "intro",
            centers: centers[0] === next.next ? centers : null,
        });
    }

    // Shows the right state for a failed request. Returns a follow-up step
    // to run once the current request has finished, if one is needed.
    function handleError(
        error: unknown,
        allowResync: boolean,
    ): (() => Promise<void>) | null {
        if (!isMountedRef.current) return null;

        const sessionId = sessionIdRef.current;

        if (error instanceof ApiError) {
            if (error.status === 401) {
                setScreen({ kind: "signin" });
                return null;
            }

            if (
                error.status === 409 &&
                error.message === "STAGE2_ALREADY_COMPLETED"
            ) {
                router.replace("/personality_results");
                return null;
            }

            if (error.status === 403) {
                setScreen({
                    kind: "blocked",
                    title: "Personality Assessment Access Required",
                    message: accessMessage(error.message),
                });
                return null;
            }

            // Sequence or answer conflicts: the saved state has moved on,
            // so reload it rather than retrying the same request.
            if (
                (error.status === 400 || error.status === 409) &&
                sessionId &&
                allowResync
            ) {
                setNotice("Your progress was refreshed from your saved answers.");
                return () => continueAssessment(sessionId);
            }
        }

        // Network or server error: the outcome of the last request is
        // unknown, so retry reloads saved state instead of resubmitting.
        setScreen({
            kind: "error",
            message:
                error instanceof Error && error.message
                    ? error.message
                    : "Something went wrong. Please try again.",
        });
        return null;
    }

    // Runs one backend step at a time; overlapping clicks are ignored.
    async function run(work: () => Promise<void>, isFollowUp = false) {
        if (busyRef.current) return;

        busyRef.current = true;
        setIsBusy(true);

        let followUp: (() => Promise<void>) | null = null;

        try {
            await work();
        } catch (error) {
            // A failed resync shows the error screen instead of looping.
            followUp = handleError(error, !isFollowUp);
        } finally {
            busyRef.current = false;

            if (isMountedRef.current) {
                setIsBusy(false);
            }
        }

        if (followUp && isMountedRef.current) {
            await run(followUp, true);
        }
    }

    useEffect(() => {
        isMountedRef.current = true;

        void run(loadInitialState);

        return () => {
            isMountedRef.current = false;
        };
        // Load once on mount; every later step is driven by user actions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleRetry() {
        const sessionId = sessionIdRef.current;

        setNotice("");
        setScreen({
            kind: "loading",
            message: "Checking your assessment progress...",
        });
        void run(() =>
            sessionId ? continueAssessment(sessionId) : loadInitialState(),
        );
    }

    function handleBegin() {
        const sessionId = sessionIdRef.current;
        if (!sessionId) return;

        void run(async () => {
            setScreen({
                kind: "loading",
                message: "Preparing your Personality Assessment...",
            });

            await startPersonalityAssessment(sessionId);

            if (!isMountedRef.current) return;

            await continueAssessment(sessionId);
        });
    }

    function handleContinue() {
        const sessionId = sessionIdRef.current;
        if (!sessionId) return;

        setNotice("");
        void run(() => continueAssessment(sessionId));
    }

    function handleSubmit() {
        const sessionId = sessionIdRef.current;

        if (!sessionId || screen.kind !== "question" || !selectedChoiceId) {
            return;
        }

        const { center, question } = screen;
        const choiceId = selectedChoiceId;

        setNotice("");
        void run(async () => {
            const result = await submitPersonalityAnswer(
                sessionId,
                center,
                question.id,
                choiceId,
            );

            if (!isMountedRef.current) return;

            if ("completed" in result) {
                setSelectedChoiceId(null);
                setScreen({ kind: "centerComplete", center });
                return;
            }

            await loadQuestion(sessionId, center);
        });
    }

    return (
        <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
            <DecorativeBackground />

            <section className="relative w-full max-w-2xl rounded-3xl border border-white bg-white/90 p-6 shadow-xl shadow-indigo-200/40 backdrop-blur-xl sm:p-10">
                {notice && screen.kind === "question" && (
                    <p
                        role="status"
                        className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800"
                    >
                        {notice}
                    </p>
                )}

                <ScreenContent
                    screen={screen}
                    isBusy={isBusy}
                    selectedChoiceId={selectedChoiceId}
                    onSelect={setSelectedChoiceId}
                    onBegin={handleBegin}
                    onContinue={handleContinue}
                    onRetry={handleRetry}
                    onSubmit={handleSubmit}
                    onDashboard={() => router.push("/dashboard")}
                    onSignIn={() => router.push("/login")}
                    onViewResults={() => router.push("/personality_results")}
                />
            </section>
        </main>
    );
}

function ScreenContent({
    screen,
    isBusy,
    selectedChoiceId,
    onSelect,
    onBegin,
    onContinue,
    onRetry,
    onSubmit,
    onDashboard,
    onSignIn,
    onViewResults,
}: {
    screen: Screen;
    isBusy: boolean;
    selectedChoiceId: number | null;
    onSelect: (choiceId: number) => void;
    onBegin: () => void;
    onContinue: () => void;
    onRetry: () => void;
    onSubmit: () => void;
    onDashboard: () => void;
    onSignIn: () => void;
    onViewResults: () => void;
}) {
    const primaryButton =
        "mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60";
    const secondaryButton =
        "mt-3 w-full rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

    switch (screen.kind) {
        case "loading":
        case "finalising":
            return (
                <div className="py-6 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    <p className="mt-5 text-sm font-medium text-slate-600">
                        {screen.kind === "finalising"
                            ? "Saving your Personality Assessment results..."
                            : screen.message}
                    </p>
                </div>
            );

        case "signin":
            return (
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Session expired
                    </h1>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        Your session has expired. Please sign in again.
                    </p>
                    <button type="button" onClick={onSignIn} className={primaryButton}>
                        Sign in
                    </button>
                </div>
            );

        case "blocked":
            return (
                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">
                        !
                    </div>
                    <h1 className="mt-5 text-2xl font-bold text-slate-900">
                        {screen.title}
                    </h1>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        {screen.message}
                    </p>
                    <button type="button" onClick={onDashboard} className={primaryButton}>
                        Return to Dashboard
                    </button>
                </div>
            );

        case "error":
            return (
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Unable to Load Assessment
                    </h1>
                    <p role="alert" className="mt-4 text-sm leading-6 text-rose-600">
                        {screen.message}
                    </p>
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={isBusy}
                        className={primaryButton}
                    >
                        Try Again
                    </button>
                    <button type="button" onClick={onDashboard} className={secondaryButton}>
                        Return to Dashboard
                    </button>
                </div>
            );

        case "intro": {
            const centers = screen.centers;

            return (
                <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                        Stage 2
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        Personality Assessment
                    </h1>
                    <p className="mt-4 leading-7 text-slate-600">
                        Your Energy Center results decide which personality
                        centers you assess. Depending on those results, this
                        can be one, two or all three of Gut, Heart and Head.
                    </p>

                    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-left">
                        <h2 className="font-semibold text-slate-900">
                            Your centers
                        </h2>

                        {centers && centers.length > 0 ? (
                            <>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    You will assess{" "}
                                    {centers.length === 1
                                        ? "1 center"
                                        : `${centers.length} centers`}
                                    , in this order:
                                </p>

                                <ol className="mt-3 flex flex-wrap gap-2">
                                    {centers.map((center, index) => {
                                        const style = CENTER_STYLES[center];

                                        return (
                                            <li
                                                key={center}
                                                className={`rounded-full px-4 py-2 text-sm font-semibold ${style
                                                    ? `${style.background} ${style.color}`
                                                    : "bg-slate-100 text-slate-700"
                                                    }`}
                                            >
                                                {index + 1}. {centerLabel(center)}
                                            </li>
                                        );
                                    })}
                                </ol>

                                <p className="mt-4 text-sm leading-6 text-slate-600">
                                    Each center has {QUESTIONS_PER_CENTER}{" "}
                                    questions, so you can expect{" "}
                                    <span className="font-semibold text-slate-900">
                                        {centers.length * QUESTIONS_PER_CENTER}{" "}
                                        questions
                                    </span>{" "}
                                    in total.
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Your centers will be shown as you go. Each
                                center has {QUESTIONS_PER_CENTER} questions.
                            </p>
                        )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-left">
                        <h2 className="font-semibold text-slate-900">
                            Answer scale
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            You will see one statement at a time. Choose how
                            true it is for you:
                        </p>

                        <ul className="mt-3 grid gap-2 sm:grid-cols-5">
                            {ANSWER_SCALE.map((option) => (
                                <li
                                    key={option.score}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700"
                                >
                                    <span className="block text-base text-indigo-700">
                                        {option.score}
                                    </span>
                                    {option.label}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-left">
                        <h2 className="font-semibold text-slate-900">
                            Your progress is saved
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Each answer is saved as soon as you submit it and
                            cannot be changed afterwards. If you leave before
                            finishing, you can continue later from your next
                            unanswered question.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onBegin}
                        disabled={isBusy}
                        className={primaryButton}
                    >
                        Begin Personality Assessment
                    </button>
                    <button type="button" onClick={onDashboard} className={secondaryButton}>
                        Return to Dashboard
                    </button>
                </div>
            );
        }

        case "welcome":
            return (
                <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                        Stage 2
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        Welcome Back!
                    </h1>
                    <p className="mt-4 leading-7 text-slate-600">
                        Your Personality Assessment is in progress. You will
                        continue with the {centerLabel(screen.center)} Center
                        from your next unanswered question.
                    </p>
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={isBusy}
                        className={primaryButton}
                    >
                        Continue Personality Assessment
                    </button>
                    <button type="button" onClick={onDashboard} className={secondaryButton}>
                        Return to Dashboard
                    </button>
                </div>
            );

        case "stage2Complete":
            return (
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
                        ✓
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
                        Stage 2 Complete
                    </p>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900">
                        Personality Assessment Complete
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        You have completed every center. Your results have
                        been calculated and saved.
                    </p>
                    <button
                        type="button"
                        onClick={onViewResults}
                        className={primaryButton}
                    >
                        View Your Test Result
                    </button>
                    <button type="button" onClick={onDashboard} className={secondaryButton}>
                        Return to Dashboard
                    </button>
                </div>
            );

        case "centerComplete":
            return (
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
                        ✓
                    </div>
                    <h1 className="mt-5 text-2xl font-bold text-slate-900">
                        {centerLabel(screen.center)} Center Complete
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        Your answers for this center have been saved.
                    </p>
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={isBusy}
                        className={primaryButton}
                    >
                        Continue
                    </button>
                    <button
                        type="button"
                        onClick={onDashboard}
                        disabled={isBusy}
                        className={secondaryButton}
                    >
                        Return to Dashboard
                    </button>
                </div>
            );

        case "question": {
            const style = CENTER_STYLES[screen.center];

            return (
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span
                            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${style
                                ? `${style.background} ${style.color}`
                                : "bg-slate-100 text-slate-700"
                                }`}
                        >
                            {centerLabel(screen.center)} Center
                        </span>

                        <span className="text-sm font-medium text-slate-500">
                            Question {screen.question.questionOrder}
                        </span>
                    </div>

                    <h1 className="mt-6 text-xl font-semibold leading-8 text-slate-900 sm:text-2xl">
                        {screen.question.text}
                    </h1>

                    {/* Options are shown exactly in the order the backend returns. */}
                    <div
                        role="radiogroup"
                        aria-label="Your answer"
                        className="mt-6 space-y-3"
                    >
                        {screen.options.map((option) => {
                            const isSelected = selectedChoiceId === option.id;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    disabled={isBusy}
                                    onClick={() => onSelect(option.id)}
                                    className={`w-full rounded-xl border px-5 py-3.5 text-left font-semibold transition disabled:cursor-not-allowed ${isSelected
                                        ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                                        }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isBusy || selectedChoiceId === null}
                        className={primaryButton}
                    >
                        {isBusy ? "Saving..." : "Submit Answer"}
                    </button>

                    {/* Navigation only: answers already saved are kept. */}
                    <button
                        type="button"
                        onClick={onDashboard}
                        disabled={isBusy}
                        className={secondaryButton}
                    >
                        Save and Return to Dashboard
                    </button>
                </div>
            );
        }
    }
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
