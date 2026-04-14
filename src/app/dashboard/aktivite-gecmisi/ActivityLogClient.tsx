"use client";

import { ActivityActionType, ActivityEntityType, type ActivityLog } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ACTION_LABELS: Record<ActivityActionType, string> = {
    CREATE: "Oluşturma",
    UPDATE: "Güncelleme",
    DELETE: "Kalıcı Silme",
    RESTORE: "Geri Yükleme",
    ARCHIVE: "Çöp Kutusu",
    LOGIN_SUCCESS: "Giriş Başarılı",
    LOGIN_FAILURE: "Giriş Başarısız",
    ROLE_CHANGE: "Rol Değişimi",
    STATUS_CHANGE: "Durum Değişimi",
};

const ENTITY_LABELS: Record<string, string> = {
    ARAC: "Araç",
    MASRAF: "Masraf",
    BAKIM: "Bakım",
    DOKUMAN: "Doküman",
    CEZA: "Ceza",
    KULLANICI: "Kullanıcı",
    TEDARKICI: "Tedarikçi",
    OTURUM: "Oturum",
    DIGER: "Diğer",
};

export default function ActivityLogClient({
    rows,
    total,
    page,
    totalPages,
    sirketler,
}: {
    rows: ActivityLog[];
    total: number;
    page: number;
    totalPages: number;
    sirketler: Array<{ id: string; ad: string }>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const q = searchParams.get("q") || "";
    const action = searchParams.get("action") || "";
    const entity = searchParams.get("entity") || "";
    const sirket = searchParams.get("sirket") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        if (key !== "page") params.delete("page");
        router.push(`/dashboard/aktivite-gecmisi?${params.toString()}`);
    };

    const goPage = (nextPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextPage <= 1) params.delete("page");
        else params.set("page", String(nextPage));
        router.push(`/dashboard/aktivite-gecmisi?${params.toString()}`);
    };

    const resetFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        params.delete("action");
        params.delete("entity");
        params.delete("sirket");
        params.delete("from");
        params.delete("to");
        params.delete("page");
        router.push(`/dashboard/aktivite-gecmisi${params.toString() ? `?${params.toString()}` : ""}`);
    };

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1500px] mx-auto space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Aktivite Geçmişi</h1>
                <p className="text-sm text-slate-500">Sistemde gerçekleşen önemli işlemler.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    <div className="md:col-span-2 relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            className="pl-9"
                            placeholder="Özet / kayıt ara..."
                            value={q}
                            onChange={(e) => setParam("q", e.target.value)}
                        />
                    </div>
                    <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={action}
                        onChange={(e) => setParam("action", e.target.value)}
                    >
                        <option value="">Tüm Aksiyonlar</option>
                        {Object.entries(ACTION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={entity}
                        onChange={(e) => setParam("entity", e.target.value)}
                    >
                        <option value="">Tüm Varlıklar</option>
                        {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={sirket}
                        onChange={(e) => setParam("sirket", e.target.value)}
                    >
                        <option value="">Tüm Şirketler</option>
                        {sirketler.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.ad}
                            </option>
                        ))}
                    </select>
                    <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} />
                    <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Toplam: {total} kayıt</span>
                    <button className="text-indigo-600 hover:text-indigo-700 font-medium" onClick={resetFilters}>
                        Filtreleri sıfırla
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left p-3 font-semibold text-slate-600">Tarih</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Aksiyon</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Varlık</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Özet</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Kullanıcı</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Şirket</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length ? (
                            rows.map((row) => (
                                <tr key={row.id} className="border-b border-slate-100 align-top">
                                    <td className="p-3 text-slate-500 whitespace-nowrap">
                                        {new Date(row.createdAt).toLocaleString("tr-TR")}
                                    </td>
                                    <td className="p-3">
                                        <Badge variant="secondary">{ACTION_LABELS[row.actionType] || row.actionType}</Badge>
                                    </td>
                                    <td className="p-3">
                                        <Badge variant="outline">{ENTITY_LABELS[row.entityType] || row.entityType}</Badge>
                                    </td>
                                    <td className="p-3 text-slate-700">
                                        <div className="font-medium">{row.summary}</div>
                                        {row.metadata ? (
                                            <details className="mt-1 text-xs text-slate-500">
                                                <summary className="cursor-pointer">Detay</summary>
                                                <pre className="mt-1 whitespace-pre-wrap break-all bg-slate-50 border border-slate-200 rounded p-2">
                                                    {JSON.stringify(row.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        ) : null}
                                    </td>
                                    <td className="p-3 text-slate-500 font-mono text-xs">{row.userId || "-"}</td>
                                    <td className="p-3 text-slate-500 text-xs">
                                        {row.companyId ? sirketler.find((s) => s.id === row.companyId)?.ad || row.companyId : "-"}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-500">
                                    Filtrelere uygun aktivite kaydı bulunamadı.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => goPage(page - 1)} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" /> Önceki
                </Button>
                <span className="text-xs text-slate-500">
                    Sayfa {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => goPage(page + 1)} disabled={page >= totalPages}>
                    Sonraki <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
