export function normalizePlate(value: string) {
    return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
}

export function ensureRequiredText(value: string | null | undefined, fieldLabel: string) {
    const normalized = (value || "").trim();
    if (!normalized) {
        throw new Error(`${fieldLabel} zorunludur.`);
    }
    return normalized;
}

export function ensureValidDate(value: string | Date, fieldLabel: string) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${fieldLabel} gecersiz.`);
    }
    return date;
}

export function ensureDateOrder(start: Date, end: Date, startLabel: string, endLabel: string) {
    if (start.getTime() > end.getTime()) {
        throw new Error(`${startLabel}, ${endLabel} tarihinden sonra olamaz.`);
    }
}

export function ensureNonNegativeAmount(value: number, fieldLabel = "Tutar") {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${fieldLabel} 0 veya daha buyuk olmali.`);
    }
    return Number(value);
}

export function ensurePositiveAmount(value: number, fieldLabel = "Tutar") {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${fieldLabel} 0'dan buyuk olmali.`);
    }
    return Number(value);
}

export function ensureYearValue(value: number, fieldLabel: string) {
    if (!Number.isInteger(value) || value < 1950 || value > 2100) {
        throw new Error(`${fieldLabel} gecersiz.`);
    }
    return value;
}
