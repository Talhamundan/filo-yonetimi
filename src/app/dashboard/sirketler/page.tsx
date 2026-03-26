import React from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import SirketlerClient from "./Client";
import { canAccessAllCompanies, getCurrentUserRole, getModelFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { redirect } from "next/navigation";
import { getCezaScopeWhere } from "@/lib/dashboard-helpers";
import { getCompanyCostReportForPeriod } from "@/lib/dashboard-cost.service";

export default async function SirketlerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [role, hasGlobalCompanyAccess] = await Promise.all([getCurrentUserRole(), canAccessAllCompanies()]);
    const canManageCompanies = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);
    if (!canManageCompanies) {
        redirect("/dashboard");
    }

    const [selectedSirketId, selectedYil, selectedAy] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
    ]);
    const filter = await getModelFilter('sirket', selectedSirketId);
    const { start: periodStart, end: periodEnd } = getAyDateRange(selectedYil, selectedAy);
    const companyScope = selectedSirketId ? { sirketId: selectedSirketId } : {};
    const companyCostReport = await getCompanyCostReportForPeriod({
        scope: companyScope,
        cezaScope: getCezaScopeWhere(companyScope),
        start: periodStart,
        end: periodEnd,
    });
    const companyCostMap = new Map(
        companyCostReport
            .filter((item) => Boolean(item.sirketId))
            .map((item) => [item.sirketId as string, item])
    );

    const sirketler = await prisma.sirket.findMany({
        where: filter as Prisma.SirketWhereInput,
        orderBy: { olusturmaTarihi: 'desc' },
        include: {
            _count: {
                select: {
                    araclar: { where: { deletedAt: null } },
                    kullanicilar: { where: { deletedAt: null } },
                }
            }
        }
    });

    const formattedData = sirketler.map((s) => {
        const costDetail = companyCostMap.get(s.id);
        const maliyetKalemleri = costDetail
            ? [
                  { key: "bakim", label: "Bakım", tutar: costDetail.bakim },
                  { key: "yakit", label: "Yakıt", tutar: costDetail.yakit },
                  { key: "muayene", label: "Muayene", tutar: costDetail.muayene },
                  { key: "hgs", label: "HGS", tutar: costDetail.hgs },
                  { key: "ceza", label: "Ceza", tutar: costDetail.ceza },
                  { key: "kasko", label: "Kasko", tutar: costDetail.kasko },
                  { key: "trafik", label: "Trafik", tutar: costDetail.trafik },
                  { key: "diger", label: "Diğer", tutar: costDetail.diger },
              ].filter((item) => item.tutar > 0)
            : [];

        return {
            id: s.id,
            ad: s.ad,
            bulunduguIl: s.bulunduguIl,
            vergiNo: s.vergiNo || "Belirtilmedi",
            aracSayisi: s._count.araclar,
            personelSayisi: s._count.kullanicilar,
            toplamMaliyet: costDetail?.toplam || 0,
            maliyetKalemleri,
            olusturmaTarihi: s.olusturmaTarihi.toISOString()
        };
    }).sort((a, b) => b.toplamMaliyet - a.toplamMaliyet);

    return <SirketlerClient initialData={formattedData} />;
}
