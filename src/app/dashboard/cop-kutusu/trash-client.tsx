"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, Search, Filter, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { useConfirm } from "@/components/ui/confirm-modal";
import { matchesTokenizedSearch } from "@/lib/search-query";
import { cleanupExpiredTrashNow, emptyTrashNow, permanentlyDeleteTrashRecord, restoreTrashRecord } from "./actions";

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

type DeletedDataStats = {
    total: number;
    pendingPermanentDelete: number;
    oldestDeletedAt: string | null;
    byEntity: {
        arac: number;
        masraf: number;
        bakim: number;
        dokuman: number;
        ceza: number;
        kullanici: number;
    };
};

const ENTITY_LABELS: Record<TrashEntity, string> = {
    arac: "Araç",
    masraf: "Masraf",
    bakim: "Bakım",
    dokuman: "Doküman",
    ceza: "Ceza",
    kullanici: "Personel",
};

function getPermanentDeleteConfirmMessage(row: TrashRow) {
    if (row.entity === "kullanici") {
        return "Bu personel kaydı kalıcı olarak silinecek. Devam etmek istiyor musunuz?";
    }
    return `Bu ${ENTITY_LABELS[row.entity].toLocaleLowerCase("tr-TR")} kaydı kalıcı olarak silinecek. Devam etmek istiyor musunuz?`;
}

function getEmptyTrashConfirmMessage(companyName: string | null) {
    if (companyName) {
        return `"${companyName}" kapsamındaki tüm çöp kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`;
    }
    return "Tüm şirketler kapsamındaki çöp kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?";
}

export default function TrashClient({
    rows,
    sirketler,
    deletedStats,
}: {
    rows: TrashRow[];
    sirketler: Array<{ id: string; ad: string }>;
    deletedStats: DeletedDataStats;
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAdmin } = useDashboardScope();
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const selectedSirketId = searchParams.get("sirket");
    const selectedSirketName = selectedSirketId
        ? sirketler.find((item) => item.id === selectedSirketId)?.ad || null
        : null;

    const q = searchParams.get("q") || "";
    const entity = searchParams.get("entity") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const oldestDeletedText = deletedStats.oldestDeletedAt
        ? new Date(deletedStats.oldestDeletedAt).toLocaleDateString("tr-TR")
        : "-";

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            if (entity && row.entity !== entity) return false;
            if (!matchesTokenizedSearch(row.summary, q)) return false;
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

    const handleDeletePermanently = async (row: TrashRow) => {
        const confirmed = await openConfirm({
            title: row.entity === "kullanici" ? "Personeli Kalıcı Sil" : "Kaydı Kalıcı Sil",
            message: getPermanentDeleteConfirmMessage(row),
            confirmText: "Evet, Kalıcı Sil",
            cancelText: "Vazgeç",
            variant: "danger",
        });
        if (!confirmed) return;
        setBusyKey(`${row.entity}:${row.id}:delete`);
        startTransition(async () => {
            const result = await permanentlyDeleteTrashRecord(row.entity, row.id, selectedSirketId || null);
            setBusyKey(null);
            if (!result.success) {
                toast.error(result.error || "Kalıcı silme başarısız.");
                return;
            }
            toast.success(row.entity === "kullanici" ? "Personel kalıcı olarak silindi." : "Kayıt kalıcı olarak silindi.");
            router.refresh();
        });
    };

    const handleCleanup = async () => {
        const confirmed = await openConfirm({
            title: "Çöp Kutusunu Temizle",
            message: "30 günden eski tüm çöp kayıtları kalıcı silinecek. Devam edilsin mi?",
            confirmText: "Evet, Temizle",
            cancelText: "Vazgeç",
            variant: "warning",
        });
        if (!confirmed) return;
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

    const handleEmptyTrash = async () => {
        const confirmed = await openConfirm({
            title: "Çöp Kutusunu Boşalt",
            message: getEmptyTrashConfirmMessage(selectedSirketName),
            confirmText: "Evet, Boşalt",
            cancelText: "Vazgeç",
            variant: "danger",
        });
        if (!confirmed) return;

        startTransition(async () => {
            const result = await emptyTrashNow(selectedSirketId || null);
            if (!result.success || !result.result) {
                toast.error(result.error || "Çöp kutusu boşaltılamadı.");
                return;
            }

            if (result.result.failedTotal > 0) {
                const detail = result.result.firstFailureMessage ? ` (${result.result.firstFailureMessage})` : "";
                toast.warning(
                    `Çöp kutusu boşaltıldı: ${result.result.deletedTotal} kayıt silindi, ${result.result.failedTotal} kayıt silinemedi.${detail}`
                );
            } else {
                toast.success(`Çöp kutusu boşaltıldı. ${result.result.deletedTotal} kayıt kalıcı silindi.`);
            }
            router.refresh();
        });
    };

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto space-y-4">
            {confirmModal}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Çöp Kutusu</h1>
                    <p className="text-sm text-slate-500">Soft-delete edilen kayıtları geri yükleyin veya kalıcı silin.</p>
                </div>
                {isAdmin ? (
                    <div className="flex items-center gap-2">
                        <Button variant="destructive" onClick={handleEmptyTrash} disabled={isPending}>
                            <Trash2 className="h-4 w-4" /> Çöp Kutusunu Boşalt
                        </Button>
                        <Button variant="outline" onClick={handleCleanup} disabled={isPending}>
                            <RefreshCcw className="h-4 w-4" /> 30+ Gün Temizle
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Silinen Veriler Özeti</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Çöp kutusundaki toplam kayıt: <span className="font-semibold text-slate-900">{deletedStats.total}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                            30+ gün dolduğu için kalıcı silinmeye aday kayıt:{" "}
                            <span className="font-semibold text-amber-700">{deletedStats.pendingPermanentDelete}</span>
                        </p>
                        <p className="text-xs text-slate-500">En eski silinme tarihi: {oldestDeletedText}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Araç</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.arac}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Masraf</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.masraf}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Bakım</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.bakim}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Doküman</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.dokuman}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Ceza</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.ceza}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Personel</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.kullanici}</p>
                    </div>
                </div>
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
                <div className="overflow-x-auto">
                <table className="w-full min-w-0 text-[13px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left p-3 font-semibold text-slate-600">Tür</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Kayıt</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Şirket</th>
                            <th className="text-left p-3 font-semibold text-slate-600">Silinme Tarihi</th>
                            <th className="sticky right-0 bg-slate-50 border-l border-slate-200 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.2)] text-right p-3 font-semibold text-slate-600">İşlemler</th>
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
                                        <td className="sticky right-0 bg-white border-l border-slate-100 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)] p-3">
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
            </div>

            {sirketler.length === 0 ? null : <div className="hidden" aria-hidden="true">{sirketler.length}</div>}
        </div>
    );
}
