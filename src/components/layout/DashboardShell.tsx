"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, History, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import CompanyScopeSwitcher from "@/components/layout/CompanyScopeSwitcher";
import YearScopeSwitcher from "@/components/layout/YearScopeSwitcher";
import MonthScopeSwitcher from "@/components/layout/MonthScopeSwitcher";
import CategoryScopeSwitcher from "@/components/layout/CategoryScopeSwitcher";
import { DashboardScopeProvider } from "@/components/layout/DashboardScopeContext";
import {
    ensureDashboardPeriodInSearch,
    mergeDashboardScopeIntoHref,
    persistDashboardPeriodFromSearch,
} from "@/lib/dashboard-scope-query";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
    children: React.ReactNode;
    scopeOptions: {
        canAccessAllCompanies: boolean;
        isAdmin: boolean;
        canAssignIndependentRecords: boolean;
        isIndependentUser: boolean;
        sirketler: { id: string; ad: string }[];
        userName?: string;
        role?: string | null;
        userCompanyName?: string | null;
    };
};

const STORAGE_KEY = "dashboard-sidebar-collapsed";
const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    YETKILI: "Yetkili",
    TEKNIK: "Teknik",
    PERSONEL: "Personel",
};

export default function DashboardShell({ children, scopeOptions }: DashboardShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
    const [isMobileHeaderToolsOpen, setIsMobileHeaderToolsOpen] = React.useState(true);
    const desktopAdminMenuRef = React.useRef<HTMLDivElement>(null);
    const mobileAdminMenuRef = React.useRef<HTMLDivElement>(null);
    const headerIconButtonClass =
        "inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg md:rounded-xl border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";
    const sidebarToggleButtonClass =
        "inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30";

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
        setIsMobileHeaderToolsOpen(true);
    }, [pathname]);

    React.useEffect(() => {
        persistDashboardPeriodFromSearch(searchParams);
    }, [searchParams]);

    React.useEffect(() => {
        if (!pathname.startsWith("/dashboard")) return;

        const { params, changed } = ensureDashboardPeriodInSearch(searchParams);
        if (!changed) return;

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const handleScopedDashboardLinkClick = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.defaultPrevented) return;
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target as HTMLElement | null;
            const anchor = target?.closest("a");
            if (!anchor) return;
            if (anchor.target && anchor.target !== "_self") return;

            const rawHref = anchor.getAttribute("href");
            if (!rawHref) return;

            const scopedHref = mergeDashboardScopeIntoHref(rawHref, searchParams);
            if (scopedHref === rawHref) return;

            event.preventDefault();
            router.push(scopedHref);
        },
        [router, searchParams]
    );

    const toggleSidebar = React.useCallback(() => {
        setIsSidebarCollapsed((current) => {
            const nextValue = !current;
            window.localStorage.setItem(STORAGE_KEY, String(nextValue));
            return nextValue;
        });
    }, []);
    const toggleMobileHeaderTools = React.useCallback(() => {
        setIsMobileHeaderToolsOpen((current) => !current);
    }, []);
    const openMobileSidebar = React.useCallback(() => setIsMobileSidebarOpen(true), []);
    const closeMobileSidebar = React.useCallback(() => setIsMobileSidebarOpen(false), []);

    const scopedQuery = searchParams.toString();
    const shouldShowCompanySwitcher = scopeOptions.isIndependentUser && scopeOptions.sirketler.length > 0;
    const dashboardHref = scopedQuery ? `/dashboard?${scopedQuery}` : "/dashboard";
    const adminHref = scopedQuery ? `/dashboard/yetkilendirme-paneli?${scopedQuery}` : "/dashboard/yetkilendirme-paneli";
    const activityHref = scopedQuery ? `/dashboard/aktivite-gecmisi?${scopedQuery}` : "/dashboard/aktivite-gecmisi";
    const trashHref = scopedQuery ? `/dashboard/cop-kutusu?${scopedQuery}` : "/dashboard/cop-kutusu";
    const roleLabel = scopeOptions.role ? (ROLE_LABELS[scopeOptions.role] || scopeOptions.role) : null;
    const identityName = (scopeOptions.userName || "Kullanıcı").trim();
    const roleText = roleLabel ? `Rol: ${roleLabel}` : "Rol: -";
    const companyText = (scopeOptions.userCompanyName || "Bağımsız").trim();
    const roleAndCompanyText = `${roleText} • Şirket: ${companyText}`;
    const shouldUseCompactIdentityText = identityName.length > 16 || roleAndCompanyText.length > 28;

    return (
        <DashboardScopeProvider
            value={{
                canAccessAllCompanies: scopeOptions.canAccessAllCompanies,
                isAdmin: scopeOptions.isAdmin,
                canAssignIndependentRecords: scopeOptions.canAssignIndependentRecords,
            }}
        >
            <div
                className="dashboard-compact-ui flex h-[100dvh] min-h-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900"
                onClickCapture={handleScopedDashboardLinkClick}
            >
                <Toaster position="top-right" richColors />

                <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
                    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
                        <div className="hidden h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 md:grid">
                            <div className="flex items-center justify-start gap-3">
                                <button
                                    type="button"
                                    onClick={toggleSidebar}
                                    className={cn(
                                        "hidden lg:inline-flex -ml-1",
                                        sidebarToggleButtonClass
                                    )}
                                    aria-label={isSidebarCollapsed ? "Sidebari ac" : "Sidebari kapat"}
                                    title={isSidebarCollapsed ? "Sidebari ac" : "Sidebari kapat"}
                                >
                                    {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                                </button>
                                <div className="inline-flex h-10 md:h-11 w-auto shrink-0 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-3">
                                    <span
                                        className={cn(
                                            "font-semibold leading-tight text-slate-800 whitespace-nowrap",
                                            shouldUseCompactIdentityText ? "text-[10px]" : "text-[11px]"
                                        )}
                                        title={identityName}
                                    >
                                        {identityName}
                                    </span>
                                        <span
                                            className={cn(
                                                "font-medium leading-tight text-slate-600 whitespace-nowrap",
                                                shouldUseCompactIdentityText ? "text-[9px]" : "text-[10px]"
                                            )}
                                            title={roleAndCompanyText}
                                        >
                                        {roleAndCompanyText}
                                    </span>
                                </div>
                            </div>

                             <Link href={dashboardHref} className="mx-auto flex items-center gap-3 shrink-0">
                                <img src="/icon.png" alt="Bera Filo" className="h-9 md:h-11 w-auto rounded-lg shadow-sm" />
                                <h1 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.15rem]">
                                    Bera <span className="text-[#6366F1]">Filo</span>
                                </h1>
                            </Link>

                            <div className="flex items-center justify-end gap-3">
                                <CategoryScopeSwitcher />
                                <YearScopeSwitcher />
                                <MonthScopeSwitcher />
                                {shouldShowCompanySwitcher ? (
                                    <CompanyScopeSwitcher
                                        sirketler={scopeOptions.sirketler}
                                        allowAllOption={scopeOptions.canAccessAllCompanies}
                                    />
                                ) : null}

                                {scopeOptions.isAdmin ? (
                                    <div ref={desktopAdminMenuRef} className="relative z-30 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAdminMenuOpen((current) => !current)}
                                            className={headerIconButtonClass}
                                            title="Yönetim menüsü"
                                            aria-label="Yönetim menüsü"
                                            aria-expanded={isAdminMenuOpen}
                                            aria-haspopup="menu"
                                        >
                                            <Menu size={16} />
                                        </button>

                                        {isAdminMenuOpen ? (
                                            <div
                                                className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[200px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
                                                role="menu"
                                            >
                                                <Link
                                                    href={adminHref}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition hover:bg-slate-50",
                                                        pathname.startsWith("/dashboard/yetkilendirme-paneli")
                                                            ? "bg-indigo-50 text-indigo-700"
                                                            : "text-slate-700 hover:text-slate-900"
                                                    )}
                                                    role="menuitem"
                                                >
                                                    <ShieldCheck size={16} className="text-indigo-500" />
                                                    Admin Panel
                                                </Link>
                                                <Link
                                                    href={activityHref}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <History size={16} className="text-indigo-500" />
                                                    Aktivite Geçmişi
                                                </Link>
                                                <Link
                                                    href={trashHref}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <Trash2 size={16} className="text-amber-500" />
                                                    Çöp Kutusu
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <LogOut size={16} className="text-rose-500" />
                                                    Çıkış Yap
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                        className={headerIconButtonClass}
                                        title="Çıkış Yap"
                                        aria-label="Çıkış Yap"
                                    >
                                        <LogOut size={16} className="text-rose-500" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-2.5 py-2 md:hidden">
                            <div className="relative z-20 flex items-center justify-between gap-1.5">
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

                                    <Link href={dashboardHref} className="flex min-w-0 items-center">
                                        <h1 className="truncate text-[1.35rem] font-bold tracking-tight text-slate-900">
                                            Bera <span className="text-[#6366F1]">Filo</span>
                                        </h1>
                                    </Link>
                                </div>

                                <div className="flex min-w-0 shrink items-center gap-1.5">
                                    <div className="inline-flex h-9 max-w-[124px] min-w-0 shrink flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 px-2">
                                        <span
                                            className={cn(
                                                "truncate font-semibold leading-tight text-slate-800 whitespace-nowrap",
                                                shouldUseCompactIdentityText ? "text-[10px]" : "text-[11px]"
                                            )}
                                            title={identityName}
                                        >
                                            {identityName}
                                        </span>
                                        <span
                                            className={cn(
                                                "truncate font-medium leading-tight text-slate-600 whitespace-nowrap",
                                                shouldUseCompactIdentityText ? "text-[9px]" : "text-[10px]"
                                            )}
                                            title={roleAndCompanyText}
                                        >
                                            {roleAndCompanyText}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleMobileHeaderTools}
                                        className={headerIconButtonClass}
                                        title={isMobileHeaderToolsOpen ? "Alt menüyü kapat" : "Alt menüyü aç"}
                                        aria-label={isMobileHeaderToolsOpen ? "Alt menüyü kapat" : "Alt menüyü aç"}
                                        aria-expanded={isMobileHeaderToolsOpen}
                                    >
                                        {isMobileHeaderToolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div
                                className={cn(
                                    "relative z-10 mt-2 flex items-center gap-1.5",
                                    !isMobileHeaderToolsOpen && "hidden"
                                )}
                            >
                                <CategoryScopeSwitcher />
                                <YearScopeSwitcher />
                                <MonthScopeSwitcher />
                                {shouldShowCompanySwitcher ? (
                                    <CompanyScopeSwitcher
                                        sirketler={scopeOptions.sirketler}
                                        allowAllOption={scopeOptions.canAccessAllCompanies}
                                    />
                                ) : null}
                                {scopeOptions.isAdmin ? (
                                    <div ref={mobileAdminMenuRef} className="relative z-30 flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAdminMenuOpen((current) => !current)}
                                            className={headerIconButtonClass}
                                            title="Yönetim menüsü"
                                            aria-label="Yönetim menüsü"
                                            aria-expanded={isAdminMenuOpen}
                                            aria-haspopup="menu"
                                        >
                                            <Menu size={18} />
                                        </button>

                                        {isAdminMenuOpen ? (
                                            <div
                                                className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[200px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
                                                role="menu"
                                            >
                                                <Link
                                                    href={adminHref}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition hover:bg-slate-50",
                                                        pathname.startsWith("/dashboard/yetkilendirme-paneli")
                                                            ? "bg-indigo-50 text-indigo-700"
                                                            : "text-slate-700 hover:text-slate-900"
                                                    )}
                                                    role="menuitem"
                                                >
                                                    <ShieldCheck size={16} className="text-indigo-500" />
                                                    Admin Panel
                                                </Link>
                                                <Link
                                                    href={activityHref}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <History size={16} className="text-indigo-500" />
                                                    Aktivite Geçmişi
                                                </Link>
                                                <Link
                                                    href={trashHref}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <Trash2 size={16} className="text-amber-500" />
                                                    Çöp Kutusu
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                                    role="menuitem"
                                                >
                                                    <LogOut size={16} className="text-rose-500" />
                                                    Çıkış Yap
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                        className={cn(headerIconButtonClass, "shrink-0")}
                                        title="Çıkış Yap"
                                        aria-label="Çıkış Yap"
                                    >
                                        <LogOut size={16} className="text-rose-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
                        <Sidebar
                            collapsed={isSidebarCollapsed}
                            isAdmin={scopeOptions.isAdmin}
                            role={scopeOptions.role}
                            canAccessAllCompanies={scopeOptions.canAccessAllCompanies}
                        />
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
                            isAdmin={scopeOptions.isAdmin}
                            role={scopeOptions.role}
                            canAccessAllCompanies={scopeOptions.canAccessAllCompanies}
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
