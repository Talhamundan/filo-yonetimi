"use client";

import React from "react";

type DashboardScopeContextValue = {
    canAccessAllCompanies: boolean;
    isAdmin: boolean;
};

const DashboardScopeContext = React.createContext<DashboardScopeContextValue>({
    canAccessAllCompanies: false,
    isAdmin: false,
});

export function DashboardScopeProvider({
    value,
    children,
}: {
    value: DashboardScopeContextValue;
    children: React.ReactNode;
}) {
    return (
        <DashboardScopeContext.Provider value={value}>
            {children}
        </DashboardScopeContext.Provider>
    );
}

export function useDashboardScope() {
    return React.useContext(DashboardScopeContext);
}
