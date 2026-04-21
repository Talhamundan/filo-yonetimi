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
    FileText,
    FolderOpen,
    Building2,
    Truck,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NavItem = ({
    href,
    icon: Icon,
    label,
    badge,
    collapsed,
    onNavigate,
}: {
    href: string,
    icon: React.ElementType,
    label: string,
    badge?: number,
    collapsed?: boolean,
    onNavigate?: () => void,
}) => {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    // Helper function to check if a path is active
    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    }
    const active = isActive(href);
    const selectedSirketId = searchParams.get("sirket");
    const selectedYil = searchParams.get("yil");
    const selectedAy = searchParams.get("ay");
    const scopedParams = new URLSearchParams();
    if (selectedSirketId) scopedParams.set("sirket", selectedSirketId);
    if (selectedYil) scopedParams.set("yil", selectedYil);
    if (selectedAy) scopedParams.set("ay", selectedAy);
    const scopedQuery = scopedParams.toString();
    const scopedHref = scopedQuery ? `${href}?${scopedQuery}` : href;
    const collapsedNavClass = "h-10 w-full rounded-lg";

    return (
        <Link
            href={scopedHref}
            title={collapsed ? label : undefined}
            onClick={() => onNavigate?.()}
            className={`flex items-center font-semibold transition-all duration-300 ease-out
                ${active
                    ? 'text-slate-900'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }
                ${collapsed ? collapsedNavClass : 'h-10 w-full rounded-lg'}
            `}
        >
            <div className={cn(
                "flex w-full items-center overflow-hidden px-2.5",
                collapsed ? "justify-start" : "justify-between"
            )}>
                <div className="flex min-w-0 items-center overflow-hidden gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon size={16} className={active ? 'text-indigo-600' : ''} />
                    </span>
                    <span
                        className={cn(
                            "whitespace-nowrap overflow-hidden transition-all duration-300 ease-out",
                            collapsed ? "max-w-0 opacity-0" : "max-w-[154px] opacity-100"
                        )}
                    >
                        {label}
                    </span>
                </div>
                <span
                    className={cn(
                        "overflow-hidden transition-all duration-300 ease-out",
                        collapsed || badge === undefined || badge <= 0 ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
                    )}
                >
                    {badge !== undefined && badge > 0 ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-500/30 text-indigo-100' : 'bg-rose-100 text-rose-700'}`}>
                            {badge}
                        </span>
                    ) : null}
                </span>
            </div>
        </Link>
    )
}

const SectionTitle = ({ title, collapsed }: { title: string; collapsed?: boolean }) => (
    <div className={cn("mb-1 h-7 relative", collapsed ? "px-0" : "px-3")}>
        <p
            className={cn(
                "absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-ellipsis text-[11px] font-bold text-slate-400 uppercase tracking-[0.16em] transition-all duration-300 ease-out",
                collapsed ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            )}
        >
            {title}
        </p>
        <div
            className={cn(
                "absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-px w-8 bg-slate-200 transition-all duration-300 ease-out",
                collapsed ? "opacity-100" : "opacity-0"
            )}
        />
    </div>
)

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
    const effectiveCollapsed = mobile ? false : collapsed
    const canManageCompanies = isAdmin || (role === "YETKILI" && canAccessAllCompanies)

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                mobile
                    ? "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#E2E8F0] bg-white px-3 pt-4 pb-6 overflow-y-auto overscroll-contain transition-transform duration-300 ease-out lg:hidden"
                    : "hidden lg:flex h-full flex-col border-r border-[#E2E8F0] bg-gradient-to-b from-white via-white to-slate-50/30 pt-4 pb-6 overflow-y-auto overscroll-contain transition-all duration-300 ease-out",
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
                    <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Organization Management */}
                <SectionTitle title="Sistem Yönetimi" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    {canManageCompanies ? (
                        <>
                            <NavItem href="/dashboard/sirketler" icon={Building2} label="Şirket Yönetimi" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/taseronlar" icon={Building2} label="Taşeron Yönetimi" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                            <NavItem href="/dashboard/kiraliklar" icon={Truck} label="Kiralık Araç/Personel" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                        </>
                    ) : null}
                    <NavItem href="/dashboard/personel" icon={Users} label="Personeller" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Fleet Management */}
                <SectionTitle title="Filo Yönetimi" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/araclar" icon={Car} label="Araçlar" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/zimmetler" icon={ClipboardList} label="Zimmet Kayıtları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Operations */}
                <SectionTitle title="Operasyonlar" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/arizalar" icon={AlertTriangle} label="Arıza Kayıtları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/servis-kayitlari" icon={Wrench} label="Servis Kayıtları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/muayeneler" icon={CheckCircle} label="Muayene Takibi" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Finance */}
                <SectionTitle title="Finans" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/yakitlar" icon={Fuel} label="Yakıt Harcamaları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/ceza-masraflari" icon={AlertTriangle} label="Ceza Masrafları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/masraflar" icon={Receipt} label="Genel Masraflar" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Insurance */}
                <SectionTitle title="Sigorta Departmanı" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-0.5 mb-4">
                    <NavItem href="/dashboard/trafik-sigortasi" icon={ShieldCheck} label="Trafik Sigortaları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/kasko" icon={FileText} label="Kasko Poliçeleri" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                    <NavItem href="/dashboard/evrak-takip" icon={AlertTriangle} label="Evrak Takibi" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>

                {/* Documents */}
                <SectionTitle title="Evrak Yönetimi" collapsed={effectiveCollapsed} />
                <nav className="flex flex-col gap-1 mb-2">
                    <NavItem href="/dashboard/dokumanlar" icon={FolderOpen} label="Araç Evrakları" collapsed={effectiveCollapsed} onNavigate={mobile ? onMobileClose : undefined} />
                </nav>
            </div>
        </aside>
    )
}
