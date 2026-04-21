import { z } from "zod";

export const disFirmaTurleri = ["TASERON", "KIRALIK"] as const;
export type DisFirmaTuruValue = (typeof disFirmaTurleri)[number];
export type DisFirmaScopeValue = DisFirmaTuruValue | "ALL";

export const disFirmaFormSchema = z.object({
    ad: z.string().trim().min(2, "Firma adı en az 2 karakter olmalı."),
    tur: z.enum(disFirmaTurleri),
    sehir: z.string().trim().min(1, "Şehir bilgisi zorunludur."),
    vergiNo: z.string().trim().optional(),
    yetkiliKisi: z.string().trim().optional(),
    telefon: z.string().trim().optional(),
    calistigiKurum: z.string().trim().optional(),
});

export type DisFirmaFormValues = z.infer<typeof disFirmaFormSchema>;

export function getDisFirmaTurLabel(tur: DisFirmaScopeValue) {
    if (tur === "ALL") return "Dış";
    return tur === "TASERON" ? "Taşeron" : "Kiralık";
}
