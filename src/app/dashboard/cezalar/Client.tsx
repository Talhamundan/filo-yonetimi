"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, AlertOctagon, Car, User, Wallet } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { useRouter } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, CezaRow } from "./columns";
import { createCeza, updateCeza, deleteCeza } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { sortByTextValue } from "@/lib/sort-utils";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";

const EMPTY = {
    aracId: "",
    soforId: "",
    tarih: new Date().toISOString().split("T")[0],
    tutar: "",
    cezaMaddesi: "",
    aciklama: "",
};

const FormFields = ({
    formData,
    setFormData,
    araclar,
    soforler
}: {
    formData: any;
    setFormData: any;
    araclar: { id: string; plaka: string; marka?: string | null; model?: string | null; bulunduguIl?: string | null }[];
    soforler: { id: string; adSoyad: string }[];
}) => {
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    return (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç Seçimi <span className="text-red-500">*</span></label>
            <select
                value={formData.aracId}
                onChange={e => setFormData({ ...formData, aracId: e.target.value })}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Seçiniz...</option>
                {araclar.map(a => <option key={a.id} value={a.id}>{a.plaka}</option>)}
            </select>
            <SelectedAracInfo arac={selectedArac} />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Şoför Seçimi <span className="text-red-500">*</span></label>
            <select
                value={formData.soforId}
                onChange={e => setFormData({ ...formData, soforId: e.target.value })}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Seçiniz...</option>
                {soforler.map(s => <option key={s.id} value={s.id}>{s.adSoyad}</option>)}
            </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                <Input type="date" value={formData.tarih} onChange={e => setFormData({ ...formData, tarih: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.tutar} onChange={e => setFormData({ ...formData, tutar: e.target.value })} className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Ceza Maddesi <span className="text-red-500">*</span></label>
            <Input value={formData.cezaMaddesi} onChange={e => setFormData({ ...formData, cezaMaddesi: e.target.value })} placeholder="Örn: Hız Sınırı" className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Açıklama</label>
            <Input value={formData.aciklama} onChange={e => setFormData({ ...formData, aciklama: e.target.value })} placeholder="Opsiyonel not" className="h-9" />
        </div>
    </div>
    );
};

export default function CezalarClient({
    initialData,
    araclar,
    soforler,
    ozet
}: {
    initialData: CezaRow[];
    araclar: { id: string; plaka: string; marka?: string | null; model?: string | null; bulunduguIl?: string | null }[];
    soforler: { id: string; adSoyad: string }[];
    ozet: {
        toplamCezaMaliyeti: number;
        enCokCezaYiyenSofor: { adSoyad: string; toplamTutar: number };
        enCokCezaYiyenArac: { plaka: string; cezaAdedi: number };
    };
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<CezaRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [seciliSoforId, setSeciliSoforId] = useState("TUMU");
    const [loading, setLoading] = useState(false);
    const sortedAraclar = useMemo(() => sortByTextValue(araclar, (a) => a.plaka), [araclar]);
    const sortedSoforler = useMemo(() => sortByTextValue(soforler, (s) => s.adSoyad), [soforler]);

    const filteredData = useMemo(() => {
        if (seciliSoforId === "TUMU") return initialData;
        return initialData.filter((item) => item.soforId === seciliSoforId);
    }, [initialData, seciliSoforId]);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.soforId || !formData.tarih || !formData.tutar || !formData.cezaMaddesi) {
            return toast.warning("Eksik Bilgi", { description: "Araç, şoför, tarih, tutar ve ceza maddesi zorunludur." });
        }
        setLoading(true);
        const res = await createCeza({
            aracId: formData.aracId,
            soforId: formData.soforId,
            tarih: formData.tarih,
            tutar: Number(formData.tutar),
            cezaMaddesi: formData.cezaMaddesi,
            aciklama: formData.aciklama
        });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Ceza Kaydedildi", { description: "Yeni ceza kaydı sisteme eklendi." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if (!formData.aracId || !formData.soforId || !formData.tarih || !formData.tutar || !formData.cezaMaddesi) {
            return toast.warning("Eksik Bilgi", { description: "Araç, şoför, tarih, tutar ve ceza maddesi zorunludur." });
        }
        setLoading(true);
        const res = await updateCeza(editRow.id, {
            aracId: formData.aracId,
            soforId: formData.soforId,
            tarih: formData.tarih,
            tutar: Number(formData.tutar),
            cezaMaddesi: formData.cezaMaddesi,
            aciklama: formData.aciklama
        });
        if (res.success) {
            setEditRow(null);
            toast.success("Ceza Güncellendi", { description: "Ceza kaydı güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({
            title: "Kaydı Sil",
            message: "Bu ceza kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        const res = await deleteCeza(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Ceza kaydı kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const openEdit = (row: CezaRow) => {
        setFormData({
            aracId: row.aracId || "",
            soforId: row.soforId || "",
            tarih: new Date(row.tarih).toISOString().split("T")[0],
            tutar: String(row.tutar),
            cezaMaddesi: row.cezaMaddesi,
            aciklama: row.aciklama || "",
        });
        setEditRow(row);
    };

    const columnsWithActions = [
        ...getColumns(),
        {
            id: "actions",
            header: "İşlemler",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(row.original)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">Düzenle</button>
                    <button onClick={() => handleDelete(row.original.id)} className="text-rose-600 hover:text-rose-800 text-xs font-semibold">Sil</button>
                </div>
            )
        }
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto space-y-6">
            {confirmModal}

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <AlertOctagon className="text-rose-600" /> Şoför Bazlı Ceza Takip
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Şoför ve araç bazında trafik cezalarını yönetin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> Yeni Ceza Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Ceza Kaydı</DialogTitle>
                            <DialogDescription>Ceza kaydını araç ve şoför bilgisiyle birlikte oluşturun.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={sortedAraclar} soforler={sortedSoforler} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                            <Wallet size={16} /> Toplam Ceza Maliyeti
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">₺{ozet.toplamCezaMaliyeti.toLocaleString("tr-TR")}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                            <User size={16} /> En Çok Ceza Yiyen Şoför
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold text-slate-900">{ozet.enCokCezaYiyenSofor.adSoyad}</div>
                        <p className="text-sm text-rose-600 font-semibold mt-1">₺{ozet.enCokCezaYiyenSofor.toplamTutar.toLocaleString("tr-TR")}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                            <Car size={16} /> En Çok Ceza Yiyen Araç
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold text-slate-900 font-mono">{ozet.enCokCezaYiyenArac.plaka}</div>
                        <p className="text-sm text-slate-600 mt-1">{ozet.enCokCezaYiyenArac.cezaAdedi} kayıt</p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <label className="text-sm font-medium text-slate-600">Şoföre Göre Filtrele</label>
                    <select
                        value={seciliSoforId}
                        onChange={(e) => setSeciliSoforId(e.target.value)}
                        className="h-9 w-full md:w-[320px] rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="TUMU">Tümü</option>
                        {sortedSoforler.map((s) => <option key={s.id} value={s.id}>{s.adSoyad}</option>)}
                    </select>
                </div>
            </div>

            <DataTable
                columns={columnsWithActions as any}
                data={filteredData}
                searchKey="plaka"
                searchPlaceholder="Plakaya göre ara..."
                toolbarArrangement="report-right-scroll"
                excelEntity="ceza"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Ceza Kaydını Düzenle</DialogTitle>
                        <DialogDescription>Kayıt detaylarını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={sortedAraclar} soforler={sortedSoforler} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
