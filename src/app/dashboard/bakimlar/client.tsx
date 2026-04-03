"use client"
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Wrench } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, BakimRow } from "./columns";
import { addBakim, updateBakim, deleteBakim } from "./actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";

const EMPTY = {
    aracId: "",
    plaka: "",
    soforId: "",
    bakimTarihi: nowDateTimeLocal(),
    arizaSikayet: "",
    yapilanIslemler: "",
    degisenParca: "",
    islemYapanFirma: "",
    tutar: ""
};

const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string | null;
    model?: string | null;
    durum?: string | null;
    bulunduguIl?: string | null;
    kullaniciId?: string | null;
    kullanici?: { id: string; ad: string; soyad: string } | null;
    aktifSoforId?: string | null;
    aktifSofor?: { id: string; ad: string; soyad: string } | null;
    aktifSoforAdSoyad?: string | null;
};

type PersonelOption = {
    id: string;
    ad: string;
    soyad: string;
    rol?: string | null;
    sirketAd?: string | null;
    calistigiKurum?: string | null;
};

export default function BakimlarClient({
    initialBakimlar,
    activeAraclar,
    personeller,
}: {
    initialBakimlar: BakimRow[],
    activeAraclar: AracOption[],
    personeller: PersonelOption[],
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<BakimRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const shouldOpenCreate = searchParams.get("add") === "true";

    useEffect(() => {
        if (shouldOpenCreate) {
            setCreateOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("add");
            const query = params.toString();
            router.replace(`/dashboard/servis-kayitlari${query ? `?${query}` : ""}`, { scroll: false });
        }
    }, [shouldOpenCreate, router, searchParams]);
    const selectedArac = activeAraclar.find((arac) => arac.id === formData.aracId);
    const personelIdSet = React.useMemo(() => new Set(personeller.map((personel) => personel.id)), [personeller]);
    const normalizeSoforId = (soforId?: string | null) => (soforId && personelIdSet.has(soforId) ? soforId : "");

    const handleAracSelection = (aracId: string) => {
        const seciliArac = activeAraclar.find((arac) => arac.id === aracId);
        setFormData((prev) => ({
            ...prev,
            aracId,
            plaka: seciliArac?.plaka ? forceUppercase(seciliArac.plaka) : prev.plaka,
            soforId: normalizeSoforId(seciliArac?.aktifSoforId || seciliArac?.kullaniciId),
        }));
    };

    const handlePlakaChange = (value: string) => {
        const nextPlaka = forceUppercase(value);
        const normalizedNextPlaka = nextPlaka.replace(/\s+/g, "");
        const matchedArac = activeAraclar.find((arac) => (arac.plaka || "").replace(/\s+/g, "").toLocaleUpperCase("tr-TR") === normalizedNextPlaka);

        setFormData((prev) => ({
            ...prev,
            plaka: nextPlaka,
            aracId: matchedArac?.id || "",
            soforId: matchedArac
                ? normalizeSoforId(matchedArac.aktifSoforId || matchedArac.kullaniciId)
                : prev.soforId,
        }));
    };

    const handleCreate = async () => {
        if ((!formData.aracId && !formData.plaka.trim()) || !formData.bakimTarihi || !formData.tutar) {
            toast.warning("Eksik Bilgi", { description: "Lütfen zorunlu yıldızlı (*) alanları doldurun." });
            return;
        }

        setLoading(true);
        const res = await addBakim({
            aracId: formData.aracId || null,
            plaka: formData.plaka || null,
            soforId: formData.soforId || null,
            bakimTarihi: new Date(formData.bakimTarihi),
            arizaSikayet: formData.arizaSikayet || undefined,
            yapilanIslemler: formData.yapilanIslemler || undefined,
            degisenParca: formData.degisenParca || undefined,
            islemYapanFirma: formData.islemYapanFirma || undefined,
            tutar: parseFloat(formData.tutar)
        });

        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Bakım Kaydedildi", { description: "Servis/Bakım kaydı başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if ((!formData.aracId && !formData.plaka.trim()) || !formData.bakimTarihi || !formData.tutar) {
            toast.warning("Eksik Bilgi", { description: "Lütfen zorunlu yıldızlı (*) alanları doldurun." });
            return;
        }
        setLoading(true);
        const res = await updateBakim(editRow.id, {
            aracId: formData.aracId || null,
            plaka: formData.plaka || null,
            soforId: formData.soforId || null,
            bakimTarihi: new Date(formData.bakimTarihi),
            arizaSikayet: formData.arizaSikayet || undefined,
            yapilanIslemler: formData.yapilanIslemler || undefined,
            degisenParca: formData.degisenParca || undefined,
            islemYapanFirma: formData.islemYapanFirma || undefined,
            tutar: parseFloat(formData.tutar)
        });

        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Servis kaydı bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${plaka} için bu servis kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteBakim(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Servis kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const openEdit = (row: BakimRow) => {
        setFormData({
            aracId: row.arac?.id || "",
            plaka: row.arac?.plaka || row.plaka || "",
            soforId: normalizeSoforId(row.soforId || row.sofor?.id || row.arac?.kullanici?.id),
            bakimTarihi: toDateTimeLocalInput(row.bakimTarihi),
            arizaSikayet: row.arizaSikayet || "",
            yapilanIslemler: row.yapilanIslemler || "",
            degisenParca: row.degisenParca || "",
            islemYapanFirma: row.islemYapanFirma || row.servisAdi || "",
            tutar: String(row.tutar)
        });
        setEditRow(row);
    };



    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id, row.original.arac?.plaka || row.original.plaka || "Araçsız kayıt")} />
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
                        <Wrench className="text-indigo-600" /> Servis Kayıtları Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Filodaki tüm araçların güncel ve geçmiş servis operasyonlarının takibi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Servis Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Yeni Servis Kaydı</DialogTitle>
                            <DialogDescription>
                                Servis kaydı için temel bilgileri girin.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Araç</label>
                                <SearchableSelect
                                    value={formData.aracId}
                                    onValueChange={handleAracSelection}
                                    placeholder="Araç Seçiniz (Opsiyonel)"
                                    searchPlaceholder="Plaka / araç ara..."
                                    options={[
                                        { value: "", label: "Seçilmedi" },
                                        ...activeAraclar.map((arac) => ({
                                            value: arac.id,
                                            label: formatAracOptionLabel(arac),
                                            searchText: [arac.plaka, arac.marka, arac.model].filter(Boolean).join(" "),
                                        })),
                                    ]}
                                />
                                <SelectedAracInfo arac={selectedArac} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Plaka <span className="text-red-500">*</span></label>
                                <Input
                                    value={formData.plaka}
                                    onChange={(event) => handlePlakaChange(event.target.value)}
                                    placeholder="34 ABC 123"
                                    className="h-9 uppercase font-mono"
                                />
                                <p className="text-[11px] text-slate-500">Plaka araç listesinde varsa kayıt otomatik olarak araca bağlanır.</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Servise Götüren Personel</label>
                                <SearchableSelect
                                    value={formData.soforId}
                                    onValueChange={(value) => setFormData({ ...formData, soforId: value })}
                                    placeholder="Seçilmedi"
                                    searchPlaceholder="Personel ara..."
                                    options={[
                                        { value: "", label: "Seçilmedi" },
                                        ...personeller.map((personel) => ({
                                            value: personel.id,
                                            label: getPersonelOptionLabel(personel),
                                            searchText: getPersonelOptionSearchText(personel),
                                        })),
                                    ]}
                                />
                                <p className="text-[11px] text-slate-500">Şoför dışı personel de seçilebilir. Admin seçimi yapılamaz.</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Arıza Şikayet</label>
                                <textarea
                                    value={formData.arizaSikayet}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, arizaSikayet: e.target.value })}
                                    placeholder="Aracın bildirilen şikayeti..."
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                                <Input type="datetime-local" value={formData.bakimTarihi} onChange={e => setFormData({ ...formData, bakimTarihi: e.target.value })} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yapılan İşlem</label>
                                <textarea
                                    value={formData.yapilanIslemler}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, yapilanIslemler: e.target.value })}
                                    placeholder="Yapılan işlemler..."
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Değişen Parça</label>
                                <Input
                                    value={formData.degisenParca}
                                    onChange={(e) => setFormData({ ...formData, degisenParca: e.target.value })}
                                    placeholder="Örn: Yağ filtresi, fren balatası"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">İşlem Yapan Firma</label>
                                <Input
                                    value={formData.islemYapanFirma}
                                    onChange={(e) => setFormData({ ...formData, islemYapanFirma: e.target.value })}
                                    placeholder="Örn: Renault Bahaş Servis"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                                <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Edit Dialog */}
            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Servis Kaydını Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.arac?.plaka || editRow?.plaka || "Araçsız kayıt"} için servis bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Araç</label>
                            <SearchableSelect
                                value={formData.aracId}
                                onValueChange={handleAracSelection}
                                placeholder="Araç Seçiniz (Opsiyonel)"
                                searchPlaceholder="Plaka / araç ara..."
                                options={[
                                    { value: "", label: "Seçilmedi" },
                                    ...activeAraclar.map((arac) => ({
                                        value: arac.id,
                                        label: formatAracOptionLabel(arac),
                                        searchText: [arac.plaka, arac.marka, arac.model].filter(Boolean).join(" "),
                                    })),
                                ]}
                            />
                            <SelectedAracInfo arac={selectedArac} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Plaka <span className="text-red-500">*</span></label>
                            <Input
                                value={formData.plaka}
                                onChange={(event) => handlePlakaChange(event.target.value)}
                                placeholder="34 ABC 123"
                                className="h-9 uppercase font-mono"
                            />
                            <p className="text-[11px] text-slate-500">Plaka araç listesinde varsa kayıt otomatik olarak araca bağlanır.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Servise Götüren Personel</label>
                            <SearchableSelect
                                value={formData.soforId}
                                onValueChange={(value) => setFormData({ ...formData, soforId: value })}
                                placeholder="Seçilmedi"
                                searchPlaceholder="Personel ara..."
                                options={[
                                    { value: "", label: "Seçilmedi" },
                                    ...personeller.map((personel) => ({
                                        value: personel.id,
                                        label: getPersonelOptionLabel(personel),
                                        searchText: getPersonelOptionSearchText(personel),
                                    })),
                                ]}
                            />
                            <p className="text-[11px] text-slate-500">Şoför dışı personel de seçilebilir. Admin seçimi yapılamaz.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Arıza Şikayet</label>
                            <textarea
                                value={formData.arizaSikayet}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, arizaSikayet: e.target.value })}
                                placeholder="Aracın bildirilen şikayeti..."
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                            <Input type="datetime-local" value={formData.bakimTarihi} onChange={e => setFormData({ ...formData, bakimTarihi: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Yapılan İşlem</label>
                            <textarea
                                value={formData.yapilanIslemler}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, yapilanIslemler: e.target.value })}
                                placeholder="Yapılan işlemler..."
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Değişen Parça</label>
                            <Input
                                value={formData.degisenParca}
                                onChange={(e) => setFormData({ ...formData, degisenParca: e.target.value })}
                                placeholder="Örn: Yağ filtresi, fren balatası"
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">İşlem Yapan Firma</label>
                            <Input
                                value={formData.islemYapanFirma}
                                onChange={(e) => setFormData({ ...formData, islemYapanFirma: e.target.value })}
                                placeholder="Örn: Renault Bahaş Servis"
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialBakimlar}
                searchKey="arac_plaka"
                searchPlaceholder="Gösterilecek servis kaydı için plaka arayın..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    showDateRange: true,
                }}
                excelEntity="bakim"
            />
        </div>
    );
}
