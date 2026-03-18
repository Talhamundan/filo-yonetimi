const trAlphaNumericCollator = new Intl.Collator("tr-TR", {
    numeric: true,
    sensitivity: "base",
});

export function compareAlphaNumeric(left: string | null | undefined, right: string | null | undefined) {
    return trAlphaNumericCollator.compare((left || "").trim(), (right || "").trim());
}

export function sortByTextValue<T>(list: T[], getText: (item: T) => string | null | undefined) {
    return [...list].sort((a, b) => compareAlphaNumeric(getText(a), getText(b)));
}
