import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma, $Enums } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole, getModelFilter } from "@/lib/auth-utils";
import { withYilDateFilter } from "@/lib/company-scope";
import { EXCEL_ENTITY_CONFIG, isExcelEntityKey } from "@/lib/excel-entities";

type PrismaField = (typeof Prisma.dmmf.datamodel.models)[number]["fields"][number];
type RowData = Record<string, unknown>;
type WhereData = Record<string, unknown>;
type ExportColumn =
    | { key: string; type: "scalar"; fieldName: string }
    | {
        key: string;
        type: "relationLookup";
        relationFieldName: string;
        relationModelName: string;
        foreignKeyFieldName: string;
    };
type ModelDelegate = {
    findMany?: (args?: {
        where?: WhereData;
        orderBy?: Record<string, "asc" | "desc">;
        include?: Record<string, unknown>;
        select?: Record<string, boolean>;
        take?: number;
    }) => Promise<RowData[]>;
    create?: (args: { data: RowData }) => Promise<unknown>;
    update?: (args: { where: WhereData; data: RowData }) => Promise<unknown>;
    upsert?: (args: { where: WhereData; create: RowData; update: RowData }) => Promise<unknown>;
    findUnique?: (args: { where: WhereData; select: Record<string, boolean> }) => Promise<RowData | null>;
};

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
type ExcelModelProfile = {
    visibleColumns?: string[];
    hiddenColumns?: string[];
    labels?: Record<string, string>;
    aliases?: Record<string, string[]>;
};

const EXCEL_MODEL_PROFILES: Record<string, ExcelModelProfile> = {
    arac: {
        visibleColumns: [
            "durum",
            "plaka",
            "ruhsatSahibi",
            "calistigiKurum",
            "saseNo",
            "kategori",
            "marka",
            "model",
            "yil",
            "bulunduguIl",
            "bedel",
            "guncelKm",
            "kullanici",
            "hgsNo",
            "ruhsatSeriNo",
            "aciklama",
        ],
        hiddenColumns: ["olusturmaTarihi", "guncellemeTarihi"],
        labels: {
            durum: "Durum",
            plaka: "Plaka",
            ruhsatSahibi: "Ruhsat Sahibi",
            calistigiKurum: "Kullanıcı Firma",
            saseNo: "Şase No",
            kategori: "Kategori",
            marka: "Marka",
            model: "Model",
            yil: "Model Yılı",
            bulunduguIl: "Bulunduğu Şantiye",
            bedel: "BEDEL",
            guncelKm: "KM",
            kullanici: "Kullanıcı",
            hgsNo: "HGS No",
            ruhsatSeriNo: "Ruhsat Seri No",
            aciklama: "Açıklama",
        },
        aliases: {
            ruhsatSahibi: [
                "Ruhsat Sahibi Firma",
                "operasyonFirma",
                "operasyonFirmasi",
                "ruhsatSahibiFirma",
                "ruhsatSahibiFirmasi",
                "sirket",
                "bagliSirket",
            ],
            calistigiKurum: [
                "Kullanıcı Firma",
                "Kullanıcı Firması",
                "Kullanici Firma",
                "Kullanici Firmasi",
                "kullanici firma",
                "kullanici firmasi",
                "kullaniciFirma",
                "kullaniciFirmasi",
                "Çalıştığı Kurum",
                "Calistigi Kurum",
            ],
            guncelKm: ["Güncel KM", "km", "Km"],
            kullanici: ["Sofor", "Şoför", "sofor"],
            bulunduguIl: ["Bulunduğu İl", "Bulunduğu Şantiye", "Şantiye", "İl", "il"],
            yil: ["Yıl", "yil"],
            bedel: ["Bedel", "alış bedeli", "alis bedeli", "alış maliyeti", "alis maliyeti"],
            aciklama: ["Açiklama", "aciklama"],
        },
    },
    kullanici: {
        visibleColumns: [
            "ad",
            "soyad",
            "telefon",
            "tcNo",
            "calistigiKurum",
            "rol",
            "sirket",
            "onayDurumu",
            "eposta",
        ],
        hiddenColumns: ["deletedAt", "deletedBy"],
        labels: {
            ad: "Ad",
            soyad: "Soyad",
            telefon: "Telefon",
            tcNo: "TC Kimlik No",
            calistigiKurum: "Çalıştığı Kurum",
            rol: "Rol",
            sirket: "Bağlı Şirket",
            onayDurumu: "Onay Durumu",
            eposta: "E-Posta",
        },
        aliases: {
            calistigiKurum: [
                "Çalıştığı Kurum",
                "Calistigi Kurum",
                "Kurum",
                "Çalıştığı Firma",
                "Calistigi Firma",
                "Şehir",
                "Sehir",
                "sehir",
            ],
            sirket: ["Bağlı Şirket", "Bagli Sirket", "Şirket", "Sirket"],
            tcNo: ["TC No", "TCKN", "TC Kimlik"],
            eposta: ["Eposta", "Mail"],
        },
    },
    yakit: {
        visibleColumns: [
            "tarih",
            "arac",
            "sofor",
            "litre",
            "tutar",
            "km",
            "istasyon",
            "odemeYontemi",
        ],
        labels: {
            tarih: "Tarih",
            arac: "Araç",
            sofor: "Yakıtı Alan",
            litre: "Litre",
            tutar: "Tutar",
            km: "KM",
            istasyon: "İstasyon",
            odemeYontemi: "Ödeme Yöntemi",
        },
        aliases: {
            sofor: ["Yakıtı Alan", "Yakit Alan", "Şoför", "Sofor", "Personel", "Kullanıcı", "Kullanici"],
            odemeYontemi: ["Ödeme Şekli", "Odeme Sekli"],
        },
    },
    bakim: {
        visibleColumns: [
            "bakimTarihi",
            "arac",
            "sofor",
            "kategori",
            "servisAdi",
            "yapilanIslemler",
            "yapilanKm",
            "tutar",
        ],
        labels: {
            bakimTarihi: "Bakım Tarihi",
            arac: "Araç",
            sofor: "Servise Götüren",
            kategori: "Kategori",
            servisAdi: "Servis Adı",
            yapilanIslemler: "Yapılan İşlemler",
            yapilanKm: "Yapılan KM",
            tutar: "Tutar",
        },
        aliases: {
            sofor: ["Servise Götüren", "Servise Goturen", "Şoför", "Sofor", "Personel", "Kullanıcı", "Kullanici"],
            bakimTarihi: ["Tarih"],
            yapilanKm: ["İşlem KM", "Islem KM", "KM"],
        },
    },
};

function lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
}

function getExcelModelProfile(modelName: string): ExcelModelProfile | null {
    return EXCEL_MODEL_PROFILES[modelName] || null;
}

function getExportHeaderLabel(modelName: string, key: string) {
    const profile = getExcelModelProfile(modelName);
    return profile?.labels?.[key] || key;
}

function getHeaderAliases(modelName: string, key: string) {
    const profile = getExcelModelProfile(modelName);
    return profile?.aliases?.[key] || [];
}

function normalizeHeaderToken(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

function buildHeaderIndex(headers: string[]) {
    const index = new Map<string, string>();
    for (const header of headers) {
        const normalized = normalizeHeaderToken(header);
        if (!normalized) continue;
        if (!index.has(normalized)) {
            index.set(normalized, header);
        }
        // xlsx duplicate header'larda "_1", "_2" gibi suffix ekleyebilir.
        const dedupNormalized = normalized.replace(/\d+$/, "");
        if (dedupNormalized && dedupNormalized !== normalized && !index.has(dedupNormalized)) {
            index.set(dedupNormalized, header);
        }
    }
    return index;
}

function findHeaderByCandidates(
    availableHeaders: Set<string>,
    normalizedHeaderIndex: Map<string, string>,
    candidates: string[]
) {
    for (const candidate of candidates) {
        if (availableHeaders.has(candidate)) {
            return candidate;
        }
        const normalized = normalizeHeaderToken(candidate);
        if (!normalized) continue;
        const matched = normalizedHeaderIndex.get(normalized);
        if (matched) return matched;
    }
    return null;
}

function resolveImportHeaderForRecord(
    recordHeaders: Set<string>,
    normalizedRecordHeaderIndex: Map<string, string>,
    fallbackHeaders: Set<string>,
    fallbackNormalizedHeaderIndex: Map<string, string>,
    candidates: string[]
) {
    return (
        findHeaderByCandidates(recordHeaders, normalizedRecordHeaderIndex, candidates) ||
        findHeaderByCandidates(fallbackHeaders, fallbackNormalizedHeaderIndex, candidates)
    );
}

function readRecordCellValue(
    record: Record<string, unknown>,
    header: string | null,
    normalizedRecordHeaderIndex: Map<string, string>
) {
    if (!header) return null;
    if (Object.prototype.hasOwnProperty.call(record, header)) {
        return record[header];
    }
    const normalized = normalizeHeaderToken(header);
    if (!normalized) return null;
    const matchedHeader = normalizedRecordHeaderIndex.get(normalized);
    return matchedHeader ? record[matchedHeader] : null;
}

function getHeaderCandidates(modelName: string, key: string, extra: string[] = []) {
    const candidates = [key, getExportHeaderLabel(modelName, key), ...getHeaderAliases(modelName, key), ...extra];
    return [...new Set(candidates.filter((value) => value && value.trim().length > 0))];
}

function extractSheetHeaders(sheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
    });
    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    return headerRow
        .map((cell) => {
            const normalized = normalizeCell(cell);
            return normalized === null ? null : String(normalized).trim();
        })
        .filter((header): header is string => Boolean(header));
}

function applyExportProfile(modelName: string, columnKeys: string[]) {
    const profile = getExcelModelProfile(modelName);
    if (!profile) return columnKeys;

    let next = [...columnKeys];
    if (profile.hiddenColumns?.length) {
        const hidden = new Set(profile.hiddenColumns);
        next = next.filter((key) => !hidden.has(key));
    }
    if (profile.visibleColumns?.length) {
        const visibleSet = new Set(next);
        const ordered = profile.visibleColumns.filter((key) => visibleSet.has(key));
        const remaining = next.filter((key) => !ordered.includes(key));
        next = [...ordered, ...remaining];
    }
    return next;
}

function getEntityOrNull(entity: string) {
    return isExcelEntityKey(entity) ? EXCEL_ENTITY_CONFIG[entity] : null;
}

function getModelMeta(prismaModel: string) {
    return Prisma.dmmf.datamodel.models.find((model) => lowerFirst(model.name) === prismaModel) || null;
}

function getModelDelegate(source: unknown, modelName: string): ModelDelegate | null {
    if (!source || typeof source !== "object") return null;
    const delegate = (source as Record<string, unknown>)[modelName];
    if (!delegate || typeof delegate !== "object") return null;
    return delegate as ModelDelegate;
}

function getColumnFields(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    return model.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
}

function getObjectFields(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    return model.fields.filter((field) => field.kind === "object");
}

function getRelationFromFields(field: PrismaField) {
    const relationFromFields = (field as PrismaField & { relationFromFields?: string[] | null }).relationFromFields;
    return Array.isArray(relationFromFields) ? relationFromFields : [];
}

function buildRelationFieldByForeignKeyMap(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    const relationFieldByForeignKey = new Map<string, PrismaField>();
    const objectFields = getObjectFields(model);
    const scalarFieldNames = new Set(
        model.fields
            .filter((field) => field.kind === "scalar" || field.kind === "enum")
            .map((field) => field.name)
    );

    for (const objectField of objectFields) {
        for (const foreignKeyField of getRelationFromFields(objectField)) {
            relationFieldByForeignKey.set(foreignKeyField, objectField);
        }
    }

    // Fallback: bazı sürümlerde relationFromFields boş gelebiliyor.
    for (const objectField of objectFields) {
        const foreignKeyCandidate = `${objectField.name}Id`;
        if (!relationFieldByForeignKey.has(foreignKeyCandidate) && scalarFieldNames.has(foreignKeyCandidate)) {
            relationFieldByForeignKey.set(foreignKeyCandidate, objectField);
        }
    }

    // Arac modeli için kritik ilişki alanlarını garantiye al.
    if (model.name === "Arac") {
        const objectFieldByName = new Map(objectFields.map((field) => [field.name, field]));
        const sirketField = objectFieldByName.get("sirket");
        const kullaniciField = objectFieldByName.get("kullanici");
        if (!relationFieldByForeignKey.has("sirketId") && sirketField) {
            relationFieldByForeignKey.set("sirketId", sirketField);
        }
        if (!relationFieldByForeignKey.has("kullaniciId") && kullaniciField) {
            relationFieldByForeignKey.set("kullaniciId", kullaniciField);
        }
    }

    return relationFieldByForeignKey;
}

function shouldHideInternalField(fieldName: string) {
    if (fieldName === "id" || fieldName === "sifre") return true;
    if (fieldName === "sifreHash") return true;
    if (fieldName === "deletedAt" || fieldName === "deletedBy") return true;
    if (fieldName === "olusturmaTarihi" || fieldName === "guncellemeTarihi") return true;
    if (fieldName.endsWith("Id")) return true;
    return false;
}

function buildRelationExportSelect(modelName: string) {
    if (modelName === "Kullanici") {
        return {
            ad: true,
            soyad: true,
            sirket: { select: { ad: true } },
        };
    }

    const modelMeta = Prisma.dmmf.datamodel.models.find((model) => model.name === modelName);
    if (!modelMeta) {
        return { id: true };
    }

    const scalarFields = modelMeta.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
    const selected = scalarFields
        .map((field) => field.name)
        .filter((fieldName) => !["sifre", "sifreHash", "deletedAt", "deletedBy"].includes(fieldName));

    if (selected.length === 0) {
        const fallback = scalarFields.find((field) => !field.isId)?.name ?? scalarFields[0]?.name ?? "id";
        return { [fallback]: true };
    }

    return Object.fromEntries(selected.map((name) => [name, true]));
}

function relationDisplayValue(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const relation = value as Record<string, unknown>;

    const ad = typeof relation.ad === "string" ? relation.ad.trim() : "";
    const soyad = typeof relation.soyad === "string" ? relation.soyad.trim() : "";
    const adSoyad = `${ad} ${soyad}`.trim();
    if (adSoyad) return adSoyad;
    if (ad) return ad;

    const plaka = typeof relation.plaka === "string" ? relation.plaka.trim() : "";
    const saseNo = typeof relation.saseNo === "string" ? relation.saseNo.trim() : "";
    if (plaka && saseNo) return `${plaka} / ${saseNo}`;
    if (plaka) return plaka;
    if (saseNo) return saseNo;

    if (typeof relation.ad === "string" && relation.ad.trim()) return relation.ad.trim();
    if (typeof relation.eposta === "string" && relation.eposta.trim()) return relation.eposta.trim();
    return null;
}

function getForeignKeyBaseName(fieldName: string) {
    return fieldName.endsWith("Id") ? fieldName.slice(0, -2) : fieldName;
}

function getExportColumnKeyForRelationId(fieldName: string, usedKeys: Set<string>) {
    const base = getForeignKeyBaseName(fieldName);
    const candidates = [base, `${base}Adi`, `${base}Bilgi`];

    for (const candidate of candidates) {
        if (!usedKeys.has(candidate)) return candidate;
    }

    let suffix = 2;
    while (usedKeys.has(`${base}${suffix}`)) {
        suffix += 1;
    }
    return `${base}${suffix}`;
}

function buildExportColumns(
    fields: PrismaField[],
    relationFieldByForeignKey: Map<string, PrismaField>,
    modelName?: string
) {
    const exportColumns: ExportColumn[] = [];
    const usedKeys = new Set<string>();

    for (const field of fields) {
        if (shouldHideInternalField(field.name)) {
            if (field.name.endsWith("Id")) {
                const relationField = relationFieldByForeignKey.get(field.name);
                if (!relationField) continue;
                const key =
                    modelName === "Arac" && field.name === "sirketId" && !usedKeys.has("ruhsatSahibi")
                        ? "ruhsatSahibi"
                        : getExportColumnKeyForRelationId(field.name, usedKeys);
                usedKeys.add(key);
                exportColumns.push({
                    key,
                    type: "relationLookup",
                    relationFieldName: relationField.name,
                    relationModelName: relationField.type,
                    foreignKeyFieldName: field.name,
                });
            }
            continue;
        }

        usedKeys.add(field.name);
        exportColumns.push({
            key: field.name,
            type: "scalar",
            fieldName: field.name,
        });
    }

    return exportColumns;
}

function getRelationImportHeaderAliases(modelName: string, foreignKeyFieldName: string) {
    if (modelName !== "arac") return [];
    if (foreignKeyFieldName === "sirketId") {
        return [
            "Ruhsat Sahibi",
            "Ruhsat Sahibi Firma",
            "sirket",
            "bagliSirket",
            "operasyonFirma",
            "operasyonFirmasi",
            "ruhsatSahibi",
            "ruhsatSahibiFirma",
            "ruhsatSahibiFirmasi",
        ];
    }
    return [];
}

function toExportCell(value: unknown) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "bigint") return value.toString();
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString("base64");
    }
    if (typeof value === "object") {
        const serializable = typeof (value as { toJSON?: () => unknown }).toJSON === "function"
            ? (value as { toJSON: () => unknown }).toJSON()
            : value;
        if (
            serializable === null ||
            typeof serializable === "string" ||
            typeof serializable === "number" ||
            typeof serializable === "boolean"
        ) {
            return serializable;
        }
        return JSON.stringify(serializable);
    }
    return value;
}

function excelDateToJSDate(value: number) {
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    return new Date(excelEpochUtc + Math.round(value * 86400 * 1000));
}

function parseBoolean(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "evet", "yes"].includes(normalized)) return true;
        if (["false", "0", "hayir", "hayır", "no"].includes(normalized)) return false;
    }
    throw new Error(`Boolean deger parse edilemedi: ${String(value)}`);
}

function normalizeCell(value: unknown) {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }
    return value;
}

const NULLISH_CELL_TOKENS = new Set([
    "-",
    "--",
    "—",
    "n/a",
    "na",
    "null",
    "none",
    "nil",
    "yok",
    "bos",
    "boş",
]);

function normalizeTextToken(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");
}

function isNullishCellValue(value: unknown) {
    if (typeof value !== "string") return false;
    return NULLISH_CELL_TOKENS.has(normalizeTextToken(value));
}

function parseNumericCellValue(value: unknown) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const compact = value
        .trim()
        .replace(/\s+/g, "")
        .replace(/₺/g, "")
        .replace(/TL/gi, "")
        .replace(/\$/g, "");

    if (!compact) return null;

    const lastDot = compact.lastIndexOf(".");
    const lastComma = compact.lastIndexOf(",");
    let normalized = compact;

    if (lastDot >= 0 && lastComma >= 0) {
        if (lastComma > lastDot) {
            normalized = compact.replace(/\./g, "").replace(",", ".");
        } else {
            normalized = compact.replace(/,/g, "");
        }
    } else if (lastComma >= 0) {
        const commaCount = (compact.match(/,/g) || []).length;
        if (commaCount > 1) {
            normalized = compact.replace(/,/g, "");
        } else {
            const [left = "", right = ""] = compact.split(",");
            if (/^\d{3}$/.test(right)) {
                normalized = `${left}${right}`;
            } else {
                normalized = `${left}.${right}`;
            }
        }
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasAnyNonEmptyCell(record: Record<string, unknown>) {
    return Object.values(record).some((value) => normalizeCell(value) !== null);
}

function getEnumValueMap() {
    const map = new Map<string, Set<string>>();
    for (const enumType of Prisma.dmmf.datamodel.enums || []) {
        map.set(enumType.name, new Set(enumType.values.map((value) => value.name)));
    }

    for (const [enumName, enumObject] of Object.entries($Enums || {})) {
        if (!enumObject || typeof enumObject !== "object") continue;
        const values = Object.values(enumObject)
            .map((value) => String(value))
            .filter((value) => value.trim().length > 0);

        if (values.length > 0) {
            map.set(enumName, new Set(values));
        }
    }
    return map;
}

function normalizeEnumText(value: string) {
    return value
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/\s+/g, "_")
        .replace(/-/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

const ENUM_INPUT_ALIASES: Record<string, Record<string, string>> = {
    AracKategori: {
        TIR: "SANTIYE",
        KAMYON: "SANTIYE",
        "KAMYON TIR": "SANTIYE",
        "KAMYON/TIR": "SANTIYE",
        "SANTIYE ARACI": "SANTIYE",
        SANTIYE: "SANTIYE",
        "BINEK ARAC": "BINEK",
        "IS MAKINESI": "SANTIYE",
        "IS MAKINASI": "SANTIYE",
        "IS_MAKINASI": "SANTIYE",
        "IS MAKINESI ARACI": "SANTIYE",
    },
    AracDurumu: {
        AKTIFTE: "AKTIF",
        BOS: "BOSTA",
    },
    Rol: {
        SURUCU: "SOFOR",
    },
};

function resolveEnumAlias(enumName: string, value: string) {
    const aliasMap = ENUM_INPUT_ALIASES[enumName];
    if (!aliasMap) return null;

    const normalizedInput = normalizeEnumText(value);
    for (const [alias, canonicalValue] of Object.entries(aliasMap)) {
        if (normalizeEnumText(alias) === normalizedInput) {
            return canonicalValue;
        }
    }

    return null;
}

function coerceValue(
    field: PrismaField,
    rawValue: unknown,
    enumMap: ReturnType<typeof getEnumValueMap>
) {
    const value = normalizeCell(rawValue);
    if (value === null) return null;
    const valueIsNullish = isNullishCellValue(value);

    if (field.kind === "enum") {
        if (valueIsNullish) return null;
        const enumValues = enumMap.get(field.type);
        const strValue = String(value).trim();
        if (enumValues?.has(strValue)) {
            return strValue;
        }

        const aliasMatch = resolveEnumAlias(field.type, strValue);
        if (aliasMatch && enumValues?.has(aliasMatch)) {
            return aliasMatch;
        }

        const normalizedInput = normalizeEnumText(strValue);
        const matchedValue = enumValues
            ? [...enumValues].find((enumValue) => normalizeEnumText(enumValue) === normalizedInput)
            : null;

        if (!matchedValue) {
            throw new Error(`Enum degeri gecersiz (${field.name}): ${strValue}`);
        }
        return matchedValue;
    }

    switch (field.type) {
        case "String":
            return String(value);
        case "Int": {
            if (valueIsNullish) return null;
            const parsed = parseNumericCellValue(value);
            if (parsed === null || !Number.isFinite(parsed)) {
                throw new Error(`Int parse edilemedi (${field.name}): ${String(value)}`);
            }
            return Math.trunc(parsed);
        }
        case "BigInt": {
            if (valueIsNullish) return null;
            try {
                return BigInt(String(value));
            } catch {
                throw new Error(`BigInt parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Decimal": {
            if (valueIsNullish) return null;
            try {
                return new Prisma.Decimal(String(value));
            } catch {
                throw new Error(`Decimal parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Float": {
            if (valueIsNullish) return null;
            const parsed = parseNumericCellValue(value);
            if (parsed === null || !Number.isFinite(parsed)) {
                throw new Error(`Sayi parse edilemedi (${field.name}): ${String(value)}`);
            }
            return parsed;
        }
        case "Bytes":
            if (typeof value === "string") {
                return Buffer.from(value, "base64");
            }
            if (value instanceof Uint8Array) {
                return Buffer.from(value);
            }
            throw new Error(`Bytes parse edilemedi (${field.name}): ${String(value)}`);
        case "Boolean":
            if (valueIsNullish) return null;
            return parseBoolean(value);
        case "DateTime": {
            if (valueIsNullish) return null;
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value;
            }
            if (typeof value === "number") {
                const dt = excelDateToJSDate(value);
                if (Number.isNaN(dt.getTime())) throw new Error(`Tarih parse edilemedi (${field.name}).`);
                return dt;
            }
            const parsed = new Date(String(value));
            if (Number.isNaN(parsed.getTime())) throw new Error(`Tarih parse edilemedi (${field.name}): ${String(value)}`);
            return parsed;
        }
        case "Json":
            if (valueIsNullish) return null;
            if (typeof value === "string") {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        default:
            return value;
    }
}

function getWhereUnique(
    fields: PrismaField[],
    parsedRow: Record<string, unknown>,
    modelName?: string
) {
    if (modelName === "arac") {
        const plakaValue = parsedRow.plaka;
        if (plakaValue !== null && plakaValue !== undefined && plakaValue !== "") {
            return { where: { plaka: plakaValue } as WhereData, uniqueFieldName: "plaka" };
        }
    }

    const idField = fields.find((field) => field.isId);
    if (idField) {
        const idValue = parsedRow[idField.name];
        if (idValue !== null && idValue !== undefined && idValue !== "") {
            return { where: { [idField.name]: idValue } as WhereData, uniqueFieldName: idField.name };
        }
    }

    const uniqueFields = fields.filter((field) => field.isUnique && !field.isId);
    for (const uniqueField of uniqueFields) {
        const uniqueValue = parsedRow[uniqueField.name];
        if (uniqueValue !== null && uniqueValue !== undefined && uniqueValue !== "") {
            return { where: { [uniqueField.name]: uniqueValue } as WhereData, uniqueFieldName: uniqueField.name };
        }
    }

    return null;
}

function validateRequiredFields(fields: PrismaField[], parsedRow: Record<string, unknown>) {
    for (const field of fields) {
        if (field.isUpdatedAt) continue;
        if (!field.isRequired) continue;
        if (field.hasDefaultValue) continue;
        if (parsedRow[field.name] === null || parsedRow[field.name] === undefined || parsedRow[field.name] === "") {
            throw new Error(`Zorunlu alan bos birakilamaz: ${field.name}`);
        }
    }
}

function buildCreateData(fields: PrismaField[], parsedRow: Record<string, unknown>) {
    const data: Record<string, unknown> = {};

    for (const field of fields) {
        if (field.isUpdatedAt) continue;

        const value = parsedRow[field.name];
        if (value === undefined) {
            continue;
        }
        if (value === null && (field.hasDefaultValue || field.isId)) {
            continue;
        }

        data[field.name] = value;
    }

    return data;
}

function buildUpdateData(
    fields: PrismaField[],
    parsedRow: Record<string, unknown>,
    uniqueFieldName?: string
) {
    const data: Record<string, unknown> = {};

    for (const field of fields) {
        if (field.isId || field.isUpdatedAt || field.name === uniqueFieldName) continue;
        const value = parsedRow[field.name];
        if (value === undefined) continue;
        if (value === null && field.hasDefaultValue) continue;
        data[field.name] = value;
    }

    return data;
}

const ARAC_IMPORT_ALLOWED_COLUMNS = new Set([
    "plaka",
    "marka",
    "model",
    "yil",
    "bulunduguIl",
    "guncelKm",
    "bedel",
    "aciklama",
    "hgsNo",
    "ruhsatSeriNo",
    "durum",
    "kullaniciId",
    "sirketId",
    "calistigiKurum",
    "kategori",
    "saseNo",
    "deletedAt",
    "deletedBy",
]);

async function createAracWithoutPlakaRaw(tx: unknown, data: Record<string, unknown>) {
    const txRaw = tx as { $executeRaw?: (...args: unknown[]) => Promise<unknown> };
    if (typeof txRaw.$executeRaw !== "function") {
        throw new Error("Plakasiz arac importu icin SQL baglami bulunamadi.");
    }

    const entries = Object.entries(data).filter(([key, value]) => {
        if (!ARAC_IMPORT_ALLOWED_COLUMNS.has(key)) return false;
        if (value === undefined) return false;
        return true;
    });

    if (!entries.some(([key]) => key === "id")) {
        entries.push(["id", randomUUID()]);
    }
    if (!entries.some(([key]) => key === "plaka")) {
        entries.push(["plaka", null]);
    }

    const columnsSql = Prisma.join(entries.map(([key]) => Prisma.raw(`"${key}"`)));
    const valuesSql = Prisma.join(entries.map(([, value]) => (value === null ? Prisma.sql`NULL` : Prisma.sql`${value}`)));

    await txRaw.$executeRaw(
        Prisma.sql`INSERT INTO "Arac" (${columnsSql}) VALUES (${valuesSql})`
    );
}

function parseSelectedYil(value: string | null) {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) return null;
    return parsed;
}

function buildRequiredImportColumnGroups(fields: PrismaField[], exportColumns: ExportColumn[]) {
    const relationColumnByForeignKey = new Map<string, string>();
    for (const column of exportColumns) {
        if (column.type === "relationLookup") {
            relationColumnByForeignKey.set(column.foreignKeyFieldName, column.key);
        }
    }

    const requiredGroups: Array<{ fieldName: string; candidates: string[] }> = [];
    for (const field of fields) {
        if (field.isUpdatedAt) continue;
        if (!field.isRequired || field.hasDefaultValue) continue;

        if (shouldHideInternalField(field.name)) {
            if (field.name.endsWith("Id")) {
                const relationColumn = relationColumnByForeignKey.get(field.name);
                if (relationColumn) {
                    requiredGroups.push({
                        fieldName: field.name,
                        candidates: [relationColumn, field.name],
                    });
                }
            }
            continue;
        }

        requiredGroups.push({
            fieldName: field.name,
            candidates: [field.name],
        });
    }

    return requiredGroups;
}

function normalizeLookupString(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    return String(normalized).trim();
}

function normalizeAracPlaka(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    const text = String(normalized).replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    return text || null;
}

function normalizeAracSaseNo(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    const text = String(normalized).replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    return text || null;
}

async function findExistingNoPlateAracId(tx: unknown, createData: Record<string, unknown>) {
    const txQuery = tx as { $queryRaw?: (...args: unknown[]) => Promise<unknown> };
    if (typeof txQuery.$queryRaw !== "function") {
        return null;
    }

    const normalizedSaseNo = normalizeAracSaseNo(createData.saseNo);
    if (normalizedSaseNo) {
        const rows = await txQuery.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "saseNo" = ${normalizedSaseNo}
                ORDER BY "id" ASC
                LIMIT 1
            `
        );
        const id = rows?.[0]?.id;
        return typeof id === "string" && id.trim().length > 0 ? id : null;
    }

    const marka = typeof createData.marka === "string" ? createData.marka.trim() : "";
    const model = typeof createData.model === "string" ? createData.model.trim() : "";
    const yil = typeof createData.yil === "number" && Number.isFinite(createData.yil) ? createData.yil : null;
    if (!marka || !model || yil === null) {
        return null;
    }

    const sirketIdRaw = "sirketId" in createData ? createData.sirketId : undefined;
    const sirketId = typeof sirketIdRaw === "string" && sirketIdRaw.trim().length > 0 ? sirketIdRaw : null;

    const rows = sirketId
        ? await txQuery.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "marka" = ${marka}
                  AND "model" = ${model}
                  AND "yil" = ${yil}
                  AND "sirketId" = ${sirketId}
                ORDER BY "id" ASC
                LIMIT 1
            `
        )
        : await txQuery.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "marka" = ${marka}
                  AND "model" = ${model}
                  AND "yil" = ${yil}
                  AND "sirketId" IS NULL
                ORDER BY "id" ASC
                LIMIT 1
            `
        );

    const id = rows?.[0]?.id;
    return typeof id === "string" && id.trim().length > 0 ? id : null;
}

function sanitizeAracImportRow(parsedRow: Record<string, unknown>) {
    // Prisma dmmf runtime metadata'sı bazı alanlarda default bilgisini taşımayabiliyor.
    // Bu yüzden araçta default'u olan zorunlu alanlar boş gelirse null göndermeyip atlıyoruz.
    const nullableToUndefined: Array<keyof typeof parsedRow> = ["guncelKm", "durum", "kategori", "bulunduguIl"];
    for (const key of nullableToUndefined) {
        if (parsedRow[key] === null || parsedRow[key] === "") {
            parsedRow[key] = undefined;
        }
    }

    // Model yılı kolonu bazı Excel dosyalarında "-" veya boş gelebiliyor.
    // Arac.yil DB'de NOT NULL olduğu için güvenli bir fallback ile dolduruyoruz.
    if (parsedRow.yil === null || parsedRow.yil === undefined || parsedRow.yil === "") {
        parsedRow.yil = new Date().getFullYear();
    }
}

function buildRelationLookupWheres(modelName: string, rawValue: string) {
    const value = rawValue.trim();
    if (!value) return [];

    const wheres: WhereData[] = [{ id: value }];

    if (modelName === "Arac") {
        const slashParts = value.split("/").map((part) => part.trim()).filter(Boolean);
        if (slashParts.length >= 2) {
            wheres.push({
                AND: [
                    { plaka: slashParts[0] },
                    { saseNo: slashParts[1] },
                ],
            } as WhereData);
        }
        wheres.push({ plaka: value });
        wheres.push({ saseNo: value });
        return wheres;
    }

    if (modelName === "Kullanici") {
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const ad = parts[0];
            const soyad = parts.slice(1).join(" ");
            wheres.push({
                AND: [
                    { ad },
                    { soyad },
                ],
            } as WhereData);
        }
        wheres.push({ eposta: value });
        wheres.push({ tcNo: value });
        wheres.push({ ad: value });
        return wheres;
    }

    if (modelName === "Sirket") {
        wheres.push({ ad: value });
        return wheres;
    }

    wheres.push({ ad: value });
    wheres.push({ plaka: value });
    wheres.push({ eposta: value });
    return wheres;
}

async function resolveRelationValueToForeignKey(params: {
    tx: unknown;
    relationModelName: string;
    relationColumnKey: string;
    rawRelationValue: unknown;
    rowIndex: number;
    cache: Map<string, string>;
}) {
    const relationText = normalizeLookupString(params.rawRelationValue);
    if (!relationText) return null;

    const cacheKey = `${params.relationModelName}|${relationText}`;
    const cached = params.cache.get(cacheKey);
    if (cached) return cached;

    const relationDelegate = getModelDelegate(params.tx, lowerFirst(params.relationModelName));
    if (!relationDelegate?.findMany) {
        throw new Error(`Satir ${params.rowIndex + 2}: ${params.relationColumnKey} icin iliski modeli bulunamadi.`);
    }

    const whereCandidates = buildRelationLookupWheres(params.relationModelName, relationText);
    for (const where of whereCandidates) {
        const matches = await relationDelegate.findMany({
            where,
            select: { id: true },
            take: 2,
            orderBy: { id: "asc" },
        });

        if (matches.length === 1) {
            const id = matches[0]?.id;
            if (typeof id !== "string" || !id.trim()) continue;
            params.cache.set(cacheKey, id);
            return id;
        }

        if (matches.length > 1) {
            throw new Error(
                `Satir ${params.rowIndex + 2}: ${params.relationColumnKey} degeri birden fazla kayitla eslesti (${relationText}).`
            );
        }
    }

    throw new Error(`Satir ${params.rowIndex + 2}: ${params.relationColumnKey} icin eslesen kayit bulunamadi (${relationText}).`);
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ entity: string }> }
) {
    try {
        const role = await getCurrentUserRole();
        if (!role) {
            return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
        }
        if (role === "SOFOR") {
            return NextResponse.json({ error: "Excel dışa aktarma yetkiniz bulunmuyor." }, { status: 403 });
        }

        const { entity } = await context.params;
        const config = getEntityOrNull(entity);
        if (!config) {
            return NextResponse.json({ error: "Desteklenmeyen export modeli." }, { status: 404 });
        }

        const modelMeta = getModelMeta(config.prismaModel);
        if (!modelMeta) {
            return NextResponse.json({ error: "Model metadata bulunamadi." }, { status: 500 });
        }
        const fields = getColumnFields(modelMeta);
        const relationFieldByForeignKey = buildRelationFieldByForeignKeyMap(modelMeta);
        const exportColumns = buildExportColumns(fields, relationFieldByForeignKey, modelMeta.name);
        const columns = exportColumns.map((column) => column.key);

        const selectedSirketId = req.nextUrl.searchParams.get("sirket");
        const selectedYil = parseSelectedYil(req.nextUrl.searchParams.get("yil"));
        const scopedFilter = await getModelFilter(config.filterModel, selectedSirketId);
        const where =
            config.dateField && selectedYil
                ? withYilDateFilter((scopedFilter || {}) as Record<string, unknown>, config.dateField, selectedYil)
                : scopedFilter;

        const modelDelegate = getModelDelegate(prisma, config.prismaModel);
        if (!modelDelegate?.findMany) {
            return NextResponse.json({ error: "Model export icin uygun degil." }, { status: 400 });
        }

        const orderByField = fields.find((field) => field.isId)?.name || columns[0];
        const include = Object.fromEntries(
            [...relationFieldByForeignKey.entries()].map(([, relationField]) => [
                relationField.name,
                { select: buildRelationExportSelect(relationField.type) },
            ])
        );
        const rows = await modelDelegate.findMany({
            where: where ? (where as WhereData) : undefined,
            orderBy: orderByField ? { [orderByField]: "asc" } : undefined,
            include: Object.keys(include).length > 0 ? include : undefined,
        });

        const aktifZimmetByAracId = new Map<string, { adSoyad: string | null; sirketAd: string | null }>();
        if (config.prismaModel === "arac") {
            const aracIds = rows
                .map((row) => (typeof row.id === "string" ? row.id : null))
                .filter((id): id is string => Boolean(id));

            if (aracIds.length > 0) {
                const zimmetRows = await prisma.kullaniciZimmet.findMany({
                    where: {
                        aracId: { in: aracIds },
                        bitis: null,
                    },
                    orderBy: [{ aracId: "asc" }, { baslangic: "desc" }],
                    select: {
                        aracId: true,
                        kullanici: {
                            select: {
                                ad: true,
                                soyad: true,
                                sirket: { select: { ad: true } },
                            },
                        },
                    },
                });

                for (const row of zimmetRows) {
                    if (!row?.aracId || aktifZimmetByAracId.has(row.aracId)) continue;
                    const ad = (row.kullanici?.ad || "").trim();
                    const soyad = (row.kullanici?.soyad || "").trim();
                    const adSoyad = `${ad} ${soyad}`.trim() || null;
                    const sirketAd = row.kullanici?.sirket?.ad?.trim() || null;
                    aktifZimmetByAracId.set(row.aracId, { adSoyad, sirketAd });
                }
            }
        }

        const normalizedRows = rows.map((row) => {
            const output: Record<string, unknown> = {};
            for (const column of exportColumns) {
                if (column.type === "scalar") {
                    output[column.key] = toExportCell(row[column.fieldName]);
                    continue;
                }
                output[column.key] = toExportCell(relationDisplayValue(row[column.relationFieldName]));
            }
            if (config.prismaModel === "arac") {
                const rowId = typeof row.id === "string" ? row.id : "";
                const aktifZimmet = rowId ? aktifZimmetByAracId.get(rowId) : undefined;
                const kullaniciObj = row.kullanici as Record<string, unknown> | null | undefined;
                const kullaniciSirketObj = (kullaniciObj?.sirket || null) as Record<string, unknown> | null;
                const kullaniciAdSoyad = relationDisplayValue(kullaniciObj);
                const manualKullaniciFirma =
                    typeof row.calistigiKurum === "string" && row.calistigiKurum.trim().length > 0
                        ? row.calistigiKurum.trim()
                        : null;

                output.kullanici = toExportCell(kullaniciAdSoyad || aktifZimmet?.adSoyad || null);
                output.calistigiKurum = toExportCell(
                    manualKullaniciFirma ||
                    (typeof kullaniciSirketObj?.ad === "string" ? kullaniciSirketObj.ad : aktifZimmet?.sirketAd || null)
                );
            }
            return output;
        });
        const internalColumns =
            config.prismaModel === "arac"
                ? [...columns, "calistigiKurum", "aciklama", "bedel"].filter(
                    (value, index, arr) => arr.indexOf(value) === index
                )
                : columns;
        const finalColumns = applyExportProfile(config.prismaModel, internalColumns);
        const headerLabels = finalColumns.map((key) => getExportHeaderLabel(config.prismaModel, key));
        const exportRows = normalizedRows.map((row) => {
            const output: Record<string, unknown> = {};
            for (const key of finalColumns) {
                output[getExportHeaderLabel(config.prismaModel, key)] = row[key] ?? null;
            }
            return output;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: headerLabels });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
        const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const fileName = `${config.fileNamePrefix}-${stamp}.xlsx`;

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Excel export hatasi:", error);
        return NextResponse.json({ error: "Excel export islemi basarisiz oldu." }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ entity: string }> }
) {
    try {
        const role = await getCurrentUserRole();
        if (!role) {
            return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
        }
        if (role === "SOFOR") {
            return NextResponse.json({ error: "Excel import yetkiniz bulunmuyor." }, { status: 403 });
        }

        const { entity } = await context.params;
        const config = getEntityOrNull(entity);
        if (!config) {
            return NextResponse.json({ error: "Desteklenmeyen import modeli." }, { status: 404 });
        }
        if (config.filterModel === "sirket" && role !== "ADMIN") {
            return NextResponse.json({ error: "Şirket verisi import işlemi sadece admin yetkisi gerektirir." }, { status: 403 });
        }

        const modelMeta = getModelMeta(config.prismaModel);
        if (!modelMeta) {
            return NextResponse.json({ error: "Model metadata bulunamadi." }, { status: 500 });
        }
        const fields = getColumnFields(modelMeta);
        const relationFieldByForeignKey = buildRelationFieldByForeignKeyMap(modelMeta);
        const exportColumns = buildExportColumns(fields, relationFieldByForeignKey, modelMeta.name);
        const scalarImportColumns = exportColumns.filter((column): column is Extract<ExportColumn, { type: "scalar" }> => column.type === "scalar");
        const relationImportColumns = exportColumns.filter((column): column is Extract<ExportColumn, { type: "relationLookup" }> => column.type === "relationLookup");
        const requiredGroups = buildRequiredImportColumnGroups(fields, exportColumns);
        const enumMap = getEnumValueMap();

        const formData = await req.formData();
        const fileEntry = formData.get("file");
        if (!(fileEntry instanceof File)) {
            return NextResponse.json({ error: "Excel dosyasi bulunamadi." }, { status: 400 });
        }
        if (fileEntry.size > MAX_IMPORT_FILE_BYTES) {
            return NextResponse.json({ error: "Excel dosyasi cok buyuk. Maksimum dosya boyutu 10MB." }, { status: 413 });
        }

        const buffer = Buffer.from(await fileEntry.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return NextResponse.json({ error: "Excel dosyasinda sheet bulunamadi." }, { status: 400 });
        }

        const sheet = workbook.Sheets[firstSheetName];
        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: null,
            raw: true,
        });

        if (records.length === 0) {
            return NextResponse.json({ error: "Excel dosyasi bos." }, { status: 400 });
        }

        const firstRecord = records[0] || {};
        const sheetHeaders = extractSheetHeaders(sheet);
        const availableHeaders = new Set(
            (sheetHeaders.length > 0 ? sheetHeaders : Object.keys(firstRecord))
                .map((header) => String(header).trim())
                .filter((header) => header.length > 0)
        );
        if (availableHeaders.size === 0) {
            return NextResponse.json({ error: "Excel baslik satiri bulunamadi. Lutfen export edilen sablonu kullanin." }, { status: 400 });
        }
        const normalizedHeaderIndex = buildHeaderIndex([...availableHeaders]);
        const missingGroups = requiredGroups.filter((group) => {
            const groupCandidates = group.candidates.flatMap((candidate) =>
                getHeaderCandidates(config.prismaModel, candidate)
            );
            return !findHeaderByCandidates(availableHeaders, normalizedHeaderIndex, groupCandidates);
        });
        if (missingGroups.length > 0) {
            const missingLabel = missingGroups
                .map((group) =>
                    group.candidates.length === 1
                        ? getExportHeaderLabel(config.prismaModel, group.candidates[0])
                        : `${group.fieldName} (${group.candidates.map((candidate) => getExportHeaderLabel(config.prismaModel, candidate)).join(" veya ")})`
                )
                .join(", ");
            return NextResponse.json(
                {
                    error: `Eksik zorunlu sutun(lar): ${missingLabel}. Lutfen export edilen sablonu kullanin.`,
                },
                { status: 400 }
            );
        }

        const modelDelegate = getModelDelegate(prisma, config.prismaModel);
        if (!modelDelegate?.create) {
            return NextResponse.json({ error: "Model import icin uygun degil." }, { status: 400 });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;

        await prisma.$transaction(async (tx) => {
            const model = getModelDelegate(tx, config.prismaModel);
            if (!model?.create || !model?.update || !model?.findUnique || !model?.upsert) {
                throw new Error("Model import islemleri desteklenmiyor.");
            }
            const fieldsByName = new Map(fields.map((field) => [field.name, field]));
            const relationCache = new Map<string, string>();

            for (let index = 0; index < records.length; index += 1) {
                const record = records[index];
                const parsedRow: Record<string, unknown> = {};
                const rowHasAnyRawValue = hasAnyNonEmptyCell(record);
                let isCompletelyEmpty = true;
                const recordHeaders = Object.keys(record)
                    .map((header) => String(header))
                    .filter((header) => header.trim().length > 0);
                const availableRecordHeaders = new Set(recordHeaders);
                const normalizedRecordHeaderIndex = buildHeaderIndex(recordHeaders);

                for (const column of scalarImportColumns) {
                    const field = fieldsByName.get(column.fieldName);
                    if (!field) continue;

                    const header = resolveImportHeaderForRecord(
                        availableRecordHeaders,
                        normalizedRecordHeaderIndex,
                        availableHeaders,
                        normalizedHeaderIndex,
                        getHeaderCandidates(config.prismaModel, column.key)
                    );
                    if (!header) {
                        parsedRow[field.name] = undefined;
                        continue;
                    }

                    const rawValue = readRecordCellValue(record, header, normalizedRecordHeaderIndex);
                    const parsedValue = coerceValue(field, rawValue, enumMap);
                    parsedRow[field.name] = parsedValue;
                    if (parsedValue !== null && parsedValue !== undefined && parsedValue !== "") {
                        isCompletelyEmpty = false;
                    }
                }

                for (const column of relationImportColumns) {
                    const foreignKeyField = fieldsByName.get(column.foreignKeyFieldName);
                    if (!foreignKeyField) continue;

                    const rawForeignKeyHeader = resolveImportHeaderForRecord(
                        availableRecordHeaders,
                        normalizedRecordHeaderIndex,
                        availableHeaders,
                        normalizedHeaderIndex,
                        getHeaderCandidates(config.prismaModel, foreignKeyField.name)
                    );
                    if (rawForeignKeyHeader) {
                        const rawValue = readRecordCellValue(record, rawForeignKeyHeader, normalizedRecordHeaderIndex);
                        const parsedValue = coerceValue(foreignKeyField, rawValue, enumMap);
                        parsedRow[foreignKeyField.name] = parsedValue;
                        if (parsedValue !== null && parsedValue !== undefined && parsedValue !== "") {
                            isCompletelyEmpty = false;
                        }
                        continue;
                    }

                    const relationHeader = resolveImportHeaderForRecord(
                        availableRecordHeaders,
                        normalizedRecordHeaderIndex,
                        availableHeaders,
                        normalizedHeaderIndex,
                        getHeaderCandidates(
                            config.prismaModel,
                            column.key,
                            getRelationImportHeaderAliases(config.prismaModel, foreignKeyField.name)
                        )
                    );
                    const hasRelationHeader = Boolean(relationHeader);
                    if (!hasRelationHeader) {
                        parsedRow[foreignKeyField.name] = undefined;
                        continue;
                    }

                    const relationValue = normalizeCell(
                        readRecordCellValue(record, relationHeader, normalizedRecordHeaderIndex)
                    );
                    if (relationValue === null) {
                        parsedRow[foreignKeyField.name] = null;
                        continue;
                    }

                    const resolvedForeignKey = await resolveRelationValueToForeignKey({
                        tx,
                        relationModelName: column.relationModelName,
                        relationColumnKey: column.key,
                        rawRelationValue: relationValue,
                        rowIndex: index,
                        cache: relationCache,
                    });
                    parsedRow[foreignKeyField.name] = coerceValue(foreignKeyField, resolvedForeignKey, enumMap);
                    if (resolvedForeignKey !== null && resolvedForeignKey !== undefined && resolvedForeignKey !== "") {
                        isCompletelyEmpty = false;
                    }
                }

                if (config.prismaModel === "arac" && "plaka" in parsedRow) {
                    parsedRow.plaka = normalizeAracPlaka(parsedRow.plaka);
                    if ("saseNo" in parsedRow) {
                        parsedRow.saseNo = normalizeAracSaseNo(parsedRow.saseNo);
                    }
                    sanitizeAracImportRow(parsedRow);
                }

                if (isCompletelyEmpty) {
                    if (rowHasAnyRawValue) {
                        throw new Error(
                            `Satir ${index + 2}: Sutun eslestirme hatasi. Dolu satirdaki veriler import alanlarina eslesmedi; sablon basliklarini degistirmeden tekrar deneyin.`
                        );
                    }
                    skipped += 1;
                    continue;
                }

                try {
                    validateRequiredFields(fields, parsedRow);
                } catch (validationError) {
                    throw new Error(`Satir ${index + 2}: ${(validationError as Error).message}`);
                }

                const whereUnique = getWhereUnique(fields, parsedRow, config.prismaModel);
                const createData = buildCreateData(fields, parsedRow);
                const updateData = buildUpdateData(fields, parsedRow, whereUnique?.uniqueFieldName);

                if (whereUnique) {
                    const existedBefore = await model.findUnique({
                        where: whereUnique.where,
                        select: { [whereUnique.uniqueFieldName]: true },
                    });

                    if (existedBefore) {
                        if (config.prismaModel === "arac") {
                            updateData.deletedAt = null;
                            updateData.deletedBy = null;
                        }
                        await model.update({
                            where: whereUnique.where,
                            data: updateData,
                        });
                        updated += 1;
                    } else {
                        if (config.prismaModel === "arac") {
                            createData.deletedAt = null;
                            createData.deletedBy = null;
                        }
                        await model.create({
                            data: createData,
                        });
                        created += 1;
                    }
                } else {
                    if (
                        config.prismaModel === "arac" &&
                        (createData.plaka === null || createData.plaka === undefined || createData.plaka === "")
                    ) {
                        const existingNoPlateId = await findExistingNoPlateAracId(tx, createData);

                        if (typeof existingNoPlateId === "string" && existingNoPlateId.trim().length > 0) {
                            updateData.deletedAt = null;
                            updateData.deletedBy = null;
                            await model.update({
                                where: { id: existingNoPlateId },
                                data: updateData,
                            });
                            updated += 1;
                            continue;
                        }

                        createData.deletedAt = null;
                        createData.deletedBy = null;
                        await createAracWithoutPlakaRaw(tx, createData);
                        created += 1;
                        continue;
                    }

                    if (
                        config.prismaModel === "arac" &&
                        typeof createData.plaka === "string" &&
                        createData.plaka.trim() !== ""
                    ) {
                        const plaka = normalizeAracPlaka(createData.plaka);
                        if (plaka) {
                            createData.plaka = plaka;
                            updateData.plaka = plaka;
                            const existedBefore = await model.findUnique({
                                where: { plaka },
                                select: { plaka: true },
                            });
                            if (existedBefore) {
                                if (config.prismaModel === "arac") {
                                    updateData.deletedAt = null;
                                    updateData.deletedBy = null;
                                }
                                await model.update({
                                    where: { plaka },
                                    data: updateData,
                                });
                                updated += 1;
                            } else {
                                if (config.prismaModel === "arac") {
                                    createData.deletedAt = null;
                                    createData.deletedBy = null;
                                }
                                await model.create({
                                    data: createData,
                                });
                                created += 1;
                            }
                            continue;
                        }
                    }

                    try {
                        await model.create({ data: createData });
                        created += 1;
                    } catch (createError) {
                        const createMessage = String((createError as Error)?.message || "");
                        const plakaUniqueFailed =
                            createMessage.includes("Unique constraint failed") &&
                            createMessage.includes("plaka");

                        if (
                            config.prismaModel === "arac" &&
                            plakaUniqueFailed &&
                            createData.plaka !== null &&
                            createData.plaka !== undefined
                        ) {
                            const plaka = normalizeAracPlaka(createData.plaka);
                            if (!plaka) {
                                throw createError;
                            }
                            createData.plaka = plaka;
                            updateData.plaka = plaka;
                            const existedBefore = await model.findUnique({
                                where: { plaka },
                                select: { plaka: true },
                            });
                            if (existedBefore) {
                                if (config.prismaModel === "arac") {
                                    updateData.deletedAt = null;
                                    updateData.deletedBy = null;
                                }
                                await model.update({
                                    where: { plaka },
                                    data: updateData,
                                });
                                updated += 1;
                            } else {
                                if (config.prismaModel === "arac") {
                                    createData.deletedAt = null;
                                    createData.deletedBy = null;
                                }
                                await model.create({
                                    data: createData,
                                });
                                created += 1;
                            }
                            continue;
                        }

                        throw createError;
                    }
                }
            }
        });

        if (created === 0 && updated === 0 && skipped === records.length) {
            return NextResponse.json(
                {
                    error: "Dosyada islenecek veri bulunamadi. Tum satirlar bos gorunuyor; lutfen sablona en az bir dolu satir ekleyin.",
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            created,
            updated,
            skipped,
            total: records.length,
        });
    } catch (error) {
        console.error("Excel import hatasi:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = Array.isArray(error.meta?.target)
                ? error.meta?.target.join(", ")
                : String(error.meta?.target || "benzersiz alan");
            return NextResponse.json(
                { error: `Ayni degerle mevcut kayit var (${target}). Lutfen tekrar eden satirlari kontrol edin.` },
                { status: 400 }
            );
        }
        const message = String((error as Error)?.message || "");
        if (message.includes("Sutun eslestirme hatasi")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        if (message.includes("Unique constraint failed") && message.includes("plaka")) {
            return NextResponse.json(
                { error: "Ayni plaka ile mevcut kayit var. Import satiri mevcut kayit olarak guncellenecek sekilde duzenlendi; lutfen tekrar deneyin." },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: (error as Error)?.message || "Excel import islemi basarisiz oldu." },
            { status: 500 }
        );
    }
}
