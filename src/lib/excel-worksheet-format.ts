import * as XLSX from "xlsx";

function normalizeHeader(value: unknown) {
    return String(value ?? "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/\s+/g, " ");
}

function coerceYearCellValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    const digits = String(value ?? "").replace(/[^\d]/g, "");
    if (!digits) return null;

    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return null;

    return Math.trunc(parsed);
}

export function applyExcelWorksheetFormats(
    worksheet: XLSX.WorkSheet,
    options: { entityKey?: string; headers?: string[] } = {}
) {
    if (!["arac", "kiralikArac", "taseronArac"].includes(options.entityKey || "")) return;

    const ref = worksheet["!ref"];
    if (!ref) return;

    const range = XLSX.utils.decode_range(ref);
    const headers = options.headers?.length
        ? options.headers
        : Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => {
            const address = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index });
            return String(worksheet[address]?.v ?? "");
        });

    const modelYearColumnIndexes = headers
        .map((header, index) => ({ header: normalizeHeader(header), index: range.s.c + index }))
        .filter(({ header }) => header === "model yili")
        .map(({ index }) => index);

    for (const columnIndex of modelYearColumnIndexes) {
        for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
            const cell = worksheet[address];
            if (!cell || cell.v === null || typeof cell.v === "undefined" || cell.v === "") continue;

            const year = coerceYearCellValue(cell.v);
            if (year === null) continue;

            cell.t = "n";
            cell.v = year;
            cell.z = "0";
            delete cell.w;
        }
    }
}
