"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    isOpen,
    title = "Emin misiniz?",
    message,
    confirmText = "Evet, Devam Et",
    cancelText = "Vazgeç",
    variant = "danger",
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: "bg-red-50 text-red-600",
            btn: "bg-red-600 hover:bg-red-700 shadow-red-200",
        },
        warning: {
            icon: "bg-amber-50 text-amber-500",
            btn: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
        },
        info: {
            icon: "bg-indigo-50 text-indigo-600",
            btn: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
        },
    };

    const styles = variantStyles[variant];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto p-6 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* İkon */}
                <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-5 ${styles.icon}`}>
                    <AlertTriangle size={28} />
                </div>

                {/* İçerik */}
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">{title}</h2>
                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">{message}</p>

                {/* Butonlar */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 h-11 text-white rounded-xl font-bold text-sm transition-all shadow-lg ${styles.btn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * useConfirm hook'u - state tabanlı confirm diyalog yönetimi
 * Kullanım:
 *   const { confirmModal, openConfirm } = useConfirm();
 *   await openConfirm({ message: "Silmek istiyor musunuz?" })  => true/false döner
 */
export function useConfirm() {
    const [state, setState] = React.useState<{
        isOpen: boolean;
        title?: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        variant?: "danger" | "warning" | "info";
        resolve?: (val: boolean) => void;
    }>({ isOpen: false, message: "" });

    const openConfirm = React.useCallback(
        (opts: { title?: string; message: string; confirmText?: string; cancelText?: string; variant?: "danger" | "warning" | "info" }): Promise<boolean> => {
            return new Promise((resolve) => {
                setState({ ...opts, isOpen: true, resolve });
            });
        },
        []
    );

    const handleConfirm = () => {
        state.resolve?.(true);
        setState((s) => ({ ...s, isOpen: false }));
    };

    const handleCancel = () => {
        state.resolve?.(false);
        setState((s) => ({ ...s, isOpen: false }));
    };

    const confirmModal = (
        <ConfirmModal
            isOpen={state.isOpen}
            title={state.title}
            message={state.message}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            variant={state.variant}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { confirmModal, openConfirm };
}
