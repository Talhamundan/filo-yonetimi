import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
    | { key: string; type: "relation"; relationFieldName: string };
type ModelDelegate = {
    findMany?: (args?: {
        where?: WhereData;
        orderBy?: Record<string, "asc" | "desc">;
        include?: Record<string, unknown>;
    }) => Promise<RowData[]>;
    create?: (args: { data: RowData }) => Promise<unknown>;
    upsert?: (args: { where: WhereData; create: RowData; update: RowData }) => Promise<unknown>;
    findUnique?: (args: { where: WhereData; select: Record<string, boolean> }) => Promise<RowData | null>;
};

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
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

function shouldHideInternalExportField(fieldName: string) {
    if (fieldName === "id" || fieldName === "sifre") return true;
    if (fieldName === "deletedAt" || fieldName === "deletedBy") return true;
    if (fieldName.endsWith("Id")) return true;
    return false;
}

function buildRelationDisplaySelect(modelName: string) {
    const modelMeta = Prisma.dmmf.datamodel.models.find((model) => model.name === modelName);
    if (!modelMeta) {
        return { id: true };
    }

    const scalarFields = modelMeta.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
    const scalarFieldNames = new Set(scalarFields.map((field) => field.name));
    const preferredByModel: Record<string, string[]> = {
        Arac: ["plaka", "saseNo", "marka", "model"],
        Kullanici: ["ad", "soyad", "eposta"],
        Sirket: ["ad"],
    };
    const preferred = preferredByModel[modelName] ?? ["ad", "plaka", "adSoyad", "eposta"];
    const selected = preferred.filter((name) => scalarFieldNames.has(name));

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
    relationFieldByForeignKey: Map<string, PrismaField>
) {
    const exportColumns: ExportColumn[] = [];
    const usedKeys = new Set<string>();

    for (const field of fields) {
        if (shouldHideInternalExportField(field.name)) {
            if (field.name.endsWith("Id")) {
                const relationField = relationFieldByForeignKey.get(field.name);
                if (!relationField) continue;
                const key = getExportColumnKeyForRelationId(field.name, usedKeys);
                usedKeys.add(key);
                exportColumns.push({
                    key,
                    type: "relation",
                    relationFieldName: relationField.name,
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

function getEnumValueMap() {
    const map = new Map<string, Set<string>>();
    for (const enumType of Prisma.dmmf.datamodel.enums) {
        map.set(enumType.name, new Set(enumType.values.map((value) => value.name)));
    }
    return map;
}

function coerceValue(
    field: PrismaField,
    rawValue: unknown,
    enumMap: ReturnType<typeof getEnumValueMap>
) {
    const value = normalizeCell(rawValue);
    if (value === null) return null;

    if (field.kind === "enum") {
        const enumValues = enumMap.get(field.type);
        const strValue = String(value);
        if (!enumValues?.has(strValue)) {
            throw new Error(`Enum degeri gecersiz (${field.name}): ${strValue}`);
        }
        return strValue;
    }

    switch (field.type) {
        case "String":
            return String(value);
        case "Int": {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) throw new Error(`Int parse edilemedi (${field.name}): ${String(value)}`);
            return Math.trunc(parsed);
        }
        case "BigInt": {
            try {
                return BigInt(String(value));
            } catch {
                throw new Error(`BigInt parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Decimal": {
            try {
                return new Prisma.Decimal(String(value));
            } catch {
                throw new Error(`Decimal parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Float": {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) throw new Error(`Sayi parse edilemedi (${field.name}): ${String(value)}`);
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
            return parseBoolean(value);
        case "DateTime": {
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
    parsedRow: Record<string, unknown>
) {
    const idField = fields.find((field) => field.isId);
    if (idField) {
        const idValue = parsedRow[idField.name];
        if (idValue !== null && idValue !== undefined && idValue !== "") {
            return { where: { [idField.name]: idValue } as WhereData, uniqueFieldName: idField.name };
        }
    }

    const singleUniqueField = fields.find((field) => field.isUnique);
    if (singleUniqueField) {
        const uniqueValue = parsedRow[singleUniqueField.name];
        if (uniqueValue !== null && uniqueValue !== undefined && uniqueValue !== "") {
            return { where: { [singleUniqueField.name]: uniqueValue } as WhereData, uniqueFieldName: singleUniqueField.name };
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
        if (value === undefined || value === null) {
            if (field.hasDefaultValue || field.isId) {
                continue;
            }
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

function parseSelectedYil(value: string | null) {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) return null;
    return parsed;
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
        const objectFields = getObjectFields(modelMeta);
        const relationFieldByForeignKey = new Map<string, PrismaField>();
        for (const objectField of objectFields) {
            for (const foreignKeyField of getRelationFromFields(objectField)) {
                relationFieldByForeignKey.set(foreignKeyField, objectField);
            }
        }
        const exportColumns = buildExportColumns(fields, relationFieldByForeignKey);
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
                { select: buildRelationDisplaySelect(relationField.type) },
            ])
        );
        const rows = await modelDelegate.findMany({
            where: where ? (where as WhereData) : undefined,
            orderBy: orderByField ? { [orderByField]: "asc" } : undefined,
            include: Object.keys(include).length > 0 ? include : undefined,
        });

        const normalizedRows = rows.map((row) => {
            const output: Record<string, unknown> = {};
            for (const column of exportColumns) {
                if (column.type === "scalar") {
                    output[column.key] = toExportCell(row[column.fieldName]);
                    continue;
                }
                output[column.key] = toExportCell(relationDisplayValue(row[column.relationFieldName]));
            }
            return output;
        });

        const worksheet = XLSX.utils.json_to_sheet(normalizedRows, { header: columns });
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
        const columns = fields.map((field) => field.name);
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
        const missingColumns = columns.filter((column) => !(column in firstRecord));
        if (missingColumns.length > 0) {
            return NextResponse.json(
                {
                    error: `Eksik sutun(lar): ${missingColumns.join(", ")}. Lutfen export edilen sablonu kullanin.`,
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
            if (!model?.create || !model?.findUnique || !model?.upsert) {
                throw new Error("Model import islemleri desteklenmiyor.");
            }

            for (let index = 0; index < records.length; index += 1) {
                const record = records[index];
                const parsedRow: Record<string, unknown> = {};
                let isCompletelyEmpty = true;

                for (const field of fields) {
                    const parsedValue = coerceValue(field, record[field.name], enumMap);
                    parsedRow[field.name] = parsedValue;
                    if (parsedValue !== null && parsedValue !== undefined && parsedValue !== "") {
                        isCompletelyEmpty = false;
                    }
                }

                if (isCompletelyEmpty) {
                    skipped += 1;
                    continue;
                }

                try {
                    validateRequiredFields(fields, parsedRow);
                } catch (validationError) {
                    throw new Error(`Satir ${index + 2}: ${(validationError as Error).message}`);
                }

                const whereUnique = getWhereUnique(fields, parsedRow);
                const createData = buildCreateData(fields, parsedRow);
                const updateData = buildUpdateData(fields, parsedRow, whereUnique?.uniqueFieldName);

                if (whereUnique) {
                    const existedBefore = await model.findUnique({
                        where: whereUnique.where,
                        select: { [whereUnique.uniqueFieldName]: true },
                    });

                    await model.upsert({
                        where: whereUnique.where,
                        create: createData,
                        update: updateData,
                    });

                    if (existedBefore) {
                        updated += 1;
                    } else {
                        created += 1;
                    }
                } else {
                    await model.create({ data: createData });
                    created += 1;
                }
            }
        });

        return NextResponse.json({
            success: true,
            created,
            updated,
            skipped,
            total: records.length,
        });
    } catch (error) {
        console.error("Excel import hatasi:", error);
        return NextResponse.json(
            { error: (error as Error)?.message || "Excel import islemi basarisiz oldu." },
            { status: 500 }
        );
    }
}
