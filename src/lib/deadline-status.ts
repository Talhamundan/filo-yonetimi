import { differenceInCalendarDays } from "date-fns";

export type DeadlineStatus = "GECIKTI" | "KRITIK" | "YAKLASTI" | "GECERLI";

export const DEADLINE_STATUS_CLASS: Record<DeadlineStatus, string> = {
    GECIKTI: "bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none",
    KRITIK: "bg-orange-100 text-orange-800 hover:bg-orange-200 border-0 shadow-none",
    YAKLASTI: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none",
    GECERLI: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none",
};

export function getDaysLeft(targetDate: Date | string | null | undefined, baseDate = new Date()) {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    if (Number.isNaN(target.getTime())) return null;
    return differenceInCalendarDays(target, baseDate);
}

export function getDeadlineStatus(daysLeft: number): DeadlineStatus {
    if (daysLeft < 0) return "GECIKTI";
    if (daysLeft <= 15) return "KRITIK";
    if (daysLeft <= 30) return "YAKLASTI";
    return "GECERLI";
}

export function getDeadlineLabel(status: DeadlineStatus, daysLeft: number) {
    switch (status) {
        case "GECIKTI":
            return "Gecikti";
        case "KRITIK":
            return `Kritik (${daysLeft} Gün)`;
        case "YAKLASTI":
            return `Yaklaşıyor (${daysLeft} Gün)`;
        case "GECERLI":
        default:
            return "Geçerli";
    }
}

export function getDeadlineBadgeConfig(daysLeft: number) {
    const status = getDeadlineStatus(daysLeft);
    return {
        status,
        label: getDeadlineLabel(status, daysLeft),
        className: DEADLINE_STATUS_CLASS[status],
    };
}

