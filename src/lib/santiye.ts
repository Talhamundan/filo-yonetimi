export function normalizeSantiyeText(value: unknown) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleUpperCase("tr-TR");
}

export function normalizeSantiyeList(values: unknown[]) {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of values || []) {
        const normalized = normalizeSantiyeText(value);
        if (!normalized) continue;
        const key = normalized.toLocaleLowerCase("tr-TR");
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }

    return result;
}

export function parseSantiyeTextInput(value: unknown) {
    const raw = String(value || "");
    const tokens = raw
        .split(/\r?\n|,|;|\|/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return normalizeSantiyeList(tokens);
}

export function serializeSantiyeList(values: unknown[]) {
    return normalizeSantiyeList(values).join("\n");
}
