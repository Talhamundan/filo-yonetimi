"use client"

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";
import Image from "next/image";

const REMEMBERED_USERNAME_KEY = "auth.rememberedUsername";

export default function LoginPage() {
    const rememberedUsername =
        typeof window !== "undefined" ? window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "" : "";

    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(Boolean(rememberedUsername));
    const [formData, setFormData] = useState({ kullaniciAdi: rememberedUsername, sifre: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const res = await signIn("credentials", {
                kullaniciAdi: formData.kullaniciAdi,
                sifre: formData.sifre,
                redirect: false
            });

            if (res?.error) {
                toast.error("Giriş bilgileri hatalı veya hesabınız onaylanmamış olabilir.");
            } else {
                if (rememberMe) {
                    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, formData.kullaniciAdi.trim().toLowerCase());
                } else {
                    window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
                }
                toast.success("Başarıyla giriş yapıldı!");
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            toast.error("Bir sistem hatası oluştu.");
        }
        
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#a6efe5] px-4 py-8">
            <div
                className="pointer-events-none absolute inset-0 opacity-35"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
                    backgroundSize: "18px 18px",
                }}
            />
            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center rounded-2xl border border-[#d7eeea] bg-[#edf5f4] px-6 py-10 shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                <div className="w-full max-w-md">
                    <div className="mb-8 flex justify-center">
                        <Image src="/logo-bera.png" alt="Bera Logo" width={190} height={70} priority className="h-auto w-auto" />
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-900">Kullanıcı Adı</label>
                            <div className="relative">
                                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    required
                                    type="text"
                                    value={formData.kullaniciAdi}
                                    onChange={(e) => setFormData({ ...formData, kullaniciAdi: e.target.value })}
                                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                    placeholder="Kullanıcı Adı Giriniz"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-900">Parola</label>
                            <div className="relative">
                                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    required
                                    type="password"
                                    value={formData.sifre}
                                    onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                    placeholder="Parola Giriniz"
                                />
                            </div>
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-700"
                            />
                            Beni Hatırla
                        </label>

                        <button
                            type="submit"
                            disabled={loading}
                            className="h-11 w-full rounded-lg bg-slate-500 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
                        >
                            {loading ? "Giriş Yapılıyor..." : "GİRİŞ YAP"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
