"use client"

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Car, Users, Wrench, Fuel, ArrowLeft, Activity, Gauge, ShieldCheck, ShieldAlert, AlertTriangle, MapPin, FileDigit, Settings, Receipt, FileArchive, FileText, Plus, Pencil, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { createZimmet, finalizeZimmet, deleteZimmet } from "../../zimmetler/actions";
import { addBakim, updateBakim, deleteBakim } from "../../bakimlar/actions";
import { createYakit, updateYakit, deleteYakit } from "../../yakitlar/actions";
import { createMasraf, updateMasraf, deleteMasraf } from "../../masraflar/actions";
import { createSigorta, updateSigorta, deleteSigorta } from "../../trafik-sigortasi/actions";
import { createKasko, updateKasko, deleteKasko } from "../../kasko/actions";
import { createMuayene, updateMuayene, deleteMuayene } from "../../muayeneler/actions";
import { createDokuman, updateDokuman, deleteDokuman } from "../../dokumanlar/actions";
import { createCeza, updateCeza, deleteCeza } from "../../cezalar/actions";
import { deleteArizaKaydi, seviseGonderArizaKaydi, updateArizaKaydi } from "../../arizalar/actions";
import { deleteArac, updateArac } from "../actions";
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status";
import { sortByTextValue } from "@/lib/sort-utils";
import { PersonelLink } from "@/components/links/RecordLinks";
import { RowActionButton } from "@/components/ui/row-action-button";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { useDashboardScopedHref } from "@/lib/use-dashboard-scoped-href";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";
import { KIRALIK_SIRKET_ADI, KIRALIK_SIRKET_OPTION_VALUE, isKiralikSirketName } from "@/lib/ruhsat-sahibi";
import { formatCurrency, formatKm, formatLitres, getFuelKmDelta, getZimmetKmDelta, sumBy } from "@/lib/detail-table-totals";
import { ARAC_UST_KATEGORI_OPTIONS, getAracAltKategoriOptions, resolveAracKategoriFields } from "@/lib/arac-kategori";

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

const MASRAF_TURLERI = ['BAKIM_ONARIM', 'LASTIK', 'TEMIZLIK', 'OTOPARK', 'HGS_YUKLEME', 'KOPRU_OBO', 'DIGER'];
const DOKUMAN_TURLERI = [
    { label: "Ruhsat", value: "RUHSAT" },
    { label: "Trafik Sigortası", value: "SIGORTA" },
    { label: "Kasko Poliçesi", value: "KASKO" },
    { label: "Muayene Evrakı", value: "MUAYENE" },
    { label: "Ceza Makbuzu", value: "CEZA_MAKBUZU" },
    { label: "Servis & Fatura", value: "SERVIS_FATURA" },
    { label: "Diğer", value: "DIGER" },
];

const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");
const parseNumberInput = (value: string, fallback: number): number => {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const safeNumberInputValue = (value: unknown, fallback = 0): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
const getLatestFuelKmValue = (rows: Array<{ km?: number | null; tarih?: Date | string | null }> | null | undefined) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    let latestKm: number | null = null;
    let latestTime = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
        const km = Number(row?.km);
        if (!Number.isFinite(km) || km <= 0) continue;
        const timestamp = row?.tarih ? new Date(row.tarih).getTime() : Number.NEGATIVE_INFINITY;
        if (timestamp >= latestTime) {
            latestTime = timestamp;
            latestKm = Math.trunc(km);
        }
    }
    return latestKm;
};

const QUICK_ADD_CONFIG: Record<string, { button: string; title: string; description: string }> = {
    soforGecmisi: { button: "Zimmet Ekle", title: "Yeni Zimmet Kaydı", description: "Bu araca yeni şoför ataması yapın." },
    ruhsat: { button: "Ruhsat Belgesi Ekle", title: "Ruhsat Belgesi Ekle", description: "Aracın ruhsat belgesini bu ekrandan kaydedin." },
    bakim: { button: "Servis Kaydı Ekle", title: "Servis Kaydı Ekle", description: "Periyodik bakım veya arıza kaydını bu sekmeden oluşturun." },
    yakit: { button: "Yakıt Kaydı Ekle", title: "Yakıt Alım Bilgisi", description: "Yeni yakıt kaydını tablo alanlarıyla uyumlu şekilde girin." },
    masraflar: { button: "Masraf Ekle", title: "Ek Masraf Kaydı", description: "Araç için kategori bazlı gider kaydı oluşturun." },
    ceza: { button: "Ceza Ekle", title: "Yeni Ceza Kaydı", description: "Araç için trafik cezası kaydı oluşturun." },
    sigorta: { button: "Poliçe Ekle", title: "Sigorta / Kasko Kaydı", description: "Trafik sigortası veya kasko kaydı ekleyin." },
    muayene: { button: "Muayene Ekle", title: "Muayene Kaydı", description: "Muayene tarih, sonuç ve ücret bilgilerini kaydedin." },
    dokuman: { button: "Evrak Ekle", title: "Yeni Evrak", description: "Araça ait dijital evrağı sisteme kaydedin." },
};

const YAKIT_CIKISI_OPTIONS = ["Mithra", "Binlik Bidon"] as const;

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
    disFirmalar,
}: {
    initialArac: AracDetaySaaS;
    kullanicilar: SoforOption[];
    sirketler: Array<{ id: string; ad: string; bulunduguIl?: string | null; santiyeler?: string[] }>;
    disFirmalar: Array<{ id: string; ad: string; tur: string }>;
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAssignIndependentRecords, canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const scopedHref = useDashboardScopedHref();
    const [loading, setLoading] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("ozet");
    const [quickAddOpen, setQuickAddOpen] = React.useState(false);
    const [submittingQuickAdd, setSubmittingQuickAdd] = React.useState(false);
    const latestFuelKm = getLatestFuelKmValue(arac.yakitlar);
    const defaultSoforIadeKm = latestFuelKm !== null ? String(latestFuelKm) : String(arac.guncelKm || 0);

    const [zimmetForm, setZimmetForm] = React.useState({
        kullaniciId: "",
        baslangic: todayDate(),
        baslangicKm: String(arac.guncelKm || 0),
        notlar: "",
    });
    const [ruhsatDokumanForm, setRuhsatDokumanForm] = React.useState({
        ad: "",
        dosyaUrl: "",
        file: null as File | null,
    });
    const [bakimForm, setBakimForm] = React.useState({
        bakimTarihi: todayDate(),
        arizaSikayet: "",
        yapilanIslemler: "",
        degisenParca: "",
        islemYapanFirma: "",
        tutar: "",
    });
    const [yakitForm, setYakitForm] = React.useState({
        tarih: nowDateTimeLocal(),
        litre: "",
        km: "",
        istasyon: "",
    });
    const [masrafForm, setMasrafForm] = React.useState({
        tarih: todayDate(),
        tur: "BAKIM_ONARIM",
        tutar: "",
        aciklama: "",
    });
    const [cezaForm, setCezaForm] = React.useState({
        tarih: todayDate(),
        sonOdemeTarihi: todayDate(),
        soforId: "",
        cezaMaddesi: "",
        tutar: "",
        odendiMi: false,
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
        tur: "DIGER" as "RUHSAT" | "SIGORTA" | "KASKO" | "MUAYENE" | "CEZA_MAKBUZU" | "SERVIS_FATURA" | "DIGER",
        dosyaUrl: "",
        file: null as File | null,
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
        bitisKm: defaultSoforIadeKm,
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

    const [actionLoading, setActionLoading] = React.useState(false);

    const [editBakimRow, setEditBakimRow] = React.useState<AracDetaySaaS | null>(null);
    const [bakimEditForm, setBakimEditForm] = React.useState({
        bakimTarihi: todayDate(),
        arizaSikayet: "",
        yapilanIslemler: "",
        degisenParca: "",
        islemYapanFirma: "",
        tutar: "",
    });

    const [editYakitRow, setEditYakitRow] = React.useState<AracDetaySaaS | null>(null);
    const [yakitEditForm, setYakitEditForm] = React.useState({
        tarih: nowDateTimeLocal(),
        litre: "",
        km: "",
        istasyon: "",
    });

    const [editMasrafRow, setEditMasrafRow] = React.useState<AracDetaySaaS | null>(null);
    const [masrafEditForm, setMasrafEditForm] = React.useState({
        tarih: todayDate(),
        tur: "BAKIM_ONARIM",
        tutar: "",
        aciklama: "",
    });

    const [editCezaRow, setEditCezaRow] = React.useState<AracDetaySaaS | null>(null);
    const [cezaEditForm, setCezaEditForm] = React.useState({
        tarih: todayDate(),
        sonOdemeTarihi: todayDate(),
        soforId: "",
        cezaMaddesi: "",
        tutar: "",
        odendiMi: false,
    });

    const [editSigortaRow, setEditSigortaRow] = React.useState<AracDetaySaaS | null>(null);
    const [sigortaEditTipi, setSigortaEditTipi] = React.useState<"TRAFIK" | "KASKO">("TRAFIK");
    const [sigortaEditForm, setSigortaEditForm] = React.useState({
        sirket: "",
        acente: "",
        policeNo: "",
        baslangicTarihi: todayDate(),
        bitisTarihi: oneYearAfter(todayDate()),
        tutar: "",
        aktifMi: true,
    });

    const [editMuayeneRow, setEditMuayeneRow] = React.useState<AracDetaySaaS | null>(null);
    const [muayeneEditForm, setMuayeneEditForm] = React.useState({
        muayeneTarihi: todayDate(),
        gecerlilikTarihi: twoYearsAfter(todayDate()),
        tutar: "",
        gectiMi: true,
        km: "",
        aktifMi: true,
    });

    const [editDokumanRow, setEditDokumanRow] = React.useState<AracDetaySaaS | null>(null);
    const [dokumanEditForm, setDokumanEditForm] = React.useState({
        ad: "",
        tur: "DIGER" as "RUHSAT" | "SIGORTA" | "KASKO" | "MUAYENE" | "CEZA_MAKBUZU" | "SERVIS_FATURA" | "DIGER",
        dosyaUrl: "",
    });

    const [editAracOpen, setEditAracOpen] = React.useState(false);
    const [updatingArac, setUpdatingArac] = React.useState(false);
    const initialAracKategoriFields = React.useMemo(
        () => resolveAracKategoriFields({ kategori: arac.kategori, altKategori: arac.altKategori }),
        [arac.altKategori, arac.kategori]
    );
    const [aracEditForm, setAracEditForm] = React.useState({
        plaka: forceUppercase(arac.plaka || ""),
        marka: forceUppercase(arac.marka || ""),
        model: forceUppercase(arac.model || ""),
        yil: Number(arac.yil || new Date().getFullYear()),
        muayeneGecerlilikTarihi: toDateTimeLocalInput(arac.muayene?.[0]?.gecerlilikTarihi),
        bulunduguIl: arac.bulunduguIl || "MERKEZ",
        guncelKm: Number(arac.guncelKm || 0),
        bedel: arac.bedel === null || arac.bedel === undefined ? "" : String(arac.bedel),
        kategori: initialAracKategoriFields.kategori,
        altKategori: initialAracKategoriFields.altKategori,
        calistigiKurum: arac.calistigiKurum || arac.kullanici?.sirket?.ad || "",
        sirketId: arac.sirket?.id || "",
        disFirmaId: arac.disFirma?.id || arac.disFirmaId || "",
        ruhsatSeriNo: arac.ruhsatSeriNo || "",
        aciklama: arac.aciklama || "",
        saseNo: arac.saseNo || "",
        motorNo: arac.motorNo || "",
        kullaniciId: arac.kullanici?.id || "",
    });
    const resolvedAracEditKategoriFields = React.useMemo(
        () =>
            resolveAracKategoriFields({
                kategori: aracEditForm.kategori,
                altKategori: aracEditForm.altKategori,
            }),
        [aracEditForm.altKategori, aracEditForm.kategori]
    );
    const aracEditAltKategoriOptions = React.useMemo(
        () => getAracAltKategoriOptions(resolvedAracEditKategoriFields.kategori),
        [resolvedAracEditKategoriFields.kategori]
    );
    const sortedKullanicilar = React.useMemo(
        () => sortByTextValue(kullanicilar, (k) => k.adSoyad),
        [kullanicilar]
    );
    const hasKiralikSirket = React.useMemo(
        () => sirketler.some((sirket) => isKiralikSirketName(sirket.ad)),
        [sirketler]
    );
    const aracYakitOrtalamasi = React.useMemo(() => {
        const raw = Number(arac.ortalamaYakit100Km);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw;
    }, [arac.ortalamaYakit100Km]);
    const aracYakitTuketimBirimiEtiketi = React.useMemo(
        () => (arac.yakitTuketimBirimi === "LITRE_PER_HOUR" ? "L/saat" : "L/100 km"),
        [arac.yakitTuketimBirimi]
    );
    const aracMesafeBirimiEtiketi = React.useMemo(
        () => (initialAracKategoriFields.altKategori === "IS_MAKINESI" ? "saat" : "km"),
        [initialAracKategoriFields.altKategori]
    );
    const aracYakitAralikSayisi = Number(arac.ortalamaYakitIntervalSayisi || 0);
    const ruhsatSahibiFirmaAdi = arac.sirket?.ad || "Bağımsız";
    const kullaniciFirmaAdi = arac.kullanici?.sirket?.ad || arac.calistigiKurum || "-";
    const disFirmaAdi = arac.disFirma?.ad
        ? `${arac.disFirma.ad}${arac.disFirma.tur ? ` (${arac.disFirma.tur === "KIRALIK" ? "Kiralık" : "Taşeron"})` : ""}`
        : "-";
    const aracTabloToplamlari = React.useMemo(() => ({
        zimmetKm: getZimmetKmDelta(arac.kullaniciGecmisi || []),
        bakimTutar: sumBy(arac.bakimlar || [], (kayit) => kayit.tutar),
        arizaTutar: sumBy(arac.arizalar || [], (kayit) => kayit.tutar),
        yakitKm: getFuelKmDelta(arac.yakitlar || []),
        yakitLitre: sumBy(arac.yakitlar || [], (kayit) => kayit.litre),
        yakitTutar: sumBy(arac.yakitlar || [], (kayit) => kayit.tutar),
        masrafTutar: sumBy(arac.masraflar || [], (kayit) => kayit.tutar),
        cezaTutar: sumBy(arac.cezalar || [], (kayit) => kayit.tutar),
        trafikTutar: sumBy(arac.trafikSigortasi || [], (kayit) => kayit.tutar),
        kaskoTutar: sumBy(arac.kasko || [], (kayit) => kayit.tutar),
        muayeneTutar: sumBy(arac.muayene || [], (kayit) => kayit.tutar),
    }), [arac]);
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
    const selectedSirketForEdit = React.useMemo(
        () => sirketler.find((item) => item.id === aracEditForm.sirketId),
        [aracEditForm.sirketId, sirketler]
    );
    const santiyeOptionsForEdit = React.useMemo(
        () => (selectedSirketForEdit?.santiyeler || []).filter((item) => String(item || "").trim().length > 0),
        [selectedSirketForEdit]
    );
    const santiyeListIdForEdit = aracEditForm.sirketId ? `arac-detail-santiye-${aracEditForm.sirketId}` : "arac-detail-santiye-generic";
    const arizaSoforOptions = React.useMemo(() => {
        if (!arac.kullanici?.id) {
            return sortedKullanicilar;
        }

        const options = new Map<string, SoforOption>();
        const ekle = (option?: Partial<SoforOption> | null) => {
            const id = option?.id;
            if (!id) return;
            const text = (option?.adSoyad || "").trim();
            if (!text) return;
            options.set(id, {
                id,
                adSoyad: text,
                sirketId: option?.sirketId || null,
                sirketAd: option?.sirketAd || null,
            });
        };

        ekle({
            id: arac.kullanici.id,
            adSoyad: `${arac.kullanici.ad || ""} ${arac.kullanici.soyad || ""}`.trim(),
            sirketId: arac.kullanici.sirket?.id || null,
            sirketAd: arac.kullanici.sirket?.ad || null,
        });

        const seciliSoforId = editArizaRow?.soforId || arizaEditForm.soforId;
        const seciliSofor = sortedKullanicilar.find((k) => k.id === seciliSoforId);
        if (seciliSofor) {
            ekle(seciliSofor);
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
    const resetSoforIadeForm = React.useCallback(() => {
        setSoforIadeForm({
            bitis: nowDateTimeLocal(),
            bitisKm: defaultSoforIadeKm,
            notlar: activeZimmet?.notlar || "",
        });
    }, [activeZimmet?.notlar, defaultSoforIadeKm]);

    const resetAracEditForm = React.useCallback(() => {
        setAracEditForm({
            plaka: forceUppercase(arac.plaka || ""),
            marka: forceUppercase(arac.marka || ""),
            model: forceUppercase(arac.model || ""),
            yil: Number(arac.yil || new Date().getFullYear()),
            muayeneGecerlilikTarihi: toDateTimeLocalInput(arac.muayene?.[0]?.gecerlilikTarihi),
            bulunduguIl: arac.bulunduguIl || "MERKEZ",
            guncelKm: Number(arac.guncelKm || 0),
            bedel: arac.bedel === null || arac.bedel === undefined ? "" : String(arac.bedel),
            kategori: initialAracKategoriFields.kategori,
            altKategori: initialAracKategoriFields.altKategori,
            calistigiKurum: arac.calistigiKurum || arac.kullanici?.sirket?.ad || "",
            sirketId: arac.sirket?.id || "",
            disFirmaId: arac.disFirma?.id || arac.disFirmaId || "",
            ruhsatSeriNo: arac.ruhsatSeriNo || "",
            aciklama: arac.aciklama || "",
            saseNo: arac.saseNo || "",
            motorNo: arac.motorNo || "",
            kullaniciId: arac.kullanici?.id || "",
        });
    }, [arac, initialAracKategoriFields.altKategori, initialAracKategoriFields.kategori]);

    const handleUpdateAracBilgileri = async () => {
        if (!aracEditForm.marka.trim() || !aracEditForm.model.trim()) {
            toast.warning("Eksik Bilgi", { description: "Marka ve model alanları zorunludur." });
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
            kategori: resolvedAracEditKategoriFields.kategori,
            altKategori: resolvedAracEditKategoriFields.altKategori,
            calistigiKurum: aracEditForm.calistigiKurum || null,
            sirketId: aracEditForm.sirketId || null,
            ruhsatSeriNo: aracEditForm.ruhsatSeriNo || null,
            aciklama: aracEditForm.aciklama || null,
            saseNo: forceUppercase(aracEditForm.saseNo || ""),
            motorNo: forceUppercase(aracEditForm.motorNo || ""),
            kullaniciId: aracEditForm.kullaniciId || null,
        });
        setUpdatingArac(false);

        if (res.success) {
            setEditAracOpen(false);
            if ((res as any).pendingApproval) {
                toast.info("Talep Admin Onayına Gönderildi", {
                    description: (res as any).message || "Admin onaylayana kadar mevcut araç bilgileri değişmeden kalacak.",
                });
            } else {
                toast.success("Araç bilgileri güncellendi.");
            }
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
            router.push(scopedHref("/dashboard/araclar"));
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
            resetSoforIadeForm();
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
            toast.warning("Eksik Bilgi", { description: "Kaza açıklaması zorunludur." });
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
            toast.success("Kaza kaydı güncellendi.");
            closeArizaEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleSeviseGonderAriza = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Servise Gönder",
            message: `${arac.plaka} için açılan kaza kaydı onarıma gönderilecek. Onaylıyor musunuz?`,
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
            title: "Kaza Kaydını Sil",
            message: `${arac.plaka} için kaza kaydını silmek istediğinize emin misiniz?`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;

        setArizaActionLoading(true);
        const res = await deleteArizaKaydi(row.id);
        setArizaActionLoading(false);

        if (res.success) {
            toast.success("Kaza kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openBakimEdit = (row: AracDetaySaaS) => {
        setEditBakimRow(row);
        setBakimEditForm({
            bakimTarihi: toDateTimeLocalInput(row.bakimTarihi),
            arizaSikayet: row.arizaSikayet || "",
            yapilanIslemler: row.yapilanIslemler || "",
            degisenParca: row.degisenParca || "",
            islemYapanFirma: row.islemYapanFirma || row.servisAdi || "",
            tutar: row.tutar ? String(row.tutar) : "",
        });
    };

    const closeBakimEdit = () => setEditBakimRow(null);

    const handleUpdateBakim = async () => {
        if (!editBakimRow) return;
        setActionLoading(true);
        const res = await updateBakim(editBakimRow.id, {
            bakimTarihi: new Date(bakimEditForm.bakimTarihi),
            arizaSikayet: bakimEditForm.arizaSikayet,
            yapilanIslemler: bakimEditForm.yapilanIslemler,
            degisenParca: bakimEditForm.degisenParca,
            islemYapanFirma: bakimEditForm.islemYapanFirma,
            tutar: Number(bakimEditForm.tutar || 0),
            aracId: arac.id,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Servis kaydı güncellendi.");
            closeBakimEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteBakim = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Servis Kaydını Sil",
            message: "Bu servis kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteBakim(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Servis kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openYakitEdit = (row: AracDetaySaaS) => {
        setEditYakitRow(row);
        setYakitEditForm({
            tarih: toDateTimeLocalInput(row.tarih),
            litre: String(row.litre),
            km: row.km != null ? String(row.km) : "",
            istasyon: row.istasyon || "",
        });
    };

    const closeYakitEdit = () => setEditYakitRow(null);

    const handleUpdateYakit = async () => {
        if (!editYakitRow) return;
        setActionLoading(true);
        const res = await updateYakit(editYakitRow.id, {
            tarih: yakitEditForm.tarih,
            litre: Number(yakitEditForm.litre),
            km: yakitEditForm.km ? Number(yakitEditForm.km) : null,
            istasyon: yakitEditForm.istasyon,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Yakıt kaydı güncellendi.");
            closeYakitEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteYakit = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Yakıt Kaydını Sil",
            message: "Bu yakıt kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteYakit(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Yakıt kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openMasrafEdit = (row: AracDetaySaaS) => {
        setEditMasrafRow(row);
        setMasrafEditForm({
            tarih: toDateTimeLocalInput(row.tarih).slice(0, 10),
            tur: row.tur,
            tutar: String(row.tutar),
            aciklama: row.aciklama || "",
        });
    };

    const closeMasrafEdit = () => setEditMasrafRow(null);

    const handleUpdateMasraf = async () => {
        if (!editMasrafRow) return;
        setActionLoading(true);
        const res = await updateMasraf(editMasrafRow.id, {
            tarih: masrafEditForm.tarih,
            tur: masrafEditForm.tur,
            tutar: Number(masrafEditForm.tutar),
            aciklama: masrafEditForm.aciklama,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Masraf kaydı güncellendi.");
            closeMasrafEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteMasraf = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Masraf Kaydını Sil",
            message: "Bu masraf kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteMasraf(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Masraf kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openCezaEdit = (row: AracDetaySaaS) => {
        setEditCezaRow(row);
        setCezaEditForm({
            tarih: toDateTimeLocalInput(row.tarih).slice(0, 10),
            sonOdemeTarihi: toDateTimeLocalInput(row.sonOdemeTarihi || row.tarih).slice(0, 10),
            soforId: row.soforId || "",
            cezaMaddesi: row.cezaMaddesi || "",
            tutar: String(row.tutar || 0),
            odendiMi: row.odendiMi || false,
        });
    };

    const closeCezaEdit = () => setEditCezaRow(null);

    const handleUpdateCeza = async () => {
        if (!editCezaRow) return;
        setActionLoading(true);
        const res = await updateCeza(editCezaRow.id, {
            tarih: cezaEditForm.tarih,
            sonOdemeTarihi: cezaEditForm.sonOdemeTarihi,
            soforId: cezaEditForm.soforId || "",
            cezaMaddesi: cezaEditForm.cezaMaddesi,
            tutar: Number(cezaEditForm.tutar),
            odendiMi: cezaEditForm.odendiMi,
            aracId: arac.id,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Ceza kaydı güncellendi.");
            closeCezaEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteCeza = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Ceza Kaydını Sil",
            message: "Bu ceza kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteCeza(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Ceza kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openSigortaEdit = (row: AracDetaySaaS, tipi: "TRAFIK" | "KASKO") => {
        setEditSigortaRow(row);
        setSigortaEditTipi(tipi);
        setSigortaEditForm({
            sirket: row.sirket || "",
            acente: row.acente || "",
            policeNo: row.policeNo || "",
            baslangicTarihi: toDateTimeLocalInput(row.baslangicTarihi).slice(0, 10),
            bitisTarihi: toDateTimeLocalInput(row.bitisTarihi).slice(0, 10),
            tutar: String(row.tutar || ""),
            aktifMi: row.aktifMi ?? true,
        });
    };

    const closeSigortaEdit = () => setEditSigortaRow(null);

    const handleUpdateSigorta = async () => {
        if (!editSigortaRow) return;
        setActionLoading(true);
        const action = sigortaEditTipi === "TRAFIK" ? updateSigorta : updateKasko;
        const res = await action(editSigortaRow.id, {
            ...sigortaEditForm,
            tutar: sigortaEditForm.tutar ? Number(sigortaEditForm.tutar) : null,
            aracId: arac.id,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Poliçe güncellendi.");
            closeSigortaEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteSigorta = async (row: AracDetaySaaS, tipi: "TRAFIK" | "KASKO") => {
        const confirmed = await openConfirm({
            title: "Poliçeyi Sil",
            message: "Bu poliçe kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const action = tipi === "TRAFIK" ? deleteSigorta : deleteKasko;
        const res = await action(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Poliçe silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openMuayeneEdit = (row: AracDetaySaaS) => {
        setEditMuayeneRow(row);
        setMuayeneEditForm({
            muayeneTarihi: toDateTimeLocalInput(row.muayeneTarihi).slice(0, 10),
            gecerlilikTarihi: toDateTimeLocalInput(row.gecerlilikTarihi).slice(0, 10),
            tutar: String(row.tutar || ""),
            gectiMi: row.gectiMi ?? true,
            km: String(row.km || ""),
            aktifMi: row.aktifMi ?? true,
        });
    };

    const closeMuayeneEdit = () => setEditMuayeneRow(null);

    const handleUpdateMuayene = async () => {
        if (!editMuayeneRow) return;
        setActionLoading(true);
        const res = await updateMuayene(editMuayeneRow.id, {
            ...muayeneEditForm,
            tutar: muayeneEditForm.tutar ? Number(muayeneEditForm.tutar) : null,
            km: muayeneEditForm.km ? Number(muayeneEditForm.km) : null,
            aracId: arac.id,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Muayene kaydı güncellendi.");
            closeMuayeneEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteMuayene = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Muayene Kaydını Sil",
            message: "Bu muayene kaydını silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteMuayene(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Muayene kaydı silindi.");
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const openDokumanEdit = (row: AracDetaySaaS) => {
        setEditDokumanRow(row);
        setDokumanEditForm({
            ad: row.ad || "",
            tur: row.tur,
            dosyaUrl: row.dosyaUrl || "",
        });
    };

    const closeDokumanEdit = () => setEditDokumanRow(null);

    const handleUpdateDokuman = async () => {
        if (!editDokumanRow) return;
        setActionLoading(true);
        const res = await updateDokuman(editDokumanRow.id, {
            ...dokumanEditForm,
            aracId: arac.id,
        });
        setActionLoading(false);
        if (res.success) {
            toast.success("Evrak bilgisi güncellendi.");
            closeDokumanEdit();
            router.refresh();
            return;
        }
        toast.error("İşlem başarısız.", { description: res.error });
    };

    const handleDeleteDokuman = async (row: AracDetaySaaS) => {
        const confirmed = await openConfirm({
            title: "Evrakı Sil",
            message: "Bu evrakı silmek istediğinize emin misiniz?",
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteDokuman(row.id);
        setActionLoading(false);
        if (res.success) {
            toast.success("Evrak silindi.");
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
            case 'ARIZALI': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 font-semibold px-3 py-1 border-0 shadow-none">Kazalı</Badge>;
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

    const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy", { locale: tr }) : '-';

    const buildDokumanUploadForm = (params: {
        ad: string;
        tur: string;
        file?: File | null;
        dosyaUrl?: string;
    }) => {
        const formData = new FormData();
        formData.append("ad", params.ad);
        formData.append("aracId", arac.id);
        formData.append("tur", params.tur);
        if (params.file) formData.append("file", params.file);
        if (params.dosyaUrl) formData.append("dosyaUrl", params.dosyaUrl);
        return formData;
    };

    const resetFormForTab = (tab: string) => {
        if (tab === "soforGecmisi") {
            setZimmetForm({
                kullaniciId: "",
                baslangic: todayDate(),
                baslangicKm: String(arac.guncelKm || 0),
                notlar: "",
            });
        } else if (tab === "ruhsat") {
            setRuhsatDokumanForm({ ad: "", dosyaUrl: "", file: null });
        } else if (tab === "bakim") {
            setBakimForm({
                bakimTarihi: todayDate(),
                arizaSikayet: "",
                yapilanIslemler: "",
                degisenParca: "",
                islemYapanFirma: "",
                tutar: "",
            });
        } else if (tab === "yakit") {
            setYakitForm({
                tarih: nowDateTimeLocal(),
                litre: "",
                km: "",
                istasyon: "",
            });
        } else if (tab === "masraflar") {
            setMasrafForm({
                tarih: todayDate(),
                tur: "BAKIM_ONARIM",
                tutar: "",
                aciklama: "",
            });
        } else if (tab === "ceza") {
            setCezaForm({
                tarih: todayDate(),
                sonOdemeTarihi: todayDate(),
                soforId: "",
                cezaMaddesi: "",
                tutar: "",
                odendiMi: false,
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
                file: null,
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
                if (!ruhsatDokumanForm.file && !ruhsatDokumanForm.dosyaUrl.trim()) {
                    toast.warning("Dosya Eksik", { description: "Lütfen PDF, JPG, JPEG veya PNG dosyası seçin." });
                    return;
                }
                const res = await createDokuman(buildDokumanUploadForm({
                    ad: ruhsatDokumanForm.ad.trim(),
                    tur: "RUHSAT",
                    file: ruhsatDokumanForm.file,
                    dosyaUrl: ruhsatDokumanForm.dosyaUrl.trim(),
                }));
                if (!res.success) throw new Error(res.error || "Ruhsat belgesi oluşturulamadı.");
                toast.success("Ruhsat belgesi eklendi.");
            } else if (activeTab === "bakim") {
                if (!bakimForm.bakimTarihi || !bakimForm.tutar) {
                    toast.warning("Eksik Bilgi", { description: "Tarih ve tutar zorunludur." });
                    return;
                }
                const res = await addBakim({
                    aracId: arac.id,
                    bakimTarihi: new Date(bakimForm.bakimTarihi),
                    arizaSikayet: bakimForm.arizaSikayet || undefined,
                    yapilanIslemler: bakimForm.yapilanIslemler || undefined,
                    degisenParca: bakimForm.degisenParca || undefined,
                    islemYapanFirma: bakimForm.islemYapanFirma || undefined,
                    tutar: Number(bakimForm.tutar),
                });
                if (!res.success) throw new Error(res.error || "Servis kaydı oluşturulamadı.");
                toast.success("Servis kaydı eklendi.");
            } else if (activeTab === "yakit") {
                const litre = Number(yakitForm.litre || 0);
                if (!litre) {
                    toast.warning("Eksik Bilgi", { description: "Litre zorunludur." });
                    return;
                }
                const kmText = String(yakitForm.km || "").trim();
                const kmValue = kmText ? Number(kmText) : null;
                if (kmText && (!Number.isFinite(kmValue) || Number(kmValue) < 0)) {
                    toast.warning("Geçersiz Bilgi", { description: "KM alanını kontrol edin." });
                    return;
                }
                const res = await createYakit({
                    aracId: arac.id,
                    tarih: yakitForm.tarih,
                    litre,
                    tutar: 0,
                    km: kmValue,
                    istasyon: yakitForm.istasyon || undefined,
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
            } else if (activeTab === "ceza") {
                if (!cezaForm.tarih || !cezaForm.tutar) {
                    toast.warning("Eksik Bilgi", { description: "Tarih ve tutar zorunludur." });
                    return;
                }
                const res = await createCeza({
                    aracId: arac.id,
                    soforId: cezaForm.soforId || null,
                    tarih: new Date(cezaForm.tarih),
                    sonOdemeTarihi: cezaForm.sonOdemeTarihi ? new Date(cezaForm.sonOdemeTarihi) : null,
                    cezaMaddesi: cezaForm.cezaMaddesi,
                    tutar: Number(cezaForm.tutar),
                    odendiMi: cezaForm.odendiMi,
                });
                if (!res.success) throw new Error(res.error || "Ceza kaydı oluşturulamadı.");
                toast.success("Ceza kaydı eklendi.");
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
                if (!dokumanForm.file && !dokumanForm.dosyaUrl.trim()) {
                    toast.warning("Dosya Eksik", { description: "Lütfen PDF, JPG, JPEG veya PNG dosyası seçin." });
                    return;
                }
                const res = await createDokuman(buildDokumanUploadForm({
                    ad: dokumanForm.ad.trim(),
                    tur: dokumanForm.tur,
                    file: dokumanForm.file,
                    dosyaUrl: dokumanForm.dosyaUrl.trim(),
                }));
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
                                    label: getPersonelOptionLabel(k),
                                    searchText: getPersonelOptionSearchText(k),
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
                        <label className="text-sm font-medium">Dosya Seç</label>
                        <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => setRuhsatDokumanForm({ ...ruhsatDokumanForm, file: e.target.files?.[0] || null })}
                            className="h-9"
                        />
                    </div>
                </div>
            );
        }

        if (activeTab === "bakim") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                        <Input type="datetime-local" value={bakimForm.bakimTarihi} onChange={e => setBakimForm({ ...bakimForm, bakimTarihi: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Arıza Şikayet</label>
                        <textarea value={bakimForm.arizaSikayet} onChange={e => setBakimForm({ ...bakimForm, arizaSikayet: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Yapılan İşlem</label>
                        <textarea value={bakimForm.yapilanIslemler} onChange={e => setBakimForm({ ...bakimForm, yapilanIslemler: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Değişen Parça</label>
                        <Input value={bakimForm.degisenParca} onChange={e => setBakimForm({ ...bakimForm, degisenParca: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">İşlem Yapan Firma</label>
                        <Input value={bakimForm.islemYapanFirma} onChange={e => setBakimForm({ ...bakimForm, islemYapanFirma: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                        <Input type="number" value={bakimForm.tutar} onChange={e => setBakimForm({ ...bakimForm, tutar: e.target.value })} className="h-9" />
                    </div>
                </div>
            );
        }

        if (activeTab === "yakit") {
            const yakitCikisiOptions = (() => {
                const current = typeof yakitForm.istasyon === "string" ? yakitForm.istasyon.trim() : "";
                if (!current) return [...YAKIT_CIKISI_OPTIONS];
                const exists = YAKIT_CIKISI_OPTIONS.some((item) => item.localeCompare(current, "tr-TR", { sensitivity: "base" }) === 0);
                return exists ? [...YAKIT_CIKISI_OPTIONS] : [...YAKIT_CIKISI_OPTIONS, current];
            })();

            return (
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Alım Tarihi & Saati</label>
                        <Input type="datetime-local" value={yakitForm.tarih} onChange={e => setYakitForm({ ...yakitForm, tarih: e.target.value })} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Alınan Litre <span className="text-red-500">*</span></label>
                            <Input type="number" step="0.01" value={yakitForm.litre} onChange={e => setYakitForm({ ...yakitForm, litre: e.target.value })} placeholder="0.00" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">KM/Saat (Opsiyonel)</label>
                            <Input type="number" value={yakitForm.km} onChange={e => setYakitForm({ ...yakitForm, km: e.target.value })} placeholder="123456" className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Yakıt Çıkışı</label>
                        <select
                            value={yakitForm.istasyon}
                            onChange={e => setYakitForm({ ...yakitForm, istasyon: e.target.value })}
                            className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                            <option value="">Seçiniz...</option>
                            {yakitCikisiOptions.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
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

        if (activeTab === "ceza") {
            return (
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Ceza Tarihi <span className="text-red-500">*</span></label>
                            <Input type="date" value={cezaForm.tarih} onChange={e => setCezaForm({ ...cezaForm, tarih: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Son Ödeme (Opsiyonel)</label>
                            <Input type="date" value={cezaForm.sonOdemeTarihi} onChange={e => setCezaForm({ ...cezaForm, sonOdemeTarihi: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Şoför</label>
                        <SearchableSelect
                            value={cezaForm.soforId}
                            onValueChange={(v) => setCezaForm({ ...cezaForm, soforId: v })}
                            placeholder="Şoför seçiniz..."
                            options={[
                                { value: "", label: "Şoför seçiniz..." },
                                ...sortedKullanicilar.map(k => ({ value: k.id, label: k.adSoyad }))
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Ceza Maddesi</label>
                            <Input value={cezaForm.cezaMaddesi} onChange={e => setCezaForm({ ...cezaForm, cezaMaddesi: e.target.value })} className="h-9" placeholder="Örn: 51/2-A" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" value={cezaForm.tutar} onChange={e => setCezaForm({ ...cezaForm, tutar: e.target.value })} className="h-9" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="cezaOdendiMi" checked={cezaForm.odendiMi} onChange={e => setCezaForm({ ...cezaForm, odendiMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                        <label htmlFor="cezaOdendiMi" className="text-sm font-medium">Ödendi mi?</label>
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
                            <select 
                                value={sigortaForm.acente} 
                                onChange={e => setSigortaForm({ ...sigortaForm, acente: e.target.value })} 
                                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                            >
                                <option value="">Seçiniz...</option>
                                <option value="Hisar Sigorta Aracılık Hizmetleri">Hisar Sigorta Aracılık Hizmetleri</option>
                                <option value="Erçal Sigorta">Erçal Sigorta</option>
                            </select>
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
                        <label className="text-sm font-medium">Dosya Seç</label>
                        <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => setDokumanForm({ ...dokumanForm, file: e.target.files?.[0] || null })}
                            className="h-9"
                        />
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
                    onClick={() => router.push(scopedHref('/dashboard/araclar'))}
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
                        <DialogContent className="max-h-[88vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Araç Bilgilerini Düzenle</DialogTitle>
                                <DialogDescription>
                                    "{arac.plaka}" plakalı aracın teknik ve idari bilgilerini güncelleyin.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3 py-2">
                                <div className="col-span-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Temel Bilgiler</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Car size={14} className="text-slate-400" />
                                        Plaka <span className="text-rose-500">*</span>
                                    </label>
                                    <Input value={aracEditForm.plaka} onChange={e => setAracEditForm({ ...aracEditForm, plaka: forceUppercase(e.target.value) })} placeholder="34 ABC 123" className="h-9 font-mono uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Marka <span className="text-rose-500">*</span></label>
                                    <Input value={aracEditForm.marka} onChange={e => setAracEditForm({ ...aracEditForm, marka: forceUppercase(e.target.value) })} placeholder="RENAULT" className="h-9 uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Model <span className="text-rose-500">*</span></label>
                                    <Input value={aracEditForm.model} onChange={e => setAracEditForm({ ...aracEditForm, model: forceUppercase(e.target.value) })} placeholder="MEGANE" className="h-9 uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Model Yılı <span className="text-rose-500">*</span></label>
                                    <Input
                                        type="number"
                                        value={safeNumberInputValue(aracEditForm.yil, new Date().getFullYear())}
                                        onChange={e => setAracEditForm({
                                            ...aracEditForm,
                                            yil: parseNumberInput(
                                                e.target.value,
                                                safeNumberInputValue(aracEditForm.yil, new Date().getFullYear())
                                            )
                                        })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Güncel KM <span className="text-rose-500">*</span></label>
                                    <Input
                                        type="number"
                                        value={safeNumberInputValue(aracEditForm.guncelKm, 0)}
                                        onChange={e => setAracEditForm({
                                            ...aracEditForm,
                                            guncelKm: parseNumberInput(
                                                e.target.value,
                                                safeNumberInputValue(aracEditForm.guncelKm, 0)
                                            )
                                        })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Muayene Geçerlilik</label>
                                    <Input type="datetime-local" value={aracEditForm.muayeneGecerlilikTarihi} onChange={e => setAracEditForm({ ...aracEditForm, muayeneGecerlilikTarihi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-sm font-medium">Şase No</label>
                                    <Input value={aracEditForm.saseNo} onChange={e => setAracEditForm({ ...aracEditForm, saseNo: forceUppercase(e.target.value) })} className="h-9 uppercase" placeholder="Opsiyonel" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-sm font-medium">Motor No</label>
                                    <Input value={aracEditForm.motorNo} onChange={e => setAracEditForm({ ...aracEditForm, motorNo: forceUppercase(e.target.value) })} className="h-9 uppercase" placeholder="Opsiyonel" />
                                </div>

                                <div className="col-span-2 pt-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Organizasyon & Zimmet</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Settings size={14} className="text-slate-400" />
                                        Ruhsat Sahibi Firma
                                    </label>
                                    <select
                                        value={aracEditForm.sirketId}
                                        onChange={e => {
                                            const nextSirketId = e.target.value;
                                            const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                                            const nextSantiyeler = (selectedSirket?.santiyeler || []).filter((item) => String(item || "").trim().length > 0);
                                            setAracEditForm({
                                                ...aracEditForm,
                                                sirketId: nextSirketId,
                                                bulunduguIl: nextSantiyeler[0] || selectedSirket?.bulunduguIl || aracEditForm.bulunduguIl,
                                            });
                                        }}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        {canAssignIndependentRecords ? <option value="">Şirket Seçiniz (Bağımsız)</option> : <option value="" disabled>Şirket Seçiniz</option>}
                                        {canAssignIndependentRecords && !hasKiralikSirket && <option value={KIRALIK_SIRKET_OPTION_VALUE}>{KIRALIK_SIRKET_ADI}</option>}
                                        {sirketler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Settings size={14} className="text-slate-400" />
                                        Dış Firma
                                    </label>
                                    <select
                                        value={aracEditForm.disFirmaId}
                                        onChange={e => setAracEditForm({ ...aracEditForm, disFirmaId: e.target.value })}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="">Dış firma yok</option>
                                        {disFirmalar.map((firma) => (
                                            <option key={firma.id} value={firma.id}>
                                                {firma.ad} ({firma.tur === "KIRALIK" ? "Kiralık" : "Taşeron"})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Settings size={14} className="text-slate-400" />
                                        Kullanıcı Firma
                                    </label>
                                    <select
                                        value={aracEditForm.calistigiKurum}
                                        onChange={e => setAracEditForm({ ...aracEditForm, calistigiKurum: e.target.value })}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="">Kullanıcı Firma Seçiniz</option>
                                        {kullaniciFirmaOptions.map((firma) => <option key={firma} value={firma}>{firma}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Users size={14} className="text-slate-400" />
                                        Zimmetli Kullanıcı (Atama)
                                    </label>
                                    <SearchableSelect
                                        value={aracEditForm.kullaniciId}
                                        onValueChange={(value) => {
                                            const selectedKullanici = editAracFormKullanicilar.find((u) => u.id === value);
                                            setAracEditForm({
                                                ...aracEditForm,
                                                kullaniciId: value,
                                                calistigiKurum: selectedKullanici?.sirketAd || aracEditForm.calistigiKurum,
                                            });
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

                                <div className="col-span-2 pt-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Operasyonel Detaylar</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bulunduğu Şantiye</label>
                                    <Input
                                        value={aracEditForm.bulunduguIl}
                                        onChange={e => setAracEditForm({ ...aracEditForm, bulunduguIl: forceUppercase(e.target.value) })}
                                        list={santiyeListIdForEdit}
                                        placeholder={santiyeOptionsForEdit.length > 0 ? "Şantiye seçin veya yazın" : "Şantiye adı yazın"}
                                        className="h-9 uppercase"
                                    />
                                    <datalist id={santiyeListIdForEdit}>
                                        {santiyeOptionsForEdit.map((santiye) => (
                                            <option key={santiye} value={santiye} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Üst Kategori</label>
                                    <select
                                        value={resolvedAracEditKategoriFields.kategori}
                                        onChange={e => {
                                            const next = resolveAracKategoriFields({
                                                kategori: e.target.value,
                                                altKategori: resolvedAracEditKategoriFields.altKategori,
                                            });
                                            setAracEditForm({
                                                ...aracEditForm,
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
                                        value={resolvedAracEditKategoriFields.altKategori}
                                        onChange={e => {
                                            const next = resolveAracKategoriFields({
                                                kategori: resolvedAracEditKategoriFields.kategori,
                                                altKategori: e.target.value,
                                            });
                                            setAracEditForm({
                                                ...aracEditForm,
                                                kategori: next.kategori,
                                                altKategori: next.altKategori,
                                            });
                                        }}
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    >
                                        {aracEditAltKategoriOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bedel</label>
                                    <Input type="number" value={aracEditForm.bedel} onChange={e => setAracEditForm({ ...aracEditForm, bedel: e.target.value })} className="h-9" placeholder="₺" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ruhsat Seri No</label>
                                    <Input value={aracEditForm.ruhsatSeriNo} onChange={e => setAracEditForm({ ...aracEditForm, ruhsatSeriNo: e.target.value })} className="h-9" placeholder="Örn: AA 123456" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-sm font-medium">Açıklama</label>
                                    <textarea
                                        value={aracEditForm.aciklama}
                                        onChange={e => setAracEditForm({ ...aracEditForm, aciklama: e.target.value })}
                                        placeholder="Araç hakkında ek bilgiler..."
                                        rows={2}
                                        className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="gap-2">
                                <button
                                    onClick={handleUpdateAracBilgileri}
                                    disabled={updatingArac}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md text-sm font-semibold shadow-md transition-all disabled:opacity-50"
                                >
                                    {updatingArac ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
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
                                <div className="flex items-center gap-1.5"><Gauge size={16} /> {arac.guncelKm.toLocaleString('tr-TR')} {aracMesafeBirimiEtiketi}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5">
                                    <Fuel size={16} />
                                    {aracYakitOrtalamasi !== null
                                        ? `${aracYakitOrtalamasi.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${aracYakitTuketimBirimiEtiketi}`
                                        : "Yakıt ortalaması yok"}
                                    {aracYakitOrtalamasi !== null && aracYakitAralikSayisi > 0 ? (
                                        <span className="text-[11px] text-slate-400">({aracYakitAralikSayisi} aralık)</span>
                                    ) : null}
                                </div>
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
                                            resetSoforIadeForm();
                                        }
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <button className="flex-1 rounded-md border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Teslim Al (Ayrıl)</button>
                                    </DialogTrigger>
                                    <DialogContent >
                                        <DialogHeader>
                                            <DialogTitle>Zimmeti Sonlandır</DialogTitle>
                                            <DialogDescription>
                                                Araç personelden ayrılacak. İade tarihindeki kilometre bilgisini girin.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">İade Tarihi</label>
                                                    <Input type="datetime-local" value={soforIadeForm.bitis} onChange={e => setSoforIadeForm({ ...soforIadeForm, bitis: e.target.value })} className="h-9" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">İade KM</label>
                                                    <Input type="number" value={soforIadeForm.bitisKm} onChange={e => setSoforIadeForm({ ...soforIadeForm, bitisKm: e.target.value })} className="h-9" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Notlar</label>
                                                <Input value={soforIadeForm.notlar} onChange={e => setSoforIadeForm({ ...soforIadeForm, notlar: e.target.value })} className="h-9" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleUnassign} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium shadow transition-all disabled:opacity-50">
                                                {loading ? "Sonlandırılıyor..." : "Zimmeti Sonlandır"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {!arac.kullanici && (
                                <Dialog open={soforAtamaOpen} onOpenChange={setSoforAtamaOpen}>
                                    <DialogTrigger asChild>
                                        <button className="flex-1 rounded-md border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Yeni Şoför Ata</button>
                                    </DialogTrigger>
                                    <DialogContent >
                                        <DialogHeader>
                                            <DialogTitle>Araca Şoför Ata</DialogTitle>
                                            <DialogDescription>
                                                Şoför seçerek aracı teslim edin. Teslim tarihindeki kilometreyi girin.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Şoför <span className="text-red-500">*</span></label>
                                                <SearchableSelect
                                                    value={soforAtamaForm.kullaniciId}
                                                    onValueChange={v => setSoforAtamaForm({ ...soforAtamaForm, kullaniciId: v })}
                                                    placeholder="Şoför Seçiniz..."
                                                    searchPlaceholder="Personel ara..."
                                                    options={[
                                                        { value: "", label: "Şoför Seçiniz..." },
                                                        ...sortedKullanicilar.map(k => ({
                                                            value: k.id,
                                                            label: getPersonelOptionLabel(k),
                                                            searchText: getPersonelOptionSearchText(k),
                                                        }))
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
                                                <label className="text-sm font-medium">Notlar</label>
                                                <Input value={soforAtamaForm.notlar} onChange={e => setSoforAtamaForm({ ...soforAtamaForm, notlar: e.target.value })} className="h-9" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleAssignSofor} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow transition-all disabled:opacity-50">
                                                {loading ? "Atanıyor..." : "Atamayı Tamamla"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        {arac.kullanici ? (
                            <div 
                                className="flex items-center gap-3 cursor-pointer group hover:bg-white/50 p-2 -m-2 rounded-lg transition-colors"
                                onClick={() => router.push(scopedHref(`/dashboard/personel/${arac.kullanici.id}`))}
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
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Kaza Kaydını Düzenle</DialogTitle>
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
                                    <label className="text-sm font-medium">Bildiren Personel</label>
                                    <SearchableSelect
                                        value={arizaEditForm.soforId}
                                        onValueChange={(val) => setArizaEditForm((prev) => ({ ...prev, soforId: val }))}
                                        placeholder="Personel Seçin"
                                        searchPlaceholder="Personel ara..."
                                        options={[
                                            { value: "", label: "Seçilmedi" },
                                            ...arizaSoforOptions.map((o) => ({
                                                value: o.id,
                                                label: o.adSoyad,
                                            })),
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Kaza Açıklaması <span className="text-red-500">*</span></label>
                                <textarea value={arizaEditForm.aciklama} onChange={(e) => setArizaEditForm({ ...arizaEditForm, aciklama: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t pt-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Servis / Firma Adı</label>
                                    <Input value={arizaEditForm.servisAdi} onChange={(e) => setArizaEditForm({ ...arizaEditForm, servisAdi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (Opsiyonel)</label>
                                    <Input type="number" value={arizaEditForm.tutar} onChange={(e) => setArizaEditForm({ ...arizaEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yapılan İşlemler</label>
                                <textarea value={arizaEditForm.yapilanIslemler} onChange={(e) => setArizaEditForm({ ...arizaEditForm, yapilanIslemler: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={handleUpdateAriza}
                                disabled={arizaActionLoading}
                                className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md text-sm font-semibold shadow transition-all disabled:opacity-50"
                            >
                                {arizaActionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Bakım Düzenle */}
                <Dialog open={!!editBakimRow} onOpenChange={(open) => !open && closeBakimEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Servis Kaydını Düzenle</DialogTitle>
                            <DialogDescription>{arac.plaka} için servis kaydı detaylarını güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bakım/Servis Tarihi</label>
                                    <Input type="datetime-local" value={bakimEditForm.bakimTarihi} onChange={e => setBakimEditForm({ ...bakimEditForm, bakimTarihi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (₺)</label>
                                    <Input type="number" value={bakimEditForm.tutar} onChange={e => setBakimEditForm({ ...bakimEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Servis/Firma Adı</label>
                                <Input value={bakimEditForm.islemYapanFirma} onChange={e => setBakimEditForm({ ...bakimEditForm, islemYapanFirma: e.target.value })} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Arıza/Şikayet Özeti</label>
                                <Input value={bakimEditForm.arizaSikayet} onChange={e => setBakimEditForm({ ...bakimEditForm, arizaSikayet: e.target.value })} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yapılan İşlemler</label>
                                <textarea value={bakimEditForm.yapilanIslemler} onChange={e => setBakimEditForm({ ...bakimEditForm, yapilanIslemler: e.target.value })} className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Değişen Parçalar</label>
                                <Input value={bakimEditForm.degisenParca} onChange={e => setBakimEditForm({ ...bakimEditForm, degisenParca: e.target.value })} className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateBakim} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Yakıt Düzenle */}
                <Dialog open={!!editYakitRow} onOpenChange={(open) => !open && closeYakitEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Yakıt Kaydını Düzenle</DialogTitle>
                            <DialogDescription>Yakıt alım bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tarih</label>
                                <Input type="datetime-local" value={yakitEditForm.tarih} onChange={e => setYakitEditForm({ ...yakitEditForm, tarih: e.target.value })} className="h-9" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Litre</label>
                                    <Input type="number" step="0.01" value={yakitEditForm.litre} onChange={e => setYakitEditForm({ ...yakitEditForm, litre: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Araç KM</label>
                                    <Input type="number" value={yakitEditForm.km} onChange={e => setYakitEditForm({ ...yakitEditForm, km: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">İstasyon / Kaynak</label>
                                <Input value={yakitEditForm.istasyon} onChange={e => setYakitEditForm({ ...yakitEditForm, istasyon: e.target.value })} className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateYakit} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Masraf Düzenle */}
                <Dialog open={!!editMasrafRow} onOpenChange={(open) => !open && closeMasrafEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Masraf Kaydını Düzenle</DialogTitle>
                            <DialogDescription>Harcama bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tarih</label>
                                    <Input type="date" value={masrafEditForm.tarih} onChange={e => setMasrafEditForm({ ...masrafEditForm, tarih: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (₺)</label>
                                    <Input type="number" value={masrafEditForm.tutar} onChange={e => setMasrafEditForm({ ...masrafEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tür</label>
                                <select value={masrafEditForm.tur} onChange={e => setMasrafEditForm({ ...masrafEditForm, tur: e.target.value })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400">
                                    {MASRAF_TURLERI.map(tur => <option key={tur} value={tur}>{tur.replace(/_/g, " ")}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Açıklama</label>
                                <Input value={masrafEditForm.aciklama} onChange={e => setMasrafEditForm({ ...masrafEditForm, aciklama: e.target.value })} className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateMasraf} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Ceza Düzenle */}
                <Dialog open={!!editCezaRow} onOpenChange={(open) => !open && closeCezaEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Ceza Kaydını Düzenle</DialogTitle>
                            <DialogDescription>Trafik cezası detaylarını güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ceza Tarihi</label>
                                    <Input type="date" value={cezaEditForm.tarih} onChange={e => setCezaEditForm({ ...cezaEditForm, tarih: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Son Ödeme Tarihi</label>
                                    <Input type="date" value={cezaEditForm.sonOdemeTarihi} onChange={e => setCezaEditForm({ ...cezaEditForm, sonOdemeTarihi: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Şoför</label>
                                <SearchableSelect
                                    value={cezaEditForm.soforId}
                                    onValueChange={(v) => setCezaEditForm({ ...cezaEditForm, soforId: v })}
                                    placeholder="Personel seçiniz..."
                                    options={[
                                        { value: "", label: "Seçiniz..." },
                                        ...sortedKullanicilar.map(k => ({ value: k.id, label: k.adSoyad }))
                                    ]}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ceza Maddesi</label>
                                    <Input value={cezaEditForm.cezaMaddesi} onChange={e => setCezaEditForm({ ...cezaEditForm, cezaMaddesi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (₺)</label>
                                    <Input type="number" value={cezaEditForm.tutar} onChange={e => setCezaEditForm({ ...cezaEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="editCezaOdendi" checked={cezaEditForm.odendiMi} onChange={e => setCezaEditForm({ ...cezaEditForm, odendiMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                                <label htmlFor="editCezaOdendi" className="text-sm font-medium">Ceza Ödendi</label>
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateCeza} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Sigorta/Kasko Düzenle */}
                <Dialog open={!!editSigortaRow} onOpenChange={(open) => !open && closeSigortaEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>{sigortaEditTipi === "TRAFIK" ? "Trafik Sigortasını Düzenle" : "Kasko Poliçesini Düzenle"}</DialogTitle>
                            <DialogDescription>Poliçe bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Şirket</label>
                                    <Input value={sigortaEditForm.sirket} onChange={e => setSigortaEditForm({ ...sigortaEditForm, sirket: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Acente</label>
                                    <Input value={sigortaEditForm.acente} onChange={e => setSigortaEditForm({ ...sigortaEditForm, acente: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Poliçe No</label>
                                <Input value={sigortaEditForm.policeNo} onChange={e => setSigortaEditForm({ ...sigortaEditForm, policeNo: e.target.value })} className="h-9" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Başlangıç Tarihi</label>
                                    <Input type="date" value={sigortaEditForm.baslangicTarihi} onChange={e => setSigortaEditForm({ ...sigortaEditForm, baslangicTarihi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bitiş Tarihi</label>
                                    <Input type="date" value={sigortaEditForm.bitisTarihi} onChange={e => setSigortaEditForm({ ...sigortaEditForm, bitisTarihi: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tutar (₺)</label>
                                    <Input type="number" value={sigortaEditForm.tutar} onChange={e => setSigortaEditForm({ ...sigortaEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="editSigortaAktif" checked={sigortaEditForm.aktifMi} onChange={e => setSigortaEditForm({ ...sigortaEditForm, aktifMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                                    <label htmlFor="editSigortaAktif" className="text-sm font-medium">Poliçe Aktif</label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateSigorta} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Muayene Düzenle */}
                <Dialog open={!!editMuayeneRow} onOpenChange={(open) => !open && closeMuayeneEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Muayene Kaydını Düzenle</DialogTitle>
                            <DialogDescription>Muayene bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Muayene Tarihi</label>
                                    <Input type="date" value={muayeneEditForm.muayeneTarihi} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, muayeneTarihi: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Geçerlilik Tarihi</label>
                                    <Input type="date" value={muayeneEditForm.gecerlilikTarihi} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, gecerlilikTarihi: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Ücret (₺)</label>
                                    <Input type="number" value={muayeneEditForm.tutar} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, tutar: e.target.value })} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">KM</label>
                                    <Input type="number" value={muayeneEditForm.km} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, km: e.target.value })} className="h-9" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Durum</label>
                                    <select value={muayeneEditForm.gectiMi ? "GECTI" : "GECMEDI"} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, gectiMi: e.target.value === "GECTI" })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400">
                                        <option value="GECTI">Geçti</option>
                                        <option value="GECMEDI">Geçmedi</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="editMuayeneAktif" checked={muayeneEditForm.aktifMi} onChange={e => setMuayeneEditForm({ ...muayeneEditForm, aktifMi: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                                    <label htmlFor="editMuayeneAktif" className="text-sm font-medium">Kayıt Aktif</label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateMuayene} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Evrak Düzenle */}
                <Dialog open={!!editDokumanRow} onOpenChange={(open) => !open && closeDokumanEdit()}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Evrak Bilgisini Düzenle</DialogTitle>
                            <DialogDescription>Dosya bilgilerini ve türünü güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Belge Adı</label>
                                <Input value={dokumanEditForm.ad} onChange={e => setDokumanEditForm({ ...dokumanEditForm, ad: e.target.value })} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Kategori</label>
                                <select value={dokumanEditForm.tur} onChange={e => setDokumanEditForm({ ...dokumanEditForm, tur: e.target.value as any })} className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400">
                                    {DOKUMAN_TURLERI.map(tur => <option key={tur.value} value={tur.value}>{tur.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Dosya URL</label>
                                <Input value={dokumanEditForm.dosyaUrl} onChange={e => setDokumanEditForm({ ...dokumanEditForm, dosyaUrl: e.target.value })} className="h-9 text-xs" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleUpdateDokuman} disabled={actionLoading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all disabled:opacity-50">
                                {actionLoading ? "Güncelleniyor..." : "Güncelle"}
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
                        <TabsTrigger value="bakim" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Wrench size={16} className="mr-2" /> Servis Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="ariza" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <AlertTriangle size={16} className="mr-2" /> Kaza Kayıtları
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
                            <Dialog open={quickAddOpen} onOpenChange={(open) => {
                                setQuickAddOpen(open);
                                if (!open) {
                                    resetFormForTab(activeTab);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                                        <Plus size={16} />
                                        {QUICK_ADD_CONFIG[activeTab].button}
                                    </button>
                                </DialogTrigger>
                                <DialogContent >
                                    <DialogHeader>
                                        <DialogTitle>{QUICK_ADD_CONFIG[activeTab].title}</DialogTitle>
                                        <DialogDescription>{QUICK_ADD_CONFIG[activeTab].description}</DialogDescription>
                                    </DialogHeader>
                                    {renderQuickAddForm()}
                                    <DialogFooter>
                                        <button
                                            onClick={handleQuickCreate}
                                            disabled={submittingQuickAdd}
                                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md text-sm font-semibold shadow transition-all disabled:opacity-50"
                                        >
                                            {submittingQuickAdd ? "Kaydediliyor..." : "Kaydı Oluştur"}
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
                                                <span className="text-sm font-medium text-slate-500">Motor No</span>
                                                <span className="text-sm font-semibold text-slate-800">{arac.motorNo || '-'}</span>
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
                                    {arac.kullaniciGecmisi && arac.kullaniciGecmisi.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatKm(aracTabloToplamlari.zimmetKm)}</TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                            <li className="flex justify-between items-center gap-4 px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Ruhsat Sahibi Firma</span>
                                                <span className="max-w-[60%] break-words text-right text-sm font-semibold text-slate-900">{ruhsatSahibiFirmaAdi}</span>
                                            </li>
                                            <li className="flex justify-between items-center gap-4 px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Kullanıcı Firma</span>
                                                <span className="max-w-[60%] break-words text-right text-sm font-semibold text-indigo-600">{kullaniciFirmaAdi}</span>
                                            </li>
                                            <li className="flex justify-between items-center gap-4 px-6 py-4">
                                                <span className="text-sm font-medium text-slate-500">Dış Firma</span>
                                                <span className="max-w-[60%] break-words text-right text-sm font-semibold text-slate-900">{disFirmaAdi}</span>
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
                                                        <TableCell className="font-medium text-indigo-600 hover:underline cursor-pointer" onClick={() => window.open(`/api/dokumanlar/${d.id}/file`, "_blank")}>{d.ad}</TableCell>
                                                        <TableCell className="text-right">
                                                            <button type="button" onClick={() => window.open(`/api/dokumanlar/${d.id}/file`, "_blank")} className="text-sm font-medium text-slate-500 hover:text-indigo-600">
                                                                Görüntüle
                                                            </button>
                                                        </TableCell>
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

                        {/* 4. BAKIM */}
                        <TabsContent value="bakim">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Tarih</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Arıza Şikayet</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Yapılan İşlem</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Değişen Parça</TableHead>
                                            <TableHead className="font-semibold text-slate-500">İşlem Yapan Firma</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Masraf Tutarı</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.bakimlar && arac.bakimlar.length > 0 ? (
                                            arac.bakimlar.map((b: AracDetaySaaS) => (
                                                <TableRow key={b.id}>
                                                    <TableCell className="text-slate-700">{formatDate(b.bakimTarihi)}</TableCell>
                                                    <TableCell className="text-slate-600 max-w-[220px] truncate" title={b.arizaSikayet || ""}>{b.arizaSikayet || '-'}</TableCell>
                                                    <TableCell className="text-slate-600 max-w-[220px] truncate" title={b.yapilanIslemler || ""}>{b.yapilanIslemler || '-'}</TableCell>
                                                    <TableCell className="text-slate-600 max-w-[220px] truncate" title={b.degisenParca || ""}>{b.degisenParca || '-'}</TableCell>
                                                    <TableCell className="text-slate-900">{b.islemYapanFirma || b.servisAdi || '-'}</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{Number(b.tutar || 0).toLocaleString("tr-TR")}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <RowActionButton variant="edit" onClick={() => openBakimEdit(b)} disabled={actionLoading} />
                                                            <RowActionButton variant="delete" onClick={() => handleDeleteBakim(b)} disabled={actionLoading} />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Servis kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {arac.bakimlar && arac.bakimlar.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={5} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.bakimTutar)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                                    Kaza kaydı bulunmuyor.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                    {arac.arizalar && arac.arizalar.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={5} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.arizaTutar)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                            <TableHead className="font-semibold text-slate-500">Personel</TableHead>
                                            <TableHead className="font-semibold text-slate-500">İstasyon</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Araç KM/Saat</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Litre (L)</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Tutar (₺)</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.yakitlar && arac.yakitlar.length > 0 ? (
                                            arac.yakitlar.map((y: AracDetaySaaS) => (
                                                <TableRow key={y.id}>
                                                    <TableCell className="text-slate-700">{formatDate(y.tarih)}</TableCell>
                                                    <TableCell className="text-slate-700">
                                                        {(() => {
                                                            const selectedSofor = y.sofor || y.kullanici || arac.kullanici || (arac.kullaniciGecmisi && arac.kullaniciGecmisi[0]?.kullanici) || null;
                                                            if (selectedSofor?.id) {
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <PersonelLink personelId={selectedSofor.id} className="hover:text-indigo-600 hover:underline">
                                                                            {`${selectedSofor.ad || ""} ${selectedSofor.soyad || ""}`.trim() || "-"}
                                                                        </PersonelLink>
                                                                        {canAccessAllCompanies && (selectedSofor?.sirket?.ad || selectedSofor?.calistigiKurum) ? (
                                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">
                                                                                {selectedSofor?.sirket?.ad || selectedSofor?.calistigiKurum}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                );
                                                            }
                                                            return <span className="text-slate-400 italic text-xs">Atanmamış</span>;
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="text-slate-900">{y.istasyon || '-'}</TableCell>
                                                    <TableCell className="text-slate-700">
                                                        {y.km != null ? `${Number(y.km).toLocaleString("tr-TR")} ${aracMesafeBirimiEtiketi}` : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-slate-700">{y.litre} L</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{y.tutar.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <RowActionButton variant="edit" onClick={() => openYakitEdit(y)} disabled={actionLoading} />
                                                            <RowActionButton variant="delete" onClick={() => handleDeleteYakit(y)} disabled={actionLoading} />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Yakıt kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {arac.yakitlar && arac.yakitlar.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="font-bold text-slate-900">
                                                    {`${aracTabloToplamlari.yakitKm.toLocaleString("tr-TR")} ${aracMesafeBirimiEtiketi}`}
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-900">{formatLitres(aracTabloToplamlari.yakitLitre)}</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.yakitTutar)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.masraflar && arac.masraflar.length > 0 ? (
                                            arac.masraflar.map((m: AracDetaySaaS) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="text-slate-700">{formatDate(m.tarih)}</TableCell>
                                                    <TableCell className="text-slate-900"><Badge variant="outline">{m.tur}</Badge></TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{m.tutar.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <RowActionButton variant="edit" onClick={() => openMasrafEdit(m)} disabled={actionLoading} />
                                                            <RowActionButton variant="delete" onClick={() => handleDeleteMasraf(m)} disabled={actionLoading} />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Ekstra masraf kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {arac.masraflar && arac.masraflar.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={2} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.masrafTutar)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
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
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <RowActionButton variant="edit" onClick={() => openCezaEdit(c)} disabled={actionLoading} />
                                                                <RowActionButton variant="delete" onClick={() => handleDeleteCeza(c)} disabled={actionLoading} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Ceza kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {arac.cezalar && arac.cezalar.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={5} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.cezaTutar)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                                <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {arac.trafikSigortasi && arac.trafikSigortasi.length > 0 ? (
                                                arac.trafikSigortasi.map((s: AracDetaySaaS) => (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="text-slate-700">{formatDate(s.bitisTarihi)} <span className="ml-2">{renderDeadlineBadge(s.bitisTarihi, s.aktifMi)}</span></TableCell>
                                                        <TableCell className="text-slate-900">{s.sirket || '-'}</TableCell>
                                                        <TableCell className="text-slate-900 text-right">{s.tutar ? `₺${s.tutar.toLocaleString()}` : '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <RowActionButton variant="edit" onClick={() => openSigortaEdit(s, "TRAFIK")} disabled={actionLoading} />
                                                                <RowActionButton variant="delete" onClick={() => handleDeleteSigorta(s, "TRAFIK")} disabled={actionLoading} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Trafik sigortası kaydı bulunmuyor.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                        {arac.trafikSigortasi && arac.trafikSigortasi.length > 0 ? (
                                            <TableFooter className="bg-slate-50/90">
                                                <TableRow>
                                                    <TableCell colSpan={2} className="font-bold text-slate-900">Toplam</TableCell>
                                                    <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.trafikTutar)}</TableCell>
                                                    <TableCell />
                                                </TableRow>
                                            </TableFooter>
                                        ) : null}
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
                                                <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {arac.kasko && arac.kasko.length > 0 ? (
                                                arac.kasko.map((k: AracDetaySaaS) => (
                                                    <TableRow key={k.id}>
                                                        <TableCell className="text-slate-700">{formatDate(k.bitisTarihi)} <span className="ml-2">{renderDeadlineBadge(k.bitisTarihi, k.aktifMi)}</span></TableCell>
                                                        <TableCell className="text-slate-900">{k.sirket || '-'}</TableCell>
                                                        <TableCell className="text-slate-900 text-right">{k.tutar ? `₺${k.tutar.toLocaleString()}` : '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <RowActionButton variant="edit" onClick={() => openSigortaEdit(k, "KASKO")} disabled={actionLoading} />
                                                                <RowActionButton variant="delete" onClick={() => handleDeleteSigorta(k, "KASKO")} disabled={actionLoading} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Kasko poliçesi bulunmuyor.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                        {arac.kasko && arac.kasko.length > 0 ? (
                                            <TableFooter className="bg-slate-50/90">
                                                <TableRow>
                                                    <TableCell colSpan={2} className="font-bold text-slate-900">Toplam</TableCell>
                                                    <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.kaskoTutar)}</TableCell>
                                                    <TableCell />
                                                </TableRow>
                                            </TableFooter>
                                        ) : null}
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
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
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
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <RowActionButton variant="edit" onClick={() => openMuayeneEdit(m)} disabled={actionLoading} />
                                                            <RowActionButton variant="delete" onClick={() => handleDeleteMuayene(m)} disabled={actionLoading} />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Muayene kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {arac.muayene && arac.muayene.length > 0 ? (
                                        <TableFooter className="bg-slate-50/90">
                                            <TableRow>
                                                <TableCell colSpan={2} className="font-bold text-slate-900">Toplam</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">{formatCurrency(aracTabloToplamlari.muayeneTutar)}</TableCell>
                                                <TableCell colSpan={2} />
                                            </TableRow>
                                        </TableFooter>
                                    ) : null}
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
                                            <TableHead className="font-semibold text-slate-500 text-right">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.dokumanlar && arac.dokumanlar.length > 0 ? (
                                            arac.dokumanlar.map((d: AracDetaySaaS) => (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-slate-700">{formatDate(d.yuklemeTarihi)}</TableCell>
                                                    <TableCell className="font-medium text-indigo-600 hover:underline cursor-pointer" onClick={() => window.open(`/api/dokumanlar/${d.id}/file`, '_blank')}>{d.ad}</TableCell>
                                                    <TableCell className="text-slate-600"><Badge variant="outline">{d.tur}</Badge></TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <RowActionButton variant="edit" onClick={() => openDokumanEdit(d)} disabled={actionLoading} />
                                                            <RowActionButton variant="delete" onClick={() => handleDeleteDokuman(d)} disabled={actionLoading} />
                                                        </div>
                                                    </TableCell>
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
