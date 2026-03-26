"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { CezaMasrafRow, getColumns } from "./columns";
import { createCezaMasraf, deleteCezaMasraf, updateCezaMasraf } from "./actions";
import { sortByTextValue } from "@/lib/sort-utils";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";

const todayDate = () => new Date().toISOString().slice(0, 10);
const oneMonthAfter = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
};

const EMPTY = {
    aracId: "",
    soforId: "",
    tarih: todayDate(),
    sonOdemeTarihi: oneMonthAfter(),
    cezaMaddesi: "",
    tutar: "",
    km: "",
    aciklama: "",
    odendiMi: false,
};

type AracOption = {
    id: string;
    plaka: string;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
};
type SoforOption = { id: string; adSoyad: string };

function FormFields({
    formData,
    setFormData,
    araclar,
    soforler,
    autoAssignFromArac = false,
}: {
    formData: typeof EMPTY;
    setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY>>;
    araclar: (AracOption & { aktifSoforId?: string | null; aktifSoforAdSoyad?: string | null })[];
    soforler: SoforOption[];
    autoAssignFromArac?: boolean;
}) {
    const selectedArac = araclar.find((a) => a.id === formData.aracId);
    const hasActiveSofor = Boolean(autoAssignFromArac && selectedArac?.aktifSoforId);

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Arac (Plaka) <span className="text-red-500">*</span></label>
                <select
                    value={formData.aracId}
                    onChange={(e) => {
                        const selected = araclar.find((a) => a.id === e.target.value);
                        setFormData((prev) => ({
                            ...prev,
                            aracId: e.target.value,
                            soforId: autoAssignFromArac ? selected?.aktifSoforId || "" : prev.soforId,
                        }));
                    }}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Seciniz...</option>
                    {araclar.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.plaka}
                        </option>
                    ))}
                </select>
                <SelectedAracInfo arac={selectedArac} />
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Sofor (Opsiyonel)</label>
                {hasActiveSofor ? (
                    <div className="space-y-1">
                        <Input value={selectedArac?.aktifSoforAdSoyad || "-"} disabled className="h-9" />
                        <p className="text-[11px] text-emerald-700 font-medium">Aktif sofor otomatik secildi.</p>
                    </div>
                ) : (
                    <select
                        value={formData.soforId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, soforId: e.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Atanmamis</option>
                        {soforler.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.adSoyad}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ceza Tarihi <span className="text-red-500">*</span></label>
                    <Input
                        type="date"
                        value={formData.tarih}
                        onChange={(e) => setFormData((prev) => ({ ...prev, tarih: e.target.value }))}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Son Odeme Tarihi</label>
                    <Input
                        type="date"
                        value={formData.sonOdemeTarihi}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sonOdemeTarihi: e.target.value }))}
                        className="h-9"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                    <Input
                        type="number"
                        step="0.01"
                        value={formData.tutar}
                        onChange={(e) => setFormData((prev) => ({ ...prev, tutar: e.target.value }))}
                        className="h-9"
                        placeholder="0.00"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ceza Anindaki KM</label>
                    <Input
                        type="number"
                        value={formData.km}
                        onChange={(e) => setFormData((prev) => ({ ...prev, km: e.target.value }))}
                        className="h-9"
                        placeholder="123456"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ceza Maddesi <span className="text-red-500">*</span></label>
                <Input
                    value={formData.cezaMaddesi}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cezaMaddesi: e.target.value }))}
                    className="h-9"
                    placeholder="Orn: Hiz siniri asimi"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Aciklama</label>
                <Input
                    value={formData.aciklama}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aciklama: e.target.value }))}
                    className="h-9"
                    placeholder="Opsiyonel not"
                />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                    type="checkbox"
                    checked={formData.odendiMi}
                    onChange={(e) => setFormData((prev) => ({ ...prev, odendiMi: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                />
                Bu ceza odendi mi?
            </label>
        </div>
    );
}

export default function CezaMasraflariClient({
    initialData,
    araclar,
    soforler,
}: {
    initialData: CezaMasrafRow[];
    araclar: (AracOption & { aktifSoforId?: string | null; aktifSoforAdSoyad?: string | null })[];
    soforler: SoforOption[];
}) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<CezaMasrafRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const sortedAraclar = useMemo(() => sortByTextValue(araclar, (a) => a.plaka), [araclar]);
    const sortedSoforler = useMemo(() => sortByTextValue(soforler, (s) => s.adSoyad), [soforler]);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.tarih || !formData.cezaMaddesi || !formData.tutar) {
            return toast.warning("Eksik Bilgi", {
                description: "Arac, ceza tarihi, ceza maddesi ve tutar zorunludur.",
            });
        }

        setLoading(true);
        const res = await createCezaMasraf({
            aracId: formData.aracId,
            soforId: formData.soforId || null,
            tarih: formData.tarih,
            cezaMaddesi: formData.cezaMaddesi,
            tutar: Number(formData.tutar),
            km: formData.km ? Number(formData.km) : null,
            sonOdemeTarihi: formData.sonOdemeTarihi || null,
            odendiMi: formData.odendiMi,
            aciklama: formData.aciklama || null,
        });
        setLoading(false);

        if (!res.success) {
            return toast.error("Kayit Hatasi", { description: res.error });
        }

        setCreateOpen(false);
        setFormData({ ...EMPTY });
        toast.success("Ceza masraf kaydi olusturuldu.");
        router.refresh();
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if (!formData.aracId || !formData.tarih || !formData.cezaMaddesi || !formData.tutar) {
            return toast.warning("Eksik Bilgi", {
                description: "Arac, ceza tarihi, ceza maddesi ve tutar zorunludur.",
            });
        }

        setLoading(true);
        const res = await updateCezaMasraf(editRow.id, {
            aracId: formData.aracId,
            soforId: formData.soforId || null,
            tarih: formData.tarih,
            cezaMaddesi: formData.cezaMaddesi,
            tutar: Number(formData.tutar),
            km: formData.km ? Number(formData.km) : null,
            sonOdemeTarihi: formData.sonOdemeTarihi || null,
            odendiMi: formData.odendiMi,
            aciklama: formData.aciklama || null,
        });
        setLoading(false);

        if (!res.success) {
            return toast.error("Guncelleme Hatasi", { description: res.error });
        }

        setEditRow(null);
        toast.success("Ceza masraf kaydi guncellendi.");
        router.refresh();
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({
            title: "Kaydi Sil",
            message: "Bu ceza kaydini silmek istediginizden emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;

        const res = await deleteCezaMasraf(id);
        if (!res.success) {
            return toast.error("Silme Hatasi", { description: res.error });
        }
        toast.success("Kayit silindi.");
        router.refresh();
    };

    const openEdit = (row: CezaMasrafRow) => {
        setFormData({
            aracId: row.aracId || "",
            soforId: row.soforId || "",
            tarih: row.tarih ? new Date(row.tarih).toISOString().slice(0, 10) : todayDate(),
            sonOdemeTarihi: row.sonOdemeTarihi ? new Date(row.sonOdemeTarihi).toISOString().slice(0, 10) : "",
            cezaMaddesi: row.cezaMaddesi || "",
            tutar: String(row.tutar || ""),
            km: row.km != null ? String(row.km) : "",
            aciklama: row.aciklama || "",
            odendiMi: Boolean(row.odendiMi),
        });
        setEditRow(row);
    };

    const columnsWithActions: ColumnDef<CezaMasrafRow>[] = [
        ...getColumns(canAccessAllCompanies),
        {
            id: "islemler",
            header: "Islemler",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id)} />
                </div>
            ),
        },
    ];

    return (
        <>
            {confirmModal}
            <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="text-rose-600" /> Ceza Masraflari
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Yakit ve HGS gibi, ceza odemelerini de finans kalemi olarak takip edin.
                        </p>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <button className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                                <Plus size={16} />
                                Ceza Masrafi Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[460px]">
                            <DialogHeader>
                                <DialogTitle>Yeni Ceza Masraf Kaydi</DialogTitle>
                                <DialogDescription>Arac, ceza ve odeme bilgilerini girerek kaydi olusturun.</DialogDescription>
                            </DialogHeader>
                            <FormFields
                                formData={formData}
                                setFormData={setFormData}
                                araclar={sortedAraclar}
                                soforler={sortedSoforler}
                                autoAssignFromArac
                            />
                            <DialogFooter>
                                <button
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                                >
                                    {loading ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </header>

                <DataTable
                    columns={columnsWithActions}
                    data={initialData}
                    searchKey="arac_plaka"
                    searchPlaceholder="Plakaya gore ceza kaydi ara..."
                    toolbarArrangement="report-right-scroll"
                    serverFiltering={{
                        statusOptions: [
                            { value: "ODENDI", label: "Ödendi" },
                            { value: "ODENMEDI", label: "Ödenmedi" },
                            { value: "YAKLASIYOR", label: "Yaklaşıyor" },
                            { value: "GECIKTI", label: "Gecikti" },
                        ],
                        showDateRange: true,
                    }}
                    excelEntity="ceza"
                />

                <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
                    <DialogContent className="sm:max-w-[460px]">
                        <DialogHeader>
                            <DialogTitle>Ceza Masraf Kaydini Duzenle</DialogTitle>
                            <DialogDescription>Kaydi guncelleyip tekrar kaydedin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={sortedAraclar} soforler={sortedSoforler} />
                        <DialogFooter>
                            <button
                                onClick={handleUpdate}
                                disabled={loading}
                                className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                            >
                                {loading ? "Guncelleniyor..." : "Guncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
