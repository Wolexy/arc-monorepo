"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";

import {
    getAdminUsers,
    updateAccountStatus,
    grantStage2Access,
    revokeStage2Access,
    type AdminUser,
} from "@/lib/api/admin";

export default function AdminPage() {
    const router = useRouter();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

    const loadUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        setError("");

        try {
            const users = await getAdminUsers();
            setAdminUsers(users);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to load users.",
            );
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function checkAdminAccess() {
            try {
                const currentUser = await getCurrentUser();

                if (!isMounted) return;

                if (currentUser.role !== "ADMIN") {
                    router.replace("/dashboard");
                    return;
                }

                setUser(currentUser);
            } catch {
                if (isMounted) {
                    setError("Your session has expired. Please sign in again.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void checkAdminAccess();

        return () => {
            isMounted = false;
        };
    }, [router]);

    useEffect(() => {
        if (user?.role === "ADMIN") {
            void loadUsers();
        }
    }, [user, loadUsers]);

    async function handleAccountStatusChange(targetUser: AdminUser) {
        const newStatus = !targetUser.accountEnabled;

        setUpdatingUserId(targetUser.id);
        setError("");
        setMessage("");

        try {
            const result = await updateAccountStatus(targetUser.id, newStatus);

            setAdminUsers((currentUsers) =>
                currentUsers.map((item) =>
                    item.id === targetUser.id
                        ? { ...item, accountEnabled: result.accountEnabled }
                        : item,
                ),
            );

            setMessage(
                `${targetUser.email} has been ${result.accountEnabled ? "enabled" : "disabled"
                }.`,
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update account status.",
            );
        } finally {
            setUpdatingUserId(null);
        }
    }

    async function handleStage2AccessChange(targetUser: AdminUser) {
        const shouldGrant = !targetUser.stage2AccessGranted;

        setUpdatingUserId(targetUser.id);
        setError("");
        setMessage("");

        try {
            if (shouldGrant) {
                await grantStage2Access(targetUser.id);
            } else {
                await revokeStage2Access(targetUser.id);
            }

            setAdminUsers((currentUsers) =>
                currentUsers.map((item) =>
                    item.id === targetUser.id
                        ? {
                            ...item,
                            stage2AccessGranted: shouldGrant,
                            accessGranted: shouldGrant,
                        }
                        : item,
                ),
            );

            setMessage(
                `Stage 2 access has been ${shouldGrant ? "granted to" : "revoked from"
                } ${targetUser.email}.`,
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update Stage 2 access.",
            );
        } finally {
            setUpdatingUserId(null);
        }
    }

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-gray-500">
                    Loading administrator dashboard...
                </p>
            </main>
        );
    }

    if (error && !user) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="mb-3 text-2xl font-bold">Unable to open dashboard</h1>
                    <p className="mb-6 text-gray-600">{error}</p>

                    <button
                        type="button"
                        onClick={() => router.replace("/login")}
                        className="rounded-lg bg-black px-5 py-3 font-medium text-white"
                    >
                        Sign in
                    </button>
                </div>
            </main>
        );
    }

    if (!user || user.role !== "ADMIN") {
        return null;
    }

    return (
        <main className="min-h-screen px-6 py-10">
            <div className="mx-auto max-w-7xl">
                <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm text-gray-500">ARC Assessment</p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Admin Dashboard
                        </h1>

                        <p className="mt-2 text-gray-600">{user.email}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                        Regular Dashboard
                    </button>
                </header>

                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-2xl font-semibold">
                                User Management
                            </h2>

                            <p className="mt-2 text-sm text-gray-600">
                                Manage account status and Stage 2 assessment access.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setMessage("");
                                void loadUsers();
                            }}
                            disabled={isLoadingUsers}
                            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                            {isLoadingUsers ? "Refreshing..." : "Refresh users"}
                        </button>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                        >
                            {error}
                        </div>
                    )}

                    {message && (
                        <div
                            role="status"
                            className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
                        >
                            {message}
                        </div>
                    )}

                    {isLoadingUsers && adminUsers.length === 0 ? (
                        <p className="py-6 text-sm text-gray-500">
                            Loading registered users...
                        </p>
                    ) : adminUsers.length === 0 ? (
                        <p className="py-6 text-sm text-gray-500">
                            No users to display.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="p-3 font-semibold">User</th>
                                        <th className="p-3 font-semibold">Email Verified</th>
                                        <th className="p-3 font-semibold">Account Status</th>
                                        <th className="p-3 font-semibold">Stage 2 Access</th>
                                        <th className="p-3 font-semibold">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {adminUsers.map((targetUser) => {
                                        const isUpdating = updatingUserId === targetUser.id;
                                        const isSelf = targetUser.id === user.id;

                                        return (
                                            <tr
                                                key={targetUser.id}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="p-3">
                                                    <div className="font-medium">
                                                        {targetUser.email}
                                                    </div>

                                                    <div className="mt-1 text-xs text-gray-500">
                                                        ID: {targetUser.id} · {targetUser.role}
                                                        {isSelf ? " · You" : ""}
                                                    </div>
                                                </td>

                                                <td className="p-3">
                                                    <span
                                                        className={
                                                            targetUser.emailVerified
                                                                ? "font-medium text-green-700"
                                                                : "font-medium text-amber-700"
                                                        }
                                                    >
                                                        {targetUser.emailVerified
                                                            ? "Verified"
                                                            : "Not verified"}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <span
                                                        className={
                                                            targetUser.accountEnabled
                                                                ? "font-medium text-green-700"
                                                                : "font-medium text-red-700"
                                                        }
                                                    >
                                                        {targetUser.accountEnabled
                                                            ? "Enabled"
                                                            : "Disabled"}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <span
                                                        className={
                                                            targetUser.stage2AccessGranted
                                                                ? "font-medium text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        {targetUser.stage2AccessGranted
                                                            ? "Granted"
                                                            : "Not Granted"}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <div className="flex min-w-36 flex-col items-start gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void handleAccountStatusChange(targetUser)
                                                            }
                                                            disabled={isUpdating || isSelf}
                                                            title={
                                                                isSelf
                                                                    ? "You cannot disable your own administrator account here."
                                                                    : undefined
                                                            }
                                                            className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {isUpdating
                                                                ? "Updating..."
                                                                : targetUser.accountEnabled
                                                                    ? "Disable account"
                                                                    : "Enable account"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void handleStage2AccessChange(targetUser)
                                                            }
                                                            disabled={isUpdating}
                                                            className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {isUpdating
                                                                ? "Updating..."
                                                                : targetUser.stage2AccessGranted
                                                                    ? "Revoke Stage 2"
                                                                    : "Grant Stage 2"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}