import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Clock3, FilePlus2, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getModelFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { ensureSigortaTeklifTable } from "@/lib/sigorta-teklif-schema-compat";
import SigortaTeklifPanel from "./SigortaTeklifPanel";

type PolicyType = "KASKO" | "TRAFIK";

type UnifiedPolicyRow = {
    id: string;
    tur: PolicyType;
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    tutar: number;
    aktifMi: boolean;
    arac: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
    } | null;
};

type SigortaTeklifRawRow = {
    id: string;
    aracId: string;
    tur: "KASKO" | "TRAFIK";
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    teklifTutar: number;
    durum: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
    notlar: string | null;
    updatedAt: Date;
};

function toNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAgencyKey(value: string | null | undefined) {
    const raw = String(value || "").trim();
    if (!raw) return "BELIRSIZ";
    const normalized = raw
        .toLocaleUpperCase("tr-TR")
        .replace(/Ç/g, "C")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O");

    if (normalized.includes("ERCAL")) return "ERÇAL";
    if (normalized === "HS" || normalized.includes(" HS ") || normalized.startsWith("HS ") || normalized.endsWith(" HS")) return "HS";
    return raw.toLocaleUpperCase("tr-TR");
}

function formatCurrency(value: number) {
    return value.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function formatDate(value: Date) {
    return new Date(value).toLocaleDateString("tr-TR");
}

function getDaysLeft(value: Date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(value);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function getPolicyStatus(daysLeft: number) {
    if (daysLeft < 0) return { label: "Gecikti", className: "bg-rose-50 text-rose-700 border-rose-200" };
    if (daysLeft <= 15) return { label: "Kritik", className: "bg-orange-50 text-orange-700 border-orange-200" };
    if (daysLeft <= 30) return { label: "Yaklaşıyor", className: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: "Planlı", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default async function SigortaciOperasyonPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
    ]);

    const { start: seciliDonemBaslangic, end: seciliDonemBitis } = getAyDateRange(selectedYil, selectedAy);
    const [kaskoFilter, trafikFilter, aracFilter] = await Promise.all([
        getModelFilter("kasko", selectedSirketId),
        getModelFilter("trafikSigortasi", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
    ]);

    const kaskoWhere = {
        AND: [
            (kaskoFilter || {}) as Record<string, unknown>,
            { baslangicTarihi: { lte: seciliDonemBitis } },
            { bitisTarihi: { gte: seciliDonemBaslangic } },
        ],
    };
    const trafikWhere = {
        AND: [
            (trafikFilter || {}) as Record<string, unknown>,
            { baslangicTarihi: { lte: seciliDonemBitis } },
            { bitisTarihi: { gte: seciliDonemBaslangic } },
        ],
    };

    const [kaskoRowsRaw, trafikRowsRaw, aracRows] = await Promise.all([
        (prisma as any).kasko.findMany({
            where: kaskoWhere as any,
            select: {
                id: true,
                acente: true,
                sirket: true,
                policeNo: true,
                baslangicTarihi: true,
                bitisTarihi: true,
                tutar: true,
                aktifMi: true,
                arac: {
                    select: { id: true, plaka: true, marka: true, model: true },
                },
            },
            orderBy: { bitisTarihi: "asc" },
        }),
        (prisma as any).trafikSigortasi.findMany({
            where: trafikWhere as any,
            select: {
                id: true,
                acente: true,
                sirket: true,
                policeNo: true,
                baslangicTarihi: true,
                bitisTarihi: true,
                tutar: true,
                aktifMi: true,
                arac: {
                    select: { id: true, plaka: true, marka: true, model: true },
                },
            },
            orderBy: { bitisTarihi: "asc" },
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true },
            orderBy: { plaka: "asc" },
        }),
    ]);

    const policies: UnifiedPolicyRow[] = [
        ...(kaskoRowsRaw as any[]).map((row) => ({
            id: String(row.id),
            tur: "KASKO" as const,
            acente: row.acente || null,
            sigortaSirketi: row.sirket || null,
            policeNo: row.policeNo || null,
            baslangicTarihi: new Date(row.baslangicTarihi),
            bitisTarihi: new Date(row.bitisTarihi),
            tutar: toNumber(row.tutar),
            aktifMi: Boolean(row.aktifMi),
            arac: row.arac
                ? {
                      id: String(row.arac.id),
                      plaka: String(row.arac.plaka || "-"),
                      marka: String(row.arac.marka || ""),
                      model: String(row.arac.model || ""),
                  }
                : null,
        })),
        ...(trafikRowsRaw as any[]).map((row) => ({
            id: String(row.id),
            tur: "TRAFIK" as const,
            acente: row.acente || null,
            sigortaSirketi: row.sirket || null,
            policeNo: row.policeNo || null,
            baslangicTarihi: new Date(row.baslangicTarihi),
            bitisTarihi: new Date(row.bitisTarihi),
            tutar: toNumber(row.tutar),
            aktifMi: Boolean(row.aktifMi),
            arac: row.arac
                ? {
                      id: String(row.arac.id),
                      plaka: String(row.arac.plaka || "-"),
                      marka: String(row.arac.marka || ""),
                      model: String(row.arac.model || ""),
                  }
                : null,
        })),
    ].sort((a, b) => a.bitisTarihi.getTime() - b.bitisTarihi.getTime());

    const debtByAgency = new Map<
        string,
        { acente: string; toplamBorc: number; bekleyenKayit: number; gecikenPoliçe: number }
    >();

    for (const policy of policies) {
        if (!policy.aktifMi) continue;
        const key = normalizeAgencyKey(policy.acente || policy.sigortaSirketi || null);
        const current = debtByAgency.get(key) || {
            acente: key,
            toplamBorc: 0,
            bekleyenKayit: 0,
            gecikenPoliçe: 0,
        };
        current.toplamBorc += toNumber(policy.tutar);
        current.bekleyenKayit += 1;
        if (getDaysLeft(policy.bitisTarihi) < 0) {
            current.gecikenPoliçe += 1;
        }
        debtByAgency.set(key, current);
    }

    const agencyPriority = ["HS", "ERÇAL"];
    const agencyDebtRows = [...debtByAgency.values()].sort((a, b) => {
        const aPriority = agencyPriority.indexOf(a.acente);
        const bPriority = agencyPriority.indexOf(b.acente);
        const aRank = aPriority === -1 ? 999 : aPriority;
        const bRank = bPriority === -1 ? 999 : bPriority;
        return aRank - bRank || b.toplamBorc - a.toplamBorc;
    });

    const policyTrackingRows = policies.map((policy) => ({
        ...policy,
        daysLeft: getDaysLeft(policy.bitisTarihi),
    }));
    const offerQueue = policyTrackingRows
        .filter((policy) => policy.daysLeft <= 45)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 20);

    await ensureSigortaTeklifTable();
    const aracOptions = (aracRows as any[])
        .map((row) => ({
            id: String(row.id),
            plaka: String(row.plaka || "-"),
            marka: String(row.marka || ""),
            model: String(row.model || ""),
        }))
        .filter((row) => row.id && row.plaka);
    const aracIdList = aracOptions.map((row) => row.id);
    const aracMap = new Map(aracOptions.map((row) => [row.id, row]));
    const teklifRowsRaw: SigortaTeklifRawRow[] = aracIdList.length
        ? await prisma.$queryRaw<SigortaTeklifRawRow[]>(
              Prisma.sql`
                SELECT
                    "id",
                    "aracId",
                    "tur",
                    "acente",
                    "sigortaSirketi",
                    "policeNo",
                    "baslangicTarihi",
                    "bitisTarihi",
                    "teklifTutar",
                    "durum",
                    "notlar",
                    "updatedAt"
                FROM "SigortaTeklif"
                WHERE "aracId" IN (${Prisma.join(aracIdList)})
                ORDER BY "updatedAt" DESC
              `
          )
        : [];
    const teklifRows = teklifRowsRaw.map((row) => {
        const arac = aracMap.get(String(row.aracId));
        const tur: PolicyType = row.tur === "TRAFIK" ? "TRAFIK" : "KASKO";
        return {
            id: String(row.id),
            aracId: String(row.aracId),
            plaka: arac?.plaka || "-",
            markaModel: `${arac?.marka || ""} ${arac?.model || ""}`.trim() || "-",
            tur,
            acente: row.acente || null,
            sigortaSirketi: row.sigortaSirketi || null,
            policeNo: row.policeNo || null,
            baslangicTarihi: new Date(row.baslangicTarihi).toISOString(),
            bitisTarihi: new Date(row.bitisTarihi).toISOString(),
            teklifTutar: toNumber(row.teklifTutar),
            durum:
                row.durum === "ONAYLANDI" || row.durum === "REDDEDILDI" || row.durum === "BEKLIYOR"
                    ? row.durum
                    : "BEKLIYOR",
            notlar: row.notlar || null,
            updatedAt: new Date(row.updatedAt).toISOString(),
        };
    });
    const queueSuggestions = offerQueue
        .filter((row) => Boolean(row.arac?.id))
        .map((row) => ({
            aracId: String(row.arac?.id),
            plaka: String(row.arac?.plaka || "-"),
            tur: row.tur,
            acente: row.acente || null,
            sigortaSirketi: row.sigortaSirketi || null,
            policeNo: row.policeNo || null,
            baslangicTarihi: row.baslangicTarihi.toISOString(),
            bitisTarihi: row.bitisTarihi.toISOString(),
            teklifTutar: toNumber(row.tutar),
        }));

    const totalUnpaidDebt = agencyDebtRows.reduce((sum, row) => sum + row.toplamBorc, 0);
    const overduePolicies = policyTrackingRows.filter((row) => row.daysLeft < 0).length;
    const upcoming30Days = policyTrackingRows.filter((row) => row.daysLeft >= 0 && row.daysLeft <= 30).length;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Sigortacı Operasyon</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Aracı kurum borçları, poliçe gün takibi ve teklif öncelik listesini tek ekrandan yönetin.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard/kasko"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <FilePlus2 size={14} />
                            Kasko Veri Girişi
                        </Link>
                        <Link
                            href="/dashboard/trafik-sigortasi"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <FilePlus2 size={14} />
                            Trafik Veri Girişi
                        </Link>
                    </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                        <p className="text-xs font-semibold text-rose-600">Tahmini Borç (Aktif Poliçeler)</p>
                        <p className="mt-1 text-lg font-bold text-rose-700">{formatCurrency(totalUnpaidDebt)}</p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                        <p className="text-xs font-semibold text-orange-600">Geciken Poliçe</p>
                        <p className="mt-1 text-lg font-bold text-orange-700">{overduePolicies}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-600">30 Gün İçinde Bitiş</p>
                        <p className="mt-1 text-lg font-bold text-amber-700">{upcoming30Days}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600" />
                        <h2 className="text-sm font-bold text-slate-900">Aracı Kurum Borçları</h2>
                    </div>
                    <div className="space-y-2">
                        {agencyDebtRows.length > 0 ? (
                            agencyDebtRows.map((row) => (
                                <div key={row.acente} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{row.acente}</p>
                                        <p className="text-xs text-slate-500">
                                            {row.bekleyenKayit} bekleyen kayıt
                                            {row.gecikenPoliçe > 0 ? ` • ${row.gecikenPoliçe} geciken poliçe` : ""}
                                        </p>
                                    </div>
                                    <p className="text-sm font-bold text-rose-700">{formatCurrency(row.toplamBorc)}</p>
                                </div>
                            ))
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                                Seçili dönemde borç kaydı bulunamadı.
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Clock3 size={16} className="text-indigo-600" />
                        <h2 className="text-sm font-bold text-slate-900">Poliçe Gün Takibi</h2>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[11px] text-slate-500">
                                    <th className="py-1 pr-2">Plaka</th>
                                    <th className="py-1 pr-2">Tür</th>
                                    <th className="py-1 pr-2">Bitiş</th>
                                    <th className="py-1 pr-2">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {policyTrackingRows.slice(0, 30).map((row) => {
                                    const status = getPolicyStatus(row.daysLeft);
                                    return (
                                        <tr key={`${row.tur}-${row.id}`} className="border-t border-slate-100 text-xs">
                                            <td className="py-2 pr-2 font-semibold text-slate-800">
                                                {row.arac?.id ? (
                                                    <Link
                                                        href={`/dashboard/araclar/${row.arac.id}`}
                                                        className="underline-offset-2 hover:text-indigo-700 hover:underline"
                                                    >
                                                        {row.arac.plaka || "-"}
                                                    </Link>
                                                ) : (
                                                    row.arac?.plaka || "-"
                                                )}
                                            </td>
                                            <td className="py-2 pr-2 text-slate-600">{row.tur}</td>
                                            <td className="py-2 pr-2 text-slate-600">{formatDate(row.bitisTarihi)}</td>
                                            <td className="py-2 pr-2">
                                                <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${status.className}`}>
                                                    {status.label} ({row.daysLeft})
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <SigortaTeklifPanel
                aracOptions={aracOptions}
                teklifRows={teklifRows}
                queueSuggestions={queueSuggestions}
            />
        </div>
    );
}
