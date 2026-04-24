"use client"

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserAccount, deleteUserAccount, updateUserAccount, createYakitTank, updateYakitTank, deleteYakitTank } from "./actions";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Lock, User, Eye, EyeOff, Database, Download, Upload, Loader2, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Rol } from "@prisma/client";
import ExcelTransferToolbar from "@/components/ui/excel-transfer-toolbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-modal";
import type { ColumnDef } from "@tanstack/react-table";
import { RowActionButton } from "@/components/ui/row-action-button";
import { getRoleLabel } from "@/lib/role-label";
import type { YakitTank } from "@prisma/client";

type AssignablePersonel = {
    id: string;
    adSoyad: string;
    rol: Rol;
    sirketAdi: string;
};

type RegisteredUser = {
    id: string;
    ad: string;
    soyad: string;
    rol: Rol;
    sirket?: { ad: string } | null;
    hesap?: { kullaniciAdi: string } | null;
};

type RegisteredUserRow = {
    id: string;
    adSoyad: string;
    kullaniciAdi: string;
    rol: Rol;
    sirketAdi: string;
};

export default function OnayMerkeziClient({
    registeredUsers,
    assignablePersoneller,
    yakitTanklar,
}: {
    registeredUsers: RegisteredUser[];
    assignablePersoneller: AssignablePersonel[];
    yakitTanklar: YakitTank[];
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isCreating, setIsCreating] = useState(false);
    const [editRow, setEditRow] = useState<RegisteredUserRow | null>(null);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editForm, setEditForm] = useState({ kullaniciAdi: "", sifre: "", rol: "PERSONEL" as Rol });
    const hasAssignablePersonel = assignablePersoneller.length > 0;
    const [createForm, setCreateForm] = useState({
        personelId: "",
        kullaniciAdi: "",
        sifre: "",
    });
    const [isBulkExporting, setIsBulkExporting] = useState(false);
    const [isBulkImporting, setIsBulkImporting] = useState(false);
    
    // Yakit Tank States
    const [isAddingTank, setIsAddingTank] = useState(false);
    const [editTankRow, setEditTankRow] = useState<YakitTank | null>(null);
    const [isSavingTank, setIsSavingTank] = useState(false);
    const [tankForm, setTankForm] = useState({ ad: "", kapasiteLitre: 0, mevcutLitre: 0, aktifMi: true });

    const handleCreateTank = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tankForm.ad.trim() || tankForm.kapasiteLitre <= 0) {
            toast.warning("Tank adı ve geçerli kapasite zorunludur.");
            return;
        }
        setIsSavingTank(true);
        const res = await createYakitTank({
            ad: tankForm.ad,
            kapasiteLitre: tankForm.kapasiteLitre,
            mevcutLitre: tankForm.mevcutLitre
        });
        if (res.success) {
            toast.success("Yakıt tankı tanımlandı.");
            setIsAddingTank(false);
            setTankForm({ ad: "", kapasiteLitre: 0, mevcutLitre: 0, aktifMi: true });
            router.refresh();
        } else {
            toast.error(res.error || "Tank eklenemedi.");
        }
        setIsSavingTank(false);
    };

    const handleSaveTank = async () => {
        if (!editTankRow) return;
        if (!tankForm.ad.trim() || tankForm.kapasiteLitre <= 0) {
            toast.warning("Tank adı ve geçerli kapasite zorunludur.");
            return;
        }
        setIsSavingTank(true);
        const res = await updateYakitTank(editTankRow.id, tankForm);
        if (res.success) {
            toast.success("Yakıt tankı güncellendi.");
            setEditTankRow(null);
            router.refresh();
        } else {
            toast.error(res.error || "Tank güncellenemedi.");
        }
        setIsSavingTank(false);
    };

    const handleDeleteTank = async (tank: YakitTank) => {
        const confirmed = await openConfirm({
            title: "Tankı Sil",
            message: `${tank.ad} isimli yakıt tankını silmek istediğinizden emin misiniz?`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;

        const res = await deleteYakitTank(tank.id);
        if (res.success) {
            toast.success("Yakıt tankı silindi.");
            router.refresh();
        } else {
            toast.error(res.error || "Tank silinemedi.");
        }
    };

    const handleBulkExport = async () => {
        setIsBulkExporting(true);
        try {
            const response = await fetch("/api/excel/bulk");
            if (!response.ok) throw new Error("Yedekleme dosyası oluşturulamadı.");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const now = new Date();
            const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            a.download = `filo-yonetimi-yedek-${stamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Sistem yedeği başarıyla indirildi.");
        } catch (error) {
            console.error(error);
            toast.error("Yedekleme sırasında hata oluştu.");
        } finally {
            setIsBulkExporting(false);
        }
    };

    const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmed = await openConfirm({
            title: "Tüm Verileri Geri Yükle",
            message: "Bu işlem sistemdeki tüm verileri (araç, personel, yakıt, servis vb.) güncelleyecek veya yeni kayıtlar ekleyecektir. Devam etmek istiyor musunuz?",
            confirmText: "Evet, Geri Yükle",
            variant: "danger",
        });

        if (!confirmed) {
            event.target.value = "";
            return;
        }

        setIsBulkImporting(true);
        const loadingToast = toast.loading("Veriler geri yükleniyor, lütfen bekleyin...");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/excel/bulk", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Geri yükleme başarısız.");

            toast.success("Sistem verileri başarıyla geri yüklendi.");
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message || "Geri yükleme sırasında hata oluştu.");
        } finally {
            toast.dismiss(loadingToast);
            setIsBulkImporting(false);
            event.target.value = "";
        }
    };

    const createFieldLabelClass = "inline-flex h-5 items-center text-xs font-semibold text-slate-600";
    const createFieldControlClass =
        "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm leading-5 outline-none focus:border-indigo-500";
    const scopedQuery = searchParams.toString();

    const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!createForm.personelId.trim() || !createForm.kullaniciAdi.trim() || !createForm.sifre.trim()) {
            toast.warning("Personel, personel giriş adı ve şifre zorunludur.");
            return;
        }

        setIsCreating(true);
        const result = await createUserAccount({
            personelId: createForm.personelId,
            kullaniciAdi: createForm.kullaniciAdi,
            sifre: createForm.sifre,
        });

        if (result.success) {
            toast.success("Personel hesabı tanımlandı. Login ekranından giriş yapabilir.");
            setCreateForm({
                personelId: "",
                kullaniciAdi: "",
                sifre: "",
            });
            setShowCreatePassword(false);
            router.refresh();
        } else {
            toast.error(result.error || "Personel hesabı tanımlanamadı.");
        }

        setIsCreating(false);
    };

    const registeredTableData: RegisteredUserRow[] = registeredUsers.map((user) => ({
        id: user.id,
        adSoyad: `${user.ad} ${user.soyad}`.trim(),
        kullaniciAdi: user.hesap?.kullaniciAdi || "-",
        rol: user.rol,
        sirketAdi: user.sirket?.ad || "Bağımsız",
    }));

    const openUserEdit = (row: RegisteredUserRow) => {
        setEditForm({
            kullaniciAdi: row.kullaniciAdi === "-" ? "" : row.kullaniciAdi,
            sifre: "",
            rol: row.rol,
        });
        setShowEditPassword(false);
        setEditRow(row);
    };

    const handleSaveUser = async () => {
        if (!editRow) return;
        if (!editForm.kullaniciAdi.trim()) {
            toast.warning("Personel giriş adı zorunludur.");
            return;
        }

        setIsSavingUser(true);
        const result = await updateUserAccount(editRow.id, {
            kullaniciAdi: editForm.kullaniciAdi,
            sifre: editForm.sifre,
            rol: editForm.rol,
        });

        if (result.success) {
            toast.success("Personel bilgileri güncellendi.");
            setEditRow(null);
            setEditForm({ kullaniciAdi: "", sifre: "", rol: "PERSONEL" });
            setShowEditPassword(false);
            router.refresh();
        } else {
            toast.error(result.error || "Güncelleme yapılamadı.");
        }

        setIsSavingUser(false);
    };

    const handleDeleteUser = async (row: RegisteredUserRow) => {
        const confirmed = await openConfirm({
            title: "Hesabı Kaldır",
            message: `${row.adSoyad} personelinin giriş hesabını kaldırmak istediğinizden emin misiniz?`,
            confirmText: "Evet, Kaldır",
            variant: "danger",
        });
        if (!confirmed) return;

        const result = await deleteUserAccount(row.id);
        if (result.success) {
            toast.success("Personel giriş hesabı kaldırıldı.");
            router.refresh();
        } else {
            toast.error(result.error || "Personel hesabı kaldırılamadı.");
        }
    };

    const tankColumns: ColumnDef<YakitTank>[] = [
        {
            accessorKey: "ad",
            header: "Tank Adı",
            cell: ({ row }) => <span className="font-bold text-slate-900">{row.original.ad}</span>,
        },
        {
            accessorKey: "kapasiteLitre",
            header: "Kapasite",
            cell: ({ row }) => <span>{row.original.kapasiteLitre.toLocaleString("tr-TR")} Litre</span>,
        },
        {
            accessorKey: "mevcutLitre",
            header: "Mevcut",
            cell: ({ row }) => (
                <span className={cn("font-medium", row.original.mevcutLitre < row.original.kapasiteLitre * 0.1 ? "text-rose-600" : "text-emerald-600")}>
                    {row.original.mevcutLitre.toLocaleString("tr-TR")} Litre
                </span>
            ),
        },
        {
            accessorKey: "aktifMi",
            header: "Durum",
            cell: ({ row }) => (
                <span className={cn("inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider", row.original.aktifMi ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {row.original.aktifMi ? "AKTİF" : "PASİF"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "İşlemler",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => {
                        setEditTankRow(row.original);
                        setTankForm({
                            ad: row.original.ad,
                            kapasiteLitre: row.original.kapasiteLitre,
                            mevcutLitre: row.original.mevcutLitre,
                            aktifMi: row.original.aktifMi
                        });
                    }} />
                    <RowActionButton variant="delete" onClick={() => handleDeleteTank(row.original)} />
                </div>
            ),
        },
    ];

    const registeredColumns: ColumnDef<RegisteredUserRow>[] = [
        {
            accessorKey: "adSoyad",
            header: "Ad Soyad",
            cell: ({ row }) => {
                const personelHref = scopedQuery
                    ? `/dashboard/personel/${row.original.id}?${scopedQuery}`
                    : `/dashboard/personel/${row.original.id}`;
                return (
                    <Link
                        href={personelHref}
                        className="font-semibold text-slate-900 transition-colors hover:text-indigo-600 hover:underline"
                    >
                        {row.original.adSoyad}
                    </Link>
                );
            },
        },
        {
            accessorKey: "kullaniciAdi",
            header: "Personel Giriş Adı",
            cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{row.original.kullaniciAdi}</span>,
        },
        {
            accessorKey: "rol",
            header: "Rol",
            cell: ({ row }) => (
                <span className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                    {getRoleLabel(row.original.rol)}
                </span>
            ),
        },
        {
            accessorKey: "sirketAdi",
            header: "Şirket",
        },
        {
            id: "actions",
            header: "İşlemler",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openUserEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDeleteUser(row.original)} />
                </div>
            ),
        },
    ];

    return (
        <div className="p-8 xl:p-12 max-w-[1400px] mx-auto">
            {confirmModal}
            <header className="mb-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-start gap-3 leading-tight lg:whitespace-nowrap">
                        <ShieldCheck className="mt-1 shrink-0 text-indigo-600" size={32} />
                        <span>Admin Panel</span>
                    </h1>
                    <p className="mt-2 whitespace-nowrap text-[14px] font-medium text-slate-500">Sistem yetkilendirme ayarlarını yönetin ve yakıt tankı tanımlamalarını yapın.</p>
                </div>
                <ExcelTransferToolbar options={[{ entity: "personel", label: "Personel" }]} hideEntitySelect />
            </header>
            <section className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                <div className="mb-3 flex items-center gap-2">
                    <UserPlus size={18} className="text-indigo-600" />
                    <h2 className="text-lg font-bold text-slate-900">Personel Hesabı Tanımla</h2>
                </div>
                <p className="mb-4 text-sm text-slate-600">
                    Sistemde zaten bulunan personele giriş adı ve şifre atayarak hesabı aktif edin.
                </p>
                <form onSubmit={handleCreateUser} className="grid gap-3 md:grid-cols-3 md:items-start">
                    <div className="space-y-1 min-w-0">
                        <label className={createFieldLabelClass}>Personel</label>
                        <select
                            value={createForm.personelId}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, personelId: event.target.value }))}
                            className={createFieldControlClass}
                            disabled={!hasAssignablePersonel}
                        >
                            <option value="">Personel seçin</option>
                            {assignablePersoneller.map((personel) => (
                                <option key={personel.id} value={personel.id}>
                                    {personel.adSoyad} ({getRoleLabel(personel.rol)}){personel.sirketAdi ? ` - ${personel.sirketAdi}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1 min-w-0">
                        <label className={`${createFieldLabelClass} gap-1`}><User size={13} />Personel Giriş Adı</label>
                        <input
                            value={createForm.kullaniciAdi}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, kullaniciAdi: event.target.value.toLocaleLowerCase("tr-TR") }))}
                            className={createFieldControlClass}
                            placeholder="personel.giris"
                        />
                    </div>
                    <div className="space-y-1 min-w-0">
                        <label className={`${createFieldLabelClass} gap-1`}><Lock size={13} />Şifre</label>
                        <div className="relative">
                            <input
                                type={showCreatePassword ? "text" : "password"}
                                value={createForm.sifre}
                                onChange={(event) => setCreateForm((prev) => ({ ...prev, sifre: event.target.value }))}
                                className={`${createFieldControlClass} pr-11`}
                                placeholder="Geçici şifre"
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                onClick={() => setShowCreatePassword((prev) => !prev)}
                                aria-label={showCreatePassword ? "Şifreyi gizle" : "Şifreyi göster"}
                                title={showCreatePassword ? "Şifreyi gizle" : "Şifreyi göster"}
                            >
                                {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <button
                            type="submit"
                            disabled={isCreating || !hasAssignablePersonel}
                            className="inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <UserPlus size={16} />
                            {isCreating ? "Tanımlanıyor..." : "Hesabı Tanımla"}
                        </button>
                    </div>
                    {!hasAssignablePersonel ? (
                        <p className="md:col-span-3 text-xs font-medium text-slate-500">
                            Hesap tanımlanacak personel bulunamadı. Tüm personele zaten giriş hesabı atanmış.
                        </p>
                    ) : null}
                </form>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-lg font-bold text-slate-900">Giriş Yetkisi Bulunanlar</h2>
                <DataTable
                    columns={registeredColumns}
                    data={registeredTableData}
                    searchKey="adSoyad"
                    searchPlaceholder="Giriş yetkili personel ara..."
                    tableClassName="w-full min-w-0"
                />
            </section>

            {/* Yakit Tanki Yonetimi Bolumu */}
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Fuel size={20} className="text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-900">Yakıt Tankı Yönetimi</h2>
                    </div>
                    <button
                        onClick={() => {
                            setTankForm({ ad: "", kapasiteLitre: 0, mevcutLitre: 0, aktifMi: true });
                            setIsAddingTank(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <UserPlus size={16} /> {/* Actually TankPlus would be better but UserPlus matches style */}
                        Yeni Tank Tanımla
                    </button>
                </div>
                
                {yakitTanklar.length > 0 ? (
                    <DataTable
                        columns={tankColumns}
                        data={yakitTanklar}
                        searchKey="ad"
                        searchPlaceholder="Tank ara..."
                        tableClassName="w-full min-w-0"
                    />
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <Fuel size={40} className="text-slate-300 mb-3" />
                        <h3 className="text-sm font-bold text-slate-900">Tanımlı Tank Yok</h3>
                        <p className="text-xs text-slate-500 max-w-[280px] mt-1">
                            Sistemde henüz yakıt tankı tanımlanmamış. Yeni bir depo veya tank ekleyerek başlayın.
                        </p>
                    </div>
                )}
            </section>

            <Dialog
                open={!!editRow}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditRow(null);
                        setEditForm({ kullaniciAdi: "", sifre: "", rol: "PERSONEL" });
                        setShowEditPassword(false);
                    }
                }}
            >
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Personel Hesabını Düzenle</DialogTitle>
                        <DialogDescription>
                            {editRow?.adSoyad} için giriş adı, şifre and yetki bilgilerini güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Personel Giriş Adı</label>
                            <input
                                value={editForm.kullaniciAdi}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, kullaniciAdi: event.target.value.toLocaleLowerCase("tr-TR") }))}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Yeni Şifre (Opsiyonel)</label>
                            <div className="relative">
                                <input
                                    type={showEditPassword ? "text" : "password"}
                                    value={editForm.sifre}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, sifre: event.target.value }))}
                                    placeholder="Boş bırakılırsa değişmez"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-sm outline-none focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                    onClick={() => setShowEditPassword((prev) => !prev)}
                                    aria-label={showEditPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                                    title={showEditPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                                >
                                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500">Mevcut şifre güvenlik nedeniyle gösterilmez. Yeni şifre girerseniz güncellenir.</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Rol</label>
                            <select
                                value={editForm.rol}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, rol: event.target.value as Rol }))}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                            >
                                <option value="PERSONEL">Personel</option>
                                <option value="TEKNIK">Teknik</option>
                                <option value="YETKILI">Yetkili</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <button
                            onClick={handleSaveUser}
                            disabled={isSavingUser}
                            className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSavingUser ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Yeni Tank Ekle Dialog */}
            <Dialog open={isAddingTank} onOpenChange={setIsAddingTank}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Yakıt Tankı Tanımla</DialogTitle>
                        <DialogDescription>
                            Sanal yakıt stoğu takibi için yeni bir depo veya tank tanımlayın.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateTank} className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 italic">Tank / Depo Adı</label>
                            <input
                                value={tankForm.ad}
                                onChange={(e) => setTankForm({ ...tankForm, ad: e.target.value })}
                                placeholder="Örn: Ana Depo, Şantiye Tankı"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 italic">Kapasite (Litre)</label>
                                <input
                                    type="number"
                                    value={tankForm.kapasiteLitre || ""}
                                    onChange={(e) => setTankForm({ ...tankForm, kapasiteLitre: Number(e.target.value) })}
                                    placeholder="5000"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 italic">Mevcut Miktar (Litre)</label>
                                <input
                                    type="number"
                                    value={tankForm.mevcutLitre || ""}
                                    onChange={(e) => setTankForm({ ...tankForm, mevcutLitre: Number(e.target.value) })}
                                    placeholder="0"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <DialogFooter className="mt-2">
                            <button
                                type="submit"
                                disabled={isSavingTank}
                                className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-6 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSavingTank ? "Tanımlanıyor..." : "Tankı Kaydet"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Tank Düzenle Dialog */}
            <Dialog open={!!editTankRow} onOpenChange={(open) => !open && setEditTankRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yakıt Tankını Düzenle</DialogTitle>
                        <DialogDescription>
                            {editTankRow?.ad} tankının bilgilerini güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 italic">Tank Adı</label>
                            <input
                                value={tankForm.ad}
                                onChange={(e) => setTankForm({ ...tankForm, ad: e.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 italic">Kapasite (Litre)</label>
                                <input
                                    type="number"
                                    value={tankForm.kapasiteLitre || ""}
                                    onChange={(e) => setTankForm({ ...tankForm, kapasiteLitre: Number(e.target.value) })}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 italic">Mevcut Miktar (Litre)</label>
                                <input
                                    type="number"
                                    value={tankForm.mevcutLitre || ""}
                                    onChange={(e) => setTankForm({ ...tankForm, mevcutLitre: Number(e.target.value) })}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 py-2">
                            <input
                                type="checkbox"
                                id="tank-active"
                                checked={tankForm.aktifMi}
                                onChange={(e) => setTankForm({ ...tankForm, aktifMi: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="tank-active" className="text-sm font-medium text-slate-700">Tank Aktif (Yakıt girişlerinde görünür)</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <button
                            onClick={handleSaveTank}
                            disabled={isSavingTank}
                            className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-6 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSavingTank ? "Güncelleniyor..." : "Değişiklikleri Kaydet"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Veri Yönetimi Bölümü */}
            <section className="mt-8 rounded-2xl border border-rose-100 bg-rose-50/10 p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-100/20 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="max-w-2xl">
                        <div className="mb-3 flex items-center gap-2">
                            <Database size={22} className="text-rose-600" />
                            <h2 className="text-xl font-bold text-slate-900">Genel Veri Yönetimi</h2>
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 tracking-wider">ADMIN</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Sistemdeki tüm tabloları (Şirketler, Personel, Araçlar, Yakıt ve Servis kayıtları vb.) tek bir Excel dosyası olarak indirip yedekleyebilir veya bu dosyayı kullanarak toplu veri aktarımı yapabilirsiniz.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                            onClick={handleBulkExport}
                            disabled={isBulkExporting}
                            className="group flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
                        >
                            {isBulkExporting ? (
                                <Loader2 size={18} className="animate-spin text-indigo-600" />
                            ) : (
                                <Download size={18} className="transition-transform group-hover:-translate-y-0.5" />
                            )}
                            <span>Sistem Yedeği İndir (Excel)</span>
                        </button>

                        <label className={`group flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 disabled:opacity-50 ${isBulkImporting ? "pointer-events-none opacity-50" : ""}`}>
                            {isBulkImporting ? (
                                <Loader2 size={18} className="animate-spin text-indigo-400" />
                            ) : (
                                <Upload size={18} className="transition-transform group-hover:-translate-y-0.5" />
                            )}
                            <span>Verileri Geri Yükle</span>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleBulkImport}
                                disabled={isBulkImporting}
                            />
                        </label>
                    </div>
                </div>
                
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-white/60 border border-slate-200/50 p-3 relative z-10">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-[11px] font-medium text-slate-500">
                        <strong className="text-slate-700 uppercase">Önemli:</strong> Geri yükleme işlemi sırasında Excel dosyasındaki sekmelerin (Şirketler, Personel, Araçlar vb.) isimlerini değiştirmeyiniz. Sistem ilişkileri korumak için verileri belirli bir sırayla işler.
                    </p>
                </div>
            </section>
        </div>
    );
}
