"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    type CurrentUser,
} from "@/lib/api/auth";

export default function AssessmentPage() {
    const router = useRouter();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

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

    // Loading screen.
    if (isLoading) {
        return (
            <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl shadow-indigo-200/40 backdrop-blur-xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-700">
                        ✦
                    </div>

                    <h1 className="mt-5 text-2xl font-bold text-slate-900">
                        Preparing Your ARC Experience
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        Please wait while we verify your account.
                    </p>
                </section>
            </main>
        );
    }

    // Account-loading error.
    if (loadError || !user) {
        return (
            <main className="flex min-h-[75vh] items-center justify-center px-4 py-12">
                <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-lg">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Unable to Load Your Account
                    </h1>

                    <p
                        role="alert"
                        className="mt-4 text-sm leading-6 text-rose-600"
                    >
                        {loadError || "Please sign in to continue."}
                    </p>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700"
                    >
                        Return to Dashboard
                    </button>
                </section>
            </main>
        );
    }

    // Stage 1 is open to every verified, enabled account (no Stage 2 grant).
    const canAccessAssessment =
        user.emailVerified === true && user.accountEnabled === true;

    // Access-restriction screen.
    if (!canAccessAssessment) {
        return (
            <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12">
                <section className="w-full max-w-lg rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl shadow-indigo-200/40 backdrop-blur-xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">
                        !
                    </div>

                    <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-indigo-600">
                        ARC Personality Assessment
                    </p>

                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        Your next step starts here.
                    </h1>

                    <p className="mt-4 text-sm leading-7 text-slate-600">
                        Your account does not currently have access to the
                        assessment. Please contact the administrator for
                        assistance.
                    </p>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="mt-7 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700"
                    >
                        Return to Dashboard
                    </button>
                </section>
            </main>
        );
    }

    // ARC assessment introduction.
    return (
        <main className="relative min-h-[75vh] overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-100 px-4 py-12 sm:px-8">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
                <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" />
            </div>

            <section className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                    <p className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-700 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Your journey begins here
                    </p>

                    <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                        Discover the way{" "}
                        <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                            you think,
                        </span>{" "}
                        feel, and act.
                    </h1>

                    <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                        The ARC assessment begins with three Energy Centers:
                        Gut, Heart, and Head. Explore the statements, reflect
                        on what describes you, and respond honestly.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <div className="rounded-xl border border-white bg-white/80 px-4 py-3 shadow-sm">
                            <p className="text-sm font-bold text-slate-900">
                                Gut
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Instinct &amp; action
                            </p>
                        </div>

                        <div className="rounded-xl border border-white bg-white/80 px-4 py-3 shadow-sm">
                            <p className="text-sm font-bold text-slate-900">
                                Heart
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Feelings &amp; connection
                            </p>
                        </div>

                        <div className="rounded-xl border border-white bg-white/80 px-4 py-3 shadow-sm">
                            <p className="text-sm font-bold text-slate-900">
                                Head
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Thought &amp; analysis
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-indigo-300/40 via-violet-300/30 to-fuchsia-300/40 blur-2xl" />

                    <div className="relative rounded-[2rem] border border-white bg-white/85 p-7 shadow-2xl shadow-indigo-200/50 backdrop-blur-xl sm:p-9">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-indigo-600">
                                    ARC CORE ASSESSMENT
                                </p>

                                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                    Energy Center Assessment
                                </h2>
                            </div>

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-xl">
                                ✦
                            </div>
                        </div>

                        <div className="mt-7 space-y-4">
                            {[
                                {
                                    number: "01",
                                    title: "Read each statement",
                                    text: "Consider what genuinely reflects you.",
                                },
                                {
                                    number: "02",
                                    title: "Rank the statements",
                                    text: "Use Most True, True, and Least True.",
                                },
                                {
                                    number: "03",
                                    title: "Discover your results",
                                    text: "Complete the groups to reveal your scores.",
                                },
                            ].map((step) => (
                                <div
                                    key={step.number}
                                    className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                                        {step.number}
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-slate-900">
                                            {step.title}
                                        </h3>

                                        <p className="mt-1 text-sm leading-6 text-slate-500">
                                            {step.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.push("/energy_center_assessment")
                            }
                            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700"
                        >
                            Begin Assessment
                            <span aria-hidden="true">→</span>
                        </button>

                        {/* Navigation only: no session is created, deleted, or reset. */}
                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            className="mt-3 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-4 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Cancel
                        </button>

                        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                            Take your time. Answer honestly and choose what
                            best reflects you.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}