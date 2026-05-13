"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
    LayoutDashboard,
    Car,
    Users,
    ClipboardList,
    Wrench,
    AlertTriangle,
    CheckCircle,
    Fuel,
    Receipt,
    ShieldCheck,
    ShieldAlert,
    FileText,
    FolderOpen,
    Building2,
    Handshake,
    FileWarning,
    Truck,
    Boxes,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NavItem = React.memo(({
    href,
    scopedHref,
    icon: Icon,
    label,
    badge,
    active,
    collapsed,
    onNavigate,
}: {
    href: string,
    scopedHref: string,
    icon: React.ElementType,
    label: string,
    badge?: number,
    active: boolean,
    collapsed?: boolean,
    onNavigate?: () => void,
}) => {
    const hasBadge = Boolean(badge && badge > 0)

    return (
        <Link
            href={scopedHref}
            title={collapsed ? label : undefined}
            onClick={() => onNavigate?.()}
            className={cn(
                "flex h-10 w-full items-center rounded-lg font-semibold transition-colors duration-200",
                active
                    ? "text-slate-900"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            )}
        >
            <div className={cn(
                "flex w-full items-center overflow-hidden px-2.5",
                collapsed ? "justify-start" : "justify-between"
            )}>
                <div className="flex min-w-0 items-center overflow-hidden gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon size={16} className={active ? 'text-indigo-600' : ''} />
                    </span>
                    {!collapsed ? (
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                    ) : null}
                </div>
                {!collapsed && hasBadge ? (
                    <span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-500/30 text-indigo-100' : 'bg-rose-100 text-rose-700'}`}>
                            {badge}
                        </span>
                    </span>
                ) : null}
            </div>
        </Link>
    )
})

const SectionTitle = React.memo(function SectionTitle({ title, collapsed }: { title: string; collapsed?: boolean }) {
    const isCollapsed = Boolean(collapsed)
    return (
    <div className={cn("mb-1 h-7 relative", collapsed ? "px-0" : "px-3")}>
        <p
            className={cn(
                "absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-ellipsis text-[11px] font-bold text-slate-400 uppercase tracking-[0.16em] transition-opacity duration-200",
                isCollapsed ? "opacity-0" : "opacity-100"
            )}
        >
            {title}
        </p>
        <div
            className={cn(
                "absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-px w-8 bg-slate-200 transition-opacity duration-200",
                isCollapsed ? "opacity-100" : "opacity-0"
            )}
        />
    </div>
    )
})

type SidebarProps = {
    collapsed?: boolean;
    mobile?: boolean;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
    isAdmin?: boolean;
    role?: string | null;
    canAccessAllCompanies?: boolean;
};

export default function Sidebar({
    collapsed = false,
    mobile = false,
    mobileOpen = false,
    onMobileClose,
    isAdmin = false,
    role = null,
    canAccessAllCompanies = false,
}: SidebarProps) {
    const sidebarRef = React.useRef<HTMLElement>(null)
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const effectiveCollapsed = mobile ? false : collapsed
    const canManageCompanies = isAdmin || (role === "YETKILI" && canAccessAllCompanies)
    const isTechnicalPersonnel = role === "TEKNIK"
    const scopedQuery = React.useMemo(() => {
        const selectedSirketId = searchParams.get("sirket")
        const selectedYil = searchParams.get("yil")
        const selectedAy = searchParams.get("ay")
        const scopedParams = new URLSearchParams()
        if (selectedSirketId) scopedParams.set("sirket", selectedSirketId)
        if (selectedYil) scopedParams.set("yil", selectedYil)
        if (selectedAy) scopedParams.set("ay", selectedAy)
        return scopedParams.toString()
    }, [searchParams])
    const buildScopedHref = React.useCallback((href: string) => {
        return scopedQuery ? `${href}?${scopedQuery}` : href
    }, [scopedQuery])
    const isActivePath = React.useCallback((path: string) => {
        if (path === "/dashboard" && pathname === "/dashboard") return true
        if (path !== "/dashboard" && pathname.startsWith(path)) return true
        return false
    }, [pathname])

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                mobile
                    ? "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#E2E8F0] bg-white px-3 pt-4 pb-6 overflow-y-auto overscroll-contain transition-transform duration-200 ease-out lg:hidden"
                    : "hidden lg:flex h-full flex-col border-r border-[#E2E8F0] bg-gradient-to-b from-white via-white to-slate-50/30 pt-4 pb-6 overflow-y-auto overscroll-contain transition-[width,padding] duration-200 ease-out",
                mobile ? (mobileOpen ? "translate-x-0" : "-translate-x-full") : (effectiveCollapsed ? "w-[72px] px-2" : "w-[236px] px-3")
            )}
        >
            {mobile ? (
                <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Menü</span>
                    <button
                        type="button"
                        onClick={onMobileClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        aria-label="Menüyü kapat"
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : null}

            <div className="min-h-full">
                {/* Fleet Overview */}
                <SectionTitle title="Genel Bakış" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard" scopedHref={buildScopedHref("/dashboard")} icon={LayoutDashboard} label="Dashboard" active={isActivePath("/dashboard")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {canManageCompanies ? (
                    <>
                        {/* Organization Management */}
                        <SectionTitle title="Sistem Yönetimi" collapsed={effectiveCollapsed} />
                        <nav className="flex flex-col gap-0.5 mb-4">
                            <NavItem href="/dashboard/sirketler" scopedHref={buildScopedHref("/dashboard/sirketler")} icon={Building2} label="Şirket Yönetimi" active={isActivePath("/dashboard/sirketler")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/taseronlar" scopedHref={buildScopedHref("/dashboard/taseronlar")} icon={Handshake} label="Taşeron Yönetimi" active={isActivePath("/dashboard/taseronlar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/kiraliklar" scopedHref={buildScopedHref("/dashboard/kiraliklar")} icon={Truck} label="Kiralıklar" active={isActivePath("/dashboard/kiraliklar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                        </nav>
                    </>
                ) : null}

                {!isTechnicalPersonnel ? (
                    <>
                        {/* Fleet Management */}
                        <SectionTitle title="Filo Yönetimi" collapsed={effectiveCollapsed} />
                        <nav className="flex flex-col gap-0.5 mb-4">
                            <NavItem href="/dashboard/araclar" scopedHref={buildScopedHref("/dashboard/araclar")} icon={Car} label="Araçlar" active={isActivePath("/dashboard/araclar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/personel" scopedHref={buildScopedHref("/dashboard/personel")} icon={Users} label="Personeller" active={isActivePath("/dashboard/personel")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/zimmetler" scopedHref={buildScopedHref("/dashboard/zimmetler")} icon={ClipboardList} label="Zimmet Kayıtları" active={isActivePath("/dashboard/zimmetler")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                        </nav>
                    </>
                ) : null}

                {/* Operations */}
                <SectionTitle title="Operasyonlar" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/arizalar" scopedHref={buildScopedHref("/dashboard/arizalar")} icon={AlertTriangle} label="Kazalı Araç Takibi" active={isActivePath("/dashboard/arizalar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/servis-kayitlari" scopedHref={buildScopedHref("/dashboard/servis-kayitlari")} icon={Wrench} label="Servis Kayıtları" active={isActivePath("/dashboard/servis-kayitlari")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/muayeneler" scopedHref={buildScopedHref("/dashboard/muayeneler")} icon={CheckCircle} label="Muayene Takibi" active={isActivePath("/dashboard/muayeneler")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/stok-takibi" scopedHref={buildScopedHref("/dashboard/stok-takibi")} icon={Boxes} label="Stok Takibi" active={isActivePath("/dashboard/stok-takibi")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Finance */}
                <SectionTitle title="Finans" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/yakitlar" scopedHref={buildScopedHref("/dashboard/yakitlar")} icon={Fuel} label="Yakıt Harcamaları" active={isActivePath("/dashboard/yakitlar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/ceza-masraflari" scopedHref={buildScopedHref("/dashboard/ceza-masraflari")} icon={FileWarning} label="Ceza Masrafları" active={isActivePath("/dashboard/ceza-masraflari")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/masraflar" scopedHref={buildScopedHref("/dashboard/masraflar")} icon={Receipt} label="Genel Masraflar" active={isActivePath("/dashboard/masraflar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Insurance */}
                <SectionTitle title="Sigorta Departmanı" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/sigortaci" scopedHref={buildScopedHref("/dashboard/sigortaci")} icon={ShieldAlert} label="Sigortacı Operasyon" active={isActivePath("/dashboard/sigortaci")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/trafik-sigortasi" scopedHref={buildScopedHref("/dashboard/trafik-sigortasi")} icon={ShieldCheck} label="Trafik Sigortaları" active={isActivePath("/dashboard/trafik-sigortasi")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/kasko" scopedHref={buildScopedHref("/dashboard/kasko")} icon={FileText} label="Kasko Poliçeleri" active={isActivePath("/dashboard/kasko")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Documents */}
                <SectionTitle title="Evrak Yönetimi" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-1 mb-2">
                    <NavItem href="/dashboard/dokumanlar" scopedHref={buildScopedHref("/dashboard/dokumanlar")} icon={FolderOpen} label="Araç Evrakları" active={isActivePath("/dashboard/dokumanlar")} collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>
            </div>
        </aside>
    )
}
