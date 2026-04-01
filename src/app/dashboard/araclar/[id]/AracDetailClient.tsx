"use client"

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Car, Users, Wrench, Fuel, ArrowLeft, Activity, ShieldCheck, ShieldAlert, AlertTriangle, MapPin, FileDigit, Settings, Receipt, FileArchive, CreditCard, FileText, Plus, Pencil, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { createZimmet, finalizeZimmet } from "../../zimmetler/actions";
import { createHgs } from "../../hgs/actions";
import { addBakim } from "../../bakimlar/actions";
import { createYakit } from "../../yakitlar/actions";
import { createMasraf } from "../../masraflar/actions";
import { createSigorta } from "../../trafik-sigortasi/actions";
import { createKasko } from "../../kasko/actions";
import { createMuayene } from "../../muayeneler/actions";
import { createDokuman } from "../../dokumanlar/actions";
import { deleteArizaKaydi, seviseGonderArizaKaydi, updateArizaKaydi } from "../../arizalar/actions";
import { deleteArac, updateArac } from "../actions";
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status";
import { sortByTextValue } from "@/lib/sort-utils";
import { PersonelLink } from "@/components/links/RecordLinks";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AracDetaySaaS = any;

const todayDate = () => nowDateTimeLocal();
const oneYearAfter = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return nowDateTimeLocal();
    date.setFullYear(date.getFullYear() + 1);
    return toDateTimeLocalInput(date);
};
const twoYearsAfter = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return nowDateTimeLocal();
    date.setFullYear(date.getFullYear() + 2);
    return toDateTimeLocalInput(date);
};

const MASRAF_TURLERI = ['BAKIM_ONARIM', 'LASTIK', 'TEMIZLIK', 'OTOPARK', 'KOPRU_OBO', 'DIGER'];
const DOKUMAN_TURLERI = [
    { label: "Ruhsat", value: "RUHSAT" },
    { label: "Trafik Sigortası", value: "SIGORTA" },
    { label: "Kasko Poliçesi", value: "KASKO" },
    { label: "Servis & Fatura", value: "SERVIS_FATURA" },
    { label: "Diğer", value: "DIGER" },
];

const ILLER = [
    { value: "ISTANBUL", label: "İSTANBUL" },
    { value: "BURSA", label: "BURSA" },
    { value: "SANLIURFA", label: "ŞANLIURFA" },
    { value: "ANKARA", label: "ANKARA" },
    { value: "DIGER", label: "DİĞER" },
];
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

const QUICK_ADD_CONFIG: Record<string, { button: string; title: string; description: string }> = {
    soforGecmisi: { button: "Zimmet Ekle", title: "Yeni Zimmet Kaydı", description: "Bu araca yeni şoför ataması yapın." },
    ruhsat: { button: "Ruhsat Belgesi Ekle", title: "Ruhsat Belgesi Ekle", description: "Aracın ruhsat belgesini bu ekrandan kaydedin." },
    hgs: { button: "HGS Yükleme Ekle", title: "HGS Yükleme Kaydı", description: "Tutar ve tarih girerek HGS yüklemesi ekleyin." },
    bakim: { button: "Servis Kaydı Ekle", title: "Servis Kaydı Ekle", description: "Periyodik bakım veya arıza kaydını bu sekmeden oluşturun." },
    yakit: { button: "Yakıt Kaydı Ekle", title: "Yakıt Alımı Kaydı", description: "Litre ve litre fiyatını girin, toplam otomatik hesaplanır." },
    masraflar: { button: "Masraf Ekle", title: "Ek Masraf Kaydı", description: "Araç için kategori bazlı gider kaydı oluşturun." },
    sigorta: { button: "Poliçe Ekle", title: "Sigorta / Kasko Kaydı", description: "Trafik sigortası veya kasko kaydı ekleyin." },
    muayene: { button: "Muayene Ekle", title: "Muayene Kaydı", description: "Muayene tarih, sonuç ve ücret bilgilerini kaydedin." },
    dokuman: { button: "Evrak Ekle", title: "Yeni Evrak", description: "Araça ait dijital evrağı sisteme kaydedin." },
};

type SoforOption = {
    id: string;
    adSoyad: string;
    sirketId?: string | null;
    sirketAd?: string | null;
};

export default function AracDetailClient({
    initialArac: arac,
    kullanicilar,
    sirketler,
}: {
    initialArac: AracDetaySaaS;
    kullanicilar: SoforOption[];
    sirketler: Array<{ id: string; ad: string; bulunduguIl?: string | null }>;
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAssignIndependentRecords } = useDashboardScope();
    const router = useRouter();
    const [loading, setLoading] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("ozet");
    const [quickAddOpen, setQuickAddOpen] = React.useState(false);
    const [submittingQuickAdd, setSubmittingQuickAdd] = React.useState(false);

    const [zimmetForm, setZimmetForm] = React.useState({
        kullaniciId: "",
        baslangic: todayDate(),
        baslangicKm: String(arac.guncelKm || 0),
        notlar: "",
    });
    const [ruhsatDokumanForm, setRuhsatDokumanForm] = React.useState({
        ad: "",
        dosyaUrl: "",
    });
    const [hgsForm, setHgsForm] = React.useState({
        tarih: todayDate(),
        etiketNo: arac.hgsNo || "",
        tutar: "",
        km: String(arac.guncelKm || 0),
    });
    const [bakimForm, setBakimForm] = React.useState({
        kategori: "PERIYODIK_BAKIM" as "PERIYODIK_BAKIM" | "ARIZA",
        bakimTarihi: todayDate(),
        yapilanKm: String(arac.guncelKm || 0),
        servisAdi: "",
        yapilanIslemler: "",
        tutar: "",
    });
    const [yakitForm, setYakitForm] = React.useState({
        tarih: nowDateTimeLocal(),
        litre: "",
        litreFiyati: "",
        km: String(arac.guncelKm || 0),
        istasyon: "",
        odemeYontemi: "NAKIT",
    });
    const [masrafForm, setMasrafForm] = React.useState({
        tarih: todayDate(),
        tur: "BAKIM_ONARIM",
        tutar: "",
        aciklama: "",
    });
    const [sigortaTipi, setSigortaTipi] = React.useState<"TRAFIK" | "KASKO">("TRAFIK");
    const [sigortaForm, setSigortaForm] = React.useState({
        sirket: "",
        acente: "",
        policeNo: "",
        baslangicTarihi: todayDate(),
        bitisTarihi: oneYearAfter(todayDate()),
        tutar: "",
        aktifMi: true,
    });
    const [muayeneForm, setMuayeneForm] = React.useState({
        muayeneTarihi: todayDate(),
        gecerlilikTarihi: twoYearsAfter(todayDate()),
        tutar: "",
        gectiMi: true,
        km: String(arac.guncelKm || 0),
        aktifMi: true,
    });
    const [dokumanForm, setDokumanForm] = React.useState({
        ad: "",
        tur: "DIGER" as "RUHSAT" | "SIGORTA" | "KASKO" | "SERVIS_FATURA" | "DIGER",
        dosyaUrl: "",
    });
    const [soforAtamaOpen, setSoforAtamaOpen] = React.useState(false);
    const [soforAtamaForm, setSoforAtamaForm] = React.useState({
        kullaniciId: "",
        baslangic: todayDate(),
        baslangicKm: String(arac.guncelKm || 0),
        notlar: "",
    });
    const [soforIadeOpen, setSoforIadeOpen] = React.useState(false);
    const [soforIadeForm, setSoforIadeForm] = React.useState({
        bitis: nowDateTimeLocal(),
        bitisKm: String(arac.guncelKm || 0),
        notlar: "",
    });
    const [editArizaRow, setEditArizaRow] = React.useState<AracDetaySaaS | null>(null);
    const [arizaActionLoading, setArizaActionLoading] = React.useState(false);
    const [arizaEditForm, setArizaEditForm] = React.useState({
        soforId: "",
        aciklama: "",
        oncelik: "ORTA" as "DUSUK" | "ORTA" | "YUKSEK",
        km: "",
        servisAdi: "",
        yapilanIslemler: "",
        tutar: "",
        bildirimTarihi: nowDateTimeLocal(),
    });
    const [editAracOpen, setEditAracOpen] = React.useState(false);
    const [updatingArac, setUpdatingArac] = React.useState(false);
    const [aracEditForm, setAracEditForm] = React.useState({
        plaka: forceUppercase(arac.plaka || ""),
        marka: forceUppercase(arac.marka || ""),
        model: forceUppercase(arac.model || ""),
        yil: Number(arac.yil || new Date().getFullYear()),
        muayeneGecerlilikTarihi: toDateTimeLocalInput(arac.muayene?.[0]?.gecerlilikTarihi),
        bulunduguIl: arac.bulunduguIl || "ISTANBUL",
        guncelKm: Number(arac.guncelKm || 0),
        bedel: arac.bedel === null || arac.bedel === undefined ? "" : String(arac.bedel),
        kategori: arac.kategori || "BINEK",
        calistigiKurum: arac.calistigiKurum || arac.kullanici?.sirket?.ad || "",
        sirketId: arac.sirket?.id || "",
        hgsNo: arac.hgsNo || "",
        ruhsatSeriNo: arac.ruhsatSeriNo || "",
        aciklama: arac.aciklama || "",
        saseNo: arac.saseNo || "",
        kullaniciId: arac.kullanici?.id || "",
    });
    const sortedKullanicilar = React.useMemo(
        () => sortByTextValue(kullanicilar, (k) => k.adSoyad),
        [kullanicilar]
    );
    const editAracFormKullanicilar = React.useMemo(() => {
        if (!arac.kullanici?.id) {
            return sortedKullanicilar;
        }

        const alreadyExists = sortedKullanicilar.some((k) => k.id === arac.kullanici?.id);
        if (alreadyExists) {
            return sortedKullanicilar;
        }

        const mevcutKullanici = {
            id: arac.kullanici.id,
            adSoyad: `${arac.kullanici.ad || ""} ${arac.kullanici.soyad || ""}`.trim(),
            sirketId: arac.kullanici.sirket?.id || null,
            sirketAd: arac.kullanici.sirket?.ad || null,
        };

        return sortByTextValue([...sortedKullanicilar, mevcutKullanici], (u) => u.adSoyad);
    }, [arac.kullanici, sortedKullanicilar]);
    const kullaniciFirmaOptions = React.useMemo(() => {
        const options = Array.from(
            new Set(
                sirketler
                    .map((sirket) => (sirket.ad || "").trim())
                    .filter((ad) => ad.length > 0)
            )
        );
        if (!options.some((option) => option.toLocaleLowerCase("tr-TR") === "özel")) {
            options.push("Özel");
        }
        if (aracEditForm.calistigiKurum?.trim()) {
            const current = aracEditForm.calistigiKurum.trim();
            if (!options.some((option) => option.localeCompare(current, "tr-TR", { sensitivity: "base" }) === 0)) {
                options.push(current);
            }
        }
        return sortByTextValue(options, (item) => item);
    }, [aracEditForm.calistigiKurum, sirketler]);
    const arizaSoforOptions = React.useMemo(() => {
        if (!arac.kullanici?.id) {
            return sortedKullanicilar;
        }

        const options = new Map<string, SoforOption>();
        const ekle = (id?: string | null, adSoyad?: string | null) => {
            if (!id) return;
            const text = (adSoyad || "").trim();
            if (!text) return;
            options.set(id, { id, adSoyad: text });
        };

        ekle(arac.kullanici.id, `${arac.kullanici.ad || ""} ${arac.kullanici.soyad || ""}`);

        const seciliSoforId = editArizaRow?.soforId || arizaEditForm.soforId;
        const seciliSofor = sortedKullanicilar.find((k) => k.id === seciliSoforId);
        if (seciliSofor) {
            ekle(seciliSofor.id, seciliSofor.adSoyad);
        }

        return Array.from(options.values());
    }, [arac.kullanici, arizaEditForm.soforId, editArizaRow?.soforId, sortedKullanicilar]);

    React.useEffect(() => {
        setQuickAddOpen(false);
    }, [activeTab]);

    const activeZimmet = React.useMemo(() => {
        const gecmis = Array.isArray(arac.kullaniciGecmisi) ? arac.kullaniciGecmisi : [];
        return gecmis.find((z: any) => !z.bitis) || null;
    }, [arac.kullaniciGecmisi]);

    const resetAracEditForm = React.useCallback(() => {
        setAracEditForm({
            plaka: forceUppercase(arac.plaka || ""),
            marka: forceUppercase(arac.marka || ""),
            model: forceUppercase(arac.model || ""),
            yil: Number(arac.yil || new Date().getFullYear()),
            muayeneGecerlilikTarihi: toDateTimeLocalInput(arac.muayene?.[0]?.gecerlilikTarihi),
            bulunduguIl: arac.bulunduguIl || "ISTANBUL",
            guncelKm: Number(arac.guncelKm || 0),
            bedel: arac.bedel === null || arac.bedel === undefined ? "" : String(arac.bedel),
            kategori: arac.kategori || "BINEK",
            calistigiKurum: arac.calistigiKurum || arac.kullanici?.sirket?.ad || "",
            sirketId: arac.sirket?.id || "",
            hgsNo: arac.hgsNo || "",
            ruhsatSeriNo: arac.ruhsatSeriNo || "",
            aciklama: arac.aciklama || "",
            saseNo: arac.saseNo || "",
            kullaniciId: arac.kullanici?.id || "",
        });
    }, [arac]);

    const handleUpdateAracBilgileri = async () => {
        if (!aracEditForm.plaka.trim() || !aracEditForm.marka.trim() || !aracEditForm.model.trim()) {
            toast.warning("Eksik Bilgi", { description: "Plaka, marka ve model alanları zorunludur." });
            return;
        }

        const yil = Number(aracEditForm.yil);
        const guncelKm = Number(aracEditForm.guncelKm);
        if (!Number.isFinite(yil) || yil < 1900) {
            toast.warning("Geçersiz Değer", { description: "Model yılı geçerli bir sayı olmalıdır." });
            return;
        }
        if (!Number.isFinite(guncelKm) || guncelKm < 0) {
            toast.warning("Geçersiz Değer", { description: "Güncel KM 0 veya daha büyük olmalıdır." });
            return;
        }

        setUpdatingArac(true);
        const res = await updateArac(arac.id, {
            plaka: forceUppercase(aracEditForm.plaka),
            marka: forceUppercase(aracEditForm.marka),
            model: forceUppercase(aracEditForm.model),
            yil,
            muayeneGecerlilikTarihi: aracEditForm.muayeneGecerlilikTarihi || null,
            bulunduguIl: aracEditForm.bulunduguIl,
            guncelKm,
            bedel: aracEditForm.bedel,
            kategori: aracEditForm.kategori,
            calistigiKurum: aracEditForm.calistigiKurum || null,
            sirketId: aracEditForm.sirketId || null,
            hgsNo: aracEditForm.hgsNo || null,
            ruhsatSeriNo: aracEditForm.ruhsatSeriNo || null,
            aciklama: aracEditForm.aciklama || null,
            saseNo: forceUppercase(aracEditForm.saseNo || ""),
            kullaniciId: aracEditForm.kullaniciId || null,
        });
        setUpdatingArac(false);

        if (res.success) {
            setEditAracOpen(false);
            toast.success("Araç bilgileri güncellendi.");
            if (res.info) {
                toast.info(res.info);
            }
            router.refresh();
            return;
        }

        toast.error("Güncelleme başarısız.", { description: res.error });
    };

    const handleDeleteArac = async () => {
        const confirmed = await openConfirm({
            title: "Aracı Sil",
            message: `${arac.plaka} plakalı aracı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;

        setLoading(true);
        const res = await deleteArac(arac.id);
        setLoading(false);

        if (res.success) {
            toast.success("Araç silindi.");
            router.push("/dashboard/araclar");
            return;
        }

        if ((res as { code?: string }).code === "AKTIF_KULLANIM") {
            toast.warning("Araç silinemedi.", { description: res.error });
            return;
        }

        toast.error("Silme işlemi başarısız.", { description: res.error });
    };

    const handleUnassign = async () => {
        if (!activeZimmet?.id) {
            toast.warning("Aktif zimmet kaydı bulunamadı.");
            return;
        }
        if (!soforIadeForm.bitis || !soforIadeForm.bitisKm) {
            toast.warning("Eksik Bilgi", { description: "Teslim alma tarihi ve teslim alma KM zorunludur." });
            return;
        }

        setLoading(true);
        const res = await finalizeZimmet(activeZimmet.id, {
            bitis: soforIadeForm.bitis,
            bitisKm: Number(soforIadeForm.bitisKm),
            notlar: soforIadeForm.notlar || null,
        });
        setLoading(false);

        if (res.success) {
            toast.success("Şoför başarıyla ayrıldı.");
            setSoforIadeOpen(false);
            setSoforIadeForm({
                bitis: nowDateTimeLocal(),
                bitisKm: String(arac.guncelKm || 0),
                notlar: "",
            });
            router.refresh();
        } else {
            toast.error(res.error || "İşlem başarısız.");
        }
    };

    const handleAssignSofor = async () => {
        if (!soforAtamaForm.kullaniciId) {
            toast.warning("Eksik Bilgi", { description: "Lütfen bir şoför seçin." });
            return;
        }

        setLoading(true);
        const res = await createZimmet({
            aracId: arac.id,
            kullaniciId: soforAtamaForm.kullaniciId,
            baslangic: soforAtamaForm.baslangic,
            baslangicKm: Number(soforAtamaForm.baslangicKm || 0),
            notlar: soforAtamaForm.notlar || undefined,
        });

        if (res.success) {
            toast.success("Şoför ataması yapıldı.");
            setSoforAtamaOpen(false);
            setSoforAtamaForm({
                kullaniciId: "",
                baslangic: todayDate(),
                baslangicKm: String(arac.guncelKm || 0),
                notlar: "",
            });
            router.refresh();
        } else {
            toast.error(res.error || "Şoför ataması başarısız.");
        }
        setLoading(false);
    };

    const openArizaEdit = (row: AracDetaySaaS) => {
        setArizaEditForm({
            soforId: row.soforId || "",
            aciklama: row.aciklama || "",
            oncelik: row.oncelik === "KRITIK" ? "YUKSEK" : (row.oncelik || "ORTA"),
            km: row.km != null ? String(row.km) : "",
            servisAdi: row.servisAdi || "",
            yapilanIslemler: row.yapilanIslemler || "",
            tutar: row.tutar ? String(row.tutar) : "",
            bildirimTarihi: row.bildirimTarihi ? toDateTimeLocalInput(row.bildirimTarihi) : nowDateTimeLocal(),
        });
        setEditArizaRow(row);
    };

    const closeArizaEdit = () => {
        setEditArizaRow(null);
        setArizaEditForm({
            soforId: "",
            aciklama: "",
            oncelik: "ORTA",
            km: "",
            servisAdi: "",
            yapilanIslemler: "",
            tutar: "",
            bildirimTarihi: nowDateTimeLocal(),
        });
    };

    const handleUpdateAriza = async () => {
        if (!editArizaRow || !arizaEditForm.aciklama.trim()) {
            toast.warning("Eksik Bilgi", { description: "Arıza açıklaması zorunludur." });
            return;
        }

        setArizaActionLoading(true);
        const res = await updateArizaKaydi(editArizaRow.id, {
            soforId: arizaEditForm.soforId || null,
            aciklama: arizaEditForm.aciklama.trim(),
            oncelik: arizaEditForm.oncelik,
            km: arizaEditForm.km ? Number(arizaEditForm.km) : null,
            servisAdi: arizaEditForm.servisAdi || null,
            yapilanIslemler: arizaEditForm.yapilanIslemler || null,
            tutar: arizaEditForm.tutar ? Number(arizaEditForm.tutar) : 0,
            bildirimTarihi: arizaEditForm.bildirimTarihi ? new Date(arizaEditForm.bildirimTarihi) : new Date(),
        });
        setArizaActionLoading(false);

        if (res.success) {
            toast.success("Arıza kaydı güncellendi.");
            closeArizaEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleSeviseGonderAriza = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Servise Gönder",
            message: `${arac.plaka} için açılan arıza kaydı servise gönderilecek. Onaylıyor musunuz?`,
            confirmText: "Gönder",
            variant: "warning",
        });
        if (!confirmed) return;

        setArizaActionLoading(true);
        const res = await seviseGonderArizaKaydi(row.id);
        setArizaActionLoading(false);

        if (res.success) {
            toast.success("Araç servise alındı.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteAriza = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Arıza Kaydını Sil",
            message: `${arac.plaka} için arıza kaydını silmek istediğinize emin misiniz?`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;

        setArizaActionLoading(true);
        const res = await deleteArizaKaydi(row.id);
        setArizaActionLoading(false);

        if (res.success) {
            toast.success("Arıza kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const getStatusBadge = (durum: string) => {
        switch (durum) {
            case 'AKTIF': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-semibold px-3 py-1 border-0 shadow-none">Aktif</Badge>;
            case 'SERVISTE': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold px-3 py-1 border-0 shadow-none">Serviste</Badge>;
            case 'YEDEK': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold px-3 py-1 border-0 shadow-none">Yedek</Badge>;
            case 'ARIZALI': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 font-semibold px-3 py-1 border-0 shadow-none">Arızalı</Badge>;
            case 'SATILDI': return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold px-3 py-1 border-0 shadow-none">Satıldı</Badge>;
            case 'BOSTA': return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-200 font-semibold px-3 py-1 border-0 shadow-none">Boşta</Badge>;
            default: return <Badge variant="outline" className="font-semibold px-3 py-1 shadow-none">{durum}</Badge>;
        }
    };

    const renderDeadlineBadge = (targetDate: string | Date | null | undefined, aktifMi = true) => {
        const daysLeft = getDaysLeft(targetDate);
        if (daysLeft == null) {
            return <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">Belirsiz</Badge>;
        }
        if (!aktifMi) {
            return <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">Geçmiş Kayıt</Badge>;
        }
        const badge = getDeadlineBadgeConfig(daysLeft);
        return <Badge className={`${badge.className} border-0 shadow-none`}>{badge.label}</Badge>;
    };

    const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';

    const resetFormForTab = (tab: string) => {
        if (tab === "soforGecmisi") {
            setZimmetForm({
                kullaniciId: "",
                baslangic: todayDate(),
                baslangicKm: String(arac.guncelKm || 0),
                notlar: "",
            });
        } else if (tab === "ruhsat") {
            setRuhsatDokumanForm({ ad: "", dosyaUrl: "" });
        } else if (tab === "hgs") {
            setHgsForm({
                tarih: todayDate(),
                etiketNo: arac.hgsNo || "",
                tutar: "",
                km: String(arac.guncelKm || 0),
            });
        } else if (tab === "bakim") {
            setBakimForm({
                kategori: "PERIYODIK_BAKIM",
                bakimTarihi: todayDate(),
                yapilanKm: String(arac.guncelKm || 0),
                servisAdi: "",
                yapilanIslemler: "",
                tutar: "",
            });
        } else if (tab === "yakit") {
            setYakitForm({
                tarih: nowDateTimeLocal(),
                litre: "",
                litreFiyati: "",
                km: String(arac.guncelKm || 0),
                istasyon: "",
                odemeYontemi: "NAKIT",
            });
        } else if (tab === "masraflar") {
            setMasrafForm({
                tarih: todayDate(),
                tur: "BAKIM_ONARIM",
                tutar: "",
                aciklama: "",
            });
        } else if (tab === "sigorta") {
            setSigortaForm({
                sirket: "",
                acente: "",
                policeNo: "",
                baslangicTarihi: todayDate(),
                bitisTarihi: oneYearAfter(todayDate()),
                tutar: "",
                aktifMi: true,
            });
            setSigortaTipi("TRAFIK");
        } else if (tab === "muayene") {
            setMuayeneForm({
                muayeneTarihi: todayDate(),
                gecerlilikTarihi: twoYearsAfter(todayDate()),
                tutar: "",
                gectiMi: true,
                km: String(arac.guncelKm || 0),
                aktifMi: true,
            });
        } else if (tab === "dokuman") {
            setDokumanForm({
                ad: "",
                tur: "DIGER",
                dosyaUrl: "",
            });
        }
    };

    const handleQuickCreate = async () => {
        try {
            setSubmittingQuickAdd(true);

            if (activeTab === "soforGecmisi") {
                if (!zimmetForm.kullaniciId) {
                    toast.warning("Eksik Bilgi", { description: "Lütfen şoför seçin." });
                    return;
                }
                const res = await createZimmet({
                    aracId: arac.id,
                    kullaniciId: zimmetForm.kullaniciId,
                    baslangic: zimmetForm.baslangic,
                    baslangicKm: Number(zimmetForm.baslangicKm || 0),
                    notlar: zimmetForm.notlar || undefined,
                });
                if (!res.success) throw new Error(res.error || "Zimmet kaydı oluşturulamadı.");
                toast.success("Zimmet kaydı eklendi.");
            } else if (activeTab === "ruhsat") {
                if (!ruhsatDokumanForm.ad.trim()) {
                    toast.warning("Eksik Bilgi", { description: "Belge adı zorunludur." });
                    return;
                }
                const res = await createDokuman({
                    ad: ruhsatDokumanForm.ad.trim(),
                    aracId: arac.id,
                    tur: "RUHSAT",
                    dosyaUrl: ruhsatDokumanForm.dosyaUrl.trim() || "https://example.com/mock-file.pdf",
                });
                if (!res.success) throw new Error(res.error || "Ruhsat belgesi oluşturulamadı.");
                toast.success("Ruhsat belgesi eklendi.");
            } else if (activeTab === "hgs") {
                if (!hgsForm.tutar) {
                    toast.warning("Eksik Bilgi", { description: "Yükleme tutarı zorunludur." });
                    return;
                }
                const res = await createHgs({
                    aracId: arac.id,
                    tarih: hgsForm.tarih,
                    etiketNo: hgsForm.etiketNo,
                    tutar: Number(hgsForm.tutar),
                    km: hgsForm.km ? Number(hgsForm.km) : undefined,
                });
                if (!res.success) throw new Error(res.error || "HGS yükleme kaydı oluşturulamadı.");
                toast.success("HGS yükleme kaydı eklendi.");
            } else if (activeTab === "bakim") {
                if (!bakimForm.bakimTarihi || !bakimForm.yapilanKm || !bakimForm.tutar) {
                    toast.warning("Eksik Bilgi", { description: "Tarih, KM ve tutar zorunludur." });
                    return;
                }
                const res = await addBakim({
                    aracId: arac.id,
                    bakimTarihi: new Date(bakimForm.bakimTarihi),
                    yapilanKm: Number(bakimForm.yapilanKm),
                    kategori: bakimForm.kategori,
                    servisAdi: bakimForm.servisAdi || undefined,
                    yapilanIslemler: bakimForm.yapilanIslemler || undefined,
                    tutar: Number(bakimForm.tutar),
                });
                if (!res.success) throw new Error(res.error || "Servis kaydı oluşturulamadı.");
                toast.success("Servis kaydı eklendi.");
            } else if (activeTab === "yakit") {
                const litre = Number(yakitForm.litre || 0);
                const litreFiyati = Number(yakitForm.litreFiyati || 0);
                if (!litre || !litreFiyati || !yakitForm.km) {
                    toast.warning("Eksik Bilgi", { description: "Litre, litre fiyatı ve KM zorunludur." });
                    return;
                }
                const res = await createYakit({
                    aracId: arac.id,
                    tarih: yakitForm.tarih,
                    litre,
                    tutar: litre * litreFiyati,
                    km: Number(yakitForm.km),
                    istasyon: yakitForm.istasyon || undefined,
                    odemeYontemi: yakitForm.odemeYontemi,
                });
                if (!res.success) throw new Error(res.error || "Yakıt kaydı oluşturulamadı.");
                toast.success("Yakıt kaydı eklendi.");
            } else if (activeTab === "masraflar") {
                if (!masrafForm.tutar) {
                    toast.warning("Eksik Bilgi", { description: "Masraf tutarı zorunludur." });
                    return;
                }
                const res = await createMasraf({
                    aracId: arac.id,
                    tarih: masrafForm.tarih,
                    tur: masrafForm.tur,
                    tutar: Number(masrafForm.tutar),
                    aciklama: masrafForm.aciklama || undefined,
                });
                if (!res.success) throw new Error(res.error || "Masraf kaydı oluşturulamadı.");
                toast.success("Masraf kaydı eklendi.");
            } else if (activeTab === "sigorta") {
                if (!sigortaForm.baslangicTarihi || !sigortaForm.bitisTarihi) {
                    toast.warning("Eksik Bilgi", { description: "Başlangıç ve bitiş tarihi zorunludur." });
                    return;
                }
                const payload = {
                    aracId: arac.id,
                    sirket: sigortaForm.sirket || undefined,
                    acente: sigortaForm.acente || undefined,
                    policeNo: sigortaForm.policeNo || undefined,
                    baslangicTarihi: sigortaForm.baslangicTarihi,
                    bitisTarihi: sigortaForm.bitisTarihi,
                    tutar: sigortaForm.tutar ? Number(sigortaForm.tutar) : undefined,
                    aktifMi: sigortaForm.aktifMi,
                };
                const res = sigortaTipi === "TRAFIK"
                    ? await createSigorta(payload)
                    : await createKasko(payload);
                if (!res.success) throw new Error(res.error || "Poliçe kaydı oluşturulamadı.");
                toast.success(sigortaTipi === "TRAFIK" ? "Trafik sigortası kaydı eklendi." : "Kasko kaydı eklendi.");
            } else if (activeTab === "muayene") {
                const res = await createMuayene({
                    aracId: arac.id,
                    muayeneTarihi: muayeneForm.muayeneTarihi,
                    gecerlilikTarihi: muayeneForm.gecerlilikTarihi,
                    tutar: muayeneForm.tutar ? Number(muayeneForm.tutar) : undefined,
                    gectiMi: muayeneForm.gectiMi,
                    km: muayeneForm.km ? Number(muayeneForm.km) : undefined,
                    aktifMi: muayeneForm.aktifMi,
                });
                if (!res.success) throw new Error(res.error || "Muayene kaydı oluşturulamadı.");
                toast.success("Muayene kaydı eklendi.");
            } else if (activeTab === "dokuman") {
                if (!dokumanForm.ad.trim()) {
                    toast.warning("Eksik Bilgi", { description: "Doküman adı zorunludur." });
                    return;
                }
                const res = await createDokuman({
                    ad: dokumanForm.ad.trim(),
                    aracId: arac.id,
                    tur: dokumanForm.tur,
                    dosyaUrl: dokumanForm.dosyaUrl.trim() || "https://example.com/mock-file.pdf",
                });
                if (!res.success) throw new Error(res.error || "Doküman kaydı oluşturulamadı.");
                toast.success("Doküman kaydı eklendi.");
            }

            resetFormForTab(activeTab);
            setQuickAddOpen(false);
            router.refresh();
        } catch (error: any) {
            toast.error("Kayıt Hatası", { description: error?.message || "Kayıt oluşturulamadı." });
        } finally {
            setSubmittingQuickAdd(false);
        }
    };

    const renderQuickAddForm = () => {
        if (activeTab === "soforGecmisi") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Şoför <span className="text-red-500">*</span></label>
                        <SearchableSelect
                            value={zimmetForm.kullaniciId}
                            onValueChange={(value) => setZimmetForm({ ...zimmetForm, kullaniciId: value })}
                            placeholder="Şoför seçiniz..."
                            searchPlaceholder="Personel ara..."
                            options={[
                                { value: "", label: "Şoför seçiniz..." },
                                ...sortedKullanicilar.map((k) => ({
                                    value: k.id,
                                    label: k.adSoyad,
                                    searchText: k.adSoyad,
                                })),
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Teslim Tarihi</label>
                            <Input type="datetime-local" value={zimmetForm.baslangic} onChange={e => setZimmetForm({ ...zimmetForm, baslangic: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Teslim KM</label>
                            <Input type="number" value={zimmetForm.baslangicKm} onChange={e => setZimmetForm({ ...zimmetForm, baslangicKm: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Notlar</label>
                        <Input value={zimmetForm.notlar} onChange={e => setZimmetForm({ ...zimmetForm, notlar: e.target.value })} className="h-9" />
                    </div>
                </div>
            );
        }

        if (activeTab === "ruhsat") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Belge Adı <span className="text-red-500">*</span></label>
                        <Input value={ruhsatDokumanForm.ad} onChange={e => setRuhsatDokumanForm({ ...ruhsatDokumanForm, ad: e.target.value })} className="h-9" placeholder="Örn: Ruhsat Ön Yüz" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Dosya URL (Opsiyonel)</label>
                        <Input value={ruhsatDokumanForm.dosyaUrl} onChange={e => setRuhsatDokumanForm({ ...ruhsatDokumanForm, dosyaUrl: e.target.value })} className="h-9" placeholder="https://..." />
                    </div>
                </div>
            );
        }

        if (activeTab === "hgs") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">İşlem Tarihi</label>
                        <Input type="datetime-local" value={hgsForm.tarih} onChange={e => setHgsForm({ ...hgsForm, tarih: e.target.value })} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Etiket No</label>
                            <Input value={hgsForm.etiketNo} onChange={e => setHgsForm({ ...hgsForm, etiketNo: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" value={hgsForm.tutar} onChange={e => setHgsForm({ ...hgsForm, tutar: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">İşlem KM</label>
                        <Input type="number" value={hgsForm.km} onChange={e => setHgsForm({ ...hgsForm, km: e.target.value })} className="h-9" />
                    </div>
                </div>
            );
        }

        if (activeTab === "bakim") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Kategori</label>
                        <select value={bakimForm.kategori} onChange={e => setBakimForm({ ...bakimForm, kategori: e.target.value as "PERIYODIK_BAKIM" | "ARIZA" })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            <option value="PERIYODIK_BAKIM">Periyodik Bakım</option>
                            <option value="ARIZA">Arıza</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                            <Input type="datetime-local" value={bakimForm.bakimTarihi} onChange={e => setBakimForm({ ...bakimForm, bakimTarihi: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">KM <span className="text-red-500">*</span></label>
                            <Input type="number" value={bakimForm.yapilanKm} onChange={e => setBakimForm({ ...bakimForm, yapilanKm: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Servis Adı</label>
                        <Input value={bakimForm.servisAdi} onChange={e => setBakimForm({ ...bakimForm, servisAdi: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Yapılan İşlemler</label>
                        <textarea value={bakimForm.yapilanIslemler} onChange={e => setBakimForm({ ...bakimForm, yapilanIslemler: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                        <Input type="number" value={bakimForm.tutar} onChange={e => setBakimForm({ ...bakimForm, tutar: e.target.value })} className="h-9" />
                    </div>
                </div>
            );
        }

        if (activeTab === "yakit") {
            const litre = Number(yakitForm.litre || 0);
            const litreFiyati = Number(yakitForm.litreFiyati || 0);
            const toplam = litre * litreFiyati;

            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Alım Tarihi & Saati</label>
                        <Input type="datetime-local" value={yakitForm.tarih} onChange={e => setYakitForm({ ...yakitForm, tarih: e.target.value })} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Litre <span className="text-red-500">*</span></label>
                            <Input type="number" step="0.01" value={yakitForm.litre} onChange={e => setYakitForm({ ...yakitForm, litre: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Litre Fiyatı (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" step="0.01" value={yakitForm.litreFiyati} onChange={e => setYakitForm({ ...yakitForm, litreFiyati: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-500">Toplam (₺)</label>
                        <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                            {toplam > 0 ? toplam.toFixed(2) : "—"}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">KM <span className="text-red-500">*</span></label>
                            <Input type="number" value={yakitForm.km} onChange={e => setYakitForm({ ...yakitForm, km: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">İstasyon</label>
                            <Input value={yakitForm.istasyon} onChange={e => setYakitForm({ ...yakitForm, istasyon: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Ödeme Tipi</label>
                        <select value={yakitForm.odemeYontemi} onChange={e => setYakitForm({ ...yakitForm, odemeYontemi: e.target.value })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            <option value="NAKIT">Nakit</option>
                            <option value="TASIT_TANIMA">Taşıt Tanıma</option>
                        </select>
                    </div>
                </div>
            );
        }

        if (activeTab === "masraflar") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tarih</label>
                            <Input type="datetime-local" value={masrafForm.tarih} onChange={e => setMasrafForm({ ...masrafForm, tarih: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" value={masrafForm.tutar} onChange={e => setMasrafForm({ ...masrafForm, tutar: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Kategori</label>
                        <select value={masrafForm.tur} onChange={e => setMasrafForm({ ...masrafForm, tur: e.target.value })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            {MASRAF_TURLERI.map((tur) => <option key={tur} value={tur}>{tur.replace(/_/g, " ")}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Açıklama</label>
                        <Input value={masrafForm.aciklama} onChange={e => setMasrafForm({ ...masrafForm, aciklama: e.target.value })} className="h-9" />
                    </div>
                </div>
            );
        }

        if (activeTab === "sigorta") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Poliçe Tipi</label>
                        <select value={sigortaTipi} onChange={e => setSigortaTipi(e.target.value as "TRAFIK" | "KASKO")} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            <option value="TRAFIK">Trafik Sigortası</option>
                            <option value="KASKO">Kasko</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Sigorta Şirketi</label>
                            <Input value={sigortaForm.sirket} onChange={e => setSigortaForm({ ...sigortaForm, sirket: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Acente</label>
                            <Input value={sigortaForm.acente} onChange={e => setSigortaForm({ ...sigortaForm, acente: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Poliçe No</label>
                        <Input value={sigortaForm.policeNo} onChange={e => setSigortaForm({ ...sigortaForm, policeNo: e.target.value })} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Başlangıç</label>
                            <Input type="datetime-local" value={sigortaForm.baslangicTarihi} onChange={e => setSigortaForm({ ...sigortaForm, baslangicTarihi: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Bitiş</label>
                            <Input type="datetime-local" value={sigortaForm.bitisTarihi} onChange={e => setSigortaForm({ ...sigortaForm, bitisTarihi: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tutar (₺)</label>
                        <Input type="number" value={sigortaForm.tutar} onChange={e => setSigortaForm({ ...sigortaForm, tutar: e.target.value })} className="h-9" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="sigortaAktifMi" checked={sigortaForm.aktifMi} onChange={e => setSigortaForm({ ...sigortaForm, aktifMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                        <label htmlFor="sigortaAktifMi" className="text-sm font-medium">Poliçe Aktif</label>
                    </div>
                </div>
            );
        }

        if (activeTab === "muayene") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Muayene Tarihi</label>
                            <Input type="datetime-local" value={muayeneForm.muayeneTarihi} onChange={e => setMuayeneForm({ ...muayeneForm, muayeneTarihi: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Geçerlilik Bitiş</label>
                            <Input type="datetime-local" value={muayeneForm.gecerlilikTarihi} onChange={e => setMuayeneForm({ ...muayeneForm, gecerlilikTarihi: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Ücret (₺)</label>
                            <Input type="number" value={muayeneForm.tutar} onChange={e => setMuayeneForm({ ...muayeneForm, tutar: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">KM</label>
                            <Input type="number" value={muayeneForm.km} onChange={e => setMuayeneForm({ ...muayeneForm, km: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Muayene Sonucu</label>
                        <select value={muayeneForm.gectiMi ? "GECTI" : "GECMEDI"} onChange={e => setMuayeneForm({ ...muayeneForm, gectiMi: e.target.value === "GECTI" })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            <option value="GECTI">Geçti</option>
                            <option value="GECMEDI">Geçmedi</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="muayeneAktifMi" checked={muayeneForm.aktifMi} onChange={e => setMuayeneForm({ ...muayeneForm, aktifMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                        <label htmlFor="muayeneAktifMi" className="text-sm font-medium">Bu Kayıt Güncel/Aktif</label>
                    </div>
                </div>
            );
        }

        if (activeTab === "dokuman") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Doküman Adı <span className="text-red-500">*</span></label>
                        <Input value={dokumanForm.ad} onChange={e => setDokumanForm({ ...dokumanForm, ad: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Kategori</label>
                        <select value={dokumanForm.tur} onChange={e => setDokumanForm({ ...dokumanForm, tur: e.target.value as any })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                            {DOKUMAN_TURLERI.map((tur) => <option key={tur.value} value={tur.value}>{tur.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Dosya URL (Opsiyonel)</label>
                        <Input value={dokumanForm.dosyaUrl} onChange={e => setDokumanForm({ ...dokumanForm, dosyaUrl: e.target.value })} className="h-9" placeholder="https://..." />
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        {confirmModal}
            <main className="flex-1 p-6 md:p-8 xl:p-12 min-w-0 max-w-[1400px] mx-auto">
                <button
                    onClick={() => router.push('/dashboard/araclar')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium text-sm mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Araç Listesine Dön
                </button>

                <div className="mb-4 flex justify-end gap-2">
                    <Dialog
                        open={editAracOpen}
                        onOpenChange={(open) => {
                            setEditAracOpen(open);
                            if (open) {
                                resetAracEditForm();
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                                <Pencil size={15} />
                                Araç Bilgilerini Düzenle
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Araç Bilgilerini Düzenle</DialogTitle>
                                <DialogDescription>
                                    {arac.plaka} için temel bilgileri ve güncel KM değerini güncelleyin.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3 py-2">
                                <div className="col-span-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Araç Bilgileri</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Plaka <span className="text-rose-500">*</span></label>
                                    <Input
                                        value={aracEditForm.plaka}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, plaka: forceUppercase(event.target.value) }))}
                                        className="h-9 uppercase font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Marka <span className="text-rose-500">*</span></label>
                                    <Input
                                        value={aracEditForm.marka}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, marka: forceUppercase(event.target.value) }))}
                                        className="h-9 uppercase"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Model <span className="text-rose-500">*</span></label>
                                    <Input
                                        value={aracEditForm.model}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, model: forceUppercase(event.target.value) }))}
                                        className="h-9 uppercase"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Model Yılı <span className="text-rose-500">*</span></label>
                                    <Input
                                        type="number"
                                        value={aracEditForm.yil}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, yil: Number(event.target.value || 0) }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-sm font-medium">Şase No (Opsiyonel)</label>
                                    <Input
                                        value={aracEditForm.saseNo}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, saseNo: forceUppercase(event.target.value) }))}
                                        className="h-9 uppercase"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Muayene Geçerlilik Tarihi (Opsiyonel)</label>
                                    <Input
                                        type="datetime-local"
                                        value={aracEditForm.muayeneGecerlilikTarihi}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, muayeneGecerlilikTarihi: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Güncel KM <span className="text-rose-500">*</span></label>
                                    <Input
                                        type="number"
                                        value={aracEditForm.guncelKm}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, guncelKm: Number(event.target.value || 0) }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">BEDEL</label>
                                    <Input
                                        type="number"
                                        value={aracEditForm.bedel}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, bedel: event.target.value }))}
                                        className="h-9"
                                        placeholder="₺"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bulunduğu Şantiye</label>
                                    <select
                                        value={aracEditForm.bulunduguIl}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, bulunduguIl: event.target.value }))}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        {ILLER.map((il) => (
                                            <option key={il.value} value={il.value}>
                                                {il.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Araç Kategorisi</label>
                                    <select
                                        value={aracEditForm.kategori}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, kategori: event.target.value }))}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="BINEK">Binek Araç</option>
                                        <option value="SANTIYE">Şantiye Aracı</option>
                                    </select>
                                </div>
                                <div className="col-span-2 pt-1">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Organizasyon & Zimmet</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ruhsat Sahibi Firma</label>
                                    <select
                                        value={aracEditForm.sirketId}
                                        onChange={(event) => {
                                            const nextSirketId = event.target.value;
                                            const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                                            setAracEditForm((prev) => ({
                                                ...prev,
                                                sirketId: nextSirketId,
                                                bulunduguIl: selectedSirket?.bulunduguIl || prev.bulunduguIl,
                                            }));
                                        }}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        {canAssignIndependentRecords ? (
                                            <option value="">Şirket Seçiniz (Bağımsız)</option>
                                        ) : (
                                            <option value="" disabled>Şirket Seçiniz</option>
                                        )}
                                        {sirketler.map((sirket) => (
                                            <option key={sirket.id} value={sirket.id}>
                                                {sirket.ad}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Kullanıcı Firma</label>
                                    <select
                                        value={aracEditForm.calistigiKurum}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, calistigiKurum: event.target.value }))}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="">Kullanıcı Firma Seçiniz</option>
                                        {kullaniciFirmaOptions.map((firma) => (
                                            <option key={firma} value={firma}>
                                                {firma}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Kullanıcı</label>
                                    <SearchableSelect
                                        value={aracEditForm.kullaniciId}
                                        onValueChange={(value) => {
                                            const selectedKullanici = editAracFormKullanicilar.find((u) => u.id === value);
                                            setAracEditForm((prev) => ({
                                                ...prev,
                                                kullaniciId: value,
                                                calistigiKurum: selectedKullanici?.sirketAd || prev.calistigiKurum,
                                            }));
                                        }}
                                        placeholder="Kullanıcı Seçiniz (Atanmamış)"
                                        searchPlaceholder="Personel ara..."
                                        options={[
                                            { value: "", label: "Kullanıcı Seçiniz (Atanmamış)" },
                                            ...editAracFormKullanicilar.map((u) => ({
                                                value: u.id,
                                                label: `${u.adSoyad}${u.sirketAd ? ` - ${u.sirketAd}` : ""}`,
                                                searchText: `${u.adSoyad} ${u.sirketAd || ""}`,
                                            })),
                                        ]}
                                    />
                                </div>
                                <div className="col-span-2 pt-1">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Diğer Bilgiler</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">HGS No</label>
                                    <Input
                                        value={aracEditForm.hgsNo}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, hgsNo: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ruhsat Seri No</label>
                                    <Input
                                        value={aracEditForm.ruhsatSeriNo}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, ruhsatSeriNo: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label className="text-sm font-medium">Açıklama</label>
                                    <textarea
                                        value={aracEditForm.aciklama}
                                        onChange={(event) => setAracEditForm((prev) => ({ ...prev, aciklama: event.target.value }))}
                                        rows={2}
                                        className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <button
                                    onClick={handleUpdateAracBilgileri}
                                    disabled={updatingArac}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                                >
                                    {updatingArac ? "Güncelleniyor..." : "Güncelle"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <button
                        onClick={handleDeleteArac}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 shadow-sm transition-colors hover:bg-rose-100 disabled:opacity-50"
                    >
                        <Trash2 size={15} />
                        Aracı Sil
                    </button>
                </div>

                {/* Hero / Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 lg:p-8 mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-6">
                        <div className="hidden sm:flex h-20 w-20 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] items-center justify-center text-[#64748B]">
                            <Car size={40} strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h1 className="text-3xl font-black text-slate-900 font-mono tracking-tight">{arac.plaka}</h1>
                                {getStatusBadge(arac.kullanici ? 'AKTIF' : arac.durum)}
                            </div>
                            <h2 className="text-lg font-semibold text-slate-700 tracking-tight">{arac.marka} {arac.model} <span className="text-slate-400 font-medium ml-1">({arac.yil})</span></h2>
                            {arac.aciklama ? (
                                <p className="mt-2 text-sm text-slate-500">{arac.aciklama}</p>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm font-medium text-slate-500">
                                <div className="flex items-center gap-1.5"><MapPin size={16} /> {arac.bulunduguIl}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5"><Activity size={16} /> {arac.guncelKm.toLocaleString('tr-TR')} km</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5 font-mono text-xs">{arac.hgsNo ? `HGS: ${arac.hgsNo}` : 'HGS Kaydı Yok'}</div>
                                {arac.sirket && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                        <div className="flex items-center gap-1.5 text-indigo-600">
                                            <ShieldCheck size={16} /> {arac.sirket.ad}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-5 min-w-[320px]">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Güncel Şoför</p>
                            {arac.kullanici && (
                                <Dialog
                                    open={soforIadeOpen}
                                    onOpenChange={(open) => {
                                        setSoforIadeOpen(open);
                                        if (open) {
                                            setSoforIadeForm({
                                                bitis: nowDateTimeLocal(),
                                                bitisKm: String(arac.guncelKm || 0),
                                                notlar: activeZimmet?.notlar || "",
                                            });
                                        }
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <button
                                            disabled={loading}
                                            className="text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded font-bold uppercase transition-colors disabled:opacity-50"
                                        >
                                            Şoförden Ayır
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px]">
                                        <DialogHeader>
                                            <DialogTitle>Zimmeti Sonlandır</DialogTitle>
                                            <DialogDescription>
                                                {arac.plaka} için teslim alma bilgilerini girin.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Alma Tarihi</label>
                                                    <Input type="datetime-local" value={soforIadeForm.bitis} onChange={e => setSoforIadeForm({ ...soforIadeForm, bitis: e.target.value })} className="h-9" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Alma KM</label>
                                                    <Input type="number" value={soforIadeForm.bitisKm} onChange={e => setSoforIadeForm({ ...soforIadeForm, bitisKm: e.target.value })} className="h-9" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Not</label>
                                                <Input value={soforIadeForm.notlar} onChange={e => setSoforIadeForm({ ...soforIadeForm, notlar: e.target.value })} className="h-9" placeholder="Opsiyonel not" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleUnassign} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                                {loading ? "Sonlandırılıyor..." : "Zimmeti Sonlandır"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {!arac.kullanici && (
                                <Dialog open={soforAtamaOpen} onOpenChange={setSoforAtamaOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            disabled={loading || kullanicilar.length === 0}
                                            className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded font-bold uppercase transition-colors disabled:opacity-50"
                                        >
                                            Şoför Ata
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px]">
                                        <DialogHeader>
                                            <DialogTitle>Araca Şoför Ata</DialogTitle>
                                            <DialogDescription>
                                                {arac.plaka} için şoför seçip yeni zimmet kaydı oluşturun.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Şoför <span className="text-red-500">*</span></label>
                                                <SearchableSelect
                                                    value={soforAtamaForm.kullaniciId}
                                                    onValueChange={(value) => setSoforAtamaForm({ ...soforAtamaForm, kullaniciId: value })}
                                                    placeholder="Şoför seçiniz..."
                                                    searchPlaceholder="Personel ara..."
                                                    options={[
                                                        { value: "", label: "Şoför seçiniz..." },
                                                        ...sortedKullanicilar.map((k) => ({
                                                            value: k.id,
                                                            label: k.adSoyad,
                                                            searchText: k.adSoyad,
                                                        })),
                                                    ]}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Tarihi</label>
                                                    <Input type="datetime-local" value={soforAtamaForm.baslangic} onChange={e => setSoforAtamaForm({ ...soforAtamaForm, baslangic: e.target.value })} className="h-9" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim KM</label>
                                                    <Input type="number" value={soforAtamaForm.baslangicKm} onChange={e => setSoforAtamaForm({ ...soforAtamaForm, baslangicKm: e.target.value })} className="h-9" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Not</label>
                                                <Input value={soforAtamaForm.notlar} onChange={e => setSoforAtamaForm({ ...soforAtamaForm, notlar: e.target.value })} className="h-9" placeholder="Opsiyonel not" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleAssignSofor} disabled={loading || !soforAtamaForm.kullaniciId} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                                {loading ? "Atanıyor..." : "Şoför Ata"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        {arac.kullanici ? (
                            <div 
                                className="flex items-center gap-3 cursor-pointer group hover:bg-white/50 p-2 -m-2 rounded-lg transition-colors"
                                onClick={() => router.push(`/dashboard/personel/${arac.kullanici.id}`)}
                            >
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white uppercase group-hover:scale-105 transition-transform">
                                    {arac.kullanici.ad.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{arac.kullanici.ad} {arac.kullanici.soyad}</span>
                                    <span className="text-xs font-semibold text-slate-500 mt-0.5">{arac.kullanici.telefon || 'Telefon Bulunmuyor'}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-sm italic font-medium">
                                <Users size={18} />
                                Bu araca şoför atanmamış.
                            </div>
                        )}
                    </div>
                </div>

                <Dialog open={!!editArizaRow} onOpenChange={(open) => !open && closeArizaEdit()}>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Arıza Kaydını Düzenle</DialogTitle>
                            <DialogDescription>{arac.plaka} için kayıt bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">KM</label>
                                    <Input
                                        type="number"
                                        value={arizaEditForm.km}
                                        onChange={(event) => setArizaEditForm((prev) => ({ ...prev, km: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bildirim Zamanı</label>
                                    <Input
                                        type="datetime-local"
                                        value={arizaEditForm.bildirimTarihi}
                                        onChange={(event) => setArizaEditForm((prev) => ({ ...prev, bildirimTarihi: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Öncelik</label>
                                    <select
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                        value={arizaEditForm.oncelik}
                                        onChange={(event) =>
                                            setArizaEditForm((prev) => ({ ...prev, oncelik: event.target.value as typeof prev.oncelik }))
                                        }
                                    >
                                        <option value="DUSUK">Düşük</option>
                                        <option value="ORTA">Orta</option>
                                        <option value="YUKSEK">Yüksek</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Personel / Şoför</label>
                                    <SearchableSelect
                                        value={arizaEditForm.soforId}
                                        onValueChange={(value) => setArizaEditForm((prev) => ({ ...prev, soforId: value }))}
                                        placeholder="Seçilmedi"
                                        searchPlaceholder="Personel ara..."
                                        options={[
                                            { value: "", label: "Seçilmedi" },
                                            ...arizaSoforOptions.map((k) => ({
                                                value: k.id,
                                                label: k.adSoyad,
                                                searchText: k.adSoyad,
                                            })),
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Arıza Açıklaması <span className="text-red-500">*</span></label>
                                <textarea
                                    value={arizaEditForm.aciklama}
                                    onChange={(event) => setArizaEditForm((prev) => ({ ...prev, aciklama: event.target.value }))}
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Servis Adı</label>
                                    <Input
                                        value={arizaEditForm.servisAdi}
                                        onChange={(event) => setArizaEditForm((prev) => ({ ...prev, servisAdi: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (₺)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={arizaEditForm.tutar}
                                        onChange={(event) => setArizaEditForm((prev) => ({ ...prev, tutar: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yapılan / Planlanan İşlemler</label>
                                <textarea
                                    value={arizaEditForm.yapilanIslemler}
                                    onChange={(event) => setArizaEditForm((prev) => ({ ...prev, yapilanIslemler: event.target.value }))}
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={handleUpdateAriza}
                                disabled={arizaActionLoading}
                                className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                            >
                                {arizaActionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="flex flex-nowrap h-auto gap-2 bg-transparent overflow-x-auto justify-start pb-2 border-b border-slate-200 w-full rounded-none scrollbar-hide">
                        <TabsTrigger value="ozet" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Activity size={16} className="mr-2" /> Genel Özet
                        </TabsTrigger>
                        <TabsTrigger value="soforGecmisi" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Users size={16} className="mr-2" /> Şoför Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="ruhsat" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <FileText size={16} className="mr-2" /> Ruhsat Bilgileri
                        </TabsTrigger>
                        <TabsTrigger value="hgs" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <CreditCard size={16} className="mr-2" /> HGS Yüklemeleri
                        </TabsTrigger>
                        <TabsTrigger value="bakim" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Wrench size={16} className="mr-2" /> Servis Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="ariza" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <AlertTriangle size={16} className="mr-2" /> Arıza Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="yakit" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Fuel size={16} className="mr-2" /> Yakıt Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="masraflar" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Receipt size={16} className="mr-2" /> Masraflar
                        </TabsTrigger>
                        <TabsTrigger value="ceza" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Receipt size={16} className="mr-2" /> Cezalar
                        </TabsTrigger>
                        <TabsTrigger value="sigorta" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <ShieldCheck size={16} className="mr-2" /> Sigorta & Kasko
                        </TabsTrigger>
                        <TabsTrigger value="muayene" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <FileDigit size={16} className="mr-2" /> Muayene Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="dokuman" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <FileArchive size={16} className="mr-2" /> Evraklar
                        </TabsTrigger>
                    </TabsList>

                    {QUICK_ADD_CONFIG[activeTab] && (
                        <div className="mt-4 flex justify-end">
                            <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                                <DialogTrigger asChild>
                                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                                        <Plus size={15} />
                                        {QUICK_ADD_CONFIG[activeTab].button}
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[460px]">
                                    <DialogHeader>
                                        <DialogTitle>{QUICK_ADD_CONFIG[activeTab].title}</DialogTitle>
                                        <DialogDescription>{QUICK_ADD_CONFIG[activeTab].description}</DialogDescription>
                                    </DialogHeader>
                                    {renderQuickAddForm()}
                                    <DialogFooter>
                                        <button
                                            onClick={handleQuickCreate}
                                            disabled={submittingQuickAdd}
                                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                                        >
                                            {submittingQuickAdd ? "Kaydediliyor..." : "Kaydet"}
                                        </button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    <div className="mt-6 min-h-[400px]">

                        {/* 1. ÖZET */}
                        <TabsContent value="ozet">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                                    <CardHeader className="border-b border-[#F1F5F9] py-4 bg-[#F8FAFC]">
                                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Settings size={16} className="text-slate-400" /> Araç Sicil Bilgileri
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ul className="divide-y divide-[#F1F5F9]">
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Ruhsat Seri No</span>
                                                <span className="text-sm font-semibold text-slate-800">{arac.ruhsatSeriNo || '-'}</span>
                                            </li>
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Şase No</span>
                                                <span className="text-sm font-semibold text-slate-800">{arac.saseNo || '-'}</span>
                                            </li>
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Filoya Katılım</span>
                                                <span className="text-sm font-semibold text-slate-800">{formatDate(arac.olusturmaTarihi)}</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* 2. ŞOFÖR GEÇMİŞİ */}
                        <TabsContent value="soforGecmisi">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Şoför Adı</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Zimmet Başlangıç</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Zimmet Bitiş</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Başlangıç / Bitiş KM</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.kullaniciGecmisi && arac.kullaniciGecmisi.length > 0 ? (
                                            arac.kullaniciGecmisi.map((z: any) => (
                                                <TableRow key={z.id}>
                                                    <TableCell className="font-medium text-slate-900">
                                                        <PersonelLink
                                                            personelId={z.kullanici?.id}
                                                            className="hover:text-indigo-600 hover:underline"
                                                        >
                                                            {z.kullanici?.ad} {z.kullanici?.soyad}
                                                        </PersonelLink>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600">{formatDate(z.baslangic)}</TableCell>
                                                    <TableCell className="text-slate-600">{z.bitis ? formatDate(z.bitis) : <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50">Devam Ediyor</Badge>}</TableCell>
                                                    <TableCell className="text-slate-600 text-right">{z.baslangicKm} km {z.bitisKm ? ` -  ${z.bitisKm} km` : ''}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Geçmiş zimmet kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 3. RUHSAT BİLGİLERİ */}
                        <TabsContent value="ruhsat">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                                    <CardHeader className="border-b border-[#F1F5F9] py-4 bg-[#F8FAFC]">
                                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Settings size={16} className="text-slate-400" /> Tescil Bilgileri
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ul className="divide-y divide-[#F1F5F9]">
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Plaka</span>
                                                <span className="text-sm font-semibold text-slate-900">{arac.plaka}</span>
                                            </li>
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Ruhsat Seri No</span>
                                                <span className="text-sm font-semibold text-slate-900">{arac.ruhsatSeriNo || '-'}</span>
                                            </li>
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Marka / Model</span>
                                                <span className="text-sm font-semibold text-slate-900">{arac.marka} {arac.model}</span>
                                            </li>
                                            <li className="flex justify-between items-center px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Model Yılı</span>
                                                <span className="text-sm font-semibold text-slate-900">{arac.yil}</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                    <CardHeader className="border-b border-[#F1F5F9] py-4 bg-[#F8FAFC]">
                                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400" /> Ruhsat Belgeleri
                                        </CardTitle>
                                    </CardHeader>
                                    <Table>
                                        <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                            <TableRow>
                                                <TableHead className="font-semibold text-slate-500">Yüklenme Tarihi</TableHead>
                                                <TableHead className="font-semibold text-slate-500">Doküman Adı</TableHead>
                                                <TableHead className="font-semibold text-slate-500 text-right">Aksiyon</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {arac.dokumanlar?.filter((d: any) => d.tur === 'RUHSAT').length > 0 ? (
                                                arac.dokumanlar.filter((d: any) => d.tur === 'RUHSAT').map((d: any) => (
                                                    <TableRow key={d.id}>
                                                        <TableCell className="text-slate-700">{formatDate(d.yuklemeTarihi)}</TableCell>
                                                        <TableCell className="font-medium text-indigo-600 hover:underline cursor-pointer">{d.ad}</TableCell>
                                                        <TableCell className="text-right"><span className="text-sm font-medium text-slate-500 hover:text-indigo-600 cursor-pointer">Görüntüle</span></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-500">Yüklenmiş ruhsat belgesi bulunmuyor.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* 4. HGS YÜKLEMELERİ */}
                        <TabsContent value="hgs">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Yükleme Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Etiket No</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Uygulanan KM</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.hgsYuklemeler && arac.hgsYuklemeler.length > 0 ? (
                                            arac.hgsYuklemeler.map((h: any) => (
                                                <TableRow key={h.id}>
                                                    <TableCell className="text-slate-700">{formatDate(h.tarih)}</TableCell>
                                                    <TableCell className="text-slate-900 font-mono text-sm">{h.etiketNo || arac.hgsNo || '-'}</TableCell>
                                                    <TableCell className="text-slate-700">{h.km?.toLocaleString() || '-'} km</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{h.tutar.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">HGS yükleme kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 5. BAKIM */}
                        <TabsContent value="bakim">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">İşlem Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Kategori</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Servis Adı</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Uygulanan KM</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Yapılan İşlemler</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.bakimlar && arac.bakimlar.length > 0 ? (
                                            arac.bakimlar.map((b: AracDetaySaaS) => (
                                                <TableRow key={b.id}>
                                                    <TableCell className="text-slate-700">{formatDate(b.bakimTarihi)}</TableCell>
                                                    <TableCell>
                                                        {(b.kategori || (b.tur === "ARIZA" ? "ARIZA" : "PERIYODIK_BAKIM")) === "ARIZA" ? (
                                                            <Badge className="bg-rose-100 text-rose-700 border-0 shadow-none">Arıza</Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none">Periyodik Bakım</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-900">{b.servisAdi || '-'}</TableCell>
                                                    <TableCell className="text-slate-700">{b.yapilanKm.toLocaleString()} km</TableCell>
                                                    <TableCell className="text-slate-600 max-w-[200px] truncate" title={b.yapilanIslemler}>{b.yapilanIslemler || '-'}</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{b.tutar.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-500">Servis kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 6. ARIZA */}
                        <TabsContent value="ariza">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Bildirim Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Personel</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Öncelik</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Durum</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Açıklama</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.arizalar && arac.arizalar.length > 0 ? (
                                            arac.arizalar.map((a: AracDetaySaaS) => (
                                                <TableRow key={a.id}>
                                                    <TableCell className="text-slate-700">{formatDate(a.bildirimTarihi)}</TableCell>
                                                    <TableCell className="text-slate-900">
                                                        {a.sofor?.id ? (
                                                            <PersonelLink personelId={a.sofor.id} className="hover:text-indigo-600 hover:underline">
                                                                {`${a.sofor.ad || ""} ${a.sofor.soyad || ""}`.trim() || "-"}
                                                            </PersonelLink>
                                                        ) : (
                                                            "-"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(a.oncelik === "YUKSEK" || a.oncelik === "KRITIK") ? (
                                                            <Badge className="bg-orange-100 text-orange-700 border-0 shadow-none">Yüksek</Badge>
                                                        ) : a.oncelik === "ORTA" ? (
                                                            <Badge className="bg-blue-100 text-blue-700 border-0 shadow-none">Orta</Badge>
                                                        ) : (
                                                            <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">Düşük</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {a.durum === "ACIK" ? (
                                                            <Badge className="bg-rose-100 text-rose-700 border-0 shadow-none">Açık</Badge>
                                                        ) : a.durum === "SERVISTE" ? (
                                                            <Badge className="bg-amber-100 text-amber-700 border-0 shadow-none">Serviste</Badge>
                                                        ) : a.durum === "TAMAMLANDI" ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none">Tamamlandı</Badge>
                                                        ) : (
                                                            <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">İptal</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 max-w-[280px] truncate" title={a.aciklama || "-"}>
                                                        {a.aciklama || "-"}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">
                                                        ₺{Number(a.tutar || 0).toLocaleString("tr-TR")}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <RowActionButton
                                                                variant="edit"
                                                                onClick={() => openArizaEdit(a)}
                                                                disabled={arizaActionLoading}
                                                            />
                                                            {a.durum === "ACIK" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSeviseGonderAriza(a)}
                                                                    disabled={arizaActionLoading}
                                                                    className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:pointer-events-none disabled:opacity-50"
                                                                    title="Servise Gönder"
                                                                    aria-label="Servise Gönder"
                                                                >
                                                                    <Wrench size={15} />
                                                                </button>
                                                            ) : null}
                                                            <RowActionButton
                                                                variant="delete"
                                                                onClick={() => handleDeleteAriza(a)}
                                                                disabled={arizaActionLoading}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                                                    Arıza kaydı bulunmuyor.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 7. YAKIT */}
                        <TabsContent value="yakit">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Tarih</TableHead>
                                            <TableHead className="font-semibold text-slate-500">İstasyon</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Araç KM</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Litre (L)</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.yakitlar && arac.yakitlar.length > 0 ? (
                                            arac.yakitlar.map((y: AracDetaySaaS) => (
                                                <TableRow key={y.id}>
                                                    <TableCell className="text-slate-700">{formatDate(y.tarih)}</TableCell>
                                                    <TableCell className="text-slate-900">{y.istasyon || '-'}</TableCell>
                                                    <TableCell className="text-slate-700">{y.km.toLocaleString()} km</TableCell>
                                                    <TableCell className="text-slate-700">{y.litre} L</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{y.tutar.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Yakıt kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 8. MASRAFLAR */}
                        <TabsContent value="masraflar">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Tarih</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Masraf Türü</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.masraflar && arac.masraflar.length > 0 ? (
                                            arac.masraflar.map((m: AracDetaySaaS) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="text-slate-700">{formatDate(m.tarih)}</TableCell>
                                                    <TableCell className="text-slate-900"><Badge variant="outline">{m.tur}</Badge></TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{m.tutar.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-500">Ekstra masraf kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 9. CEZALAR */}
                        <TabsContent value="ceza">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Ceza Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Son Ödeme</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Şoför</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Ceza Maddesi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Durum</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.cezalar && arac.cezalar.length > 0 ? (
                                            arac.cezalar.map((c: AracDetaySaaS) => {
                                                const sonOdeme = c.sonOdemeTarihi || c.tarih;
                                                return (
                                                    <TableRow key={c.id}>
                                                        <TableCell className="text-slate-700">{formatDate(c.tarih)}</TableCell>
                                                        <TableCell className="text-slate-900">{formatDate(sonOdeme)}</TableCell>
                                                        <TableCell className="text-slate-700">
                                                            {c.kullanici?.id ? (
                                                                <PersonelLink personelId={c.kullanici.id} className="hover:text-indigo-600 hover:underline">
                                                                    {`${c.kullanici.ad || ""} ${c.kullanici.soyad || ""}`.trim() || "-"}
                                                                </PersonelLink>
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-slate-900">{c.cezaMaddesi || "-"}</TableCell>
                                                        <TableCell>
                                                            {c.odendiMi ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none font-semibold px-2">Ödendi</Badge>
                                                            ) : (() => {
                                                                const daysLeft = getDaysLeft(sonOdeme);
                                                                if (daysLeft == null) {
                                                                    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Ödenmedi</Badge>;
                                                                }
                                                                const badge = getDeadlineBadgeConfig(daysLeft);
                                                                if (badge.status === "GECERLI") {
                                                                    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Ödenmedi</Badge>;
                                                                }
                                                                return (
                                                                    <Badge className={`${badge.className} ${badge.status === "GECIKTI" ? "font-bold" : "font-semibold"} px-2`}>
                                                                        {badge.status === "GECIKTI" ? (
                                                                            <>
                                                                                <ShieldAlert size={12} className="mr-1" />
                                                                                {badge.label}
                                                                            </>
                                                                        ) : (
                                                                            badge.label
                                                                        )}
                                                                    </Badge>
                                                                );
                                                            })()}
                                                        </TableCell>
                                                        <TableCell className="font-bold text-slate-900 text-right">₺{Number(c.tutar || 0).toLocaleString("tr-TR")}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-500">Ceza kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 10. SİGORTA & KASKO */}
                        <TabsContent value="sigorta">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                    <CardHeader className="border-b border-[#F1F5F9] py-4 bg-[#F8FAFC]">
                                        <CardTitle className="text-sm font-semibold text-slate-800">Trafik Sigortası Kayıtları</CardTitle>
                                    </CardHeader>
                                    <Table>
                                        <TableHeader className="bg-white border-b border-[#E2E8F0]">
                                            <TableRow>
                                                <TableHead className="font-semibold text-slate-500">Bitiş Tarihi</TableHead>
                                                <TableHead className="font-semibold text-slate-500">Şirket</TableHead>
                                                <TableHead className="font-semibold text-slate-500 text-right">Tutar</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {arac.trafikSigortasi && arac.trafikSigortasi.length > 0 ? (
                                                arac.trafikSigortasi.map((s: AracDetaySaaS) => (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="text-slate-700">{formatDate(s.bitisTarihi)} <span className="ml-2">{renderDeadlineBadge(s.bitisTarihi, s.aktifMi)}</span></TableCell>
                                                        <TableCell className="text-slate-900">{s.sirket || '-'}</TableCell>
                                                        <TableCell className="text-slate-900 text-right">{s.tutar ? `₺${s.tutar.toLocaleString()}` : '-'}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-500">Trafik sigortası kaydı bulunmuyor.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>
                                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                    <CardHeader className="border-b border-[#F1F5F9] py-4 bg-[#F8FAFC]">
                                        <CardTitle className="text-sm font-semibold text-slate-800">Kasko Kayıtları</CardTitle>
                                    </CardHeader>
                                    <Table>
                                        <TableHeader className="bg-white border-b border-[#E2E8F0]">
                                            <TableRow>
                                                <TableHead className="font-semibold text-slate-500">Bitiş Tarihi</TableHead>
                                                <TableHead className="font-semibold text-slate-500">Şirket</TableHead>
                                                <TableHead className="font-semibold text-slate-500 text-right">Tutar</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {arac.kasko && arac.kasko.length > 0 ? (
                                                arac.kasko.map((k: AracDetaySaaS) => (
                                                    <TableRow key={k.id}>
                                                        <TableCell className="text-slate-700">{formatDate(k.bitisTarihi)} <span className="ml-2">{renderDeadlineBadge(k.bitisTarihi, k.aktifMi)}</span></TableCell>
                                                        <TableCell className="text-slate-900">{k.sirket || '-'}</TableCell>
                                                        <TableCell className="text-slate-900 text-right">{k.tutar ? `₺${k.tutar.toLocaleString()}` : '-'}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-500">Kasko poliçesi bulunmuyor.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* 10. MUAYENE */}
                        <TabsContent value="muayene">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Muayene Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Geçerlilik Bitiş</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Muayene Ücreti</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Durum</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.muayene && arac.muayene.length > 0 ? (
                                            arac.muayene.map((m: AracDetaySaaS) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="text-slate-700">{formatDate(m.muayeneTarihi)}</TableCell>
                                                    <TableCell className="font-medium text-slate-900">{formatDate(m.gecerlilikTarihi)}</TableCell>
                                                    <TableCell className="text-slate-900 text-right">{m.tutar ? `₺${Number(m.tutar).toLocaleString('tr-TR')}` : '-'}</TableCell>
                                                    <TableCell className="text-right">{m.gectiMi === false ? <Badge className="bg-rose-100 text-rose-800 border-0 shadow-none">Geçmedi</Badge> : renderDeadlineBadge(m.gecerlilikTarihi, m.aktifMi)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Muayene kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 12. DOKÜMANLAR */}
                        <TabsContent value="dokuman">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Yüklenme Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Doküman Adı</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Kategori</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Aksiyon</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.dokumanlar && arac.dokumanlar.length > 0 ? (
                                            arac.dokumanlar.map((d: AracDetaySaaS) => (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-slate-700">{formatDate(d.yuklemeTarihi)}</TableCell>
                                                    <TableCell className="font-medium text-indigo-600 hover:underline cursor-pointer">{d.ad}</TableCell>
                                                    <TableCell className="text-slate-600"><Badge variant="outline">{d.tur}</Badge></TableCell>
                                                    <TableCell className="text-right"><span className="text-sm font-medium text-slate-500 hover:text-indigo-600 cursor-pointer">Görüntüle</span></TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Yüklenmiş bir evrak bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                    </div>
                </Tabs>
            </main>
        </div>
    );
}
