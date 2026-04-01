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

export default function SelectedAracInfo({ arac }: { arac?: SelectedAracInfoData | null }) {
    if (!arac) return null;
    const kmText =
        typeof arac.guncelKm === "number" && Number.isFinite(arac.guncelKm)
            ? `${arac.guncelKm.toLocaleString("tr-TR")} km`
            : "-";

    return (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500 mb-1">Seçilen Araç</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                    <span className="text-slate-500">Plaka:</span>{" "}
                    <span className="font-semibold text-slate-800 font-mono">{(arac.plaka || "-").trim() || "-"}</span>
                </div>
                <div>
                    <span className="text-slate-500">Şehir:</span>{" "}
                    <span className="font-semibold text-slate-800">{formatIl(arac.bulunduguIl)}</span>
                </div>
                <div>
                    <span className="text-slate-500">Araç:</span>{" "}
                    <span className="font-semibold text-slate-800">{[arac.marka, arac.model].filter(Boolean).join(" ") || "-"}</span>
                </div>
                <div>
                    <span className="text-slate-500">Güncel KM:</span>{" "}
                    <span className="font-semibold text-slate-800 font-mono">{kmText}</span>
                </div>
            </div>
        </div>
    );
}
