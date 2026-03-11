"use client"

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ eposta: "", sifre: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const res = await signIn("credentials", {
                eposta: formData.eposta,
                sifre: formData.sifre,
                redirect: false
            });

            if (res?.error) {
                toast.error("Giriş bilgileri hatalı veya hesabınız onaylanmamış olabilir.");
            } else {
                toast.success("Başarıyla giriş yapıldı!");
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            toast.error("Bir sistem hatası oluştu.");
        }
        
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
                <div className="p-8 pt-10 text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl mb-6">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hoş Geldiniz</h1>
                    <p className="text-slate-500 mt-2 font-medium">Lütfen bilgilerinizi kullanarak giriş yapın.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">E-Posta</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                <Mail size={18} />
                            </div>
                            <input 
                                required
                                type="email"
                                value={formData.eposta}
                                onChange={(e) => setFormData({...formData, eposta: e.target.value})}
                                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900" 
                                placeholder="ornek@sirket.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-bold text-slate-700">Şifre</label>
                            <Link href="#" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Şifremi Unuttum</Link>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input 
                                required
                                type="password"
                                value={formData.sifre}
                                onChange={(e) => setFormData({...formData, sifre: e.target.value})}
                                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900" 
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6 active:scale-[0.98]"
                    >
                        {loading ? "Giriş Yapılıyor..." : (
                            <>Sisteme Giriş Yap <ArrowRight size={20} /></>
                        )}
                    </button>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            Hesabınız yok mu? <Link href="/auth/register" className="text-indigo-600 font-bold hover:text-indigo-700 decoration-2 underline-offset-4 hover:underline">Şimdi Kayıt Talebi Oluştur</Link>
                        </p>
                    </div>
                </form>
            </div>
            
            <p className="mt-8 text-slate-400 text-xs font-medium uppercase tracking-widest">
                © 2026 Filo Yönetim Sistemleri v5.0
            </p>
        </div>
    );
}
