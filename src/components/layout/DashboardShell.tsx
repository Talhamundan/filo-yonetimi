"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import CompanyScopeSwitcher from "@/components/layout/CompanyScopeSwitcher";
import { DashboardScopeProvider } from "@/components/layout/DashboardScopeContext";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
    children: React.ReactNode;
    scopeOptions: {
        canAccessAllCompanies: boolean;
        isAdmin: boolean;
        sirketler: { id: string; ad: string }[];
    };
};

const STORAGE_KEY = "dashboard-sidebar-collapsed";

export default function DashboardShell({ children, scopeOptions }: DashboardShellProps) {
    const pathname = usePathname();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
    const adminMenuRef = React.useRef<HTMLDivElement>(null);
    const headerIconButtonClass =
        "inline-flex h-11 w-11 items-center justify-center rounded-[18px] text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900";
    const logoSquareClass =
        "relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm";

    React.useEffect(() => {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        if (storedValue === "true") {
            setIsSidebarCollapsed(true);
        }
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!adminMenuRef.current?.contains(event.target as Node)) {
                setIsAdminMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsAdminMenuOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    React.useEffect(() => {
        setIsAdminMenuOpen(false);
    }, [pathname]);

    const toggleSidebar = React.useCallback(() => {
        setIsSidebarCollapsed((current) => {
            const nextValue = !current;
            window.localStorage.setItem(STORAGE_KEY, String(nextValue));
            return nextValue;
        });
    }, []);

    return (
        <DashboardScopeProvider
            value={{
                canAccessAllCompanies: scopeOptions.canAccessAllCompanies,
                isAdmin: scopeOptions.isAdmin,
            }}
        >
            <div className="flex min-h-screen overflow-x-hidden bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
                <Toaster position="top-right" richColors />

                <div className="flex-1 min-w-0 overflow-x-hidden">
                    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
                        <div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 md:px-8">
                            <div className="flex items-center justify-start">
                                <button
                                    type="button"
                                    onClick={toggleSidebar}
                                    className={cn(
                                        "hidden lg:inline-flex",
                                        headerIconButtonClass,
                                        "text-slate-600 hover:text-slate-900"
                                    )}
                                    aria-label={isSidebarCollapsed ? "Sidebari ac" : "Sidebari kapat"}
                                    title={isSidebarCollapsed ? "Sidebari ac" : "Sidebari kapat"}
                                >
                                    {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                                </button>
                            </div>

                            <Link href="/dashboard" className="mx-auto flex items-center gap-3.5 shrink-0">
                                <div className={logoSquareClass}>
                                    <Image
                                        src="/logo-bera.png"
                                        alt="Bera Filo Logo"
                                        fill
                                        className="object-contain p-1.5"
                                    />
                                </div>
                                <h1 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.15rem]">
                                    Bera <span className="text-[#6366F1]">Filo</span>
                                </h1>
                            </Link>

                            <div className="flex items-center justify-end gap-3">
                                {scopeOptions.canAccessAllCompanies ? (
                                    <CompanyScopeSwitcher sirketler={scopeOptions.sirketler} />
                                ) : null}

                                {scopeOptions.isAdmin ? (
                                    <div ref={adminMenuRef} className="relative flex items-center gap-2">
                                        <Link
                                            href="/dashboard/onay-merkezi"
                                            className={cn(
                                                headerIconButtonClass,
                                                pathname.startsWith("/dashboard/onay-merkezi")
                                                    ? "text-indigo-600"
                                                    : "text-slate-500"
                                            )}
                                            title="Admin Panel"
                                            aria-label="Admin Panel"
                                        >
                                            <Settings size={18} />
                                        </Link>

                                        <button
                                            type="button"
                                            onClick={() => setIsAdminMenuOpen((current) => !current)}
                                            className={headerIconButtonClass}
                                            title="Kullanıcı menüsü"
                                            aria-label="Kullanıcı menüsü"
                                            aria-expanded={isAdminMenuOpen}
                                            aria-haspopup="menu"
                                        >
                                            <Menu size={18} />
                                        </button>

                                        {isAdminMenuOpen ? (
                                            <div
                                                className="absolute right-0 top-[calc(100%+10px)] min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
                                                role="menu"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <LogOut size={16} className="text-rose-500" />
                                                    Çıkış Yap
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </header>

                    <div className="flex h-[calc(100vh-81px)] min-w-0 overflow-hidden">
                        <Sidebar collapsed={isSidebarCollapsed} />

                        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                            <div className="mx-auto w-full max-w-[1600px]">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </DashboardScopeProvider>
    );
}
