"use client";

import * as React from "react";
import { SearchableSelect } from "./searchable-select";
import { ILLER } from "@/lib/constants/iller";

type CitySelectProps = {
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

export function CitySelect({
    value,
    onValueChange,
    placeholder = "İl Seçiniz...",
    disabled = false,
    className,
}: CitySelectProps) {
    return (
        <SearchableSelect
            value={value}
            onValueChange={onValueChange}
            options={ILLER}
            placeholder={placeholder}
            searchPlaceholder="İl ara..."
            disabled={disabled}
            className={className}
        />
    );
}
