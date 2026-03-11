"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../../components/ui/dialog";
import {
    User, Mail, Phone, MapPin, Briefcase, Car, ArrowLeft, Shield, Calendar, Calculator, Truck, AlertOctagon, Fuel, Receipt, Pencil, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { FormFields } from "../PersonelForm";
import { updatePersonel, deletePersonel } from "../actions";
import { useState } from "react";
import { toast } from "sonner";

export default function PersonelDetailClient({ initialPersonel: p, sirketler }: { initialPersonel: any, sirketler: any[] }) {
    const { confirmModal, openConfirm } = useConfirm();
        const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [formData, setFormData] = useState({
        ad: p.ad,
        soyad: p.soyad,
        eposta: p.eposta || '',
        telefon: p.telefon || '',
        rol: p.rol,
        sirketId: p.sirketId || '',
        sehir: p.sehir || '',
        tcNo: p.tcNo || ''
    });
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        setLoading(true);
        const res = await updatePersonel(p.id, formData as any);
        if (res.success) {
            toast.success("Personel bilgileri güncellendi");
            setEditOpen(false);
            router.refresh();
        } else {
            toast.error(res.error || "Güncelleme başarısız");
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        const confirmed = await openConfirm({ title: "Personeli Sil", message: "Bu personeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        setLoading(true);
        const res = await deletePersonel(p.id);
        if (res.success) {
            toast.success("Personel silindi");
            router.push('/dashboard/personel');
        } else {
            toast.error(res.error || "Silme işlemi başarısız");
        }
        setLoading(false);
    };

    const formatDate = (date: string | Date | null | undefined) => 
        date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

    const getRoleBadge = (rol: string) => {
        switch (rol) {
            case 'ADMIN': return <Badge className="bg-red-100 text-red-800 border-0">Admin</Badge>;
            case 'YONETICI': return <Badge className="bg-indigo-100 text-indigo-800 border-0">Yönetici</Badge>;
            case 'YETKİLİ': return <Badge className="bg-purple-100 text-purple-800 border-0">Yetkili</Badge>;
            case 'MUDUR': return <Badge className="bg-blue-100 text-blue-800 border-0">Müdür</Badge>;
            case 'MUHASEBECI': return <Badge className="bg-emerald-100 text-emerald-800 border-0">Muhasebeci</Badge>;
            case 'SOFOR': return <Badge className="bg-amber-100 text-amber-800 border-0">Şoför</Badge>;
            default: return <Badge variant="outline">{rol}</Badge>;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        {confirmModal}
            <main className="flex-1 p-6 md:p-8 xl:p-12 min-w-0 max-w-[1400px] mx-auto">
                <button
                    onClick={() => router.push('/dashboard/personel')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium text-sm mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Personel Listesine Dön
                </button>

                {/* Personel Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 lg:p-8 mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-6">
                        <div className="h-20 w-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-100 uppercase">
                            {p.ad?.charAt(0)}{p.soyad?.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{p.ad} {p.soyad}</h1>
                                {getRoleBadge(p.rol)}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500 mt-2">
                                <div className="flex items-center gap-1.5"><Briefcase size={16} /> {p.sirket?.ad || 'Bağımsız'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5"><MapPin size={16} /> {p.sehir || 'Şehir Belirtilmemiş'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">TC: {p.tcNo || 'Belirtilmemiş'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setEditOpen(true)}
                                className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                            >
                                <Pencil size={16} /> Düzenle
                            </button>
                            <button 
                                onClick={handleDelete}
                                className="flex items-center gap-2 bg-rose-50 text-rose-700 hover:bg-rose-100 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                            >
                                <Trash2 size={16} /> Sil
                            </button>
                        </div>

                        <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-5 min-w-[280px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Zimmetli Araç</p>
                        {p.arac ? (
                            <div 
                                className="flex items-center gap-3 cursor-pointer group"
                                onClick={() => router.push(`/dashboard/araclar/${p.arac.id}`)}
                            >
                                <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                                    <Car size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors uppercase">{p.arac.plaka}</span>
                                    <span className="text-xs font-semibold text-slate-500 mt-0.5">{p.arac.marka} {p.arac.model}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-sm italic font-medium">
                                <Car size={18} />
                                Zimmetli araç bulunmuyor.
                            </div>
                        )}
                    </div>
                </div>
            </div>

                <Tabs defaultValue="iletisim" className="w-full">
                    <TabsList className="flex h-auto gap-2 bg-transparent border-b border-slate-200 w-full rounded-none pb-2 mb-6">
                        <TabsTrigger value="iletisim" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            İletişim & Detaylar
                        </TabsTrigger>
                        <TabsTrigger value="zimmetGecmisi" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Araç Zimmet Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="cezalar" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Cezalar
                        </TabsTrigger>
                        <TabsTrigger value="yakit" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Yakıt Harcamaları
                        </TabsTrigger>
                        <TabsTrigger value="masraflar" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Masraflar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="iletisim">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card>
                                <CardHeader className="bg-slate-50 py-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Phone size={16} className="text-indigo-600" /> İletişim Bilgileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">E-Posta Adresi</p>
                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Mail size={14} className="text-slate-400" /> {p.eposta || 'Belirtilmemiş'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Telefon Numarası</p>
                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Phone size={14} className="text-slate-400" /> {p.telefon || 'Belirtilmemiş'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="bg-slate-50 py-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Calendar size={16} className="text-indigo-600" /> Kayıt Bilgileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Sisteme Giriş</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatDate(p.olusturmaTarihi)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Son Güncelleme</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatDate(p.guncellemeTarihi)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="zimmetGecmisi">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Alış Tarihi</TableHead>
                                        <TableHead>Bitiş Tarihi</TableHead>
                                        <TableHead className="text-right">KM Bilgisi (Alış / Veriş)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.zimmetler && p.zimmetler.length > 0 ? (
                                        p.zimmetler.map((z: any) => (
                                            <TableRow key={z.id}>
                                                <TableCell 
                                                    className="font-bold text-indigo-600 cursor-pointer uppercase"
                                                    onClick={() => router.push(`/dashboard/araclar/${z.arac.id}`)}
                                                >
                                                    {z.arac.plaka}
                                                </TableCell>
                                                <TableCell>{formatDate(z.baslangic)}</TableCell>
                                                <TableCell>{z.bitis ? formatDate(z.bitis) : <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Aktif</Badge>}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {z.baslangicKm.toLocaleString()} km / {z.bitisKm ? `${z.bitisKm.toLocaleString()} km` : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Geçmiş zimmet kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cezalar">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.cezalar && p.cezalar.length > 0 ? (
                                        p.cezalar.map((c: any) => (
                                            <TableRow key={c.id}>
                                                <TableCell>{formatDate(c.cezaTarihi)}</TableCell>
                                                <TableCell className="font-mono font-bold">{c.arac?.plaka}</TableCell>
                                                <TableCell className="text-slate-600">{c.aciklama || '-'}</TableCell>
                                                <TableCell className="text-right font-bold text-rose-600">₺{c.tutar.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Ceza kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="yakit">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Litre</TableHead>
                                        <TableHead>İstasyon</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">Araç KM</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.arac?.yakitlar && p.arac.yakitlar.length > 0 ? (
                                        p.arac.yakitlar.map((y: any) => (
                                            <TableRow key={y.id}>
                                                <TableCell>{formatDate(y.tarih)}</TableCell>
                                                <TableCell>{y.litre} L</TableCell>
                                                <TableCell>{y.istasyon || '-'}</TableCell>
                                                <TableCell className="text-right font-bold">₺{y.tutar.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{y.km.toLocaleString()} km</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                                                Mevcut araç üzerinde yakıt kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="masraflar">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.arac?.masraflar && p.arac.masraflar.length > 0 ? (
                                        p.arac.masraflar.map((m: any) => (
                                            <TableRow key={m.id}>
                                                <TableCell>{formatDate(m.tarih)}</TableCell>
                                                <TableCell><Badge variant="outline">{m.tur}</Badge></TableCell>
                                                <TableCell className="text-slate-600">{m.aciklama || '-'}</TableCell>
                                                <TableCell className="text-right font-bold">₺{m.tutar.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Mevcut araç üzerinde masraf kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="sm:max-w-[450px]">
                        <DialogHeader>
                            <DialogTitle>Personeli Düzenle</DialogTitle>
                            <DialogDescription>{p.ad} {p.soyad} kişisinin bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} />
                        <DialogFooter>
                            <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Güncelleniyor...' : 'Güncelle'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
