"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Loader2, Plus, Trash2, Upload, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSigortaTeklif, deleteSigortaTeklif, updateSigortaTeklifDurum } from "./actions";
import { toDateTimeLocalInput } from "@/lib/datetime-local";

type SigortaTeklifDurum = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
type SigortaTeklifTur = "KASKO" | "TRAFIK";

type TeklifAracOption = {
    id: string;
    plaka: string;
    marka: string;
    model: string;
};

type TeklifSuggestion = {
    aracId: string;
    plaka: string;
    tur: SigortaTeklifTur;
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: string;
    bitisTarihi: string;
    teklifTutar: number;
};

type TeklifRow = {
    id: string;
    aracId: string;
    plaka: string;
    markaModel: string;
    tur: SigortaTeklifTur;
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: string;
    bitisTarihi: string;
    teklifTutar: number;
    durum: SigortaTeklifDurum;
    notlar: string | null;
    updatedAt: string;
};

type SigortaTeklifPanelProps = {
    aracOptions: TeklifAracOption[];
    teklifRows: TeklifRow[];
    queueSuggestions: TeklifSuggestion[];
};

function formatCurrency(value: number) {
    return Number(value || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function formatDate(value: string) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR");
}

function getDurumBadge(durum: SigortaTeklifDurum) {
    if (durum === "ONAYLANDI") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (durum === "REDDEDILDI") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
}

function getDownloadFileName(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) return fallback;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            return utf8Match[1];
        }
    }
    const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback;
}

async function getErrorMessage(response: Response, fallback: string) {
    try {
        const payload = await response.json();
        if (typeof payload?.error === "string" && payload.error.trim()) {
            return payload.error;
        }
    } catch {
        // noop
    }
    return fallback;
}

function getNoonDate(date = new Date()) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);
    return result;
}

function getDefaultFormData() {
    const baslangic = getNoonDate();
    const bitis = new Date(baslangic);
    bitis.setFullYear(bitis.getFullYear() + 1);

    return {
        aracId: "",
        tur: "KASKO" as SigortaTeklifTur,
        acente: "",
        sigortaSirketi: "",
        policeNo: "",
        baslangicTarihi: toDateTimeLocalInput(baslangic),
        bitisTarihi: toDateTimeLocalInput(bitis),
        teklifTutar: "",
        notlar: "",
    };
}

export default function SigortaTeklifPanel({
    aracOptions,
    teklifRows,
    queueSuggestions,
}: SigortaTeklifPanelProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [formData, setFormData] = React.useState(() => getDefaultFormData());
    const [loading, setLoading] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);

    const endpoint = React.useMemo(() => {
        const params = new URLSearchParams();
        const selectedSirket = searchParams.get("sirket");
        const selectedYil = searchParams.get("yil");
        const selectedAy = searchParams.get("ay");
        if (selectedSirket) params.set("sirket", selectedSirket);
        if (selectedYil) params.set("yil", selectedYil);
        if (selectedAy) params.set("ay", selectedAy);
        const query = params.toString();
        return `/api/sigorta-teklif/excel${query ? `?${query}` : ""}`;
    }, [searchParams]);

    const handlePickSuggestion = React.useCallback((suggestion: TeklifSuggestion) => {
        setFormData((current) => ({
            ...current,
            aracId: suggestion.aracId,
            tur: suggestion.tur,
            acente: suggestion.acente || "",
            sigortaSirketi: suggestion.sigortaSirketi || "",
            policeNo: suggestion.policeNo || "",
            baslangicTarihi: toDateTimeLocalInput(suggestion.baslangicTarihi) || current.baslangicTarihi,
            bitisTarihi: toDateTimeLocalInput(suggestion.bitisTarihi) || current.bitisTarihi,
            teklifTutar: suggestion.teklifTutar > 0 ? String(suggestion.teklifTutar) : current.teklifTutar,
        }));
    }, []);

    const handleCreate = React.useCallback(async () => {
        if (!formData.aracId) {
            toast.warning("Araç seçimi zorunlu.");
            return;
        }
        const teklifTutar = Number(formData.teklifTutar);
        if (!Number.isFinite(teklifTutar) || teklifTutar <= 0) {
            toast.warning("Teklif tutarını kontrol edin.");
            return;
        }

        setLoading(true);
        const result = await createSigortaTeklif({
            aracId: formData.aracId,
            tur: formData.tur,
            acente: formData.acente || undefined,
            sigortaSirketi: formData.sigortaSirketi || undefined,
            policeNo: formData.policeNo || undefined,
            baslangicTarihi: formData.baslangicTarihi,
            bitisTarihi: formData.bitisTarihi,
            teklifTutar,
            notlar: formData.notlar || undefined,
        });
        setLoading(false);

        if (!result.success) {
            toast.error("Teklif oluşturulamadı", { description: result.error });
            return;
        }

        toast.success("Teklif kaydedildi.");
        setFormData(getDefaultFormData());
        router.refresh();
    }, [formData, router]);

    const handleStatusUpdate = React.useCallback(
        async (id: string, durum: SigortaTeklifDurum) => {
            setLoading(true);
            const result = await updateSigortaTeklifDurum(id, durum);
            setLoading(false);

            if (!result.success) {
                toast.error("Durum güncellenemedi", { description: result.error });
                return;
            }
            toast.success("Teklif durumu güncellendi.");
            router.refresh();
        },
        [router]
    );

    const handleDelete = React.useCallback(
        async (id: string) => {
            if (!window.confirm("Bu teklif kaydını silmek istiyor musunuz?")) return;
            setLoading(true);
            const result = await deleteSigortaTeklif(id);
            setLoading(false);

            if (!result.success) {
                toast.error("Teklif silinemedi", { description: result.error });
                return;
            }
            toast.success("Teklif silindi.");
            router.refresh();
        },
        [router]
    );

    const handleExport = React.useCallback(async () => {
        if (loading || isExporting || isImporting) return;
        setIsExporting(true);
        try {
            const response = await fetch(endpoint, { method: "GET" });
            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Excel dışa aktarma başarısız oldu."));
            }

            const blob = await response.blob();
            const fallback = `sigorta-teklif-${new Date().toISOString().slice(0, 10)}.xlsx`;
            const fileName = getDownloadFileName(response.headers.get("content-disposition"), fallback);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Teklif Excel dışa aktarma tamamlandı.");
        } catch (error) {
            toast.error("Excel dışa aktarma başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            });
        } finally {
            setIsExporting(false);
        }
    }, [endpoint, isExporting, isImporting, loading]);

    const handleImportFileChange = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setIsImporting(true);
            try {
                const payload = new FormData();
                payload.append("file", file);
                const response = await fetch(endpoint, { method: "POST", body: payload });
                const json = await response.json().catch(() => null);
                if (!response.ok) {
                    const message =
                        typeof json?.error === "string" && json.error.trim()
                            ? json.error
                            : "Excel içe aktarma başarısız oldu.";
                    throw new Error(message);
                }

                toast.success("Excel içe aktarma tamamlandı.", {
                    description: `Toplam ${json?.total ?? 0} satır işlendi • ${json?.created ?? 0} eklendi • ${json?.updated ?? 0} güncellendi • ${json?.skipped ?? 0} atlandı`,
                });
                router.refresh();
            } catch (error) {
                toast.error("Excel içe aktarma başarısız.", {
                    description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
                });
            } finally {
                event.target.value = "";
                setIsImporting(false);
            }
        },
        [endpoint, router]
    );

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFileChange}
            />

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900">Teklif Ekranı</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={loading || isExporting || isImporting}
                        className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Dışa Aktar
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || isImporting || isExporting}
                        className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                        {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        İçe Aktar
                    </Button>
                </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
                Poliçe yenileme tekliflerini kaydedin, karşılaştırın ve onay sürecini buradan yürütün.
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <select
                        value={formData.aracId}
                        onChange={(event) => setFormData((current) => ({ ...current, aracId: event.target.value }))}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                        disabled={loading}
                    >
                        <option value="">Araç seçiniz</option>
                        {aracOptions.map((arac) => (
                            <option key={arac.id} value={arac.id}>
                                {arac.plaka} - {arac.marka} {arac.model}
                            </option>
                        ))}
                    </select>
                    <select
                        value={formData.tur}
                        onChange={(event) => setFormData((current) => ({ ...current, tur: event.target.value as SigortaTeklifTur }))}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                        disabled={loading}
                    >
                        <option value="KASKO">Kasko</option>
                        <option value="TRAFIK">Trafik</option>
                    </select>
                    <Input
                        value={formData.acente}
                        onChange={(event) => setFormData((current) => ({ ...current, acente: event.target.value }))}
                        placeholder="Acente"
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <Input
                        value={formData.sigortaSirketi}
                        onChange={(event) => setFormData((current) => ({ ...current, sigortaSirketi: event.target.value }))}
                        placeholder="Sigorta Şirketi"
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <Input
                        value={formData.policeNo}
                        onChange={(event) => setFormData((current) => ({ ...current, policeNo: event.target.value }))}
                        placeholder="Poliçe No"
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <Input
                        type="datetime-local"
                        value={formData.baslangicTarihi}
                        onChange={(event) => setFormData((current) => ({ ...current, baslangicTarihi: event.target.value }))}
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <Input
                        type="datetime-local"
                        value={formData.bitisTarihi}
                        onChange={(event) => setFormData((current) => ({ ...current, bitisTarihi: event.target.value }))}
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <Input
                        type="number"
                        value={formData.teklifTutar}
                        onChange={(event) => setFormData((current) => ({ ...current, teklifTutar: event.target.value }))}
                        placeholder="Teklif Tutarı"
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                </div>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                    <Input
                        value={formData.notlar}
                        onChange={(event) => setFormData((current) => ({ ...current, notlar: event.target.value }))}
                        placeholder="Notlar (opsiyonel)"
                        className="h-9 bg-white"
                        disabled={loading}
                    />
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={loading}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        <Plus size={14} />
                        Teklif Ekle
                    </button>
                </div>
            </div>

            {queueSuggestions.length > 0 ? (
                <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Öncelik Kuyruğundan Hızlı Doldur</p>
                    <div className="flex flex-wrap gap-1.5">
                        {queueSuggestions.slice(0, 8).map((item, index) => (
                            <button
                                key={`${item.aracId}-${item.tur}-${index}`}
                                type="button"
                                onClick={() => handlePickSuggestion(item)}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                {item.plaka} • {item.tur}
                                <ArrowRight size={10} />
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[11px] text-slate-500">
                            <th className="py-1 pr-2">Araç</th>
                            <th className="py-1 pr-2">Tür</th>
                            <th className="py-1 pr-2">Acente</th>
                            <th className="py-1 pr-2">Tutar</th>
                            <th className="py-1 pr-2">Bitiş</th>
                            <th className="py-1 pr-2">Durum</th>
                            <th className="py-1 pr-2 text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teklifRows.length > 0 ? (
                            teklifRows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100 text-xs">
                                    <td className="py-2 pr-2">
                                        <p className="font-semibold text-slate-800">
                                            <Link
                                                href={`/dashboard/araclar/${row.aracId}`}
                                                className="underline-offset-2 hover:text-indigo-700 hover:underline"
                                            >
                                                {row.plaka}
                                            </Link>
                                        </p>
                                        <p className="text-[11px] text-slate-500">{row.markaModel}</p>
                                    </td>
                                    <td className="py-2 pr-2 text-slate-700">{row.tur}</td>
                                    <td className="py-2 pr-2 text-slate-700">{row.acente || "-"}</td>
                                    <td className="py-2 pr-2 text-slate-700">{formatCurrency(row.teklifTutar)}</td>
                                    <td className="py-2 pr-2 text-slate-700">{formatDate(row.bitisTarihi)}</td>
                                    <td className="py-2 pr-2">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${getDurumBadge(row.durum)}`}>
                                            {row.durum}
                                        </span>
                                    </td>
                                    <td className="py-2 pr-2">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleStatusUpdate(row.id, "ONAYLANDI")}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                title="Onayla"
                                                disabled={loading}
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleStatusUpdate(row.id, "REDDEDILDI")}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                title="Reddet"
                                                disabled={loading}
                                            >
                                                <XCircle size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(row.id)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                                title="Sil"
                                                disabled={loading}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="py-5 text-center text-xs text-slate-500">
                                    Henüz teklif kaydı bulunmuyor.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
