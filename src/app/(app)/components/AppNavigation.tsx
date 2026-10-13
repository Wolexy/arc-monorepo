"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
    {
        label: "Dashboard",
        href: "/dashboard",
    },
    {
        label: "Assessment",
        href: "/assessment",
    },
    {
        label: "Results",
        href: "/results",
    },
    {
        label: "Profile",
        href: "/profile",
    },
];

export default function AppNavigation() {
    const pathname = usePathname();

    return (
        <nav className="flex items-center gap-6 text-sm">
            {navigation.map((item) => {
                const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                if (isActive) {
                    return null;
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="hover:text-gray-600"
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}