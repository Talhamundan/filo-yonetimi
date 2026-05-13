"use client";

import { ActivityActionType, ActivityEntityType, type ActivityLog } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ActivityLogRow = ActivityLog & {
    userDisplayName?: string;
};

type ChangeRow = {
    field: string;
    before: unknown;
    after: unknown;
};

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

const FIELD_LABELS: Record<string, string> = {
    plaka: "Plaka",
    marka: "Marka",
    model: "Model",
    yil: "Model Yılı",
    guncelKm: "Güncel KM",
    bulunduguIl: "Bulunduğu İl",
    calistigiKurum: "Çalıştığı Kurum",
    sirketId: "Şirket",
    kullaniciId: "Kullanıcı",
    ad: "Ad",
    soyad: "Soyad",
    tutar: "Tutar",
    tarih: "Tarih",
    aciklama: "Açıklama",
    aktifMi: "Aktif",
    kapasiteLitre: "Kapasite",
    mevcutLitre: "Mevcut Litre",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatFieldLabel(field: string) {
    if (FIELD_LABELS[field]) return FIELD_LABELS[field];
    return field
        .replace(/Id$/, "")
        .replace(/([a-zğüşöçı])([A-ZĞÜŞÖÇİ])/g, "$1 $2")
        .replace(/^./, (char) => char.toLocaleUpperCase("tr-TR"));
}

function formatChangeValue(value: unknown): string {
    if (value === null || typeof value === "undefined" || value === "") return "-";
    if (typeof value === "boolean") return value ? "Evet" : "Hayır";
    if (value instanceof Date) return value.toLocaleString("tr-TR");
    if (typeof value === "string") {
        const date = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
        if (date && !Number.isNaN(date.getTime())) return date.toLocaleString("tr-TR");
        return value;
    }
    if (Array.isArray(value)) return value.length ? value.map(formatChangeValue).join(", ") : "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function getMetadataChanges(metadata: unknown): ChangeRow[] {
    if (!isPlainObject(metadata)) return [];
    const changes = metadata.changes;
    if (!Array.isArray(changes)) return [];
    return changes
        .filter((item): item is ChangeRow => isPlainObject(item) && typeof item.field === "string")
        .filter((item) => item.field !== "updatedAt" && item.field !== "olusturmaTarihi");
}

function isApprovalPendingMetadata(metadata: unknown) {
    return isPlainObject(metadata) && metadata.approvalPending === true;
}

export default function ActivityLogClient({
    rows,
    total,
    page,
    totalPages,
}: {
    rows: ActivityLogRow[];
    total: number;
    page: number;
    totalPages: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const q = searchParams.get("q") || "";
    const action = searchParams.get("action") || "";
    const entity = searchParams.get("entity") || "";
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
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                                                {getMetadataChanges(row.metadata).length > 0 ? (
                                                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Yapılan değişiklikler</p>
                                                        <div className="grid gap-1.5">
                                                            {getMetadataChanges(row.metadata).map((change) => (
                                                                <div key={change.field} className="grid gap-1 md:grid-cols-[150px_1fr]">
                                                                    <span className="font-semibold text-slate-600">{formatFieldLabel(change.field)}</span>
                                                                    <span className="text-slate-600">
                                                                        <span className="line-through decoration-slate-400">{formatChangeValue(change.before)}</span>
                                                                        <span className="px-2 text-slate-400">→</span>
                                                                        <span className="font-semibold text-slate-900">{formatChangeValue(change.after)}</span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : isApprovalPendingMetadata(row.metadata) ? (
                                                    <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-slate-600">
                                                        Bu eski onay kaydında karşılaştırılabilir değişiklik detayı yok.
                                                    </div>
                                                ) : (
                                                    <pre className="mt-1 whitespace-pre-wrap break-all bg-slate-50 border border-slate-200 rounded p-2">
                                                        {JSON.stringify(row.metadata, null, 2)}
                                                    </pre>
                                                )}
                                            </details>
                                        ) : null}
                                    </td>
                                    <td className="p-3 text-slate-500 text-xs">{row.userDisplayName || "-"}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-500">
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
