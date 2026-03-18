"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, Search, Filter, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { cleanupExpiredTrashNow, permanentlyDeleteTrashRecord, restoreTrashRecord } from "./actions";

export type TrashEntity = "arac" | "masraf" | "bakim" | "dokuman" | "ceza" | "kullanici";

export type TrashRow = {
    id: string;
    entity: TrashEntity;
    summary: string;
    companyId: string | null;
    companyName: string | null;
    deletedAt: Date;
    deletedBy: string | null;
};

const ENTITY_LABELS: Record<TrashEntity, string> = {
    arac: "Araç",
    masraf: "Masraf",
    bakim: "Bakım",
    dokuman: "Doküman",
    ceza: "Ceza",
    kullanici: "Kullanıcı",
};

export default function TrashClient({ rows, sirketler }: { rows: TrashRow[]; sirketler: Array<{ id: string; ad: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAdmin } = useDashboardScope();
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const q = searchParams.get("q") || "";
    const entity = searchParams.get("entity") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const filteredRows = useMemo(() => {
        const qNormalized = q.toLocaleLowerCase("tr-TR").trim();
        return rows.filter((row) => {
            if (entity && row.entity !== entity) return false;
            if (qNormalized && !row.summary.toLocaleLowerCase("tr-TR").includes(qNormalized)) return false;
            return true;
        });
    }, [rows, q, entity]);

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        router.push(`/dashboard/cop-kutusu?${params.toString()}`);
    };

    const resetFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        params.delete("entity");
        params.delete("from");
        params.delete("to");
        router.push(`/dashboard/cop-kutusu${params.toString() ? `?${params.toString()}` : ""}`);
    };

    const handleRestore = (row: TrashRow) => {
        setBusyKey(`${row.entity}:${row.id}:restore`);
        startTransition(async () => {
            const result = await restoreTrashRecord(row.entity, row.id);
            setBusyKey(null);
            if (!result.success) {
                toast.error(result.error || "Geri yükleme başarısız.");
                return;
            }
            toast.success("Kayıt geri yüklendi.");
            router.refresh();
        });
    };

    const handleDeletePermanently = (row: TrashRow) => {
        if (!confirm("Bu kayıt kalıcı olarak silinecek. Devam etmek istiyor musunuz?")) return;
        setBusyKey(`${row.entity}:${row.id}:delete`);
        startTransition(async () => {
            const result = await permanentlyDeleteTrashRecord(row.entity, row.id);
            setBusyKey(null);
            if (!result.success) {
                toast.error(result.error || "Kalıcı silme başarısız.");
                return;
            }
            toast.success("Kayıt kalıcı olarak silindi.");
            router.refresh();
        });
    };

    const handleCleanup = () => {
        if (!confirm("30 günden eski tüm çöp kayıtları kalıcı silinecek. Devam edilsin mi?")) return;
        startTransition(async () => {
            const result = await cleanupExpiredTrashNow();
            if (!result.success) {
                toast.error(result.error || "Temizlik işlemi başarısız.");
                return;
            }
            toast.success("Çöp kutusu temizliği tamamlandı.");
            router.refresh();
        });
    };

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Çöp Kutusu</h1>
                    <p className="text-sm text-slate-500">Soft-delete edilen kayıtları geri yükleyin veya kalıcı silin.</p>
                </div>
                {isAdmin ? (
                    <Button variant="outline" onClick={handleCleanup} disabled={isPending}>
                        <RefreshCcw className="h-4 w-4" /> 30+ Gün Temizle
                    </Button>
                ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2 relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            className="pl-9"
                            placeholder="Kayıt ara..."
                            value={q}
                            onChange={(e) => setParam("q", e.target.value)}
                        />
                    </div>
                    <div>
                        <select
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                            value={entity}
                            onChange={(e) => setParam("entity", e.target.value)}
                        >
                            <option value="">Tüm Türler</option>
                            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} />
                    </div>
                    <div>
                        <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} />
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5" /> {filteredRows.length} kayıt
                    </div>
                    <button type="button" onClick={resetFilters} className="text-indigo-600 hover:text-indigo-700 font-medium">
                        Filtreleri sıfırla
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left p-3 font-semibold text-slate-600">Tür</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Kayıt</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Şirket</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Silinme Tarihi</th>
                            <th className="text-right p-3 font-semibold text-slate-600">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.length ? (
                            filteredRows.map((row) => {
                                const restoreBusy = busyKey === `${row.entity}:${row.id}:restore`;
                                const deleteBusy = busyKey === `${row.entity}:${row.id}:delete`;
                                return (
                                    <tr key={`${row.entity}-${row.id}`} className="border-b border-slate-100">
                                        <td className="p-3">
                                            <Badge variant="secondary">{ENTITY_LABELS[row.entity]}</Badge>
                                        </td>
                                        <td className="p-3 text-slate-700">{row.summary}</td>
                                        <td className="p-3 text-slate-500">{row.companyName || "-"}</td>
                                        <td className="p-3 text-slate-500">{new Date(row.deletedAt).toLocaleString("tr-TR")}</td>
                                        <td className="p-3">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isPending || restoreBusy}
                                                    onClick={() => handleRestore(row)}
                                                >
                                                    <RotateCcw className="h-4 w-4" /> Geri Yükle
                                                </Button>
                                                {isAdmin ? (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={isPending || deleteBusy}
                                                        onClick={() => handleDeletePermanently(row)}
                                                    >
                                                        <Trash2 className="h-4 w-4" /> Kalıcı Sil
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-500">
                                    Çöp kutusunda kayıt bulunamadı.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {sirketler.length === 0 ? null : <div className="hidden" aria-hidden="true">{sirketler.length}</div>}
        </div>
    );
}
