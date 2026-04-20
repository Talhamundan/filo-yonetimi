"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { mergeDashboardScopeIntoHref } from "@/lib/dashboard-scope-query";

export function useDashboardScopedHref() {
    const searchParams = useSearchParams();

    return React.useCallback(
        (href: string) => mergeDashboardScopeIntoHref(href, searchParams),
        [searchParams]
    );
}
