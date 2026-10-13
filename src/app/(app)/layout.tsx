import AppNavigation from "./components/AppNavigation";
import LogoutButton from "./components/LogoutButton";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between border-b px-6 py-4">
                <AppNavigation />

                <LogoutButton />
            </header>

            <main className="px-6 py-8">
                {children}
            </main>
        </div>
    );
}