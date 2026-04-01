"use client"

import React, { useState } from "react";
import { registerUser } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Mail, Lock, Phone, CreditCard, Building2, UserCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RegisterPage({ sirketler }: { sirketler: any[] }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        ad: "",
        soyad: "",
        eposta: "",
        sifre: "",
        telefon: "",
        tcNo: "",
        sirketId: "",
        rolTalebi: "SOFOR"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const res = await registerUser(formData);
        if (res.success) {
            toast.success("Kayıt talebiniz alındı. Admin onayı sonrası giriş yapabilirsiniz.");
            router.push("/auth/login");
        } else {
            toast.error(res.error || "Kayıt başarısız.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-100 overflow-hidden">
                <div className="bg-indigo-600 p-8 text-white text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-xl mb-4">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-2xl font-bold">Yeni Kayıt Talebi</h1>
                    <p className="text-indigo-100 mt-2 text-sm">Filo yönetim sistemine erişim için bilgilerinizi girin.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">Ad</label>
                            <div className="relative">
                                <input 
                                    required
                                    value={formData.ad}
                                    onChange={(e) => setFormData({...formData, ad: e.target.value})}
                                    className="w-full h-11 pl-3 pr-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                                    placeholder="Adınız"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Soyad</label>
                            <input 
                                required
                                value={formData.soyad}
                                onChange={(e) => setFormData({...formData, soyad: e.target.value})}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                                placeholder="Soyadınız"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Mail size={14} className="text-slate-400" /> E-Posta
                        </label>
                        <input 
                            required
                            type="email"
                            value={formData.eposta}
                            onChange={(e) => setFormData({...formData, eposta: e.target.value})}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                            placeholder="ornek@sirket.com"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Lock size={14} className="text-slate-400" /> Şifre
                        </label>
                        <input 
                            required
                            type="password"
                            value={formData.sifre}
                            onChange={(e) => setFormData({...formData, sifre: e.target.value})}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Phone size={14} className="text-slate-400" /> Telefon
                            </label>
                            <input 
                                value={formData.telefon}
                                onChange={(e) => setFormData({...formData, telefon: e.target.value})}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                                placeholder="05xx..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <CreditCard size={14} className="text-slate-400" /> TC No
                            </label>
                            <input 
                                value={formData.tcNo}
                                onChange={(e) => setFormData({...formData, tcNo: e.target.value})}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm" 
                                placeholder="11 hane"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Building2 size={14} className="text-slate-400" /> Şirket
                            </label>
                            <select 
                                required
                                value={formData.sirketId}
                                onChange={(e) => setFormData({...formData, sirketId: e.target.value})}
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-transparent text-sm"
                            >
                                <option value="">Şirket Seçin</option>
                                {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <UserCircle size={14} className="text-slate-400" /> Rol Talebi
                            </label>
                            <select 
                                value={formData.rolTalebi}
                                onChange={(e) => setFormData({...formData, rolTalebi: e.target.value})}
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-transparent text-sm"
                            >
                                <option value="SOFOR">Personel</option>
                                <option value="YETKILI">Yetkili</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                    >
                        {loading ? "Talep Gönderiliyor..." : (
                            <>Kayıt Talebi Oluştur <ArrowRight size={18} /></>
                        )}
                    </button>

                    <p className="text-center text-slate-500 text-sm mt-4">
                        Zaten hesabınız var mı? <Link href="/auth/login" className="text-indigo-600 font-bold hover:underline">Giriş Yap</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
