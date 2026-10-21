"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, logout, type CurrentUser } from "@/lib/api/auth";

import { useRouter } from "next/navigation";
import Link from "next/link";

import {
    getActiveAssessmentSession,
    getAssessmentProgress,
} from "@/lib/api/sessions";

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [stage1Completed, setStage1Completed] = useState(false);
    const [stage1ResultsViewed, setStage1ResultsViewed] = useState(false);
    // Stage 2 started: a personality session exists for this test session.
    const [stage2Started, setStage2Started] = useState(false);
    // Stage 2 completed: the test session has its completedAt set.
    const [stage2Completed, setStage2Completed] = useState(false);
    const [isCheckingProgress, setIsCheckingProgress] = useState(false);

    
    useEffect(() => {
        async function loadUser() {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch {
                setError("Your session has expired. Please sign in again.");
            } finally {
                setIsLoading(false);
            }
        }

        loadUser();
    }, []);

    // Load the user's Stage 1 assessment progress.
    useEffect(() => {
        // Stage 1 needs a verified, enabled account only (no Stage 2 grant).
        if (!user || !user.emailVerified || !user.accountEnabled) {
            return;
        }

        let isMounted = true;

        async function loadAssessmentProgress() {
            setIsCheckingProgress(true);

            try {
                const session = await getActiveAssessmentSession();

                if (!isMounted) return;

                if (!session) {
                    setHasActiveSession(false);
                    setStage1Completed(false);
                    return;
                }

                setHasActiveSession(true);

                const progress = await getAssessmentProgress(session.id);

                if (!isMounted) return;

                setStage1Completed(progress.stage1Completed);
                setStage1ResultsViewed(progress.stage1ResultsViewed);
                setStage2Started(progress.stage2Started);
                setStage2Completed(!!session.completedAt);
            } catch (progressError) {
                if (!isMounted) return;

                console.error(
                    "Unable to load assessment progress:",
                    progressError,
                );
            } finally {
                if (isMounted) {
                    setIsCheckingProgress(false);
                }
            }
        }

        void loadAssessmentProgress();

        return () => {
            isMounted = false;
        };
    }, [user]);
    
    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-gray-500">Loading your dashboard...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="mb-3 text-2xl font-bold">Session expired</h1>

                    <p className="mb-6 text-gray-600">{error}</p>

                    <button
                        onClick={() => router.push("/login")}
                        className="rounded-lg bg-black px-5 py-3 font-medium text-white"
                    >
                        Sign in
                    </button>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }
    // Stage 1 is open to every verified, enabled account.
    // Stage 2 is enforced separately by the backend.
    const canAccessAssessment = user.emailVerified && user.accountEnabled;
    const hasStage2Access = user.role === "ADMIN" || user.stage2AccessGranted;

    // Primary assessment action, derived from backend progress. The Stage 2
    // pages re-check access with the backend before anything is created.
    const nextStep: {
        message: string;
        href: string;
        label: string;
        showResultsLink: boolean;
    } = isCheckingProgress
        ? {
              message: "Checking your assessment progress...",
              href: "/assessment",
              label: "View Assessment",
              showResultsLink: false,
          }
        : !hasActiveSession
          ? {
                message: "You're ready to begin your Energy Center Assessment.",
                href: "/assessment",
                label: "Begin Assessment",
                showResultsLink: false,
            }
          : !stage1Completed
            ? {
                  message:
                      "You have an Energy Center Assessment in progress. Continue where you left off.",
                  href: "/energy_center_assessment",
                  label: "Continue Assessment",
                  showResultsLink: false,
              }
            : stage2Completed
              ? {
                    message:
                        "You have completed both stages of the ARC assessment. Your results are saved.",
                    href: "/personality_results",
                    label: "View Personality Results",
                    showResultsLink: true,
                }
              : stage2Started
                ? {
                      message:
                          "Your Personality Assessment is in progress. Continue where you left off.",
                      href: "/personality_assessment",
                      label: "Continue Personality Assessment",
                      showResultsLink: true,
                  }
                : !stage1ResultsViewed
                  ? {
                        message:
                            "You've completed the Energy Center Assessment. See your next steps.",
                        href: "/stage1_completed",
                        label: "View Your Next Steps",
                        showResultsLink: true,
                    }
                  : hasStage2Access
                    ? {
                          message:
                              "Your Energy Center results are ready. You can now begin the Personality Assessment.",
                          href: "/personality_assessment",
                          label: "Begin Personality Assessment",
                          showResultsLink: true,
                      }
                    : {
                          message:
                              "Your Energy Center results are ready. See your Personality Assessment status on your next-steps page.",
                          href: "/stage1_completed",
                          label: "View Your Next Steps",
                          showResultsLink: true,
                      };

    return (
        <main className="min-h-screen px-6 py-10">
            <div className="mx-auto max-w-4xl">
                <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm text-gray-500">ARC Assessment</p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Welcome to ARC
                        </h1>

                        <p className="mt-2 text-gray-600">
                            {user.email}
                        </p>
                    </div>

                    {/* Convenience link only: /admin endpoints are protected by the backend RoleGuard. */}
                    {user.role === "ADMIN" && (
                        <Link
                            href="/admin"
                            className="rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-gray-50"
                        >
                            Admin Dashboard
                        </Link>
                    )}
                </header>

                <section className="space-y-6">

                    {/* Assessment overview */}
                    <div className="rounded-xl border p-6">
                        <h2 className="text-xl font-semibold">
                            Your Assessment
                        </h2>

                        <p className="mt-2 text-gray-600">
                            Your ARC personality assessment journey starts here.
                        </p>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">

                            <div className="rounded-lg bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    Account
                                </p>

                                <p className="mt-1 font-medium">
                                    {user.role}
                                </p>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    Stage 2 Access
                                </p>

                                <p className="mt-1 font-medium">
                                    {hasStage2Access
                                        ? "Granted"
                                        : "Not Granted"}
                                </p>
                            </div>

                        </div>

                        {canAccessAssessment ? (
                            <div className="mt-6">
                                <p className="text-gray-600">
                                    {nextStep.message}
                                </p>

                                <div className="mt-4 flex flex-wrap items-center gap-4">
                                    <Link
                                        href={nextStep.href}
                                        className="inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:opacity-90"
                                    >
                                        {nextStep.label}
                                    </Link>

                                    {nextStep.showResultsLink && (
                                        <Link
                                            href="/stage1_results"
                                            className="text-sm font-medium text-gray-700 underline-offset-4 hover:underline"
                                        >
                                            View Energy Center Results
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <h3 className="font-semibold text-amber-900">
                                    Assessment Access Required
                                </h3>

                                <p className="mt-2 text-sm text-amber-900">
                                    Your account does not currently have assessment
                                    access. Please contact the administrator for
                                    assistance.
                                </p>

                                <Link
                                    href="/assessment"
                                    className="mt-4 inline-block rounded-lg border border-amber-300 px-4 py-2 font-medium text-amber-900 hover:bg-amber-100"
                                >
                                    View Access Status
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Application navigation cards */}
                    <div>
                        <h2 className="mb-4 text-xl font-semibold">
                            Your ARC Journey
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-3">
                            {/* Energy Center Assessment */}
                            <Link
                                href={
                                    !canAccessAssessment
                                        ? "/assessment"
                                        : stage1Completed
                                            ? "/stage1_results"
                                            : hasActiveSession
                                                ? "/energy_center_assessment"
                                                : "/assessment"
                                }
                                className="group rounded-xl border p-5 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-700 transition group-hover:bg-indigo-200">
                                    ✦
                                </div>

                                <h3 className="mt-4 font-semibold text-slate-900">
                                    Energy Center Assessment
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {!canAccessAssessment
                                        ? "Check your assessment access status."
                                        : stage1Completed
                                            ? "Your assessment is complete. View your results."
                                            : hasActiveSession
                                                ? "Continue your assessment where you left off."
                                                : "Discover your Energy Center by beginning Stage 1."}
                                </p>

                                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                                    {!canAccessAssessment
                                        ? "View Access Status"
                                        : stage1Completed
                                            ? "View Results"
                                            : hasActiveSession
                                                ? "Continue Assessment"
                                                : "Begin Assessment"}

                                    <span
                                        aria-hidden="true"
                                        className="transition-transform group-hover:translate-x-1"
                                    >
                                        →
                                    </span>
                                </span>
                            </Link>

                            {/* Stage 1 Results */}
                            <Link
                                href="/stage1_results"
                                className="group rounded-xl border p-5 transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-md"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-xl text-violet-700 transition group-hover:bg-violet-200">
                                    ✓
                                </div>

                                <h3 className="mt-4 font-semibold text-slate-900">
                                    Energy Center Results
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    Review your saved Energy Center Assessment results.
                                </p>

                                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700">
                                    View Results
                                    <span
                                        aria-hidden="true"
                                        className="transition-transform group-hover:translate-x-1"
                                    >
                                        →
                                    </span>
                                </span>
                            </Link>

                            {/* Profile */}
                            <Link
                                href="/profile"
                                className="group rounded-xl border p-5 transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700 transition group-hover:bg-slate-200">
                                    👤
                                </div>

                                <h3 className="mt-4 font-semibold text-slate-900">
                                    My Profile
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    View your account information.
                                </p>

                                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    View Profile
                                    <span
                                        aria-hidden="true"
                                        className="transition-transform group-hover:translate-x-1"
                                    >
                                        →
                                    </span>
                                </span>
                            </Link>
                        </div>
                    </div>

                </section>

            </div>
        </main>
    );
}