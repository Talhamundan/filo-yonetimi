"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    const getErrorMessage = (err: string | null) => {
        switch (err) {
            case "CredentialsSignin":
                return "Giriş bilgileri hatalı veya hesabınız onaylanmamış olabilir.";
            case "SessionRequired":
                return "Bu sayfaya erişmek için giriş yapmalısınız.";
            case "AccessDenied":
                return "Bu alana erişim yetkiniz bulunmuyor.";
            default:
                return "Kimlik doğrulama sırasında bir hata oluştu.";
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 p-8 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 bg-red-50 text-red-600 rounded-2xl mb-6">
                    <ShieldAlert size={32} />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Giriş Hatası</h1>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                    {getErrorMessage(error)}
                </p>
                
                <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-xs text-slate-400 font-mono break-all">
                    Hata Kodu: {error || "unknown"}
                </div>

                <Link 
                    href="/auth/login" 
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={18} /> Geri Dön
                </Link>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
            <AuthErrorContent />
        </Suspense>
    );
}
