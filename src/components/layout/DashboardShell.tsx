"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import CompanyScopeSwitcher from "@/components/layout/CompanyScopeSwitcher";
import YearScopeSwitcher from "@/components/layout/YearScopeSwitcher";
import MonthScopeSwitcher from "@/components/layout/MonthScopeSwitcher";
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
const YEAR_STORAGE_KEY = "dashboard-scope-year";
const MONTH_STORAGE_KEY = "dashboard-scope-month";

export default function DashboardShell({ children, scopeOptions }: DashboardShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
    const desktopAdminMenuRef = React.useRef<HTMLDivElement>(null);
    const mobileAdminMenuRef = React.useRef<HTMLDivElement>(null);
    const headerIconButtonClass =
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";
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
            const target = event.target as Node;
            const clickedInsideDesktop = desktopAdminMenuRef.current?.contains(target);
            const clickedInsideMobile = mobileAdminMenuRef.current?.contains(target);
            if (!clickedInsideDesktop && !clickedInsideMobile) {
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
        setIsMobileSidebarOpen(false);
    }, [pathname]);

    React.useEffect(() => {
        const nextParams = new URLSearchParams(searchParams.toString());
        let changed = false;

        const selectedYil = searchParams.get("yil");
        if (selectedYil) {
            window.localStorage.setItem(YEAR_STORAGE_KEY, selectedYil);
        } else {
            const storedYear = Number(window.localStorage.getItem(YEAR_STORAGE_KEY));
            const fallbackYear =
                Number.isInteger(storedYear) && storedYear >= 2000 && storedYear <= 2100
                    ? storedYear
                    : new Date().getFullYear();
            nextParams.set("yil", String(fallbackYear));
            changed = true;
        }

        const selectedAy = searchParams.get("ay");
        if (selectedAy) {
            window.localStorage.setItem(MONTH_STORAGE_KEY, selectedAy);
        } else {
            const storedMonth = Number(window.localStorage.getItem(MONTH_STORAGE_KEY));
            const fallbackMonth =
                Number.isInteger(storedMonth) && storedMonth >= 1 && storedMonth <= 12
                    ? storedMonth
                    : new Date().getMonth() + 1;
            nextParams.set("ay", String(fallbackMonth));
            changed = true;
        }

        if (!changed) return;

        const query = nextParams.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }, [pathname, router, searchParams]);

    const toggleSidebar = React.useCallback(() => {
        setIsSidebarCollapsed((current) => {
            const nextValue = !current;
            window.localStorage.setItem(STORAGE_KEY, String(nextValue));
            return nextValue;
        });
    }, []);
    const openMobileSidebar = React.useCallback(() => setIsMobileSidebarOpen(true), []);
    const closeMobileSidebar = React.useCallback(() => setIsMobileSidebarOpen(false), []);

    const scopedQuery = searchParams.toString();
    const dashboardHref = scopedQuery ? `/dashboard?${scopedQuery}` : "/dashboard";
    const adminHref = scopedQuery ? `/dashboard/onay-merkezi?${scopedQuery}` : "/dashboard/onay-merkezi";

    return (
        <DashboardScopeProvider
            value={{
                canAccessAllCompanies: scopeOptions.canAccessAllCompanies,
                isAdmin: scopeOptions.isAdmin,
            }}
        >
            <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
                <Toaster position="top-right" richColors />

                <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
                    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
                        <div className="hidden h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 md:grid">
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

                            <Link href={dashboardHref} className="mx-auto flex items-center gap-3.5 shrink-0">
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
                                <YearScopeSwitcher />
                                <MonthScopeSwitcher />
                                {scopeOptions.canAccessAllCompanies ? (
                                    <CompanyScopeSwitcher sirketler={scopeOptions.sirketler} />
                                ) : null}

                                {scopeOptions.isAdmin ? (
                                    <div ref={desktopAdminMenuRef} className="relative z-30 flex items-center gap-2">
                                        <Link
                                            href={adminHref}
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
                                                className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
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

                        <div className="px-3 py-2.5 md:hidden">
                            <div className="relative z-20 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={openMobileSidebar}
                                        className={headerIconButtonClass}
                                        aria-label="Menüyü aç"
                                        title="Menüyü aç"
                                    >
                                        <PanelLeftOpen size={18} />
                                    </button>

                                    <Link href={dashboardHref} className="flex min-w-0 items-center gap-2.5">
                                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                            <Image
                                                src="/logo-bera.png"
                                                alt="Bera Filo Logo"
                                                fill
                                                className="object-contain p-1"
                                            />
                                        </div>
                                        <h1 className="truncate text-[1.55rem] font-bold tracking-tight text-slate-900">
                                            Bera <span className="text-[#6366F1]">Filo</span>
                                        </h1>
                                    </Link>
                                </div>

                                {scopeOptions.isAdmin ? (
                                    <div ref={mobileAdminMenuRef} className="relative z-30 flex shrink-0 items-center gap-2">
                                        <Link
                                            href={adminHref}
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
                                                className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
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

                            <div className="relative z-10 mt-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                <YearScopeSwitcher />
                                <MonthScopeSwitcher />
                                {scopeOptions.canAccessAllCompanies ? (
                                    <CompanyScopeSwitcher sirketler={scopeOptions.sirketler} />
                                ) : null}
                            </div>
                        </div>
                    </header>

                    <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
                        <Sidebar collapsed={isSidebarCollapsed} />
                        <button
                            type="button"
                            aria-label="Menüyü kapat"
                            onClick={closeMobileSidebar}
                            className={cn(
                                "fixed inset-0 z-40 bg-slate-900/20 transition-opacity lg:hidden",
                                isMobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                            )}
                        />
                        <Sidebar
                            mobile
                            mobileOpen={isMobileSidebarOpen}
                            onMobileClose={closeMobileSidebar}
                        />

                        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
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
