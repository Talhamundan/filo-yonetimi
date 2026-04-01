"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { changeOwnPassword } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function HesabimClient({ kullaniciAdi }: { kullaniciAdi: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState({
    mevcutSifre: "",
    yeniSifre: "",
    yeniSifreTekrar: "",
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await changeOwnPassword(form);
      if (!result.success) {
        toast.error("Şifre değiştirilemedi", { description: result.error });
        return;
      }

      toast.success("Şifre güncellendi", {
        description: "Yeni şifreniz başarıyla kaydedildi.",
      });

      setForm({ mevcutSifre: "", yeniSifre: "", yeniSifreTekrar: "" });
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[860px] p-6 md:p-8 xl:p-10">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <KeyRound className="text-indigo-600" size={22} />
          Hesabım
        </h2>
        <p className="mt-1 text-sm text-slate-500">Kendi giriş şifrenizi güvenli şekilde güncelleyin.</p>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            Giriş adınız: <span className="font-mono text-slate-700">{kullaniciAdi}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mevcut-sifre">Mevcut Şifre</Label>
              <Input
                id="mevcut-sifre"
                type="password"
                value={form.mevcutSifre}
                onChange={(event) => setForm((prev) => ({ ...prev, mevcutSifre: event.target.value }))}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="yeni-sifre">Yeni Şifre</Label>
              <Input
                id="yeni-sifre"
                type="password"
                value={form.yeniSifre}
                onChange={(event) => setForm((prev) => ({ ...prev, yeniSifre: event.target.value }))}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="yeni-sifre-tekrar">Yeni Şifre (Tekrar)</Label>
              <Input
                id="yeni-sifre-tekrar"
                type="password"
                value={form.yeniSifreTekrar}
                onChange={(event) => setForm((prev) => ({ ...prev, yeniSifreTekrar: event.target.value }))}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isPending} className="h-9 px-4">
                {isPending ? "Kaydediliyor..." : "Şifremi Güncelle"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
