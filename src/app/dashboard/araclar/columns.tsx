"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status"
import { PersonelLink } from "@/components/links/RecordLinks"

export type AracRow = {
    id: string;
    plaka: string;
    marka: string;
    model: string;
    yil: number;
    bulunduguIl: string;
    guncelKm: number;
    durum: string;
    kategori: string;
    hgsNo?: string | null;
    saseNo?: string | null;
    kullanici?: { id: string; ad: string, soyad: string } | null;
    kullaniciId?: string | null;
    sirket?: { ad: string } | null;
    muayene?: { gecerlilikTarihi: Date }[];
    kasko?: { bitisTarihi: Date }[];
    trafikSigortasi?: { bitisTarihi: Date }[];
    maliyetKalemleri?: {
        yakit: number;
        bakim: number;
        muayene: number;
        hgs: number;
        ceza: number;
        kasko: number;
        trafik: number;
        diger: number;
    };
    toplamMaliyet?: number;
}

function formatCurrency(value: number) {
    return `₺${Math.round(value || 0).toLocaleString("tr-TR")}`;
}

function renderGecerlilikDurumu(tarih: Date) {
    const kalan = getDaysLeft(tarih);

    if (kalan == null) {
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-sm px-2 py-0.5 text-[10px]">Belirsiz</Badge>;
    }

    const badge = getDeadlineBadgeConfig(kalan);
    return <Badge className={`${badge.className} border-0 shadow-sm px-2 py-0.5 text-[10px] ${badge.status === "GECERLI" ? "font-semibold" : "font-bold"}`}>{badge.label}</Badge>;
}

export const getColumns = (showCompanyInfo = false, isTeknik = false): ColumnDef<AracRow>[] => {
    const columns: ColumnDef<AracRow>[] = [
        {
            accessorKey: "durum",
            header: "Durum",
            cell: ({ row }) => {
                const durum = row.original.durum;
                const hasDriver = !!row.original.kullanici;

                // Eğer durum AKTIF ise ama şoför yoksa BOŞTA göster
                if (durum === 'AKTIF' || durum === 'BOSTA') {
                    return hasDriver ? 
                        <Badge className="bg-emerald-500 text-white font-semibold px-2.5 py-0.5 border-0 shadow-sm">Aktif</Badge> :
                        <Badge className="bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 border-0 shadow-sm">Boşta</Badge>;
                }

                switch (durum) {
                    case 'SERVISTE': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Serviste</Badge>;
                    case 'YEDEK': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Yedek</Badge>;
                    case 'ARIZALI': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Arızalı</Badge>;
                    default: return <Badge variant="outline" className="font-semibold px-2.5 py-0.5 shadow-none">{durum}</Badge>;
                }
            },
        },
        {
            accessorKey: "plaka",
            header: "Plaka",
            cell: ({ row }) => {
                return (
                    <VehicleIdentityCell
                        aracId={row.original.id}
                        plaka={row.original.plaka}
                        subtitle={`${row.original.marka} ${row.original.model}`}
                        companyName={row.original.sirket?.ad}
                        showCompanyInfo={showCompanyInfo}
                    />
                )
            },
        },
        {
            accessorKey: "saseNo",
            header: "Şase No",
            cell: ({ row }) => {
                const saseNo = row.original.saseNo?.trim();
                return <div className="font-mono text-xs text-slate-600">{saseNo || "-"}</div>;
            },
        },
        {
            accessorKey: "kategori",
            header: "Kategori",
            cell: ({ row }) => {
                const cat = row.original.kategori;
                const labels: any = { 'IS_MAKINESI': 'İş Makinesi', 'KAMYON_TIR': 'Kamyon/Tır', 'BINEK': 'Binek' };
                return <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{labels[cat] || cat}</span>;
            }
        },
        {
            accessorKey: "marka",
            header: "Marka / Model",
            cell: ({ row }) => {
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{row.original.marka} {row.original.model}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                            {row.original.yil} • {row.original.bulunduguIl}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "guncelKm",
            header: "KM",
            cell: ({ row }) => {
                const km = parseFloat(row.getValue("guncelKm") || "0")
                return <div className="font-medium text-slate-700">{km.toLocaleString('tr-TR')}</div>
            },
        },
        {
            accessorKey: "sofor_ad",
            header: "Şoför",
            accessorFn: (row) => row.kullanici ? `${row.kullanici.ad} ${row.kullanici.soyad}` : "Atanmamış",
            cell: ({ row }) => {
                const kullanici = row.original.kullanici
                return kullanici ? (
                    <PersonelLink
                        personelId={row.original.kullaniciId || kullanici.id}
                        className="font-medium text-slate-700 hover:text-indigo-600 hover:underline"
                    >
                        {kullanici.ad} {kullanici.soyad}
                    </PersonelLink>
                ) : (
                    <span className="text-slate-400 italic text-xs">Atanmamış</span>
                )
            },
        },
        {
            accessorKey: "hgsNo",
            header: "HGS No",
            cell: ({ row }) => {
                return <div className="font-mono text-xs text-slate-600">{row.getValue("hgsNo") || '-'}</div>
            },
        },
        {
            accessorKey: "muayene",
            header: "Muayene",
            cell: ({ row }) => {
                if (row.original.kategori === "IS_MAKINESI") {
                    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none px-2.5 py-0.5 text-[10px]">Muaf</Badge>;
                }

                const muayeneList = row.original.muayene;
                if (!muayeneList || muayeneList.length === 0) {
                    return <span className="text-slate-400 text-xs italic">Yok</span>;
                }

                return renderGecerlilikDurumu(muayeneList[0].gecerlilikTarihi);
            },
        },
        {
            accessorKey: "kasko",
            header: "Kasko",
            cell: ({ row }) => {
                const kaskoList = row.original.kasko;
                if (!kaskoList || kaskoList.length === 0) return <span className="text-slate-400 text-xs italic">Yok</span>;

                return renderGecerlilikDurumu(kaskoList[0].bitisTarihi);
            },
        },
        {
            accessorKey: "trafikSigortasi",
            header: "Trafik Sigortası",
            cell: ({ row }) => {
                const sigortaList = row.original.trafikSigortasi;
                if (!sigortaList || sigortaList.length === 0) return <span className="text-slate-400 text-xs italic">Yok</span>;

                return renderGecerlilikDurumu(sigortaList[0].bitisTarihi);
            },
        }
    ];

    if (!isTeknik) {
        columns.push({
            accessorKey: "toplamMaliyet",
            header: "Maliyet Özeti",
            cell: ({ row }) => {
                const toplam = row.original.toplamMaliyet || 0;
                const kalemler = row.original.maliyetKalemleri || {
                    yakit: 0, bakim: 0, muayene: 0, hgs: 0, ceza: 0, kasko: 0, trafik: 0, diger: 0,
                };
                const nonZero = [
                    { key: "Yakıt", value: kalemler.yakit, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { key: "Bakım", value: kalemler.bakim, className: "bg-amber-50 text-amber-700 border-amber-200" },
                    { key: "Muayene", value: kalemler.muayene, className: "bg-sky-50 text-sky-700 border-sky-200" },
                    { key: "HGS", value: kalemler.hgs, className: "bg-violet-50 text-violet-700 border-violet-200" },
                    { key: "Ceza", value: kalemler.ceza, className: "bg-rose-50 text-rose-700 border-rose-200" },
                    { key: "Kasko", value: kalemler.kasko, className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { key: "Trafik", value: kalemler.trafik, className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
                    { key: "Diğer", value: kalemler.diger, className: "bg-slate-100 text-slate-700 border-slate-200" },
                ].filter((item) => item.value > 0);

                return (
                    <div className="min-w-[220px] max-w-[300px]">
                        <div className="text-sm font-bold text-slate-900">{formatCurrency(toplam)}</div>
                        {nonZero.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {nonZero.map((item) => (
                                    <span
                                        key={item.key}
                                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${item.className}`}
                                    >
                                        {item.key}: {formatCurrency(item.value)}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                        )}
                    </div>
                );
            },
        });
    }

    return columns;
};
