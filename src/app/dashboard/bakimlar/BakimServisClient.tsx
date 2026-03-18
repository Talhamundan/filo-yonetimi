"use client";

import React from "react";
import BakimlarClient from "./client";
import type { BakimRow } from "./columns";

type AracOption = {
    id: string;
    plaka: string;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
};

export default function BakimServisClient({
    initialBakimlar,
    activeAraclar = [],
}: {
    initialBakimlar: BakimRow[];
    activeAraclar?: AracOption[];
}) {
    return <BakimlarClient initialBakimlar={initialBakimlar} activeAraclar={activeAraclar} />;
}
