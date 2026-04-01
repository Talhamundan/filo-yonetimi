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
    kullaniciId?: string | null;
    kullanici?: { id: string; ad: string; soyad: string } | null;
    aktifSoforId?: string | null;
    aktifSofor?: { id: string; ad: string; soyad: string } | null;
    aktifSoforAdSoyad?: string | null;
};

type PersonelOption = {
    id: string;
    ad: string;
    soyad: string;
    rol?: string | null;
};

export default function BakimServisClient({
    initialBakimlar,
    activeAraclar = [],
    personeller = [],
}: {
    initialBakimlar: BakimRow[];
    activeAraclar?: AracOption[];
    personeller?: PersonelOption[];
}) {
    return <BakimlarClient initialBakimlar={initialBakimlar} activeAraclar={activeAraclar} personeller={personeller} />;
}
