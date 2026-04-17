"use client"
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Fuel, Gauge, Wallet, Droplets, Layers, ArrowRightLeft, PackageCheck, Edit2, PencilLine } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, YakitRow } from "./columns";
import { useRouter, useSearchParams } from "next/navigation";
import { createYakit, updateYakit, deleteYakit, addFuelToTanker, transferFuelToBidon, deleteTankHareket, updateTank, updateTankHareket } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";
import { GaugeChart } from "@/components/ui/gauge-chart";

const EMPTY = {
    aracId: '',
    soforId: '',
    tarih: new Date().toISOString().slice(0, 10),
    litre: '',
    km: '',
    endeks: '',
    istasyon: '',
    odemeYontemi: 'NAKIT'
};

const YAKIT_CIKISI_OPTIONS = ["Mithra", "Binlik Bidon"] as const;

function formatLitre(value: number) {
    return `${Math.round(value).toLocaleString("tr-TR")} L`;
}

function formatPara(value: number) {
    return `₺${Math.round(value).toLocaleString("tr-TR")}`;
}

function getGaugeColorForTank(percentage: number) {
    if (percentage < 20) return "#E11D48";
    if (percentage < 45) return "#F59E0B";
    return "#16A34A";
}

function getTankSeviye(dolulukOrani: number) {
    if (dolulukOrani < 20) {
        return {
            etiket: "Kritik Seviye",
            badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
            topBorderClass: "border-t-2 border-t-rose-300",
            barClass: "bg-[#0B6E4F]",
        };
    }
    if (dolulukOrani < 40) {
        return {
            etiket: "Düşük Seviye",
            badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
            topBorderClass: "border-t-2 border-t-amber-300",
            barClass: "bg-[#0B6E4F]",
        };
    }
    return {
        etiket: "Normal Seviye",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        topBorderClass: "border-t-2 border-t-emerald-300",
        barClass: "bg-[#0B6E4F]",
    };
}

function parseDecimal(value: string) {
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parseKm(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = trimmed.replace(/[^\d]/g, "");
    const parsed = Number(numeric || trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string;
    model?: string;
    durum?: string | null;
    bulunduguIl?: string | null;
    calistigiKurum?: string | null;
    sirketAd?: string | null;
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

const FormFields = ({
    formData,
    setFormData,
    araclar,
    personeller,
    onAracChange,
    tankGosterge,
}: {
    formData: any,
    setFormData: any,
    araclar: AracOption[],
    personeller: PersonelOption[],
    onAracChange: (aracId: string) => void,
    tankGosterge?: any,
}) => {
    const seciliArac = araclar.find((a) => a.id === formData.aracId);
    const seciliPersonel = personeller.find((personel) => personel.id === formData.soforId);
    const bagliSirket = seciliArac?.sirketAd?.trim() || "-";
    const calistigiKurum =
        seciliArac?.calistigiKurum?.trim() ||
        seciliPersonel?.calistigiKurum?.trim() ||
        seciliPersonel?.sirketAd?.trim() ||
        "-";
    const alindigiYerOptions = React.useMemo(() => {
        const defaultOptions = ["Mithra", "Binlik Bidon"];
        const customTanks = (tankGosterge?.tanklar || [])
            .filter((t: any) => {
                const name = String(t.ad || "").toLocaleLowerCase("tr-TR");
                return t.aktifMi && 
                       name !== "mithra" && 
                       name !== "binlik bidon" && 
                       !["ana tank", "binlik", "gezici", "bidon"].some(key => name.includes(key));
            })
            .map((t: any) => t.ad);
        
        const allOptions = Array.from(new Set([...defaultOptions, ...customTanks]));
        const current = typeof formData.istasyon === "string" ? formData.istasyon.trim() : "";
        if (!current) return allOptions;
        
        const exists = allOptions.some((item) => item.localeCompare(current, "tr-TR", { sensitivity: "base" }) === 0);
        return exists ? allOptions : [...allOptions, current];
    }, [formData.istasyon, tankGosterge]);

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
                <SearchableSelect
                    value={formData.aracId} 
                    onValueChange={onAracChange}
                    placeholder="Seçiniz..."
                    searchPlaceholder="Plaka / araç ara..."
                    options={[
                        { value: "", label: "Seçiniz..." },
                        ...araclar.map((a) => ({
                            value: a.id,
                            label: formatAracOptionLabel(a),
                            searchText: [a.plaka, a.marka, a.model].filter(Boolean).join(" "),
                        })),
                    ]}
                />
                <SelectedAracInfo arac={seciliArac} />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yakıtı Alan Personel</label>
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
                <p className="text-[11px] text-slate-500">
                    Şoför harici personel de seçilebilir. Admin seçimi yapılamaz.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Endeks (Mithra)</label>
                    <Input type="number" value={formData.endeks} onChange={e => setFormData({...formData, endeks: e.target.value})} placeholder="0" className="h-9" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alım Tarihi</label>
                    <Input type="date" value={formData.tarih} onChange={e => setFormData({...formData, tarih: e.target.value})} className="h-9" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Alınan Litre</label>
                <Input type="number" step="0.01" value={formData.litre} onChange={e => setFormData({...formData, litre: e.target.value})} placeholder="0.00" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">KM/Saat (Opsiyonel)</label>
                    <Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} placeholder="123456" className="h-9" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Yakıt Çıkışı</label>
                    <select
                        value={formData.istasyon}
                        onChange={(e) => setFormData({ ...formData, istasyon: e.target.value })}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Seçiniz...</option>
                        {alindigiYerOptions.map((item) => {
                            let label = item;
                            if (tankGosterge) {
                                if (item === "Mithra") {
                                    const anaTanklar = tankGosterge.tanklar.filter((t: any) => 
                                        String(t.ad || "").toLocaleLowerCase("tr-TR").includes("ana tank")
                                    );
                                    const mxMevcut = anaTanklar.reduce((s: number, t: any) => s + t.mevcutLitre, 0);
                                    const mxKapasite = anaTanklar.reduce((s: number, t: any) => s + t.kapasiteLitre, 0);
                                    const mxYuzde = mxKapasite > 0 ? (mxMevcut / mxKapasite) * 100 : 0;
                                    label = `Mithra (Ana Tanklar: %${mxYuzde.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${mxMevcut.toLocaleString("tr-TR")}L)`;
                                } else if (item === "Binlik Bidon") {
                                    const bidonlar = tankGosterge.tanklar.filter((t: any) => {
                                        const name = String(t.ad || "").toLocaleLowerCase("tr-TR");
                                        return name.includes("binlik") || name.includes("gezici");
                                    });
                                    const mxMevcut = bidonlar.reduce((s: number, t: any) => s + t.mevcutLitre, 0);
                                    const mxKapasite = bidonlar.reduce((s: number, t: any) => s + t.kapasiteLitre, 0);
                                    const mxYuzde = mxKapasite > 0 ? (mxMevcut / mxKapasite) * 100 : 0;
                                    label = `Binlik Bidon (%${mxYuzde.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${mxMevcut.toLocaleString("tr-TR")}L)`;
                                } else {
                                    const matchingTank = tankGosterge.tanklar.find((t: any) => t.ad === item);
                                    if (matchingTank) {
                                        label = `${item} (%${matchingTank.dolulukOrani.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${matchingTank.mevcutLitre.toLocaleString("tr-TR")}L)`;
                                    }
                                }
                            }
                            return (
                                <option key={item} value={item}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>
        </div>
    );
};

const TankerAlimDialog = ({
    open,
    onOpenChange,
    tanks,
    onSuccess,
    editRow
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    tanks: any[],
    onSuccess: () => void,
    editRow?: YakitRow | null
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        tankId: '',
        litre: '',
        toplamTutar: '',
        tarih: new Date().toISOString().slice(0, 16)
    });

    React.useEffect(() => {
        if (editRow) {
            setFormData({
                tankId: editRow.arac.id,
                litre: editRow.litre.toString(),
                toplamTutar: editRow.tutar.toString(),
                tarih: new Date(editRow.tarih).toISOString().slice(0, 16)
            });
        } else {
            setFormData({
                tankId: '',
                litre: '',
                toplamTutar: '',
                tarih: new Date().toISOString().slice(0, 16)
            });
        }
    }, [editRow, open]);

    const handleSave = async () => {
        if (!formData.tankId || !formData.litre || !formData.toplamTutar) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen tüm alanları doldurun." });
        }
        setLoading(true);
        const payload = {
            litre: parseDecimal(formData.litre),
            toplamTutar: parseDecimal(formData.toplamTutar),
            tarih: formData.tarih
        };

        const res = editRow 
            ? await updateTankHareket(editRow.id, payload)
            : await addFuelToTanker({ ...payload, tankId: formData.tankId });

        if (res.success) {
            toast.success(editRow ? "Güncellendi" : "Alım Kaydedildi", { 
                description: editRow ? "Stok alım kaydı güncellendi." : "Tanker yakıt alımı başarıyla eklendi." 
            });
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("Hata", { description: res.error });
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent >
                <DialogHeader>
                    <DialogTitle>{editRow ? 'Alım Kaydını Düzenle' : 'Tankere Yakıt Alışı Gir'}</DialogTitle>
                    <DialogDescription>Dışarıdan tankere alınan yakıt miktarını ve maliyetini kaydedin.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Hedef Tank</label>
                        <select
                            disabled={!!editRow}
                            value={formData.tankId}
                            onChange={(e) => setFormData({ ...formData, tankId: e.target.value })}
                            className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                        >
                            <option value="">Seçiniz...</option>
                            {tanks.filter(t => t.ad !== "Binlik Bidon").map((t) => (
                                <option key={t.id} value={t.id}>{t.ad}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Alınan Litre</label>
                        <Input type="number" step="0.01" value={formData.litre} onChange={(e) => setFormData({ ...formData, litre: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Toplam Tutar (TL)</label>
                        <Input type="number" step="0.01" value={formData.toplamTutar} onChange={(e) => setFormData({ ...formData, toplamTutar: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tarih</label>
                        <Input type="datetime-local" value={formData.tarih} onChange={(e) => setFormData({ ...formData, tarih: e.target.value })} />
                    </div>
                </div>
                <DialogFooter>
                    <button onClick={handleSave} disabled={loading} className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                        {loading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const TankerTransferDialog = ({
    open,
    onOpenChange,
    onSuccess,
    editRow
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onSuccess: () => void,
    editRow?: YakitRow | null
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        litre: '',
        tarih: new Date().toISOString().slice(0, 16)
    });

    React.useEffect(() => {
        if (editRow) {
            setFormData({
                litre: editRow.litre.toString(),
                tarih: new Date(editRow.tarih).toISOString().slice(0, 16).replace('T', ' ')
            });
        } else {
            setFormData({
                litre: '',
                tarih: new Date().toISOString().slice(0, 16)
            });
        }
    }, [editRow, open]);

    const handleSave = async () => {
        if (!formData.litre) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen aktarılacak litre miktarını girin." });
        }
        setLoading(true);
        const payload = {
            litre: parseDecimal(formData.litre),
            tarih: formData.tarih
        };

        const res = editRow
            ? await updateTankHareket(editRow.id, payload)
            : await transferFuelToBidon(payload);

        if (res.success) {
            toast.success(editRow ? "Güncellendi" : "Aktarım Başarılı", { 
                description: editRow ? "Aktarım kaydı güncellendi." : "Ana tanktan bidona yakıt başarıyla aktarıldı." 
            });
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("Hata", { description: res.error });
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent >
                <DialogHeader>
                    <DialogTitle>{editRow ? 'Aktarımı Düzenle' : 'Bidona Yakıt Aktar'}</DialogTitle>
                    <DialogDescription>Mithra (Ana Tanklar) üzerinden Binlik Bidon&apos;a iç transfer yapın.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <p className="text-[12px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100">
                        Sistem otomatik olarak Ana Tank 1 veya 2&apos;den (uygunluk durumuna göre) Binlik Bidon&apos;a aktarım yapacaktır.
                    </p>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Aktarılacak Litre</label>
                        <Input type="number" step="0.01" value={formData.litre} onChange={(e) => setFormData({ ...formData, litre: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tarih</label>
                        <Input type="datetime-local" value={formData.tarih} onChange={(e) => setFormData({ ...formData, tarih: e.target.value })} />
                    </div>
                </div>
                <DialogFooter>
                    <button onClick={handleSave} disabled={loading} className="bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                        {loading ? 'İşlem Yapılıyor...' : editRow ? 'Güncelle' : 'Aktarımı Tamamla'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const TankEditDialog = ({
    open,
    onOpenChange,
    tank,
    onSuccess
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    tank: any | null,
    onSuccess: () => void
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        ad: '',
        kapasiteLitre: '',
        mevcutLitre: '',
        birimMaliyet: ''
    });

    React.useEffect(() => {
        if (tank) {
            setFormData({
                ad: tank.ad,
                kapasiteLitre: tank.kapasiteLitre.toString(),
                mevcutLitre: tank.mevcutLitre.toString(),
                birimMaliyet: tank.birimMaliyet.toString()
            });
        }
    }, [tank]);

    const handleSave = async () => {
        if (!tank) return;
        setLoading(true);
        const res = await updateTank(tank.id, {
            ad: formData.ad,
            kapasiteLitre: Number(formData.kapasiteLitre),
            mevcutLitre: Number(formData.mevcutLitre),
            birimMaliyet: Number(formData.birimMaliyet)
        });
        if (res.success) {
            toast.success("Tank Güncellendi", { description: "Tank bilgileri başarıyla güncellendi." });
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("Hata", { description: res.error });
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent >
                <DialogHeader>
                    <DialogTitle>Tank Bilgilerini Düzenle</DialogTitle>
                    <DialogDescription>Tankın fiziksel kapasitesini veya mevcut stok durumunu güncelleyin.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tank Adı</label>
                        <Input value={formData.ad} onChange={(e) => setFormData({ ...formData, ad: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Kapasite (Litre)</label>
                            <Input type="number" value={formData.kapasiteLitre} onChange={(e) => setFormData({ ...formData, kapasiteLitre: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Mevcut Stok (Litre)</label>
                            <Input type="number" value={formData.mevcutLitre} onChange={(e) => setFormData({ ...formData, mevcutLitre: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Birim Maliyet (₺/L)</label>
                        <Input type="number" step="0.01" value={formData.birimMaliyet} onChange={(e) => setFormData({ ...formData, birimMaliyet: e.target.value })} />
                    </div>
                </div>
                <DialogFooter>
                    <button onClick={handleSave} disabled={loading} className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                        {loading ? 'Güncelleniyor...' : 'Güncelle'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function YakitlarClient({
    initialYakitlar,
    araclar,
    personeller,
    yakitTanklari,
}: {
    initialYakitlar: YakitRow[],
    araclar: AracOption[],
    personeller: PersonelOption[],
    yakitTanklari: any[],
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [tankerOpen, setTankerOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [tankEditOpen, setTankEditOpen] = useState(false);
    const [selectedTank, setSelectedTank] = useState<any | null>(null);
    const [editRow, setEditRow] = useState<YakitRow | null>(null);
    const [editStockRow, setEditStockRow] = useState<YakitRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const shouldOpenCreate = searchParams.get("add") === "true";
    const personelIdSet = React.useMemo(() => new Set(personeller.map((personel) => personel.id)), [personeller]);
    const normalizeSoforId = (soforId?: string | null) => (soforId && personelIdSet.has(soforId) ? soforId : "");
    const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy", { locale: tr }) : '-';

    const tankGosterge = React.useMemo(() => {
        const tanklar = yakitTanklari.map((tank) => {
            const dolulukOrani = tank.kapasiteLitre > 0 ? (tank.mevcutLitre / tank.kapasiteLitre) * 100 : 0;
            return {
                ...tank,
                dolulukOrani,
                stokDegeri: tank.mevcutLitre * tank.birimMaliyet,
            };
        });
        const toplamKapasite = tanklar.reduce((sum, tank) => sum + tank.kapasiteLitre, 0);
        const toplamStok = tanklar.reduce((sum, tank) => sum + tank.mevcutLitre, 0);
        const toplamDeger = tanklar.reduce((sum, tank) => sum + tank.stokDegeri, 0);
        const agirlikliMaliyet = toplamStok > 0 ? toplamDeger / toplamStok : 0;

        let kademeliBaslangic = 0;
        const yerlesim = tanklar.map((tank) => {
            const baslangicOrani = toplamKapasite > 0 ? (kademeliBaslangic / toplamKapasite) * 100 : 0;
            const genislikOrani = toplamKapasite > 0 ? (tank.mevcutLitre / toplamKapasite) * 100 : 0;
            kademeliBaslangic += tank.kapasiteLitre;
            return {
                ...tank,
                baslangicOrani,
                genislikOrani,
            };
        });

        return {
            tanklar: yerlesim,
            toplamKapasite,
            toplamStok,
            toplamDeger,
            agirlikliMaliyet,
            genelDolulukOrani: toplamKapasite > 0 ? (toplamStok / toplamKapasite) * 100 : 0,
        };
    }, [yakitTanklari]);
    const tankGaugeItems = React.useMemo(() => {
        const normalized = (value: unknown) => String(value || "").toLocaleLowerCase("tr-TR");
        const list = tankGosterge.tanklar as any[];
        const usedIds = new Set<string>();
        const pickByKeywords = (keywords: string[]) => {
            const found = list.find((tank) => {
                const name = normalized(tank.ad);
                return !usedIds.has(tank.id) && keywords.some((keyword) => name.includes(keyword));
            });
            if (!found) return null;
            usedIds.add(found.id);
            return found;
        };

        const result: Array<{ id: string; title: string; sublabel: string; tank: any }> = [];
        const tank1 = pickByKeywords(["ana tank 1", "tank 1", "mithra"]);
        const tank2 = pickByKeywords(["ana tank 2", "tank 2", "ana tank"]);
        const gezici = pickByKeywords(["binlik", "gezici", "bidon", "mobil", "tanker"]);

        if (tank1) result.push({ id: tank1.id, title: "Ana Tank", sublabel: tank1.ad, tank: tank1 });
        if (tank2) result.push({ id: tank2.id, title: "Yardımcı Tank", sublabel: tank2.ad, tank: tank2 });
        if (gezici) result.push({ id: gezici.id, title: "Gezici/Bidon", sublabel: gezici.ad, tank: gezici });

        if (result.length === 0) {
            return list.slice(0, 3).map((tank) => ({
                id: tank.id,
                title: tank.ad,
                sublabel: tank.ad,
                tank,
            }));
        }

        return result;
    }, [tankGosterge.tanklar]);

    const son30GunYakitCikisi = React.useMemo(
        () => initialYakitlar.reduce((sum, row) => sum + Number(row?.litre || 0), 0),
        [initialYakitlar]
    );

    const son7GunYakitCikisi = React.useMemo(() => {
        const now = Date.now();
        const yediGunOncesi = now - 7 * 24 * 60 * 60 * 1000;
        return initialYakitlar.reduce((sum, row) => {
            const tarih = new Date(row?.tarih as any).getTime();
            if (!Number.isFinite(tarih) || tarih < yediGunOncesi) return sum;
            return sum + Number(row?.litre || 0);
        }, 0);
    }, [initialYakitlar]);

    const mithraCikisLitre = React.useMemo(
        () =>
            initialYakitlar.reduce((sum, row) => {
                const istasyon = String(row?.istasyon || "").trim().toLocaleLowerCase("tr-TR");
                const isMatch = istasyon === "mithra" || istasyon.includes("ana tank");
                if (!isMatch) return sum;
                return sum + Number(row?.litre || 0);
            }, 0),
        [initialYakitlar]
    );

    const binlikCikisLitre = React.useMemo(
        () =>
            initialYakitlar.reduce((sum, row) => {
                const istasyon = String(row?.istasyon || "").trim().toLocaleLowerCase("tr-TR");
                const isMatch = istasyon === "binlik bidon" || istasyon.includes("binlik") || istasyon.includes("bidon") || istasyon.includes("gezici");
                if (!isMatch) return sum;
                return sum + Number(row?.litre || 0);
            }, 0),
        [initialYakitlar]
    );

    const sonGuncelleme = React.useMemo(() => {
        const latest = initialYakitlar[0];
        if (!latest?.tarih) return "-";
        const d = new Date(latest.tarih as any);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }, [initialYakitlar]);

    const tahminiKalanGun = React.useMemo(() => {
        if (son30GunYakitCikisi <= 0) return null;
        const gunlukOrtalama = son30GunYakitCikisi / 30;
        if (gunlukOrtalama <= 0) return null;
        return Math.max(1, Math.round(tankGosterge.toplamStok / gunlukOrtalama));
    }, [son30GunYakitCikisi, tankGosterge.toplamStok]);

    useEffect(() => {
        if (shouldOpenCreate) {
            setCreateOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("add");
            const query = params.toString();
            router.replace(`/dashboard/yakitlar${query ? `?${query}` : ""}`, { scroll: false });
        }
    }, [shouldOpenCreate, router, searchParams]);

    const handleAracSelection = (aracId: string) => {
        const seciliArac = araclar.find((arac) => arac.id === aracId);
        setFormData((prev) => ({
            ...prev,
            aracId,
            soforId: normalizeSoforId(seciliArac?.aktifSoforId || seciliArac?.kullaniciId),
        }));
    };

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Araç Seçilmedi", { description: "Lütfen yakıt alımı için bir araç seçin." });
        }
        setLoading(true);
        const litre = parseDecimal(formData.litre);
        const km = parseKm(formData.km);
        const isKmInvalid = km !== null && !Number.isFinite(km);
        if (!Number.isFinite(litre) || isKmInvalid) {
            setLoading(false);
            return toast.error("Geçersiz değer", { description: "Litre veya KM alanını kontrol edin." });
        }
        const res = await createYakit({
            ...formData,
            litre,
            tutar: 0,
            km,
            endeks: formData.endeks ? Math.trunc(Number(formData.endeks)) : null,
            soforId: formData.soforId || null,
            odemeYontemi: formData.odemeYontemi
        });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Yakıt Kaydı Eklendi", { description: "Araç yakıt alımı başarıyla kaydedildi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const litre = parseDecimal(formData.litre);
        const km = parseKm(formData.km);
        if (!Number.isFinite(litre)) {
            setLoading(false);
            return toast.error("Geçersiz Değer", { description: "Litre alanını kontrol edin." });
        }
        const res = await updateYakit(editRow.id, {
            ...formData,
            litre,
            tutar: 0,
            km,
            endeks: formData.endeks ? Math.trunc(Number(formData.endeks)) : null,
            soforId: formData.soforId || null,
            odemeYontemi: formData.odemeYontemi
        });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncellendi", { description: "Yakıt alım kaydı güncellendi." });
            router.refresh();
        } else {
            toast.error("Hata", { description: res.error });
        }
        setLoading(false);
    };

    const handleEdit = (row: YakitRow) => {
        if (row.isStokHareketi) {
            setEditStockRow(row);
            const plaka = String(row.arac.plaka || "").toLocaleUpperCase("tr-TR");
            if (plaka === "BİDON DOLUMU") {
                setTransferOpen(true);
            } else {
                setTankerOpen(true);
            }
        } else {
            openEdit(row);
        }
    };

    const openEdit = (row: YakitRow) => {
        setFormData({
            aracId: row.arac.id,
            soforId: normalizeSoforId(row.soforId || (row as any).kullanici?.id || row.arac.kullanici?.id),
            tarih: new Date(row.tarih).toISOString().slice(0, 10),
            litre: row.litre.toString(),
            km: row.km.toString(),
            endeks: row.endeks?.toString() || '',
            istasyon: row.istasyon || '',
            odemeYontemi: row.odemeYontemi || 'NAKIT'
        });
        setEditRow(row);
        setCreateOpen(true);
    };

    const handleDelete = async (row: YakitRow) => {
        const isStok = row.isStokHareketi;
        const plaka = row.arac.plaka;
        const title = isStok ? "Stok Hareketini Sil" : "Kaydı Sil";
        const message = isStok 
            ? `${plaka} işlemini silmek istediğinizden emin misiniz? (Stok iadesi yapılacaktır)` 
            : `${plaka} plakalı aracın yakıt kaydını silmek istediğinizden emin misiniz?`;
            
        const confirmed = await openConfirm({ title, message, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        
        const res = isStok ? await deleteTankHareket(row.id) : await deleteYakit(row.id);
        if (res.success) {
            toast.success("Silindi", { description: "Kayıt başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Hata", { description: res.error });
        }
    };

    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => handleEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original)} />
                </div>
            )
        },
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                         <Fuel className="text-rose-600" /> Yakıt Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Tanker stoklarını ve araç yakıtlarını takip edin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setTankerOpen(true)} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-md font-medium text-sm border border-emerald-200 transition-all flex items-center gap-2">
                        <Plus size={16} /> Tankere Yakıt Al
                    </button>
                    <button onClick={() => setTransferOpen(true)} className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-md font-medium text-sm border border-amber-200 transition-all flex items-center gap-2">
                        <Droplets size={16} /> Bidona Aktar
                    </button>
                    <Dialog open={createOpen} onOpenChange={(v) => {
                        setCreateOpen(v);
                        if (!v) {
                            setFormData({ ...EMPTY });
                            setEditRow(null);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2">
                                <Plus size={16} /> Araca Yakıt Ver
                            </button>
                        </DialogTrigger>
                        <DialogContent >
                            <DialogHeader>
                                <DialogTitle>{editRow ? 'Kaydı Düzenle' : 'Araca Yakıt Verme'}</DialogTitle>
                            </DialogHeader>
                            <FormFields
                                formData={formData}
                                setFormData={setFormData}
                                araclar={araclar}
                                personeller={personeller}
                                onAracChange={handleAracSelection}
                                tankGosterge={tankGosterge}
                            />
                            <DialogFooter>
                                <button onClick={editRow ? handleUpdate : handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                    {loading ? 'İşleniyor...' : editRow ? 'Güncelle' : 'Kaydet'}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <TankerAlimDialog 
                    open={tankerOpen} 
                    onOpenChange={(v) => { 
                        setTankerOpen(v); 
                        if(!v) {
                            setEditStockRow(null);
                            setFormData({ ...EMPTY });
                        }
                    }} 
                    tanks={yakitTanklari} 
                    onSuccess={() => router.refresh()} 
                    editRow={editStockRow}
                />
                <TankerTransferDialog
                    open={transferOpen}
                    onOpenChange={(v) => { 
                        setTransferOpen(v); 
                        if(!v) {
                            setEditStockRow(null);
                            setFormData({ ...EMPTY });
                        }
                    }}
                    onSuccess={() => router.refresh()}
                    editRow={editStockRow}
                />
                <TankEditDialog 
                    open={tankEditOpen} 
                    onOpenChange={(v) => {
                        setTankEditOpen(v);
                        if (!v) {
                            setFormData({ ...EMPTY });
                            setSelectedTank(null);
                        }
                    }} 
                    tank={selectedTank} 
                    onSuccess={() => router.refresh()} 
                />
            </header>

            <section className="mb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800">Tank Durumları</h3>
                        <div className="flex gap-4 text-xs font-medium text-slate-500">
                            <span>Toplam Stok: {formatLitre(tankGosterge.toplamStok)}</span>
                            <span>Genel Doluluk: %{tankGosterge.genelDolulukOrani.toFixed(1)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {tankGaugeItems.map((item) => {
                            const tank = item.tank;
                            const seviye = getTankSeviye(Number(tank.dolulukOrani || 0));
                            const doluluk = Number(tank.dolulukOrani || 0);
                            return (
                                <GaugeChart
                                    key={item.id}
                                    label={item.title}
                                    sublabel={item.sublabel}
                                    value={doluluk}
                                    min={0}
                                    max={100}
                                    valueText={`%${doluluk.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
                                    secondaryText={`${formatLitre(Number(tank.mevcutLitre || 0))} / ${formatLitre(Number(tank.kapasiteLitre || 0))}`}
                                    color={getGaugeColorForTank(doluluk)}
                                    className="h-full"
                                    icon={<Fuel size={32} />}
                                    headerRight={
                                        <button
                                            onClick={() => {
                                                setSelectedTank(tank);
                                                setTankEditOpen(true);
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Tankı düzenle"
                                            aria-label={`${item.title} düzenle`}
                                        >
                                            <PencilLine size={14} />
                                        </button>
                                    }
                                    footer={
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${seviye.badgeClass}`}>
                                                {seviye.etiket}
                                            </span>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Maliyet</p>
                                                <p className="text-xs font-bold text-slate-700">₺{Number(tank.birimMaliyet || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    }
                                />
                            );
                        })}
                    </div>
                </div>
            </section>

            <DataTable
                columns={columnsWithActions as any}
                data={initialYakitlar}
                searchKey="arac_plaka"
                searchPlaceholder="Plaka ara..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{ showDateRange: true }}
                excelEntity="yakit"
            />
        </div>
    );
}
