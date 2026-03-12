"use client"

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
    Car, Users, Wrench, Fuel, ArrowLeft, Activity, ShieldCheck, MapPin, FileDigit, Settings, Receipt, AlertTriangle, FileArchive, CreditCard, FileText
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { unassignArac } from "../actions";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AracDetaySaaS = any;

export default function AracDetailClient({ initialArac: arac }: { initialArac: AracDetaySaaS }) {
    const { confirmModal, openConfirm } = useConfirm();
    const router = useRouter();
    const [loading, setLoading] = React.useState(false);

    const handleUnassign = async () => {
        const confirmed = await openConfirm({ title: "Şoförü Ayır", message: "Bu şoförü araçtan ayırmak istediğinize emin misiniz? Zimmet kaydı tamamlanmış olarak işaretlenecek.", confirmText: "Evet, Ayır", variant: "warning" });
        if (!confirmed) return;
        
        setLoading(true);
        const res = await unassignArac(arac.id);
        setLoading(false);

        if (res.success) {
            toast.success("Şoför başarıyla ayrıldı.");
            router.refresh();
        } else {
            toast.error(res.error || "İşlem başarısız.");
        }
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

    const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

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
                                <button 
                                    onClick={handleUnassign}
                                    disabled={loading}
                                    className="text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded font-bold uppercase transition-colors disabled:opacity-50"
                                >
                                    {loading ? '...' : 'Şoförden Ayır'}
                                </button>
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

                <Tabs defaultValue="ozet" className="w-full">
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
                            <Wrench size={16} className="mr-2" /> Bakım Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="yakit" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Fuel size={16} className="mr-2" /> Yakıt Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="masraflar" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <Receipt size={16} className="mr-2" /> Masraflar
                        </TabsTrigger>
                        <TabsTrigger value="sigorta" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <ShieldCheck size={16} className="mr-2" /> Sigorta & Kasko
                        </TabsTrigger>
                        <TabsTrigger value="muayene" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <FileDigit size={16} className="mr-2" /> Muayene Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="ariza" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <AlertTriangle size={16} className="mr-2" /> Arıza Raporları
                        </TabsTrigger>
                        <TabsTrigger value="dokuman" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2 border border-transparent data-[state=inactive]:border-slate-200">
                            <FileArchive size={16} className="mr-2" /> Evraklar
                        </TabsTrigger>
                    </TabsList>

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
                                                    <TableCell className="font-medium text-slate-900">{z.kullanici?.ad} {z.kullanici?.soyad}</TableCell>
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
                                            <TableHead className="font-semibold text-slate-500">Bakım Tarihi</TableHead>
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
                                                    <TableCell className="text-slate-900">{b.servisAdi || '-'}</TableCell>
                                                    <TableCell className="text-slate-700">{b.yapilanKm.toLocaleString()} km</TableCell>
                                                    <TableCell className="text-slate-600 max-w-[200px] truncate" title={b.yapilanIslemler}>{b.yapilanIslemler || '-'}</TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-right">₺{b.tutar.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Bakım kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 6. YAKIT */}
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

                        {/* 7. MASRAFLAR */}
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

                        {/* 8. SİGORTA & KASKO */}
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
                                                        <TableCell className="text-slate-700">{formatDate(s.bitisTarihi)} {s.aktifMi ? <Badge className="ml-2 bg-emerald-50 text-emerald-700">Aktif</Badge> : ''}</TableCell>
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
                                                        <TableCell className="text-slate-700">{formatDate(k.bitisTarihi)} {k.aktifMi ? <Badge className="ml-2 bg-emerald-50 text-emerald-700">Aktif</Badge> : ''}</TableCell>
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

                        {/* 9. MUAYENE */}
                        <TabsContent value="muayene">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Muayene Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Geçerlilik Bitiş</TableHead>
                                            <TableHead className="font-semibold text-slate-500">İstasyon</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Durum</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.muayene && arac.muayene.length > 0 ? (
                                            arac.muayene.map((m: AracDetaySaaS) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="text-slate-700">{formatDate(m.muayeneTarihi)}</TableCell>
                                                    <TableCell className="font-medium text-slate-900">{formatDate(m.gecerlilikTarihi)}</TableCell>
                                                    <TableCell className="text-slate-600">{m.istasyon || '-'}</TableCell>
                                                    <TableCell className="text-right">{m.aktifMi ? <Badge className="bg-emerald-50 text-emerald-700 border-0 shadow-none">Aktif Geçerli</Badge> : <Badge variant="outline" className="text-slate-400 border-0 shadow-none">Süresi Doldu</Badge>}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Muayene kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 10. ARIZALAR */}
                        <TabsContent value="ariza">
                            <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-500">Arıza Tarihi</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Açıklama</TableHead>
                                            <TableHead className="font-semibold text-slate-500">Yönlendirilen Servis</TableHead>
                                            <TableHead className="font-semibold text-slate-500 text-right">Durum</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arac.arizalar && arac.arizalar.length > 0 ? (
                                            arac.arizalar.map((a: AracDetaySaaS) => (
                                                <TableRow key={a.id}>
                                                    <TableCell className="text-slate-700">{formatDate(a.arizaTarihi)}</TableCell>
                                                    <TableCell className="text-slate-900 max-w-[200px] truncate" title={a.aciklama}>{a.aciklama}</TableCell>
                                                    <TableCell className="text-slate-600">{a.servis || '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className={
                                                            a.durum === 'ACIK' ? 'border-rose-200 text-rose-700 bg-rose-50' :
                                                                a.durum === 'COZULDU' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                                                    'border-amber-200 text-amber-700 bg-amber-50'
                                                        }>{a.durum}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Arıza kaydı bulunmuyor.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        {/* 11. DOKÜMANLAR */}
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
