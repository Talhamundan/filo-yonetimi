"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Car, Building2, User } from "lucide-react";
import { getSirketlerSelect, getKullanicilarSelect } from "./actions";
import { createArac } from "@/app/dashboard/araclar/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";
import { ARAC_UST_KATEGORI_OPTIONS, getAracAltKategoriOptions, resolveAracKategoriFields } from "@/lib/arac-kategori";

const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

const EMPTY = {
    plaka: '',
    marka: '',
    model: '',
    yil: new Date().getFullYear(),
    muayeneGecerlilikTarihi: '',
    bulunduguIl: 'MERKEZ',
    guncelKm: 0,
    aciklama: '',
    sirketId: '',
    kullaniciId: '',
    ruhsatSeriNo: '',
    saseNo: '',
    kategori: 'BINEK',
    altKategori: 'OTOMOBIL',
};

const FormFields = ({
    formData,
    setFormData,
    sirketler,
    kullanicilar,
    allowIndependentOption = true,
}: {
    formData: any,
    setFormData: any,
    sirketler: { id: string; ad: string; bulunduguIl?: string; santiyeler?: string[] }[],
    kullanicilar: any[],
    allowIndependentOption?: boolean,
}) => (
    <div className="grid grid-cols-2 gap-4 py-2">
        {(() => {
            const resolvedKategoriFields = resolveAracKategoriFields({
                kategori: formData.kategori,
                altKategori: formData.altKategori,
            });
            const altKategoriOptions = getAracAltKategoriOptions(resolvedKategoriFields.kategori);
            const selectedSirket = sirketler.find((item) => item.id === formData.sirketId);
            const santiyeOptions = (selectedSirket?.santiyeler || []).filter((item) => String(item || "").trim().length > 0);
            const santiyeListId = formData.sirketId ? `shortcut-arac-santiye-${formData.sirketId}` : "shortcut-arac-santiye-generic";
            return (
                <>
                    <div className="col-span-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Temel Bilgiler</p>
                    </div>
                    <div className="space-y-1.5 font-sans">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <Car size={14} className="text-slate-400" />
                            Plaka <span className="text-rose-500">*</span>
                        </label>
                        <Input value={formData.plaka} onChange={e => setFormData({...formData, plaka: forceUppercase(e.target.value)})} placeholder="34 ABC 123" className="h-9 font-mono uppercase" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Marka <span className="text-rose-500">*</span></label>
                        <Input value={formData.marka} onChange={e => setFormData({...formData, marka: forceUppercase(e.target.value)})} placeholder="RENAULT" className="h-9 uppercase" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Model <span className="text-rose-500">*</span></label>
                        <Input value={formData.model} onChange={e => setFormData({...formData, model: forceUppercase(e.target.value)})} placeholder="MEGANE" className="h-9 uppercase" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Model Yılı <span className="text-rose-500">*</span></label>
                        <Input type="number" value={formData.yil} onChange={e => setFormData({...formData, yil: parseInt(e.target.value)})} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Güncel KM <span className="text-rose-500">*</span></label>
                        <Input type="number" value={formData.guncelKm} onChange={e => setFormData({...formData, guncelKm: parseInt(e.target.value)})} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Muayene Geçerlilik</label>
                        <Input type="datetime-local" value={formData.muayeneGecerlilikTarihi} onChange={e => setFormData({ ...formData, muayeneGecerlilikTarihi: e.target.value })} className="h-9" />
                    </div>

                    <div className="col-span-2 pt-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Organizasyon & Zimmet</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400" />
                            Bağlı Şirket
                        </label>
                        <select 
                            value={formData.sirketId} 
                            onChange={e => {
                                const nextSirketId = e.target.value;
                                const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                                const nextSantiyeler = (selectedSirket?.santiyeler || []).filter((item) => String(item || "").trim().length > 0);
                                setFormData({
                                    ...formData,
                                    sirketId: nextSirketId,
                                    bulunduguIl: nextSantiyeler[0] || selectedSirket?.bulunduguIl || formData.bulunduguIl
                                });
                            }}
                            className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            {allowIndependentOption ? <option value="">Şirket Seçiniz (Bağımsız)</option> : <option value="" disabled>Şirket Seçiniz</option>}
                            {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <User size={14} className="text-slate-400" />
                            Mevcut Şoför (Zimmet)
                        </label>
                        <SearchableSelect
                            value={formData.kullaniciId} 
                            onValueChange={(value) => setFormData({ ...formData, kullaniciId: value })}
                            placeholder="Şoför Seçiniz (Atanmamış)"
                            searchPlaceholder="Personel ara..."
                            options={[
                                { value: "", label: "Şoför Seçiniz (Atanmamış)" },
                                ...kullanicilar.map((u) => ({
                                    value: u.id,
                                    label: getPersonelOptionLabel(u),
                                    searchText: getPersonelOptionSearchText(u),
                                })),
                            ]}
                        />
                    </div>

                    <div className="col-span-2 pt-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Diğer Bilgiler</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Bulunduğu Şantiye</label>
                        <Input
                            value={formData.bulunduguIl}
                            onChange={e => setFormData({ ...formData, bulunduguIl: forceUppercase(e.target.value) })}
                            list={santiyeListId}
                            placeholder={santiyeOptions.length > 0 ? "Şantiye seçin veya yazın" : "Şantiye adı yazın"}
                            className="h-9 uppercase"
                        />
                        <datalist id={santiyeListId}>
                            {santiyeOptions.map((santiye) => (
                                <option key={santiye} value={santiye} />
                            ))}
                        </datalist>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Üst Kategori</label>
                        <select 
                            value={resolvedKategoriFields.kategori}
                            onChange={e => {
                                const next = resolveAracKategoriFields({
                                    kategori: e.target.value,
                                    altKategori: resolvedKategoriFields.altKategori,
                                });
                                setFormData({
                                    ...formData,
                                    kategori: next.kategori,
                                    altKategori: next.altKategori,
                                });
                            }}
                            className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            {ARAC_UST_KATEGORI_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Alt Kategori</label>
                        <select
                            value={resolvedKategoriFields.altKategori}
                            onChange={e => setFormData({ ...formData, altKategori: e.target.value })}
                            className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            {altKategoriOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                        <label className="text-sm font-medium">Açıklama (Opsiyonel)</label>
                        <textarea
                            value={formData.aciklama}
                            onChange={e => setFormData({ ...formData, aciklama: e.target.value })}
                            rows={2}
                            placeholder="Araç hakkında ek bilgiler..."
                            className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                    </div>
                </>
            );
        })()}
    </div>
);

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function YeniAracShortcut({ className, asDropdownItem }: { className?: string, asDropdownItem?: boolean }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [sirketler, setSirketler] = useState<any[]>([]);
    const [kullanicilar, setKullanicilar] = useState<any[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { canAssignIndependentRecords } = useDashboardScope();
    const scopedSirketId = searchParams.get("sirket")?.trim() || "";
    const defaultCreateSirketId = React.useMemo(() => {
        if (scopedSirketId && sirketler.some((s) => s.id === scopedSirketId)) {
            return scopedSirketId;
        }
        if (sirketler.length === 1) {
            return sirketler[0]?.id || "";
        }
        if (!canAssignIndependentRecords && sirketler.length > 1) {
            return sirketler[0]?.id || "";
        }
        return "";
    }, [canAssignIndependentRecords, scopedSirketId, sirketler]);

    useEffect(() => {
        if (!open) return;
        if (!defaultCreateSirketId) return;
        setFormData((prev) => (prev.sirketId ? prev : { ...prev, sirketId: defaultCreateSirketId }));
    }, [open, defaultCreateSirketId]);

    const handleOpen = async (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen && sirketler.length === 0) {
            setDataLoading(true);
            try {
                const [sRes, kRes] = await Promise.all([
                    getSirketlerSelect(),
                    getKullanicilarSelect()
                ]);
                setSirketler(sRes);
                setKullanicilar(kRes);
            } catch {
                toast.error("Veri alınamadı");
            } finally {
                setDataLoading(false);
            }
        }
    };

    const handleCreate = async () => {
        if (!formData.plaka || !formData.marka) {
            return toast.warning("Plaka ve Marka alanlarını doldurun.");
        }
        setLoading(true);
        const res = await createArac(formData);
        if (res.success) {
            setOpen(false);
            setFormData({ ...EMPTY, sirketId: defaultCreateSirketId });
            toast.success("Araç Kaydedildi");
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const trigger = asDropdownItem ? (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpen(true); }} className={className || "cursor-pointer font-medium"}>
            <Car size={14} className="text-indigo-600 mr-2" />
            Yeni Araç
        </DropdownMenuItem>
    ) : (
        <DialogTrigger asChild>
            <Button variant="outline" className={className || "justify-start"}>
                <Car size={14} className="text-indigo-600 mr-1.5" />
                Yeni Araç
            </Button>
        </DialogTrigger>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            {trigger}
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Yeni Araç Ekle</DialogTitle>
                    <DialogDescription>Filoya yeni bir araç ekleyin.</DialogDescription>
                </DialogHeader>
                {dataLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500">Yükleniyor...</div>
                ) : (
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        sirketler={sirketler}
                        kullanicilar={kullanicilar}
                        allowIndependentOption={canAssignIndependentRecords}
                    />
                )}
                <DialogFooter>
                    <button 
                        onClick={handleCreate}
                        disabled={loading || dataLoading}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
