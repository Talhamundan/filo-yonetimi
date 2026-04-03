"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ClipboardCheck, Plus } from "lucide-react";
import { getAraclarSelect, getKullanicilarSelect } from "./actions";
import { createZimmet } from "@/app/dashboard/zimmetler/actions";
import { useRouter } from "next/navigation";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { nowDateTimeLocal } from "@/lib/datetime-local";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const EMPTY = {
    aracId: '',
    kullaniciId: '',
    baslangic: nowDateTimeLocal(),
    baslangicKm: 0,
    notlar: ''
};

export default function YeniZimmetShortcut({ className, asDropdownItem }: { className?: string, asDropdownItem?: boolean }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [araclar, setAraclar] = useState<any[]>([]);
    const [kullanicilar, setKullanicilar] = useState<any[]>([]);
    const router = useRouter();

    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    const handleOpen = async (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen && araclar.length === 0) {
            setDataLoading(true);
            try {
                const [aRes, kRes] = await Promise.all([
                    getAraclarSelect(),
                    getKullanicilarSelect()
                ]);
                setAraclar(aRes);
                setKullanicilar(kRes);
            } catch (err) {
                toast.error("Veri alınamadı");
            } finally {
                setDataLoading(false);
            }
        }
    };

    const handleAracChange = (aracId: string) => {
        const foundArac = araclar.find(a => a.id === aracId);
        setFormData({
            ...formData,
            aracId,
            baslangicKm: foundArac ? foundArac.guncelKm : 0
        });
    };

    const handleCreate = async () => {
        if (!formData.aracId || !formData.kullaniciId) {
            return toast.warning("Araç ve Personel alanlarını seçin.");
        }
        setLoading(true);
        const res = await createZimmet(formData);
        if (res.success) {
            setOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Zimmet Tanımlandı");
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const trigger = asDropdownItem ? (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpen(true); }} className={className || "cursor-pointer font-medium"}>
            <ClipboardCheck size={14} className="text-amber-600 mr-2" />
            Yeni Zimmet
        </DropdownMenuItem>
    ) : (
        <DialogTrigger asChild>
            <Button variant="outline" className={className || "justify-start"}>
                <ClipboardCheck size={14} className="text-amber-600 mr-1.5" />
                Yeni Zimmet
            </Button>
        </DialogTrigger>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            {trigger}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Yeni Zimmet Kaydı</DialogTitle>
                    <DialogDescription>Aracı bir şoföre atayın.</DialogDescription>
                </DialogHeader>
                {dataLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500">Yükleniyor...</div>
                ) : (
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
                            <label className="text-sm font-medium">Personel / Şoför <span className="text-red-500">*</span></label>
                            <SearchableSelect
                                value={formData.kullaniciId} 
                                onValueChange={(value) => setFormData({ ...formData, kullaniciId: value })}
                                placeholder="Seçiniz..."
                                searchPlaceholder="Personel ara..."
                                options={[
                                    { value: "", label: "Seçiniz..." },
                                    ...kullanicilar.map((k) => ({
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
                            <Input value={formData.notlar} onChange={e => setFormData({...formData, notlar: e.target.value})} placeholder="Örn: Anahtar teslim edildi" className="h-9" />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <button onClick={handleCreate} disabled={loading || dataLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                        {loading ? 'Zimmetleniyor...' : 'Zimmetle'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
