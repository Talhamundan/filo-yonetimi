type SelectedAracInfoData = {
    plaka?: string | null;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
    guncelKm?: number | null;
};

const formatIl = (il?: string | null) => {
    if (!il) return "-";
    return il.split("_").join(" ");
};

function formatNumber(value: unknown, fallback = "-") {
    if (value === null || value === undefined || value === "") return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue.toLocaleString("tr-TR") : fallback;
}

export default function SelectedAracInfo({ arac }: { arac?: SelectedAracInfoData | null }) {
    if (!arac) return null;
    const kmText = arac.guncelKm != null ? `${formatNumber(arac.guncelKm)} km` : "-";

    return (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500 mb-1">Seçilen Araç</p>
            <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                    <span className="text-slate-500">Plaka:</span>{" "}
                    <span className="font-semibold text-slate-800 font-mono break-words">{(arac.plaka || "-").trim() || "-"}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-slate-500">Şantiye:</span>{" "}
                    <span className="font-semibold text-slate-800 break-words">{formatIl(arac.bulunduguIl)}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-slate-500">Araç:</span>{" "}
                    <span className="font-semibold text-slate-800 break-words">{[arac.marka, arac.model].filter(Boolean).join(" ") || "-"}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-slate-500">Güncel KM:</span>{" "}
                    <span className="font-semibold text-slate-800 font-mono break-words">{kmText}</span>
                </div>
            </div>
        </div>
    );
}
