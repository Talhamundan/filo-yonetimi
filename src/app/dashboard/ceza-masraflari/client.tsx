"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { CezaMasrafRow, getColumns } from "./columns";
import { createCezaMasraf, deleteCezaMasraf, updateCezaMasraf } from "./actions";
import { sortByTextValue } from "@/lib/sort-utils";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { formatAracOptionLabel } from "@/lib/arac-option-label";

const todayDate = () => nowDateTimeLocal();
const oneMonthAfter = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return toDateTimeLocalInput(date);
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
    plaka: string | null;
    marka?: string | null;
    model?: string | null;
    durum?: string | null;
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
    const soforIdSet = React.useMemo(() => new Set(soforler.map((sofor) => sofor.id)), [soforler]);

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Arac (Plaka) <span className="text-red-500">*</span></label>
                <SearchableSelect
                    value={formData.aracId}
                    onValueChange={(value) => {
                        const selected = araclar.find((a) => a.id === value);
                        setFormData((prev) => ({
                            ...prev,
                            aracId: value,
                            soforId: autoAssignFromArac
                                ? (selected?.aktifSoforId && soforIdSet.has(selected.aktifSoforId) ? selected.aktifSoforId : "")
                                : prev.soforId,
                        }));
                    }}
                    placeholder="Seciniz..."
                    searchPlaceholder="Plaka / araç ara..."
                    options={[
                        { value: "", label: "Seciniz..." },
                        ...araclar.map((a) => ({
                            value: a.id,
                            label: formatAracOptionLabel(a),
                            searchText: [a.plaka, a.marka, a.model].filter(Boolean).join(" "),
                        })),
                    ]}
                />
                <SelectedAracInfo arac={selectedArac} />
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Sofor (Opsiyonel)</label>
                <SearchableSelect
                    value={formData.soforId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, soforId: value }))}
                    placeholder="Atanmamis"
                    searchPlaceholder="Personel ara..."
                    options={[
                        { value: "", label: "Atanmamis" },
                        ...soforler.map((s) => ({
                            value: s.id,
                            label: s.adSoyad,
                            searchText: s.adSoyad,
                        })),
                    ]}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ceza Tarihi <span className="text-red-500">*</span></label>
                    <Input
                        type="datetime-local"
                        value={formData.tarih}
                        onChange={(e) => setFormData((prev) => ({ ...prev, tarih: e.target.value }))}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Son Odeme Tarihi</label>
                    <Input
                        type="datetime-local"
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
    const soforIdSet = useMemo(() => new Set(sortedSoforler.map((sofor) => sofor.id)), [sortedSoforler]);

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
            soforId: row.soforId && soforIdSet.has(row.soforId) ? row.soforId : "",
            tarih: row.tarih ? toDateTimeLocalInput(row.tarih) : todayDate(),
            sonOdemeTarihi: row.sonOdemeTarihi ? toDateTimeLocalInput(row.sonOdemeTarihi) : "",
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
