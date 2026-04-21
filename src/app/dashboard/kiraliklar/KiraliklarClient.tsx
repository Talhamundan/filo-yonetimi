"use client";

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus, Truck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import {
    createKiralikArac,
    createKiralikPersonel,
    deleteKiralikArac,
    deleteKiralikPersonel,
    updateKiralikArac,
    updateKiralikPersonel,
} from "./actions";

type SirketOption = { id: string; ad: string };
type DisFirmaOption = { id: string; ad: string };

type KiralikPersonelRow = {
    id: string;
    adSoyad: string;
    ad: string;
    soyad: string;
    telefon: string;
    sirketId: string;
    sirketAd: string;
    disFirmaId: string;
    disFirmaAd: string;
    zimmetliArac: string;
};

type KiralikAracRow = {
    id: string;
    plaka: string;
    sirketId: string;
    sirketAd: string;
    disFirmaId: string;
    disFirmaAd: string;
    soforId: string;
    soforAdSoyad: string;
};

type KiralikAracForm = {
    plaka: string;
    sirketId: string;
    disFirmaId: string;
    kullaniciId: string;
};

type KiralikPersonelForm = {
    ad: string;
    soyad: string;
    telefon: string;
    sirketId: string;
    disFirmaId: string;
};

const EMPTY_ARAC_FORM: KiralikAracForm = {
    plaka: "",
    sirketId: "",
    disFirmaId: "",
    kullaniciId: "",
};

const EMPTY_PERSONEL_FORM: KiralikPersonelForm = {
    ad: "",
    soyad: "",
    telefon: "",
    sirketId: "",
    disFirmaId: "",
};

function normalizeText(value: string) {
    return value.toLocaleUpperCase("tr-TR").trim();
}

function normalizePlateInput(value: string) {
    return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR").trim();
}

export default function KiraliklarClient({
    araclar,
    personeller,
    sirketler,
    disFirmalar,
}: {
    araclar: KiralikAracRow[];
    personeller: KiralikPersonelRow[];
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
}) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();

    const [aracCreateOpen, setAracCreateOpen] = React.useState(false);
    const [personelCreateOpen, setPersonelCreateOpen] = React.useState(false);
    const [editingArac, setEditingArac] = React.useState<KiralikAracRow | null>(null);
    const [editingPersonel, setEditingPersonel] = React.useState<KiralikPersonelRow | null>(null);
    const [aracForm, setAracForm] = React.useState<KiralikAracForm>(EMPTY_ARAC_FORM);
    const [personelForm, setPersonelForm] = React.useState<KiralikPersonelForm>(EMPTY_PERSONEL_FORM);
    const [savingArac, setSavingArac] = React.useState(false);
    const [savingPersonel, setSavingPersonel] = React.useState(false);

    const sortedPersoneller = React.useMemo(
        () => [...personeller].sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr-TR")),
        [personeller]
    );

    const aracColumns = React.useMemo<ColumnDef<KiralikAracRow>[]>(
        () => [
            {
                accessorKey: "sirketAd",
                header: "Çalıştığı Firmamız",
            },
            {
                accessorKey: "disFirmaAd",
                header: "Taşeron Firma",
            },
            {
                accessorKey: "plaka",
                header: "Plaka",
                cell: ({ row }) => <span className="font-mono font-semibold">{row.original.plaka || "-"}</span>,
            },
            {
                accessorKey: "soforAdSoyad",
                header: "Şoför",
            },
            {
                id: "actions",
                header: "İşlemler",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <RowActionButton
                            variant="edit"
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditingArac(row.original);
                                setAracForm({
                                    plaka: row.original.plaka,
                                    sirketId: row.original.sirketId,
                                    disFirmaId: row.original.disFirmaId,
                                    kullaniciId: row.original.soforId || "",
                                });
                            }}
                        />
                        <RowActionButton
                            variant="delete"
                            onClick={async (event) => {
                                event.stopPropagation();
                                const confirmed = await openConfirm({
                                    title: "Kiralık Aracı Sil",
                                    message: `${row.original.plaka} plakalı kiralık aracı silmek istiyor musunuz?`,
                                    confirmText: "Evet, Sil",
                                    variant: "danger",
                                });
                                if (!confirmed) return;

                                const result = await deleteKiralikArac(row.original.id);
                                if (!result.success) {
                                    toast.error("Araç silinemedi", { description: result.error });
                                    return;
                                }
                                toast.success("Kiralık araç silindi.");
                                router.refresh();
                            }}
                        />
                    </div>
                ),
            },
        ],
        [openConfirm, router]
    );

    const personelColumns = React.useMemo<ColumnDef<KiralikPersonelRow>[]>(
        () => [
            {
                accessorKey: "adSoyad",
                header: "Personel",
            },
            {
                accessorKey: "sirketAd",
                header: "Çalıştığı Firmamız",
            },
            {
                accessorKey: "disFirmaAd",
                header: "Taşeron Firma",
            },
            {
                accessorKey: "telefon",
                header: "Telefon",
            },
            {
                accessorKey: "zimmetliArac",
                header: "Zimmetli Araç",
                cell: ({ row }) => <span className="font-mono">{row.original.zimmetliArac || "-"}</span>,
            },
            {
                id: "actions",
                header: "İşlemler",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <RowActionButton
                            variant="edit"
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditingPersonel(row.original);
                                setPersonelForm({
                                    ad: row.original.ad,
                                    soyad: row.original.soyad,
                                    telefon: row.original.telefon === "-" ? "" : row.original.telefon,
                                    sirketId: row.original.sirketId,
                                    disFirmaId: row.original.disFirmaId,
                                });
                            }}
                        />
                        <RowActionButton
                            variant="delete"
                            onClick={async (event) => {
                                event.stopPropagation();
                                const confirmed = await openConfirm({
                                    title: "Kiralık Personeli Sil",
                                    message: `${row.original.adSoyad} kaydını silmek istiyor musunuz?`,
                                    confirmText: "Evet, Sil",
                                    variant: "danger",
                                });
                                if (!confirmed) return;

                                const result = await deleteKiralikPersonel(row.original.id);
                                if (!result.success) {
                                    toast.error("Personel silinemedi", { description: result.error });
                                    return;
                                }
                                toast.success("Kiralık personel silindi.");
                                router.refresh();
                            }}
                        />
                    </div>
                ),
            },
        ],
        [openConfirm, router]
    );

    const handleCreateArac = async () => {
        if (!aracForm.plaka.trim() || !aracForm.sirketId || !aracForm.disFirmaId) {
            toast.warning("Plaka, çalıştığı firmamız ve taşeron firma zorunludur.");
            return;
        }
        setSavingArac(true);
        const result = await createKiralikArac(aracForm);
        setSavingArac(false);
        if (!result.success) {
            toast.error("Kiralık araç eklenemedi", { description: result.error });
            return;
        }
        setAracCreateOpen(false);
        setAracForm(EMPTY_ARAC_FORM);
        toast.success("Kiralık araç eklendi.");
        router.refresh();
    };

    const handleUpdateArac = async () => {
        if (!editingArac) return;
        if (!aracForm.plaka.trim() || !aracForm.sirketId || !aracForm.disFirmaId) {
            toast.warning("Plaka, çalıştığı firmamız ve taşeron firma zorunludur.");
            return;
        }

        setSavingArac(true);
        const result = await updateKiralikArac(editingArac.id, aracForm);
        setSavingArac(false);
        if (!result.success) {
            toast.error("Kiralık araç güncellenemedi", { description: result.error });
            return;
        }
        setEditingArac(null);
        setAracForm(EMPTY_ARAC_FORM);
        toast.success("Kiralık araç güncellendi.");
        router.refresh();
    };

    const handleCreatePersonel = async () => {
        if (!personelForm.ad.trim() || !personelForm.soyad.trim() || !personelForm.sirketId || !personelForm.disFirmaId) {
            toast.warning("Ad, soyad, çalıştığı firmamız ve taşeron firma zorunludur.");
            return;
        }
        setSavingPersonel(true);
        const result = await createKiralikPersonel(personelForm);
        setSavingPersonel(false);
        if (!result.success) {
            toast.error("Kiralık personel eklenemedi", { description: result.error });
            return;
        }
        setPersonelCreateOpen(false);
        setPersonelForm(EMPTY_PERSONEL_FORM);
        toast.success("Kiralık personel eklendi.");
        router.refresh();
    };

    const handleUpdatePersonel = async () => {
        if (!editingPersonel) return;
        if (!personelForm.ad.trim() || !personelForm.soyad.trim() || !personelForm.sirketId || !personelForm.disFirmaId) {
            toast.warning("Ad, soyad, çalıştığı firmamız ve taşeron firma zorunludur.");
            return;
        }

        setSavingPersonel(true);
        const result = await updateKiralikPersonel(editingPersonel.id, personelForm);
        setSavingPersonel(false);
        if (!result.success) {
            toast.error("Kiralık personel güncellenemedi", { description: result.error });
            return;
        }
        setEditingPersonel(null);
        setPersonelForm(EMPTY_PERSONEL_FORM);
        toast.success("Kiralık personel güncellendi.");
        router.refresh();
    };

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8 xl:p-10">
            {confirmModal}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kiralık Araçlar ve Personeller</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Kiralık araç giderlerini hakedişten düşebilmek için araç ve personeli tek ekrandan yönetin.
                </p>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Kiralık Araç Listesi</h3>
                        <p className="text-sm text-slate-500">Alanlar: Çalıştığı firmamız, taşeron firma, plaka, şoför.</p>
                    </div>
                    <Dialog
                        open={aracCreateOpen}
                        onOpenChange={(open) => {
                            setAracCreateOpen(open);
                            if (!open) setAracForm(EMPTY_ARAC_FORM);
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                <Plus size={16} />
                                Kiralık Araç Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Kiralık Araç</DialogTitle>
                                <DialogDescription>Yalnızca takip için gerekli temel bilgileri girin.</DialogDescription>
                            </DialogHeader>
                            <KiralikAracFormFields
                                form={aracForm}
                                setForm={setAracForm}
                                sirketler={sirketler}
                                disFirmalar={disFirmalar}
                                personeller={sortedPersoneller}
                            />
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={handleCreateArac}
                                    disabled={savingArac}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {savingArac ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable
                    columns={aracColumns}
                    data={araclar}
                    searchKey="plaka"
                    searchPlaceholder="Plaka ara..."
                    excelEntity="kiralikArac"
                    tableClassName="min-w-[920px]"
                />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Kiralık Personel Listesi</h3>
                        <p className="text-sm text-slate-500">Kiralık şoför/personel kayıtlarını buradan ekleyip yönetin.</p>
                    </div>
                    <Dialog
                        open={personelCreateOpen}
                        onOpenChange={(open) => {
                            setPersonelCreateOpen(open);
                            if (!open) setPersonelForm(EMPTY_PERSONEL_FORM);
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                <Plus size={16} />
                                Kiralık Personel Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Kiralık Personel</DialogTitle>
                                <DialogDescription>Kiralık personel kaydını hızlıca oluşturun.</DialogDescription>
                            </DialogHeader>
                            <KiralikPersonelFormFields form={personelForm} setForm={setPersonelForm} sirketler={sirketler} disFirmalar={disFirmalar} />
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={handleCreatePersonel}
                                    disabled={savingPersonel}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {savingPersonel ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable
                    columns={personelColumns}
                    data={personeller}
                    searchKey="adSoyad"
                    searchPlaceholder="Personel ara..."
                    excelEntity="kiralikPersonel"
                    tableClassName="min-w-[980px]"
                />
            </section>

            <Dialog open={Boolean(editingArac)} onOpenChange={(open) => !open && setEditingArac(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kiralık Araç Düzenle</DialogTitle>
                        <DialogDescription>{editingArac?.plaka} kaydını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <KiralikAracFormFields
                        form={aracForm}
                        setForm={setAracForm}
                        sirketler={sirketler}
                        disFirmalar={disFirmalar}
                        personeller={sortedPersoneller}
                    />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdateArac}
                            disabled={savingArac}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingArac ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editingPersonel)} onOpenChange={(open) => !open && setEditingPersonel(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kiralık Personel Düzenle</DialogTitle>
                        <DialogDescription>{editingPersonel?.adSoyad} kaydını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <KiralikPersonelFormFields form={personelForm} setForm={setPersonelForm} sirketler={sirketler} disFirmalar={disFirmalar} />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdatePersonel}
                            disabled={savingPersonel}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingPersonel ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function KiralikAracFormFields({
    form,
    setForm,
    sirketler,
    disFirmalar,
    personeller,
}: {
    form: KiralikAracForm;
    setForm: React.Dispatch<React.SetStateAction<KiralikAracForm>>;
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
    personeller: KiralikPersonelRow[];
}) {
    const filteredDriverOptions = React.useMemo(() => {
        if (!form.disFirmaId) return personeller;
        return personeller.filter((personel) => personel.disFirmaId === form.disFirmaId);
    }, [form.disFirmaId, personeller]);

    return (
        <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                    <Truck size={14} className="text-slate-400" /> Plaka <span className="text-rose-500">*</span>
                </label>
                <Input
                    value={form.plaka}
                    onChange={(event) => setForm((prev) => ({ ...prev, plaka: normalizePlateInput(event.target.value) }))}
                    placeholder="16ABC123"
                    className="h-9 font-mono uppercase"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                        <Building2 size={14} className="text-slate-400" />
                        Çalıştığı Firmamız <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.sirketId}
                        onChange={(event) => setForm((prev) => ({ ...prev, sirketId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Şirket seçiniz</option>
                        {sirketler.map((sirket) => (
                            <option key={sirket.id} value={sirket.id}>
                                {sirket.ad}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                        <Building2 size={14} className="text-slate-400" />
                        Taşeron Firma <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.disFirmaId}
                        onChange={(event) => setForm((prev) => ({ ...prev, disFirmaId: event.target.value, kullaniciId: "" }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Firma seçiniz</option>
                        {disFirmalar.map((firma) => (
                            <option key={firma.id} value={firma.id}>
                                {firma.ad}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                    <User size={14} className="text-slate-400" />
                    Şoför
                </label>
                <select
                    value={form.kullaniciId}
                    onChange={(event) => setForm((prev) => ({ ...prev, kullaniciId: event.target.value }))}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Şoför atama (boş)</option>
                    {filteredDriverOptions.map((personel) => (
                        <option key={personel.id} value={personel.id}>
                            {personel.adSoyad}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function KiralikPersonelFormFields({
    form,
    setForm,
    sirketler,
    disFirmalar,
}: {
    form: KiralikPersonelForm;
    setForm: React.Dispatch<React.SetStateAction<KiralikPersonelForm>>;
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
}) {
    return (
        <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Ad <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={form.ad}
                        onChange={(event) => setForm((prev) => ({ ...prev, ad: normalizeText(event.target.value) }))}
                        className="h-9 uppercase"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Soyad <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={form.soyad}
                        onChange={(event) => setForm((prev) => ({ ...prev, soyad: normalizeText(event.target.value) }))}
                        className="h-9 uppercase"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Telefon</label>
                <Input
                    value={form.telefon}
                    onChange={(event) => setForm((prev) => ({ ...prev, telefon: event.target.value.trim() }))}
                    className="h-9"
                    placeholder="05xx xxx xx xx"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Çalıştığı Firmamız <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.sirketId}
                        onChange={(event) => setForm((prev) => ({ ...prev, sirketId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Şirket seçiniz</option>
                        {sirketler.map((sirket) => (
                            <option key={sirket.id} value={sirket.id}>
                                {sirket.ad}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Taşeron Firma <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.disFirmaId}
                        onChange={(event) => setForm((prev) => ({ ...prev, disFirmaId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Firma seçiniz</option>
                        {disFirmalar.map((firma) => (
                            <option key={firma.id} value={firma.id}>
                                {firma.ad}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
