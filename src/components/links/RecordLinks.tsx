import Link from "next/link";
import type { ReactNode } from "react";

export function AracLink({
    aracId,
    children,
    className,
}: {
    aracId?: string | null;
    children: ReactNode;
    className?: string;
}) {
    if (!aracId) {
        return <>{children}</>;
    }

    return (
        <Link
            href={`/dashboard/araclar/${aracId}`}
            className={className}
            onClick={(event) => event.stopPropagation()}
        >
            {children}
        </Link>
    );
}

export function PersonelLink({
    personelId,
    children,
    className,
}: {
    personelId?: string | null;
    children: ReactNode;
    className?: string;
}) {
    if (!personelId) {
        return <>{children}</>;
    }

    return (
        <Link
            href={`/dashboard/personel/${personelId}`}
            className={className}
            onClick={(event) => event.stopPropagation()}
        >
            {children}
        </Link>
    );
}
