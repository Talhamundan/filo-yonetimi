"use server";

import { OdemeYontemi, YakitTankHareketTip } from "@prisma/client";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, getAracMaxKnownKm, syncAracGuncelKm } from "@/lib/km-consistency";
import { canRoleAccessAllCompanies, isDriverRole } from "@/lib/policy";

const PATH = '/dashboard/yakitlar';
const ARACLAR_PATH = '/dashboard/araclar';
const PERSONEL_PATH = "/dashboard/personel";
const YAKIT_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Yakit?.fields?.some((field: any) => field?.name === "soforId")
);

function getVehicleUsageCompanyFilter(sirketId: string) {
    return {
        OR: [
            { kullanici: { sirketId, deletedAt: null } },
            {
                kullaniciGecmisi: {
                    some: {
                        bitis: null,
                        kullanici: { sirketId, deletedAt: null },
                    },
                },
            },
        ],
    };
}

function revalidateYakitPages(aracId?: string, soforId?: string | null) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (soforId) revalidatePath(`${PERSONEL_PATH}/${soforId}`);
}

function normalizeSirketId(value: unknown) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

type CreateYakitInput = {
    aracId: string;
    tarih: string;
    litre: number;
    tutar: number;
    km?: number | null;
    soforId?: string | null;
    istasyon?: string;
    odemeYontemi?: OdemeYontemi | string;
};

type UpdateYakitInput = Partial<CreateYakitInput>;

function resolveOdemeYontemi(value?: string | OdemeYontemi): OdemeYontemi {
    if (!value) return OdemeYontemi.NAKIT;
    return value in OdemeYontemi ? (value as OdemeYontemi) : OdemeYontemi.NAKIT;
}

function parseDecimalInput(value: unknown, fieldLabel: string) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${fieldLabel} geçersiz.`);
    }
    return parsed;
}

function parseKmInput(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return null;
    }
    const numeric = raw.replace(/[^\d]/g, "");
    const parsed = Number(numeric || raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Alım KM geçersiz.");
    }
    return Math.trunc(parsed);
}

function parseDateInput(value: unknown, fieldLabel: string) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw new Error(`${fieldLabel} geçersiz.`);
        return value;
    }

    const text = String(value ?? "").trim();
    if (!text) {
        throw new Error(`${fieldLabel} boş olamaz.`);
    }

    const trDateTimeMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
    if (trDateTimeMatch) {
        const [, day, month, year, hour, minute] = trDateTimeMatch;
        const parsed = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute)
        );
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const fallback = new Date(text);
    if (Number.isNaN(fallback.getTime())) {
        throw new Error(`${fieldLabel} geçersiz.`);
    }
    return fallback;
}

async function getAracUsageContext(
    aracId: string,
    fallback?: { soforId?: string | null; kullanimSirketId?: string | null }
) {
    const aktifZimmet = await (prisma as any).kullaniciZimmet
        .findFirst({
            where: { aracId, bitis: null },
            orderBy: { baslangic: "desc" },
            select: {
                kullaniciId: true,
                kullanici: { select: { sirketId: true } },
            },
        })
        .catch(() => null);

    return {
        soforId: aktifZimmet?.kullaniciId || fallback?.soforId || null,
        kullanimSirketId: normalizeSirketId(aktifZimmet?.kullanici?.sirketId) || fallback?.kullanimSirketId || null,
    };
}

async function getYakitScopedAracOrThrow<TSelect>(aracId: string, select?: TSelect) {
    try {
        return await getScopedAracOrThrow(aracId, select);
    } catch (originalError) {
        const actor = await assertAuthenticatedUser();
        const actorSirketId = normalizeSirketId((actor as any)?.sirketId);
        const role = (actor as any)?.rol;

        if (!actorSirketId || isDriverRole(role) || canRoleAccessAllCompanies(role, actorSirketId)) {
            throw originalError;
        }

        const arac = await (prisma as any).arac.findFirst({
            where: {
                id: aracId,
                deletedAt: null,
                ...(getVehicleUsageCompanyFilter(actorSirketId) as any),
            },
            ...(select ? { select } : {}),
        });

        if (!arac) {
            throw originalError;
        }

        return arac;
    }
}

async function getYakitScopedRecordOrThrow<TSelect>(id: string, select?: TSelect) {
    try {
        return await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            select,
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });
    } catch (originalError) {
        const actor = await assertAuthenticatedUser();
        const actorSirketId = normalizeSirketId((actor as any)?.sirketId);
        const role = (actor as any)?.rol;

        if (!actorSirketId || isDriverRole(role) || canRoleAccessAllCompanies(role, actorSirketId)) {
            throw originalError;
        }

        const kayit = await (prisma as any).yakit.findFirst({
            where: {
                id,
                arac: {
                    deletedAt: null,
                    ...(getVehicleUsageCompanyFilter(actorSirketId) as any),
                },
            },
            ...(select ? { select } : {}),
        });

        if (!kayit) {
            throw originalError;
        }

        return kayit;
    }
}

async function resolveYakitSoforId(inputSoforId: string | null | undefined, fallbackSoforId?: string | null) {
    if (!YAKIT_HAS_SOFOR_ID) {
        return null;
    }

    if (typeof inputSoforId === "undefined") {
        return fallbackSoforId || null;
    }

    const normalized = inputSoforId?.trim();
    if (!normalized) {
        return null;
    }

    const personel = await getScopedKullaniciOrThrow(normalized, { id: true, rol: true });
    if ((personel as any)?.rol === "ADMIN") {
        throw new Error("Yakıt kaydı için admin seçilemez.");
    }

    return (personel as any).id as string;
}

export async function addFuelToTanker(data: {
    tankId: string;
    litre: number;
    toplamTutar: number;
    tarih: string;
}) {
    try {
        await assertAuthenticatedUser();
        const tank = await (prisma as any).yakitTank.findUnique({ where: { id: data.tankId } });
        if (!tank) throw new Error("Tank bulunamadı.");

        const parsedTarih = parseDateInput(data.tarih, "Alım tarihi");
        const parsedLitre = Number(data.litre);
        const parsedTutar = Number(data.toplamTutar);

        const yeniToplamLitre = tank.mevcutLitre + parsedLitre;
        const yeniBirimMaliyet = yeniToplamLitre > 0 
            ? (tank.mevcutLitre * tank.birimMaliyet + parsedTutar) / yeniToplamLitre 
            : tank.birimMaliyet;

        await (prisma as any).$transaction([
            (prisma as any).yakitTank.update({
                where: { id: tank.id },
                data: {
                    mevcutLitre: yeniToplamLitre,
                    birimMaliyet: yeniBirimMaliyet
                }
            }),
            (prisma as any).yakitTankHareket.create({
                data: {
                    tip: YakitTankHareketTip.ALIM,
                    tarih: parsedTarih,
                    litre: parsedLitre,
                    birimMaliyet: parsedTutar / (parsedLitre || 1),
                    toplamTutar: parsedTutar,
                    tankId: tank.id,
                }
            })
        ]);

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: e instanceof Error ? e.message : "Tankere yakıt eklenemedi." };
    }
}

export async function transferFuelToBidon(data: {
    litre: number;
    tarih: string;
}) {
    try {
        await assertAuthenticatedUser();
        const parsedTarih = parseDateInput(data.tarih, "Aktarım tarihi");
        const parsedLitre = Number(data.litre);

        // Find Binlik Bidon
        const bidon = await (prisma as any).yakitTank.findFirst({ where: { ad: "Binlik Bidon" } });
        if (!bidon) throw new Error("Binlik Bidon bulunamadı.");

        // Mithra logic to find source tank
        const tank1 = await (prisma as any).yakitTank.findFirst({ where: { ad: "Ana Tank 1" } });
        const tank2 = await (prisma as any).yakitTank.findFirst({ where: { ad: "Ana Tank 2" } });
        
        let sourceTank = null;
        if (tank1 && tank1.mevcutLitre >= parsedLitre) {
            sourceTank = tank1;
        } else if (tank2 && tank2.mevcutLitre >= parsedLitre) {
            sourceTank = tank2;
        } else if (tank1) {
            sourceTank = tank1; // Fallback
        }

        if (!sourceTank) throw new Error("Kaynak tank bulunamadı.");
        if (sourceTank.mevcutLitre < parsedLitre) {
            throw new Error(`Yetersiz yakıt. Kaynak tankta (${sourceTank.ad}) sadece ${sourceTank.mevcutLitre}L var.`);
        }

        const aktarilanDeger = parsedLitre * sourceTank.birimMaliyet;
        const yeniBidonToplamLitre = bidon.mevcutLitre + parsedLitre;
        const yeniBidonBirimMaliyet = yeniBidonToplamLitre > 0 
            ? (bidon.mevcutLitre * bidon.birimMaliyet + aktarilanDeger) / yeniBidonToplamLitre 
            : bidon.birimMaliyet;

        await (prisma as any).$transaction([
            // Source tank decrement
            (prisma as any).yakitTank.update({
                where: { id: sourceTank.id },
                data: { mevcutLitre: { decrement: parsedLitre } }
            }),
            // Target bidon increment & cost update
            (prisma as any).yakitTank.update({
                where: { id: bidon.id },
                data: {
                    mevcutLitre: yeniBidonToplamLitre,
                    birimMaliyet: yeniBidonBirimMaliyet
                }
            }),
            // Record transfer
            (prisma as any).yakitTankHareket.create({
                data: {
                    tip: YakitTankHareketTip.TRANSFER,
                    tarih: parsedTarih,
                    litre: parsedLitre,
                    birimMaliyet: sourceTank.birimMaliyet,
                    toplamTutar: aktarilanDeger,
                    tankId: sourceTank.id,
                    hedefTankId: bidon.id,
                    aciklama: `Transfer: ${sourceTank.ad} -> Binlik Bidon`
                }
            })
        ]);

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: e instanceof Error ? e.message : "Yakıt aktarımı başarısız." };
    }
}

export async function createYakit(data: CreateYakitInput) {
    try {
        await assertAuthenticatedUser();
        const arac = await getYakitScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            kullaniciId: true,
            kullanici: { select: { id: true, sirketId: true } },
        });
        const fallbackUsageContext = {
            soforId: (arac as any)?.kullanici?.id || arac.kullaniciId || null,
            kullanimSirketId: normalizeSirketId((arac as any)?.kullanici?.sirketId),
        };
        const usageContext = await getAracUsageContext(arac.id, fallbackUsageContext);
        const fallbackSoforId = usageContext.soforId;
        const resolvedSoforId = await resolveYakitSoforId(data.soforId, fallbackSoforId);
        const parsedTarih = parseDateInput(data.tarih, "Yakıt tarihi");
        const parsedLitre = parseDecimalInput(data.litre, "Litre");
        const parsedTutar = parseDecimalInput(data.tutar, "Toplam tutar");
        const parsedKm = parseKmInput(data.km);
        const km =
            parsedKm === null
                ? await getAracMaxKnownKm(arac.id)
                : await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: parsedKm,
                    fieldLabel: "Yakit KM",
                    enforceMaxKnownKm: false,
                });

        const isTanker = data.istasyon === "Mithra" || data.istasyon === "Binlik Bidon";
        let finalTutar = parsedTutar;
        let selectedTankId: string | null = null;

        if (isTanker) {
            if (data.istasyon === "Binlik Bidon") {
                const binlik = await (prisma as any).yakitTank.findFirst({ where: { ad: "Binlik Bidon" } });
                if (binlik) selectedTankId = binlik.id;
            } else {
                // Mithra case -> Use Ana Tank 1 then Ana Tank 2
                const tank1 = await (prisma as any).yakitTank.findFirst({ where: { ad: "Ana Tank 1" } });
                const tank2 = await (prisma as any).yakitTank.findFirst({ where: { ad: "Ana Tank 2" } });
                
                if (tank1 && tank1.mevcutLitre >= parsedLitre) {
                    selectedTankId = tank1.id;
                } else if (tank2 && tank2.mevcutLitre >= parsedLitre) {
                    selectedTankId = tank2.id;
                } else if (tank1) {
                    selectedTankId = tank1.id; // Fallback to Tank 1
                }
            }
        }

        if (selectedTankId) {
            const tank = await (prisma as any).yakitTank.findUnique({ where: { id: selectedTankId } });
            if (tank) {
                finalTutar = parsedLitre * tank.birimMaliyet;
            }
        }

        const result = await (prisma as any).$transaction(async (tx: any) => {
            const yakit = await tx.yakit.create({
                data: {
                    aracId: arac.id,
                    sirketId: usageContext.kullanimSirketId,
                    tarih: parsedTarih,
                    litre: parsedLitre,
                    tutar: finalTutar,
                    km: Number(km),
                    ...(YAKIT_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                    istasyon: data.istasyon || null,
                    odemeYontemi: resolveOdemeYontemi(data.odemeYontemi),
                }
            });

            if (selectedTankId) {
                const tank = await tx.yakitTank.findUnique({ where: { id: selectedTankId } });
                await tx.yakitTank.update({
                    where: { id: selectedTankId },
                    data: { mevcutLitre: { decrement: parsedLitre } }
                });

                await tx.yakitTankHareket.create({
                    data: {
                        tip: YakitTankHareketTip.CIKIS,
                        tarih: parsedTarih,
                        litre: parsedLitre,
                        birimMaliyet: tank.birimMaliyet,
                        toplamTutar: finalTutar,
                        tankId: selectedTankId,
                        aracId: arac.id,
                        soforId: resolvedSoforId,
                        yakitId: yakit.id
                    }
                });
            }

            return yakit;
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id, resolvedSoforId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı oluşturulamadı.",
        };
    }
}

export async function updateYakit(id: string, data: UpdateYakitInput) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getYakitScopedRecordOrThrow(id, {
            aracId: true,
            sirketId: true,
            km: true,
            ...(YAKIT_HAS_SOFOR_ID ? { soforId: true } : {}),
        });
        const arac = data.aracId
            ? await getYakitScopedAracOrThrow(data.aracId, {
                id: true,
                sirketId: true,
                kullaniciId: true,
                kullanici: { select: { id: true, sirketId: true } },
            })
            : await getYakitScopedAracOrThrow(mevcutKayit.aracId, {
                id: true,
                sirketId: true,
                kullaniciId: true,
                kullanici: { select: { id: true, sirketId: true } },
            });

        const kmInput =
            data.km !== undefined
                ? data.km
                : data.aracId && data.aracId !== mevcutKayit.aracId
                    ? mevcutKayit.km
                    : undefined;
        const normalizedKmInput = kmInput !== undefined ? parseKmInput(kmInput) : undefined;
        const vehicleChanged = Boolean(data.aracId && data.aracId !== mevcutKayit.aracId);

        let normalizedKm: number | undefined;
        if (normalizedKmInput === undefined) {
            normalizedKm = undefined;
        } else if (normalizedKmInput === null) {
            normalizedKm = vehicleChanged
                ? await getAracMaxKnownKm(arac.id)
                : Number.isFinite(Number(mevcutKayit.km))
                    ? Math.trunc(Number(mevcutKayit.km))
                    : await getAracMaxKnownKm(arac.id);
        } else {
            const checkedKm = await assertKmWriteConsistency({
                aracId: arac.id,
                km: normalizedKmInput,
                fieldLabel: "Yakit KM",
                currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.km },
                enforceMaxKnownKm: false,
            });
            normalizedKm = checkedKm === null ? undefined : Number(checkedKm);
        }
        const fallbackUsageContext = {
            soforId: (arac as any)?.kullanici?.id || arac.kullaniciId || null,
            kullanimSirketId: normalizeSirketId((arac as any)?.kullanici?.sirketId),
        };
        const usageContext = await getAracUsageContext(arac.id, fallbackUsageContext);
        const fallbackSoforId = vehicleChanged
            ? usageContext.soforId
            : ((mevcutKayit as any).soforId ?? usageContext.soforId);
        const resolvedSoforId = await resolveYakitSoforId(data.soforId, fallbackSoforId);
        const parsedTarih = data.tarih ? parseDateInput(data.tarih, "Yakıt tarihi") : undefined;
        const parsedLitre = data.litre !== undefined ? parseDecimalInput(data.litre, "Litre") : undefined;
        const parsedTutar = data.tutar !== undefined ? parseDecimalInput(data.tutar, "Toplam tutar") : undefined;

        await (prisma as any).$transaction(async (tx: any) => {
            const oldValue = await tx.yakit.findUnique({
                where: { id },
                include: { tankHareketi: true }
            });

            // If it was from a tank, restore fuel to tank
            if (oldValue?.tankHareketi) {
                await tx.yakitTank.update({
                    where: { id: oldValue.tankHareketi.tankId },
                    data: { mevcutLitre: { increment: oldValue.litre } }
                });
                await tx.yakitTankHareket.delete({ where: { yakitId: id } });
            }

            // Calculate new tutar if tank is used
            let finalTutar = parsedTutar;
            let selectedTankId: string | null = null;
            const newIstasyon = data.istasyon !== undefined ? data.istasyon : oldValue.istasyon;
            const newLitre = parsedLitre !== undefined ? parsedLitre : oldValue.litre;

            if (newIstasyon === "Mithra" || newIstasyon === "Binlik Bidon") {
                if (newIstasyon === "Binlik Bidon") {
                    const binlik = await tx.yakitTank.findFirst({ where: { ad: "Binlik Bidon" } });
                    if (binlik) selectedTankId = binlik.id;
                } else {
                    const tank1 = await tx.yakitTank.findFirst({ where: { ad: "Ana Tank 1" } });
                    const tank2 = await tx.yakitTank.findFirst({ where: { ad: "Ana Tank 2" } });
                    if (tank1 && tank1.mevcutLitre >= newLitre) selectedTankId = tank1.id;
                    else if (tank2 && tank2.mevcutLitre >= newLitre) selectedTankId = tank2.id;
                    else if (tank1) selectedTankId = tank1.id;
                }
            }

            if (selectedTankId) {
                const tank = await tx.yakitTank.findUnique({ where: { id: selectedTankId } });
                if (tank) finalTutar = newLitre * tank.birimMaliyet;
            }

            const updated = await tx.yakit.update({
                where: { id },
                data: {
                    aracId: arac.id,
                    sirketId: usageContext.kullanimSirketId ?? mevcutKayit.sirketId,
                    tarih: parsedTarih,
                    litre: parsedLitre,
                    tutar: finalTutar,
                    km: normalizedKm !== undefined ? Number(normalizedKm) : undefined,
                    ...(YAKIT_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                    istasyon: data.istasyon !== undefined ? data.istasyon || null : undefined,
                    odemeYontemi: data.odemeYontemi ? resolveOdemeYontemi(data.odemeYontemi) : undefined,
                }
            });

            if (selectedTankId) {
                const tank = await tx.yakitTank.findUnique({ where: { id: selectedTankId } });
                await tx.yakitTank.update({
                    where: { id: selectedTankId },
                    data: { mevcutLitre: { decrement: newLitre } }
                });

                await tx.yakitTankHareket.create({
                    data: {
                        tip: YakitTankHareketTip.CIKIS,
                        tarih: parsedTarih || oldValue.tarih,
                        litre: newLitre,
                        birimMaliyet: tank.birimMaliyet,
                        toplamTutar: finalTutar || (newLitre * tank.birimMaliyet),
                        tankId: selectedTankId,
                        aracId: arac.id,
                        soforId: resolvedSoforId || oldValue.soforId,
                        yakitId: id
                    }
                });
            }

            return updated;
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id, resolvedSoforId);
        if ((mevcutKayit as any).soforId && (mevcutKayit as any).soforId !== resolvedSoforId) {
            revalidateYakitPages(undefined, (mevcutKayit as any).soforId);
        }
        if (vehicleChanged && mevcutKayit.aracId !== arac.id) {
            await syncAracGuncelKm(mevcutKayit.aracId);
            revalidateYakitPages(mevcutKayit.aracId, null);
        }
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı güncellenemedi.",
        };
    }
}

export async function deleteYakit(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getYakitScopedRecordOrThrow(id, { aracId: true });

        await (prisma as any).$transaction(async (tx: any) => {
            const oldValue = await tx.yakit.findUnique({
                where: { id },
                include: { tankHareketi: true }
            });

            if (oldValue?.tankHareketi) {
                await tx.yakitTank.update({
                    where: { id: oldValue.tankHareketi.tankId },
                    data: { mevcutLitre: { increment: oldValue.litre } }
                });
                // Tank hareketi yakitId onDelete: SetNull olduğu için manuel silme iyi olabilir
                await tx.yakitTankHareket.deleteMany({ where: { yakitId: id } });
            }

            await tx.yakit.delete({ where: { id } });
        });
        const aracId = (kayit as { aracId?: string } | null)?.aracId;
        if (aracId) {
            await syncAracGuncelKm(aracId);
        }
        revalidateYakitPages(aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı silinemedi.",
        };
    }
}

export async function deleteTankHareket(id: string) {
    try {
        await assertAuthenticatedUser();
        const hareket = await (prisma as any).yakitTankHareket.findUnique({
            where: { id }
        });
        if (!hareket) throw new Error("Hareket kaydı bulunamadı.");

        await (prisma as any).$transaction(async (tx: any) => {
            if (hareket.tip === YakitTankHareketTip.ALIM) {
                // External purchase reversal: subtract from tank
                await tx.yakitTank.update({
                    where: { id: hareket.tankId },
                    data: { mevcutLitre: { decrement: hareket.litre } }
                });
            } else if (hareket.tip === YakitTankHareketTip.TRANSFER) {
                // Internal transfer reversal
                // 1. Subtract from target (Bidon)
                if (hareket.hedefTankId) {
                    await tx.yakitTank.update({
                        where: { id: hareket.hedefTankId },
                        data: { mevcutLitre: { decrement: hareket.litre } }
                    });
                }
                // 2. Add back to source (Ana Tank)
                await tx.yakitTank.update({
                    where: { id: hareket.tankId },
                    data: { mevcutLitre: { increment: hareket.litre } }
                });
            }

            await tx.yakitTankHareket.delete({ where: { id } });
        });

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Stok hareketi silinemedi.",
        };
    }
}

export async function updateTank(id: string, data: {
    ad?: string;
    kapasiteLitre?: number;
    mevcutLitre?: number;
    birimMaliyet?: number;
}) {
    try {
        await assertAuthenticatedUser();
        await (prisma as any).yakitTank.update({
            where: { id },
            data: {
                ...(data.ad ? { ad: data.ad } : {}),
                ...(data.kapasiteLitre !== undefined ? { kapasiteLitre: Number(data.kapasiteLitre) } : {}),
                ...(data.mevcutLitre !== undefined ? { mevcutLitre: Number(data.mevcutLitre) } : {}),
                ...(data.birimMaliyet !== undefined ? { birimMaliyet: Number(data.birimMaliyet) } : {}),
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: e instanceof Error ? e.message : "Tank güncellenemedi." };
    }
}

export async function updateTankHareket(id: string, data: {
    litre?: number;
    toplamTutar?: number;
    tarih?: string;
}) {
    try {
        await assertAuthenticatedUser();
        const oldHareket = await (prisma as any).yakitTankHareket.findUnique({
            where: { id }
        });
        if (!oldHareket) throw new Error("Hareket kaydı bulunamadı.");

        const parsedTarih = data.tarih ? parseDateInput(data.tarih, "Hareket tarihi") : undefined;
        const newLitre = data.litre !== undefined ? Number(data.litre) : oldHareket.litre;
        const newTutar = data.toplamTutar !== undefined ? Number(data.toplamTutar) : oldHareket.toplamTutar;

        await (prisma as any).$transaction(async (tx: any) => {
            // REVERSE old impact
            if (oldHareket.tip === YakitTankHareketTip.ALIM) {
                await tx.yakitTank.update({
                    where: { id: oldHareket.tankId },
                    data: { mevcutLitre: { decrement: oldHareket.litre } }
                });
            } else if (oldHareket.tip === YakitTankHareketTip.TRANSFER && oldHareket.hedefTankId) {
                await tx.yakitTank.update({
                    where: { id: oldHareket.hedefTankId },
                    data: { mevcutLitre: { decrement: oldHareket.litre } }
                });
                await tx.yakitTank.update({
                    where: { id: oldHareket.tankId },
                    data: { mevcutLitre: { increment: oldHareket.litre } }
                });
            }

            // APPLY new impact
            if (oldHareket.tip === YakitTankHareketTip.ALIM) {
                const tank = await tx.yakitTank.findUnique({ where: { id: oldHareket.tankId } });
                const yeniHacim = tank.mevcutLitre + newLitre;
                const yeniMaliyet = yeniHacim > 0 
                    ? (tank.mevcutLitre * tank.birimMaliyet + newTutar) / yeniHacim 
                    : tank.birimMaliyet;
                
                await tx.yakitTank.update({
                    where: { id: tank.id },
                    data: { 
                        mevcutLitre: yeniHacim,
                        birimMaliyet: yeniMaliyet
                    }
                });
            } else if (oldHareket.tip === YakitTankHareketTip.TRANSFER && oldHareket.hedefTankId) {
                const source = await tx.yakitTank.findUnique({ where: { id: oldHareket.tankId } });
                const target = await tx.yakitTank.findUnique({ where: { id: oldHareket.hedefTankId } });
                
                const aktarilanDeger = newLitre * source.birimMaliyet;
                
                await tx.yakitTank.update({
                    where: { id: source.id },
                    data: { mevcutLitre: { decrement: newLitre } }
                });
                
                const yeniTargetHacim = target.mevcutLitre + newLitre;
                const yeniTargetMaliyet = yeniTargetHacim > 0 
                    ? (target.mevcutLitre * target.birimMaliyet + aktarilanDeger) / yeniTargetHacim 
                    : target.birimMaliyet;

                await tx.yakitTank.update({
                    where: { id: target.id },
                    data: {
                        mevcutLitre: yeniTargetHacim,
                        birimMaliyet: yeniTargetMaliyet
                    }
                });
            }

            await tx.yakitTankHareket.update({
                where: { id },
                data: {
                    litre: newLitre,
                    toplamTutar: oldHareket.tip === YakitTankHareketTip.ALIM ? newTutar : (newLitre * oldHareket.birimMaliyet),
                    tarih: parsedTarih,
                    birimMaliyet: oldHareket.tip === YakitTankHareketTip.ALIM ? (newTutar / (newLitre || 1)) : oldHareket.birimMaliyet
                }
            });
        });

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: e instanceof Error ? e.message : "Stok hareketi güncellenemedi." };
    }
}
