import { z } from "zod";

export const stokBirimleri = ["ADET", "LITRE", "KG", "SET", "KOLI"] as const;
export type StokBirimValue = (typeof stokBirimleri)[number];

export const stokKalemFormSchema = z.object({
    ad: z.string().trim().min(2, "Stok adı en az 2 karakter olmalı."),
    kategori: z.string().trim().optional(),
    miktar: z.coerce.number().min(0, "Stok adedi negatif olamaz."),
    birim: z.enum(stokBirimleri).default("ADET"),
    konum: z.string().trim().optional(),
    kritikSeviye: z
        .union([z.coerce.number().min(0, "Kritik seviye negatif olamaz."), z.nan(), z.null(), z.undefined()])
        .optional()
        .transform((value) => (typeof value === "number" && Number.isFinite(value) ? value : null)),
    aciklama: z.string().trim().optional(),
    sirketId: z.string().trim().optional(),
});

export type StokKalemFormValues = z.infer<typeof stokKalemFormSchema>;
