"use client"

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserAccount, deleteUserAccount, updateUserAccount } from "./actions";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Lock, User, Eye, EyeOff } from "lucide-react";
import type { Rol } from "@prisma/client";
import ExcelTransferToolbar from "@/components/ui/excel-transfer-toolbar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-modal";
import type { ColumnDef } from "@tanstack/react-table";
import { RowActionButton } from "@/components/ui/row-action-button";

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
}: {
    registeredUsers: RegisteredUser[];
    assignablePersoneller: AssignablePersonel[];
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isCreating, setIsCreating] = useState(false);
    const [editRow, setEditRow] = useState<RegisteredUserRow | null>(null);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editForm, setEditForm] = useState({ kullaniciAdi: "", sifre: "", rol: "SOFOR" as Rol });
    const hasAssignablePersonel = assignablePersoneller.length > 0;
    const [createForm, setCreateForm] = useState({
        personelId: "",
        kullaniciAdi: "",
        sifre: "",
    });
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
            setEditForm({ kullaniciAdi: "", sifre: "", rol: "SOFOR" });
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
                    {row.original.rol}
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
                        <span>Yetkilendirme Paneli</span>
                    </h1>
                    <p className="mt-2 whitespace-nowrap text-[14px] font-medium text-slate-500">Sistemdeki personele giriş hesabı tanımlayın ve mevcut hesapları yönetin.</p>
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
                                    {personel.adSoyad} ({personel.rol}){personel.sirketAdi ? ` - ${personel.sirketAdi}` : ""}
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
                    tableClassName="min-w-[980px]"
                />
            </section>

            <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Personel Hesabını Düzenle</DialogTitle>
                        <DialogDescription>
                            {editRow?.adSoyad} için giriş adı, şifre ve yetki bilgilerini güncelleyin.
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
                                <option value="SOFOR">Şoför</option>
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
        </div>
    );
}
