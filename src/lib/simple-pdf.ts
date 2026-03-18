function escapePdfText(text: string) {
    return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildSimplePdf(title: string, lines: string[]) {
    const allLines = [title, "", ...lines].slice(0, 80);
    const startY = 800;
    const lineHeight = 14;

    const textOps = [
        "BT",
        "/F1 10 Tf",
        `50 ${startY} Td`,
        ...allLines.flatMap((line, index) => {
            if (index === 0) return [`(${escapePdfText(line)}) Tj`];
            return ["0 -14 Td", `(${escapePdfText(line)}) Tj`];
        }),
        "ET",
    ].join("\n");

    const stream = `${textOps}\n`;

    const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj\n",
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj\n`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];

    for (const object of objects) {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += object;
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
}

export function formatCurrency(value: number) {
    return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}
