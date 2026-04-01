type AracOptionLabelInput = {
    plaka?: string | null;
    marka?: string | null;
    model?: string | null;
    durum?: string | null;
};

const MAX_NATIVE_SELECT_LABEL_LENGTH = 52;

function truncateNativeSelectLabel(value: string, maxLength = MAX_NATIVE_SELECT_LABEL_LENGTH): string {
    const normalized = value.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatAracDurumLabel(durum?: string | null): string {
    switch ((durum || "").toUpperCase()) {
        case "AKTIF":
            return "aktif";
        case "BOSTA":
            return "boşta";
        case "SERVISTE":
            return "serviste";
        case "ARIZALI":
            return "arızalı";
        case "YEDEK":
            return "yedek";
        default: {
            const normalized = (durum || "").trim();
            if (!normalized) return "aktif/boşta";
            return normalized.replace(/_/g, " ").toLocaleLowerCase("tr-TR");
        }
    }
}

export function formatAracOptionLabel(arac: AracOptionLabelInput): string {
    const plaka = (arac.plaka || "-").trim() || "-";
    const markaModel = `${(arac.marka || "").trim()} ${(arac.model || "").trim()}`.trim();
    const durumLabel = formatAracDurumLabel(arac.durum);
    const label = markaModel
        ? `(${durumLabel}) ${plaka} - ${markaModel}`
        : `(${durumLabel}) ${plaka}`;
    return truncateNativeSelectLabel(label);
}
