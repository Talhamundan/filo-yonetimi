export function toDateTimeLocalInput(value: string | Date | null | undefined) {
    if (!value) return "";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
}

export function nowDateTimeLocal() {
    return toDateTimeLocalInput(new Date());
}
