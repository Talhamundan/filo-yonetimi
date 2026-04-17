"use server";

import type { ExcelEntityKey } from "@/lib/excel-entities";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { isAdminRole } from "@/lib/policy";
import { deleteArac } from "@/app/dashboard/araclar/actions";
import { deletePersonel } from "@/app/dashboard/personel/actions";
import { deleteSirket } from "@/app/dashboard/sirketler/actions";
import { deleteZimmet } from "@/app/dashboard/zimmetler/actions";
import { deleteArizaKaydi } from "@/app/dashboard/arizalar/actions";
import { deleteBakim } from "@/app/dashboard/bakimlar/actions";
import { deleteYakit } from "@/app/dashboard/yakitlar/actions";
import { deleteMuayene } from "@/app/dashboard/muayeneler/actions";
import { deleteKasko } from "@/app/dashboard/kasko/actions";
import { deleteSigorta } from "@/app/dashboard/trafik-sigortasi/actions";
import { deleteMasraf } from "@/app/dashboard/masraflar/actions";
import { deleteCezaMasraf } from "@/app/dashboard/ceza-masraflari/actions";
import { deleteDokuman } from "@/app/dashboard/dokumanlar/actions";
import { deleteDisFirma } from "@/app/dashboard/_dis-firmalar/actions";

type DeleteResult = { success: boolean; error?: string };

async function deleteByEntity(entity: ExcelEntityKey, id: string): Promise<DeleteResult> {
    switch (entity) {
        case "arac":
            return deleteArac(id);
        case "personel":
            return deletePersonel(id);
        case "sirket":
            return deleteSirket(id);
        case "taseronFirma":
        case "kiralikFirma":
            return deleteDisFirma(id);
        case "zimmet":
            return deleteZimmet(id);
        case "ariza":
            return deleteArizaKaydi(id);
        case "bakim":
            return deleteBakim(id);
        case "yakit":
            return deleteYakit(id);
        case "muayene":
            return deleteMuayene(id);
        case "kasko":
            return deleteKasko(id);
        case "trafikSigortasi":
            return deleteSigorta(id);
        case "masraf":
            return deleteMasraf(id);
        case "ceza":
            return deleteCezaMasraf(id);
        case "dokuman":
            return deleteDokuman(id);
        default:
            return { success: false, error: "Bu tablo için toplu silme desteklenmiyor." };
    }
}

export async function bulkDeleteByExcelEntity(entity: ExcelEntityKey, ids: string[]) {
    const actor = await assertAuthenticatedUser();
    if (!isAdminRole((actor as { rol?: string | null })?.rol)) {
        throw new Error("Toplu silme yetkisi sadece admin kullanicidadir.");
    }

    const uniqueIds = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
        return { success: false, deleted: 0, failed: 0, errors: ["Silinecek kayıt seçilemedi."] };
    }

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of uniqueIds) {
        try {
            const result = await deleteByEntity(entity, id);
            if (result?.success) {
                deleted += 1;
            } else {
                failed += 1;
                if (result?.error) {
                    errors.push(result.error);
                }
            }
        } catch (error) {
            failed += 1;
            errors.push(error instanceof Error ? error.message : "Beklenmeyen silme hatası.");
        }
    }

    return {
        success: failed === 0,
        deleted,
        failed,
        errors: [...new Set(errors)].slice(0, 5),
    };
}
