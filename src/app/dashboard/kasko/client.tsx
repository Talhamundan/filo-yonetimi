"use client"
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, ShieldCheck, RefreshCw } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { SearchableSelect } from "../../../components/ui/searchable-select";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, KaskoRow } from "./columns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createKasko, updateKasko, deleteKasko, renewKasko } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { sortByTextValue } from "@/lib/sort-utils";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { formatAracOptionLabel } from "@/lib/arac-option-label";

const oneYearAfter = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return nowDateTimeLocal();
    date.setFullYear(date.getFullYear() + 1);
    return toDateTimeLocalInput(date);
};

const EMPTY = (() => {
    const baslangicTarihi = nowDateTimeLocal();
    return {
        aracId: '',
        sirket: '',
        acente: '',
        policeNo: '',
        baslangicTarihi,
        bitisTarihi: oneYearAfter(baslangicTarihi),
        tutar: '',
        aktifMi: true
    };
})();

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string | null;
    model?: string | null;
    durum?: string | null;
    bulunduguIl?: string | null;
};

const FormFields = ({ formData, setFormData, araclar }: { formData: any, setFormData: any, araclar: AracOption[] }) => {
    const sortedAraclar = sortByTextValue(araclar, (a) => a.plaka);
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    return (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
            <SearchableSelect
                value={formData.aracId} 
                onValueChange={(value) => setFormData({ ...formData, aracId: value })}
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
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Sigorta Şirketi</label>
                <Input value={formData.sirket} onChange={e => setFormData({...formData, sirket: e.target.value})} placeholder="Örn: Allianz" className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Acente</label>
                <Input value={formData.acente} onChange={e => setFormData({...formData, acente: e.target.value})} placeholder="Örn: ABC Acente" className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Poliçe No</label>
            <Input value={formData.policeNo} onChange={e => setFormData({...formData, policeNo: e.target.value})} placeholder="12345/0" className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Başlangıç Tarihi</label>
                <Input type="datetime-local" value={formData.baslangicTarihi} onChange={e => setFormData({...formData, baslangicTarihi: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Bitiş Tarihi</label>
                <Input type="datetime-local" value={formData.bitisTarihi} onChange={e => setFormData({...formData, bitisTarihi: e.target.value})} className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Tutar (₺)</label>
            <Input type="number" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" id="aktifMi" checked={formData.aktifMi} onChange={e => setFormData({...formData, aktifMi: e.target.checked})} className="h-4 w-4 rounded border-slate-300" />
            <label htmlFor="aktifMi" className="text-sm font-medium">Poliçe Aktif</label>
        </div>
    </div>
    );
};

const RenewFields = ({ renewData, setRenewData }: { renewData: any, setRenewData: any }) => (
    <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Sigorta Şirketi</label>
                <Input
                    value={renewData.sirket}
                    onChange={e => setRenewData({ ...renewData, sirket: e.target.value })}
                    placeholder="Örn: Allianz"
                    className="h-9"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Acente</label>
                <Input
                    value={renewData.acente}
                    onChange={e => setRenewData({ ...renewData, acente: e.target.value })}
                    placeholder="Örn: ABC Acente"
                    className="h-9"
                />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Poliçe No</label>
            <Input
                value={renewData.policeNo}
                onChange={e => setRenewData({ ...renewData, policeNo: e.target.value })}
                placeholder="12345/0"
                className="h-9"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yenileme Tarihi</label>
                <Input
                    type="datetime-local"
                    value={renewData.yenilemeTarihi}
                    onChange={e => setRenewData({
                        ...renewData,
                        yenilemeTarihi: e.target.value,
                        bitisTarihi: oneYearAfter(e.target.value)
                    })}
                    className="h-9"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yeni Bitiş Tarihi</label>
                <Input
                    type="datetime-local"
                    value={renewData.bitisTarihi}
                    onChange={e => setRenewData({ ...renewData, bitisTarihi: e.target.value })}
                    className="h-9"
                />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Yeni Poliçe Tutarı (₺)</label>
            <Input
                type="number"
                value={renewData.tutar}
                onChange={e => setRenewData({ ...renewData, tutar: e.target.value })}
                placeholder="0.00"
                className="h-9"
            />
        </div>
    </div>
);

export default function KaskoClient({ initialKaskolar, araclar }: { initialKaskolar: KaskoRow[], araclar: AracOption[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<KaskoRow | null>(null);
    const [renewRow, setRenewRow] = useState<KaskoRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const renewDefaultStart = nowDateTimeLocal();
    const [renewData, setRenewData] = useState({
        sirket: '',
        acente: '',
        policeNo: '',
        yenilemeTarihi: renewDefaultStart,
        bitisTarihi: oneYearAfter(renewDefaultStart),
        tutar: ''
    });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen bir araç seçin." });
        }
        setLoading(true);
        const res = await createKasko({ ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Kasko Kaydedildi", { description: "Yeni kasko poliçesi başarıyla eklendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateKasko(editRow.id, { ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Kasko poliçesi bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, arac: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${arac} aracına ait kasko kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteKasko(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Kasko poliçesi sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: KaskoRow) => {
        setFormData({
            aracId: row.arac.id,
            sirket: row.sirket || '',
            acente: row.acente || '',
            policeNo: row.policeNo || '',
            baslangicTarihi: toDateTimeLocalInput(row.baslangicTarihi),
            bitisTarihi: toDateTimeLocalInput(row.bitisTarihi),
            tutar: String(row.tutar || ''),
            aktifMi: row.aktifMi
        });
        setEditRow(row);
    };

    const openRenew = (row: KaskoRow) => {
        const yenilemeTarihi = nowDateTimeLocal();
        setRenewData({
            sirket: row.sirket || '',
            acente: row.acente || '',
            policeNo: row.policeNo || '',
            yenilemeTarihi,
            bitisTarihi: oneYearAfter(yenilemeTarihi),
            tutar: String(row.tutar || ''),
        });
        setRenewRow(row);
    };

    const handleRenew = async () => {
        if (!renewRow) return;
        if (!renewData.yenilemeTarihi || !renewData.bitisTarihi) {
            return toast.warning("Eksik Tarih Bilgisi", { description: "Yenileme ve bitiş tarihi alanlarını doldurun." });
        }
        if (new Date(renewData.bitisTarihi) <= new Date(renewData.yenilemeTarihi)) {
            return toast.warning("Tarih Hatası", { description: "Bitiş tarihi, yenileme tarihinden sonra olmalıdır." });
        }
        setLoading(true);
        const res = await renewKasko(renewRow.id, {
            sirket: renewData.sirket,
            acente: renewData.acente,
            policeNo: renewData.policeNo,
            yenilemeTarihi: renewData.yenilemeTarihi,
            bitisTarihi: renewData.bitisTarihi,
            tutar: renewData.tutar ? parseFloat(renewData.tutar) : undefined,
        });

        if (res.success) {
            setRenewRow(null);
            toast.success("Kasko Yenilendi", { description: "Yeni dönem poliçesi başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("Yenileme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    useEffect(() => {
        const renewAracId = searchParams.get("yenileAracId");
        if (!renewAracId) return;

        const adaylar = initialKaskolar
            .filter((item) => item.arac.id === renewAracId)
            .sort((a, b) => new Date(b.bitisTarihi).getTime() - new Date(a.bitisTarihi).getTime());
        const hedefKayit = adaylar.find((item) => item.aktifMi) || adaylar[0];

        if (hedefKayit) {
            openRenew(hedefKayit);
        } else {
            setCreateOpen(true);
            setFormData((prev) => ({ ...prev, aracId: renewAracId }));
            toast.warning("Mevcut poliçe bulunamadı", { description: "Araç için doğrudan yeni poliçe giriş ekranı açıldı." });
        }

        const params = new URLSearchParams(searchParams.toString());
        params.delete("yenileAracId");
        const nextQuery = params.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }, [initialKaskolar, pathname, router, searchParams]);


    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => openRenew(row.original)} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors">
                        <RefreshCw size={15} />
                    </button>
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id, row.original.arac.plaka)} />
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
                        <ShieldCheck className="text-indigo-600" /> Kasko Poliçe Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlara ait kasko poliçelerinin kapsam, tarih ve maliyet takibi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Kasko Poliçesi
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Kasko Kaydı</DialogTitle>
                            <DialogDescription>
                                Araç plakası ve poliçe detaylarını belirterek sistemi güncelleyin.
                            </DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Kasko Poliçesini Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın poliçe bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!renewRow} onOpenChange={(o) => !o && setRenewRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Kasko Yenile</DialogTitle>
                        <DialogDescription>{renewRow?.arac.plaka} plakalı araç için yeni dönem poliçe bilgilerini girin.</DialogDescription>
                    </DialogHeader>
                    <RenewFields renewData={renewData} setRenewData={setRenewData} />
                    <DialogFooter>
                        <button onClick={handleRenew} disabled={loading} className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Yenileniyor...' : 'Yenile'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialKaskolar}
                searchKey="arac_plaka"
                searchPlaceholder="Kasko poliçesi için araç plakası ara..."
                toolbarLayout="compact"
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    statusOptions: [
                        { value: "GECERLI", label: "Geçerli" },
                        { value: "YAKLASIYOR", label: "Yaklaşıyor" },
                        { value: "YUKSEK", label: "Yüksek" },
                        { value: "GECIKTI", label: "Gecikti" },
                        { value: "PASIF", label: "Geçmiş Kayıt" },
                    ],
                    showDateRange: true,
                }}
                excelEntity="kasko"
            />
        </div>
    );
}
