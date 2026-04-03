export function normalizeSearchText(value: string) {
    return value
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function splitSearchTokens(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split(/\s+/).filter(Boolean);
}

export function matchesTokenizedSearch(haystack: string, query: string) {
    const tokens = splitSearchTokens(query).map((token) => normalizeSearchText(token)).filter(Boolean);
    if (tokens.length === 0) return true;
    const normalizedHaystack = normalizeSearchText(haystack);
    const compactHaystack = normalizedHaystack.replace(/\s+/g, "");
    return tokens.every((token) => {
        if (normalizedHaystack.includes(token)) return true;
        const compactToken = token.replace(/\s+/g, "");
        return compactToken.length > 0 && compactHaystack.includes(compactToken);
    });
}

export function buildTokenizedOrWhere(
    query: string,
    buildTokenClauses: (token: string) => Array<Record<string, unknown>>
) {
    const tokens = splitSearchTokens(query);
    if (tokens.length === 0) return null;
    return {
        AND: tokens.map((token) => ({
            OR: buildTokenClauses(token),
        })),
    } as Record<string, unknown>;
}
