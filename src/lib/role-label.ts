const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    YETKILI: "Yetkili",
    TEKNIK: "Teknik",
    SOFOR: "Personel",
    PERSONEL: "Personel",
};

export function getRoleLabel(role: string | null | undefined) {
    if (!role) return "-";
    const normalized = role.toUpperCase();
    return ROLE_LABELS[normalized] ?? role;
}

