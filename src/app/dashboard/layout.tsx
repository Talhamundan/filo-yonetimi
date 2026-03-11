import React from "react"
import Sidebar from "../../components/layout/Sidebar"
import { Toaster } from "sonner"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
            {/* Global Sidebar Persistent Across all /dashboard routes */}
            <Sidebar />

            <Toaster position="top-right" richColors />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 max-w-[1600px] mx-auto w-full">
                {children}
            </main>
        </div>
    )
}
