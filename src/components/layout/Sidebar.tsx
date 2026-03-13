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
    CreditCard
} from "lucide-react"
import { cn } from "@/lib/utils"

const NavItem = ({
    href,
    icon: Icon,
    label,
    badge,
    collapsed,
}: {
    href: string,
    icon: React.ElementType,
    label: string,
    badge?: number,
    collapsed?: boolean
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
    const scopedHref = selectedSirketId ? `${href}?sirket=${selectedSirketId}` : href;
    const collapsedNavClass = "mx-auto h-11 w-11 justify-center rounded-[18px]";

    return (
        <Link
            href={scopedHref}
            title={collapsed ? label : undefined}
            className={`flex items-center font-semibold transition-all duration-300 ease-out
                ${active
                    ? 'text-slate-900'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }
                ${collapsed ? collapsedNavClass : 'h-11 w-full rounded-lg'}
            `}
        >
            <div className={cn(
                "flex w-full items-center overflow-hidden",
                collapsed ? "justify-center px-0" : "justify-between px-3"
            )}>
                <div className={cn(
                    "flex min-w-0 items-center overflow-hidden",
                    collapsed ? "justify-center" : "gap-3"
                )}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon size={18} className={active ? 'text-indigo-600' : ''} />
                    </span>
                    <span
                        className={cn(
                            "whitespace-nowrap overflow-hidden transition-all duration-300 ease-out",
                            collapsed ? "max-w-0 opacity-0 -translate-x-1" : "max-w-[180px] opacity-100 translate-x-0"
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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-indigo-500/30 text-indigo-100' : 'bg-rose-100 text-rose-700'}`}>
                            {badge}
                        </span>
                    ) : null}
                </span>
            </div>
        </Link>
    )
}

const SectionTitle = ({ title, collapsed }: { title: string; collapsed?: boolean }) => (
    <div className={cn("mb-1.5 h-8 relative", collapsed ? "px-0" : "px-3")}>
        <p
            className={cn(
                "absolute inset-0 flex items-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.16em] transition-all duration-300 ease-out",
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

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
    const pathname = usePathname()
    const sidebarRef = React.useRef<HTMLElement>(null)

    React.useEffect(() => {
        sidebarRef.current?.scrollTo({ top: 0, behavior: "auto" })
    }, [pathname, collapsed])

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                "hidden lg:flex h-full flex-col border-r border-[#E2E8F0] bg-gradient-to-b from-white via-white to-slate-50/30 pt-4 pb-6 overflow-y-auto overscroll-contain transition-all duration-300 ease-out",
                collapsed ? "w-[72px] px-2" : "w-[260px] px-4"
            )}
        >
            <div className="min-h-full">
                {/* Fleet Overview */}
                <SectionTitle title="Genel Bakış" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
                </nav>

                {/* Organization Management */}
                <SectionTitle title="Sistem Yönetimi" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard/sirketler" icon={Building2} label="Şirket Yönetimi" collapsed={collapsed} />
                    <NavItem href="/dashboard/personel" icon={Users} label="Personel & Yetkiler" collapsed={collapsed} />
                </nav>

                {/* Fleet Management */}
                <SectionTitle title="Filo Yönetimi" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard/araclar" icon={Car} label="Araçlar" collapsed={collapsed} />
                    <NavItem href="/dashboard/zimmetler" icon={ClipboardList} label="Zimmet Kayıtları" collapsed={collapsed} />
                </nav>

                {/* Operations */}
                <SectionTitle title="Operasyonlar" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard/bakimlar" icon={Wrench} label="Bakım Kayıtları" collapsed={collapsed} />
                    <NavItem href="/dashboard/arizalar" icon={AlertTriangle} label="Arıza Bildirimleri" collapsed={collapsed} />
                    <NavItem href="/dashboard/muayeneler" icon={CheckCircle} label="Muayene Takibi" collapsed={collapsed} />
                </nav>

                {/* Finance */}
                <SectionTitle title="Finans" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard/yakitlar" icon={Fuel} label="Yakıt Harcamaları" collapsed={collapsed} />
                    <NavItem href="/dashboard/hgs" icon={CreditCard} label="HGS Yüklemeleri" collapsed={collapsed} />
                    <NavItem href="/dashboard/masraflar" icon={Receipt} label="Genel Masraflar" collapsed={collapsed} />
                </nav>

                {/* Insurance */}
                <SectionTitle title="Sigorta Departmanı" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-5">
                    <NavItem href="/dashboard/trafik-sigortasi" icon={ShieldCheck} label="Trafik Sigortaları" collapsed={collapsed} />
                    <NavItem href="/dashboard/kasko" icon={FileText} label="Kasko Poliçeleri" collapsed={collapsed} />
                    <NavItem href="/dashboard/evrak-takip" icon={AlertTriangle} label="Evrak & Sigorta Takibi" collapsed={collapsed} />
                </nav>

                {/* Documents */}
                <SectionTitle title="Evrak Yönetimi" collapsed={collapsed} />
                <nav className="flex flex-col gap-1 mb-2">
                    <NavItem href="/dashboard/dokumanlar" icon={FolderOpen} label="Araç Evrakları" collapsed={collapsed} />
                </nav>
            </div>
        </aside>
    )
}
