export const KIRALIK_SIRKET_OPTION_VALUE = "__KIRALIK__";
export const KIRALIK_SIRKET_ADI = "Kiralık";

export function isKiralikSirketName(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return false;
    return text.localeCompare(KIRALIK_SIRKET_ADI, "tr-TR", { sensitivity: "base" }) === 0;
}
