"use client";

import * as React from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "./button";
import type { ExcelEntityKey } from "@/lib/excel-entities";

type ExcelToolbarOption = {
    entity: ExcelEntityKey;
    label: string;
};

type ExcelTransferToolbarProps = {
    options: ExcelToolbarOption[];
    className?: string;
};

function getDownloadFileName(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) return fallback;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            return utf8Match[1];
        }
    }

    const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (basicMatch?.[1]) return basicMatch[1];

    return fallback;
}

async function getErrorMessage(response: Response, fallback: string) {
    try {
        const json = await response.json();
        if (typeof json?.error === "string" && json.error.trim().length > 0) {
            return json.error;
        }
    } catch {
        // noop
    }
    return fallback;
}

export default function ExcelTransferToolbar({ options, className }: ExcelTransferToolbarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);
    const [selectedEntity, setSelectedEntity] = React.useState<ExcelEntityKey>(options[0]?.entity ?? "arac");

    if (!options.length) return null;

    const selectedSirket = searchParams.get("sirket");
    const selectedYil = searchParams.get("yil");
    const params = new URLSearchParams();
    if (selectedSirket) params.set("sirket", selectedSirket);
    if (selectedYil) params.set("yil", selectedYil);
    const query = params.toString();
    const endpoint = `/api/excel/${selectedEntity}${query ? `?${query}` : ""}`;

    const handleExport = async () => {
        if (isExporting || isImporting) return;
        setIsExporting(true);
        try {
            const response = await fetch(endpoint, { method: "GET" });
            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Excel dışa aktarma başarısız oldu."));
            }

            const blob = await response.blob();
            const fallbackName = `${selectedEntity}-${new Date().toISOString().slice(0, 10)}.xlsx`;
            const fileName = getDownloadFileName(response.headers.get("content-disposition"), fallbackName);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Excel dışa aktarma tamamlandı.");
        } catch (error) {
            toast.error("Excel dışa aktarma başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const errorMessage =
                    typeof payload?.error === "string" && payload.error.trim().length > 0
                        ? payload.error
                        : "Excel içe aktarma başarısız oldu.";
                throw new Error(errorMessage);
            }

            toast.success("Excel içe aktarma tamamlandı.", {
                description: `Toplam ${payload.total} satır işlendi • ${payload.created} eklendi • ${payload.updated} güncellendi • ${payload.skipped} atlandı`,
            });
            router.refresh();
        } catch (error) {
            toast.error("Excel içe aktarma başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            });
        } finally {
            event.target.value = "";
            setIsImporting(false);
        }
    };

    return (
        <div className={`flex w-full items-center justify-end gap-2 overflow-x-auto pb-1 ${className || ""}`}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFileChange}
            />
            <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value as ExcelEntityKey)}
                className="h-10 min-w-[140px] shrink-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
                {options.map((option) => (
                    <option key={option.entity} value={option.entity}>
                        {option.label}
                    </option>
                ))}
            </select>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 min-w-[120px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={handleExport}
                disabled={isExporting || isImporting}
            >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Dışa Aktar
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 min-w-[120px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || isExporting}
            >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                İçe Aktar
            </Button>
        </div>
    );
}
