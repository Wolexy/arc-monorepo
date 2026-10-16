"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

export default function LogoutButton() {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function handleLogout() {
        if (isLoggingOut) {
            return;
        }

        setIsLoggingOut(true);

        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            // Always leave the protected application,
            // even if the server logout request fails.
            router.replace("/login");
            setIsLoggingOut(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
            {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
    );
}