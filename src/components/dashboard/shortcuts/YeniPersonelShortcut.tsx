"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { FormFields, PersonelFormData } from "@/app/dashboard/personel/PersonelForm";
import { getSirketlerSelect } from "./actions";
import { createPersonel } from "@/app/dashboard/personel/actions";
import { useRouter } from "next/navigation";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

const EMPTY: PersonelFormData = {
    ad: '',
    soyad: '',
    telefon: '',
    rol: 'SOFOR',
    sirketId: '',
    calistigiKurum: '',
    tcNo: ''
};

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function YeniPersonelShortcut({ className, asDropdownItem }: { className?: string, asDropdownItem?: boolean }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [formData, setFormData] = useState<PersonelFormData>({ ...EMPTY });
    const [sirketler, setSirketler] = useState<any[]>([]);
    const router = useRouter();
    const { canAssignIndependentRecords } = useDashboardScope();
    const defaultCreateSirketId = !canAssignIndependentRecords && sirketler.length === 1 ? sirketler[0]?.id || "" : "";

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
                const res = await getSirketlerSelect();
                setSirketler(res);
            } catch {
                toast.error("Veri alınamadı");
            } finally {
                setDataLoading(false);
            }
        }
    };

    const handleCreate = async () => {
        if (!formData.ad || !formData.soyad) {
            return toast.warning("Lütfen Zorunlu Alanları (Ad, Soyad) doldurun.");
        }
        setLoading(true);
        const res = await createPersonel(formData);
        if (res.success) {
            setOpen(false);
            setFormData({ ...EMPTY, sirketId: defaultCreateSirketId });
            toast.success("Personel Kaydedildi", { description: "Sisteme başarıyla eklendi." });
            router.refresh();
        } else {
            toast.error("Hata", { description: res.error });
        }
        setLoading(false);
    };

    const trigger = asDropdownItem ? (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpen(true); }} className={className || "cursor-pointer font-medium"}>
            <Users size={14} className="text-emerald-600 mr-2" />
            Yeni Personel
        </DropdownMenuItem>
    ) : (
        <DialogTrigger asChild>
            <Button variant="outline" className={className || "justify-start"}>
                <Users size={14} className="text-emerald-600 mr-1.5" />
                Yeni Personel
            </Button>
        </DialogTrigger>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            {trigger}
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Yeni Personel Oluştur</DialogTitle>
                    <DialogDescription>Hızlı sistem personeli kaydı.</DialogDescription>
                </DialogHeader>
                {dataLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500">Yükleniyor...</div>
                ) : (
                    <FormFields
                        formData={formData}
                        setFormData={setFormData as any}
                        sirketler={sirketler}
                        allowAdminRole={false}
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
