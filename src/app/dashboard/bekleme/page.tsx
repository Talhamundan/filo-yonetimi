"use client";

import React from "react";
import { Clock, ShieldAlert, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function WaitingPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6 text-center">
            <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100">
                <div className="inline-flex items-center justify-center h-20 w-20 bg-amber-50 text-amber-500 rounded-full mb-8 animate-pulse">
                    <Clock size={40} />
                </div>
                
                <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Onay Bekleniyor</h1>
                <p className="text-slate-600 font-medium mb-8 leading-relaxed">
                    Hesabınız başarıyla oluşturuldu. Güvenliğiniz için yöneticilerimiz bilgilerinizi kontrol ediyor. Onaylandığında sisteme tam erişim sağlayabileceksiniz.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-8 flex items-start gap-3 text-left">
                    <ShieldAlert className="text-slate-400 mt-0.5 shrink-0" size={18} />
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Genellikle onay süreçleri 24 saat içerisinde tamamlanmaktadır. Acil durumlar için şirket yöneticinizle iletişime geçebilirsiniz.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <a 
                        href="/dashboard" 
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        Durumu Kontrol Et
                    </a>
                    <button 
                        onClick={() => signOut({ callbackUrl: "/auth/login" })}
                        className="w-full h-12 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> Çıkış Yap
                    </button>
                </div>
            </div>
            
            <p className="mt-8 text-slate-400 text-xs font-semibold uppercase tracking-widest">
                Filo Yönetim Sistemi Güvenlik Protokolü
            </p>
        </div>
    );
}
