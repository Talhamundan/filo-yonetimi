"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
    Settings,
    Route,
    Building2,
    CreditCard
} from "lucide-react"
import Image from "next/image"

const NavItem = ({ href, icon: Icon, label, badge }: { href: string, icon: React.ElementType, label: string, badge?: number }) => {
    const pathname = usePathname()
    // Helper function to check if a path is active
    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    }
    const active = isActive(href);

    return (
        <Link
            href={href}
            className={`flex items-center justify-between font-semibold px-3 py-2.5 rounded-lg transition-all
                ${active
                    ? 'bg-[#0F172A] text-white shadow-md'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={18} className={active ? 'text-indigo-400' : ''} />
                {label}
            </div>
            {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-indigo-500/30 text-indigo-100' : 'bg-rose-100 text-rose-700'}`}>
                    {badge}
                </span>
            )}
        </Link>
    )
}

export default function Sidebar() {
    return (
        <aside className="hidden lg:flex flex-col w-[260px] border-r border-[#E2E8F0] bg-white px-4 py-6 h-screen sticky top-0 z-20 overflow-y-auto">
            {/* Logo Area */}
            <div className="flex items-center gap-3 mb-8 px-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-lg shadow-sm border border-slate-100">
                    <Image 
                        src="/logo-bera.png" 
                        alt="Bera Filo Logo" 
                        fill
                        className="object-contain p-1"
                    />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bera <span className="text-[#6366F1]">Filo</span></h1>
            </div>

            {/* Fleet Overview */}
            <div className="px-3 mb-2 mt-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Genel Bakış</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            </nav>

            {/* Organization Management */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sistem Yönetimi</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard/sirketler" icon={Building2} label="Şirket Yönetimi" />
                <NavItem href="/dashboard/personel" icon={Users} label="Personel & Yetkiler" />
            </nav>

            {/* Fleet Management */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Filo Yönetimi</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard/araclar" icon={Car} label="Araçlar" />
                <NavItem href="/dashboard/zimmetler" icon={ClipboardList} label="Zimmet Kayıtları" />
            </nav>

            {/* Operations */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Operasyonlar</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard/bakimlar" icon={Wrench} label="Bakım Kayıtları" />
                <NavItem href="/dashboard/arizalar" icon={AlertTriangle} label="Arıza Bildirimleri" />
                <NavItem href="/dashboard/muayeneler" icon={CheckCircle} label="Muayene Takibi" />
            </nav>

            {/* Finance */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Finans</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard/yakitlar" icon={Fuel} label="Yakıt Harcamaları" />
                <NavItem href="/dashboard/hgs" icon={CreditCard} label="HGS Yüklemeleri" />
                <NavItem href="/dashboard/masraflar" icon={Receipt} label="Genel Masraflar" />
            </nav>

            {/* Insurance */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sigorta Departmanı</p>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
                <NavItem href="/dashboard/trafik-sigortasi" icon={ShieldCheck} label="Trafik Sigortaları" />
                <NavItem href="/dashboard/kasko" icon={FileText} label="Kasko Poliçeleri" />
                <NavItem href="/dashboard/evrak-takip" icon={AlertTriangle} label="Evrak & Sigorta Takibi" />
            </nav>

            {/* Documents */}
            <div className="px-3 mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Evrak Yönetimi</p>
            </div>
            <nav className="flex flex-col gap-1 mb-2">
                <NavItem href="/dashboard/dokumanlar" icon={FolderOpen} label="Araç Evrakları" />
            </nav>

            {/* User Profile */}
            <div className="mt-8 pt-6 border-t border-[#F1F5F9] flex items-center justify-between px-3 group cursor-pointer hover:bg-slate-50 rounded-xl p-2 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                        TM
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Admin Panel</p>
                        <p className="text-[11px] font-medium text-slate-500">Filo Yöneticisi</p>
                    </div>
                </div>
                <Settings size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
        </aside>
    )
}
