"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { RowActionButton } from "@/components/ui/row-action-button";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { createStokKalem, deleteStokKalem, updateStokKalem } from "./actions";
import { getColumns, type StokKalemRow } from "./columns";
import { stokBirimleri, stokKalemFormSchema, type StokKalemFormValues } from "./schema";

const EMPTY_FORM: StokKalemFormValues = {
    ad: "",
    kategori: "",
    miktar: 0,
    birim: "ADET",
    konum: "",
    kritikSeviye: null,
    aciklama: "",
    sirketId: "",
};

type StokTakibiClientProps = {
    initialRows: StokKalemRow[];
    sirketler: Array<{ id: string; ad: string }>;
    canManage: boolean;
    defaultSirketId?: string | null;
    selectedScopeSirketId?: string | null;
    selectedScopeSirketAd?: string | null;
};

function parseNumberInput(value: string) {
    if (!value || value.trim().length === 0) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function FormFields({
    formData,
    setFormData,
    showCompanySelect,
    fixedCompanyName,
    sirketler,
}: {
    formData: StokKalemFormValues;
    setFormData: React.Dispatch<React.SetStateAction<StokKalemFormValues>>;
    showCompanySelect: boolean;
    fixedCompanyName?: string | null;
    sirketler: Array<{ id: string; ad: string }>;
}) {
    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Stok Adı <span className="text-rose-500">*</span></label>
                <Input
                    value={formData.ad}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ad: e.target.value }))}
                    placeholder="MOTOR YAĞI 10W40"
                    className="h-9"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kategori</label>
                    <Input
                        value={formData.kategori || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, kategori: e.target.value }))}
                        placeholder="YAĞ / LASTİK / FİLTRE"
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Stok Yeri</label>
                    <Input
                        value={formData.konum || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, konum: e.target.value }))}
                        placeholder="BURSA MERKEZ DEPO"
                        className="h-9"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Adet <span className="text-rose-500">*</span></label>
                    <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(formData.miktar ?? 0)}
                        onChange={(e) => setFormData((prev) => ({ ...prev, miktar: Number(e.target.value || 0) }))}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Birim</label>
                    <select
                        value={formData.birim}
                        onChange={(e) => setFormData((prev) => ({ ...prev, birim: e.target.value as StokKalemFormValues["birim"] }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        {stokBirimleri.map((birim) => (
                            <option key={birim} value={birim}>{birim}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kritik Seviye</label>
                    <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={formData.kritikSeviye == null ? "" : String(formData.kritikSeviye)}
                        onChange={(e) => setFormData((prev) => ({ ...prev, kritikSeviye: parseNumberInput(e.target.value) }))}
                        placeholder="Örn: 5"
                        className="h-9"
                    />
                </div>
            </div>

            {showCompanySelect ? (
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Şirket <span className="text-rose-500">*</span></label>
                    <select
                        value={formData.sirketId || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sirketId: e.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Şirket seçiniz</option>
                        {sirketler.map((sirket) => (
                            <option key={sirket.id} value={sirket.id}>{sirket.ad}</option>
                        ))}
                    </select>
                </div>
            ) : fixedCompanyName ? (
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Şirket</label>
                    <Input value={fixedCompanyName} readOnly className="h-9 bg-slate-50 text-slate-700" />
                </div>
            ) : null}

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Açıklama</label>
                <Input
                    value={formData.aciklama || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aciklama: e.target.value }))}
                    placeholder="Parça markası, raf bilgisi, notlar..."
                    className="h-9"
                />
            </div>
        </div>
    );
}

export default function StokTakibiClient({
    initialRows,
    sirketler,
    canManage,
    defaultSirketId,
    selectedScopeSirketId,
    selectedScopeSirketAd,
}: StokTakibiClientProps) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const showCompanyInfo = canAccessAllCompanies;
    const forcedScopeSirketId = selectedScopeSirketId || null;
    const showCompanySelect = canAccessAllCompanies && !forcedScopeSirketId;

    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<StokKalemRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<StokKalemFormValues>({
        ...EMPTY_FORM,
        sirketId: forcedScopeSirketId || defaultSirketId || "",
    });

    const columns = useMemo(() => {
        const base = getColumns(showCompanyInfo);
        if (!canManage) return base;

        return [
            ...base,
            {
                id: "actions",
                header: "İşlemler",
                cell: ({ row }: { row: { original: StokKalemRow } }) => (
                    <div className="flex items-center gap-2">
                        <RowActionButton variant="edit" onClick={() => handleEdit(row.original)} />
                        <RowActionButton variant="delete" onClick={() => handleDelete(row.original)} />
                    </div>
                ),
            },
        ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCompanyInfo, canManage]);

    const resetForm = () => {
        setFormData({
            ...EMPTY_FORM,
            sirketId: forcedScopeSirketId || defaultSirketId || "",
        });
    };

    const validate = () => {
        const result = stokKalemFormSchema.safeParse(formData);
        if (result.success) return result.data;
        toast.warning("Eksik veya hatalı bilgi", {
            description: result.error.issues[0]?.message || "Lütfen form alanlarını kontrol edin.",
        });
        return null;
    };

    const handleCreate = async () => {
        const parsed = validate();
        if (!parsed) return;
        const payload: StokKalemFormValues = {
            ...parsed,
            sirketId: forcedScopeSirketId || parsed.sirketId || defaultSirketId || "",
        };

        setLoading(true);
        const response = await createStokKalem(payload);
        setLoading(false);

        if (response.success) {
            toast.success("Stok kalemi kaydedildi.");
            setCreateOpen(false);
            resetForm();
            router.refresh();
            return;
        }

        toast.error("Kayıt başarısız", { description: response.error });
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        const parsed = validate();
        if (!parsed) return;
        const payload: StokKalemFormValues = {
            ...parsed,
            sirketId: forcedScopeSirketId || parsed.sirketId || defaultSirketId || "",
        };

        setLoading(true);
        const response = await updateStokKalem(editRow.id, payload);
        setLoading(false);

        if (response.success) {
            toast.success((response as any).pendingApproval ? "Talep Admin Onayına Gönderildi" : "Stok kalemi güncellendi.", {
                description: (response as any).message,
            });
            setEditRow(null);
            resetForm();
            router.refresh();
            return;
        }

        toast.error("Güncelleme başarısız", { description: response.error });
    };

    const handleDelete = async (row: StokKalemRow) => {
        const confirmed = await openConfirm({
            title: "Stok kalemini sil",
            message: `${row.ad} kaydını silmek istediğinizden emin misiniz?`,
            confirmText: "Evet, sil",
            variant: "danger",
        });
        if (!confirmed) return;

        const response = await deleteStokKalem(row.id);
        if (response.success) {
            toast.success((response as any).pendingApproval ? "Talep Admin Onayına Gönderildi" : "Stok kalemi silindi.", {
                description: (response as any).message,
            });
            router.refresh();
            return;
        }

        toast.error("Silme işlemi başarısız", { description: response.error });
    };

    const handleEdit = (row: StokKalemRow) => {
        const normalizedBirim = String(row.birim || "ADET").toLocaleUpperCase("tr-TR");
        const birim = (stokBirimleri as readonly string[]).includes(normalizedBirim)
            ? (normalizedBirim as StokKalemFormValues["birim"])
            : "ADET";
        setFormData({
            ad: row.ad,
            kategori: row.kategori || "",
            miktar: row.miktar,
            birim,
            konum: row.konum || "",
            kritikSeviye: row.kritikSeviye,
            aciklama: row.aciklama || "",
            sirketId: forcedScopeSirketId || row.sirketId || defaultSirketId || "",
        });
        setEditRow(row);
    };

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            {confirmModal}
            <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                        <Package className="text-indigo-600" /> Stok Takibi
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Motor yağı, lastik ve yedek parça stoklarınızı takip edin.</p>
                </div>

                {canManage ? (
                    <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                            setCreateOpen(open);
                            if (!open) resetForm();
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700">
                                <Plus size={16} /> Stok Kalemi Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Stok Kalemi</DialogTitle>
                                <DialogDescription>Depodaki yedek parça veya sarf malzemeyi sisteme ekleyin.</DialogDescription>
                            </DialogHeader>
                            <FormFields
                                formData={formData}
                                setFormData={setFormData}
                                showCompanySelect={showCompanySelect}
                                fixedCompanyName={selectedScopeSirketAd || null}
                                sirketler={sirketler}
                            />
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                ) : null}
            </header>

            <Dialog
                open={Boolean(editRow)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditRow(null);
                        resetForm();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Stok Kalemini Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.ad} kaydını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        showCompanySelect={showCompanySelect}
                        fixedCompanyName={selectedScopeSirketAd || null}
                        sirketler={sirketler}
                    />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={loading}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columns as any}
                data={initialRows}
                searchKey="ad"
                searchPlaceholder="Stok adı, kategori veya konum ara..."
                excelEntity="stokKalem"
            />
        </div>
    );
}
