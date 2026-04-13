"use client"

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ClipboardCheck } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, SoforZimmetRow } from "./columns";
import { useRouter } from "next/navigation";
import { createZimmet, deleteZimmet, finalizeZimmet, updateZimmet } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { sortByTextValue } from "@/lib/sort-utils";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { getPersonelDisplayName, getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { SearchableSelect } from "@/components/ui/searchable-select";

const EMPTY = {
    aracId: '',
    kullaniciId: '',
    baslangic: nowDateTimeLocal(),
    baslangicKm: 0,
    notlar: ''
};

const EMPTY_EDIT = {
    baslangic: '',
    bitis: '',
    baslangicKm: '',
    bitisKm: '',
    notlar: ''
};

const EMPTY_FINALIZE = {
    bitis: nowDateTimeLocal(),
    bitisKm: '',
    notlar: '',
};

export default function ZimmetlerClient({ 
    initialZimmetler, 
    araclar, 
    kullanicilar,
    isTeknik = false,
}: { 
    initialZimmetler: SoforZimmetRow[], 
    araclar: { id: string, plaka: string | null, marka?: string | null, model?: string | null, durum?: string | null, bulunduguIl?: string | null, guncelKm: number }[],
    kullanicilar: { id: string, adSoyad: string; sirketAd?: string | null; calistigiKurum?: string | null }[],
    isTeknik?: boolean;
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [editRow, setEditRow] = useState<SoforZimmetRow | null>(null);
    const [editFormData, setEditFormData] = useState({ ...EMPTY_EDIT });
    const [finalizeRow, setFinalizeRow] = useState<SoforZimmetRow | null>(null);
    const [finalizeFormData, setFinalizeFormData] = useState({ ...EMPTY_FINALIZE });
    const [loading, setLoading] = useState(false);
    const sortedAraclar = useMemo(() => sortByTextValue(araclar, (a) => a.plaka), [araclar]);
    const sortedKullanicilar = useMemo(() => sortByTextValue(kullanicilar, (k) => k.adSoyad), [kullanicilar]);
    const selectedArac = araclar.find((a) => a.id === formData.aracId);
    const activeZimmetler = useMemo(
        () => initialZimmetler.filter((row) => !row.bitis),
        [initialZimmetler]
    );
    const activeZimmetByAracId = useMemo(() => {
        const map = new Map<string, SoforZimmetRow>();
        activeZimmetler.forEach((row) => {
            map.set(row.arac.id, row);
        });
        return map;
    }, [activeZimmetler]);
    const activeZimmetByKullaniciId = useMemo(() => {
        const map = new Map<string, SoforZimmetRow>();
        activeZimmetler.forEach((row) => {
            if (row.kullanici?.id) {
                map.set(row.kullanici.id, row);
            }
        });
        return map;
    }, [activeZimmetler]);
    const aracKmById = useMemo(() => {
        const map = new Map<string, number>();
        araclar.forEach((row) => map.set(row.id, row.guncelKm || 0));
        return map;
    }, [araclar]);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.kullaniciId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Araç ve Personel alanlarını seçin." });
        }
        const personelAktifZimmet = activeZimmetByKullaniciId.get(formData.kullaniciId);
        if (personelAktifZimmet && personelAktifZimmet.arac.id !== formData.aracId) {
            return toast.warning("İşlem Başarısız", { description: "Personele zimmetli araç mevcut." });
        }
        const aracAktifZimmet = activeZimmetByAracId.get(formData.aracId);
        if (aracAktifZimmet && aracAktifZimmet.kullanici?.id !== formData.kullaniciId) {
            return toast.warning("İşlem Başarısız", { description: "Araç için aktif zimmet mevcut." });
        }
        if (
            personelAktifZimmet &&
            aracAktifZimmet &&
            personelAktifZimmet.arac.id === formData.aracId &&
            aracAktifZimmet.kullanici?.id === formData.kullaniciId
        ) {
            return toast.warning("İşlem Başarısız", { description: "Bu araç zaten seçili personele aktif zimmetli." });
        }
        setLoading(true);
        const res = await createZimmet(formData);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Zimmet Tanımlandı", { description: "Araç ilgili personele başarıyla zimmetlendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const openEdit = (row: SoforZimmetRow) => {
        setEditFormData({
            baslangic: toDateTimeLocalInput(row.baslangic),
            bitis: row.bitis ? toDateTimeLocalInput(row.bitis) : '',
            baslangicKm: String(row.baslangicKm || ''),
            bitisKm: row.bitisKm ? String(row.bitisKm) : '',
            notlar: row.notlar || ''
        });
        setEditRow(row);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if (!editFormData.baslangic || !editFormData.baslangicKm) {
            return toast.warning("Eksik Bilgi", { description: "Başlangıç tarihi ve başlangıç KM zorunludur." });
        }
        if (editFormData.bitis && new Date(editFormData.bitis) < new Date(editFormData.baslangic)) {
            return toast.warning("Tarih Hatası", { description: "Bitiş tarihi, başlangıç tarihinden önce olamaz." });
        }

        setLoading(true);
        const res = await updateZimmet(editRow.id, {
            baslangic: editFormData.baslangic,
            bitis: editFormData.bitis || null,
            baslangicKm: Number(editFormData.baslangicKm),
            bitisKm: editFormData.bitisKm ? Number(editFormData.bitisKm) : null,
            notlar: editFormData.notlar || null
        });
        if (res.success) {
            const otomatikSonlandi =
                !editRow.bitis &&
                !editFormData.bitis &&
                !!editFormData.bitisKm;
            setEditRow(null);
            setEditFormData({ ...EMPTY_EDIT });
            if (otomatikSonlandi) {
                toast.success("Zimmet Sonlandırıldı", { description: "İade KM girildiği için kayıt otomatik sonlandırıldı ve araç personelden ayrıldı." });
            } else {
                toast.success("Zimmet Güncellendi", { description: "Zimmet geçmişi kaydı başarıyla güncellendi." });
            }
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const openFinalize = (row: SoforZimmetRow) => {
        setFinalizeRow(row);
        const defaultKm = aracKmById.get(row.arac.id);
        setFinalizeFormData({
            bitis: nowDateTimeLocal(),
            bitisKm: defaultKm !== undefined ? String(defaultKm) : (row.baslangicKm ? String(row.baslangicKm) : ""),
            notlar: row.notlar || "",
        });
    };

    const handleFinalize = async () => {
        if (!finalizeRow) return;
        if (!finalizeFormData.bitis || !finalizeFormData.bitisKm) {
            return toast.warning("Eksik Bilgi", { description: "İade tarihi ve iade KM zorunludur." });
        }

        setLoading(true);
        const res = await finalizeZimmet(finalizeRow.id, {
            bitis: finalizeFormData.bitis,
            bitisKm: Number(finalizeFormData.bitisKm),
            notlar: finalizeFormData.notlar || null,
        });
        if (res.success) {
            toast.success("Zimmet Sonlandırıldı", { description: "Araç personelden ayrıldı ve zimmet kaydı kapatıldı." });
            setFinalizeRow(null);
            setFinalizeFormData({ ...EMPTY_FINALIZE });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: "Bu zimmet kaydını silmek istediğinizden emin misiniz? Bu işlem sadece geçmiş kaydı siler, aracın mevcut şoförünü değiştirmez.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteZimmet(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Zimmet geçmişi kaydı sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const handleAracChange = (aracId: string) => {
        const selectedArac = araclar.find(a => a.id === aracId);
        setFormData({
            ...formData,
            aracId,
            baslangicKm: selectedArac ? selectedArac.guncelKm : 0
        });
    };

    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies, isTeknik),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => !row.original.bitis && openFinalize(row.original)}
                        disabled={!!row.original.bitis}
                        className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${
                            row.original.bitis
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                    >
                        {row.original.bitis ? "Sonlandırıldı" : "Sonlandır"}
                    </button>
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id)} />
                </div>
            )
        }
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <ClipboardCheck className="text-indigo-600" /> Zimmet Geçmişi ve Kayıtları
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Filo dahilindeki tüm geçmiş ve aktif araç-şoför atamalarının listesi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={(v) => {
                    setCreateOpen(v);
                    if (!v) setFormData({ ...EMPTY });
                }}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Zimmet Tanımla
                        </button>
                    </DialogTrigger>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Yeni Zimmet Kaydı</DialogTitle>
                            <DialogDescription>
                                Aracı bir şoföre atayın. Aktif zimmet varsa önce mevcut kaydı kapatın.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    value={formData.aracId} 
                                    onValueChange={handleAracChange}
                                    placeholder="Seçiniz..."
                                    searchPlaceholder="Plaka / araç ara..."
                                    options={[
                                        { value: "", label: "Seçiniz..." },
                                        ...sortedAraclar.map((a) => ({
                                            value: a.id,
                                            label: formatAracOptionLabel(a),
                                            searchText: [a.plaka, a.marka, a.model].filter(Boolean).join(" "),
                                        })),
                                    ]}
                                />
                                <SelectedAracInfo arac={selectedArac} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Personel / Şoför <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    value={formData.kullaniciId} 
                                    onValueChange={(value) => setFormData({ ...formData, kullaniciId: value })}
                                    placeholder="Seçiniz..."
                                    searchPlaceholder="Personel ara..."
                                    options={[
                                        { value: "", label: "Seçiniz..." },
                                        ...sortedKullanicilar.map((k) => ({
                                            value: k.id,
                                            label: getPersonelOptionLabel(k),
                                            searchText: getPersonelOptionSearchText(k),
                                        })),
                                    ]}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Teslim Tarihi</label>
                                    <Input type="datetime-local" value={formData.baslangic} onChange={e => setFormData({...formData, baslangic: e.target.value})} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Teslim KM</label>
                                    <Input type="number" value={formData.baslangicKm} onChange={e => setFormData({...formData, baslangicKm: parseInt(e.target.value)})} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Notlar</label>
                                <Input value={formData.notlar} onChange={e => setFormData({...formData, notlar: e.target.value})} placeholder="Örn: Yedek anahtar teslim edildi" className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Zimmetleniyor...' : 'Zimmetle'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <DataTable
                columns={columnsWithActions as any}
                data={initialZimmetler}
                searchKey="arac_plaka"
                searchPlaceholder="Araç plakasına göre ara..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    statusOptions: [
                        { value: "AKTIF", label: "Aktif Zimmet" },
                        { value: "TAMAMLANDI", label: "Tamamlandı" },
                    ],
                    showDateRange: true,
                }}
                excelEntity="zimmet"
            />

            <Dialog open={!!editRow} onOpenChange={(open) => {
                if (!open) {
                    setEditRow(null);
                    setEditFormData({ ...EMPTY_EDIT });
                }
            }}>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Zimmet Kaydını Düzenle</DialogTitle>
                        <DialogDescription>
                            {editRow?.arac.plaka} aracı için zimmet geçmişi detaylarını güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Araç</label>
                            <Input value={editRow ? editRow.arac.plaka : ''} disabled className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Personel / Şoför</label>
                            <Input value={editRow?.kullanici ? getPersonelDisplayName(editRow.kullanici, { fallback: "Atanmamış" }) : "Atanmamış"} disabled className="h-9" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Teslim Tarihi</label>
                                <Input type="datetime-local" value={editFormData.baslangic} onChange={e => setEditFormData({ ...editFormData, baslangic: e.target.value })} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">İade Tarihi</label>
                                <Input type="datetime-local" value={editFormData.bitis} onChange={e => setEditFormData({ ...editFormData, bitis: e.target.value })} className="h-9" />
                            </div>
                        </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Teslim KM</label>
                                    <Input type="number" value={editFormData.baslangicKm} onChange={e => setEditFormData({ ...editFormData, baslangicKm: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">İade KM</label>
                                    <Input type="number" value={editFormData.bitisKm} onChange={e => setEditFormData({ ...editFormData, bitisKm: e.target.value })} className="h-9" />
                                    {!editRow?.bitis ? (
                                        <p className="text-[11px] text-slate-500 mt-1">Aktif kayıtta sadece iade KM girip kaydederseniz zimmet otomatik sonlanır.</p>
                                    ) : null}
                                </div>
                            </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Notlar</label>
                            <Input value={editFormData.notlar} onChange={e => setEditFormData({ ...editFormData, notlar: e.target.value })} placeholder="Örn: Evraklar teslim edildi" className="h-9" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!finalizeRow}
                onOpenChange={(open) => {
                    if (!open) {
                        setFinalizeRow(null);
                        setFinalizeFormData({ ...EMPTY_FINALIZE });
                    }
                }}
            >
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Zimmeti Sonlandır</DialogTitle>
                        <DialogDescription>
                            {finalizeRow?.arac.plaka} aracı için teslim alma bilgilerini girin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Araç</label>
                            <Input value={finalizeRow?.arac.plaka || ""} disabled className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Personel / Şoför</label>
                            <Input value={finalizeRow?.kullanici ? getPersonelDisplayName(finalizeRow.kullanici, { fallback: "Atanmamış" }) : "Atanmamış"} disabled className="h-9" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Teslim Alma Tarihi</label>
                                <Input
                                    type="datetime-local"
                                    value={finalizeFormData.bitis}
                                    onChange={(e) => setFinalizeFormData({ ...finalizeFormData, bitis: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Teslim Alma KM</label>
                                <Input
                                    type="number"
                                    value={finalizeFormData.bitisKm}
                                    onChange={(e) => setFinalizeFormData({ ...finalizeFormData, bitisKm: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Not</label>
                            <Input
                                value={finalizeFormData.notlar}
                                onChange={(e) => setFinalizeFormData({ ...finalizeFormData, notlar: e.target.value })}
                                placeholder="Örn: Anahtar ve ruhsat teslim alındı"
                                className="h-9"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={handleFinalize} disabled={loading} className="bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? "Sonlandırılıyor..." : "Zimmeti Sonlandır"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
