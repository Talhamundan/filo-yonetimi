import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "application/x-pdf", "image/jpeg", "image/png"]);
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
    "application/pdf": "pdf",
    "application/x-pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
};
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

const DOCUMENT_SLUG_BY_TYPE: Record<string, string> = {
    RUHSAT: "ruhsat",
    SIGORTA: "trafik-sigortasi",
    KASKO: "kasko-policesi",
    MUAYENE: "muayene-evragi",
    CEZA_MAKBUZU: "ceza-makbuzu",
    SERVIS_FATURA: "servis-faturasi",
    DIGER: "evrak",
};

export function getUploadsRoot() {
    return process.env.UPLOADS_DIR || "/uploads";
}

export function sanitizePlateFolder(plaka: string | null | undefined) {
    const normalized = String(plaka || "PLAKASIZ")
        .toLocaleUpperCase("tr-TR")
        .replace(/[^A-Z0-9]/g, "");
    return normalized || "PLAKASIZ";
}

function slugify(value: string) {
    return value
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function todayStamp() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function pathExists(filePath: string) {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function saveDocumentFile(params: {
    file: File;
    plaka: string | null | undefined;
    tur: string;
    ad?: string | null;
}) {
    const file = params.file;
    if (!file || file.size <= 0) {
        throw new Error("Dosya bulunamadı.");
    }
    if (file.size > MAX_DOCUMENT_FILE_BYTES) {
        throw new Error("Dosya boyutu en fazla 10MB olmalıdır.");
    }
    const originalExt = path.extname(file.name).replace(".", "").toLowerCase();
    const fileTypeAllowed = file.type ? ALLOWED_MIME_TYPES.has(file.type) : false;
    const extensionAllowed = ALLOWED_EXTENSIONS.has(originalExt);
    if (!fileTypeAllowed && !extensionAllowed) {
        throw new Error("Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir.");
    }

    const plateFolder = sanitizePlateFolder(params.plaka);
    const targetDir = path.join(getUploadsRoot(), "araclar", plateFolder);
    await mkdir(targetDir, { recursive: true });

    const ext = EXTENSION_BY_MIME_TYPE[file.type] || (originalExt === "jpeg" ? "jpg" : originalExt) || "bin";
    const typeSlug = DOCUMENT_SLUG_BY_TYPE[params.tur] || slugify(params.tur) || "evrak";
    const nameSlug = slugify(params.ad || "") || typeSlug;
    const baseName = `${typeSlug === "evrak" ? nameSlug : typeSlug}-${todayStamp()}`;
    let safeFileName = `${baseName}.${ext}`;
    let targetPath = path.join(targetDir, safeFileName);

    if (await pathExists(targetPath)) {
        safeFileName = `${baseName}-${randomUUID().slice(0, 8)}.${ext}`;
        targetPath = path.join(targetDir, safeFileName);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer, { flag: "wx" });

    const relativePath = `/uploads/araclar/${plateFolder}/${safeFileName}`;
    return {
        originalName: file.name,
        fileName: safeFileName,
        mimeType: file.type,
        size: file.size,
        path: relativePath,
    };
}

export function resolveStoredDocumentPath(storedPath: string | null | undefined) {
    if (!storedPath) return null;
    const normalized = storedPath.replace(/\\/g, "/");
    if (!normalized.startsWith("/uploads/")) return null;
    const relative = normalized.replace(/^\/uploads\//, "");
    const absolute = path.resolve(getUploadsRoot(), relative);
    const root = path.resolve(getUploadsRoot());
    if (!absolute.startsWith(root + path.sep) && absolute !== root) return null;
    return absolute;
}

export async function deleteStoredDocumentFile(storedPath: string | null | undefined) {
    const absolute = resolveStoredDocumentPath(storedPath);
    if (!absolute) return;
    try {
        await unlink(absolute);
    } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
    }
}
