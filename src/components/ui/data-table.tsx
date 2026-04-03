"use client"

import * as React from "react"
import {
    Column as TanstackColumn,
    ColumnDef,
    ColumnFiltersState,
    FilterFn,
    PaginationState,
    Row as TanstackRow,
    SortingState,
    Table as TanstackTable,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, Filter, FilterX, Loader2, Trash2, Upload } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { bulkDeleteByExcelEntity } from "@/app/dashboard/_actions/bulk-delete"
import { useDashboardScope } from "@/components/layout/DashboardScopeContext"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./table"
import { Button } from "./button"
import { Input } from "./input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu"
import type { ExcelEntityKey } from "@/lib/excel-entities"
import { cn } from "@/lib/utils"
import { matchesTokenizedSearch } from "@/lib/search-query"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    searchPlaceholder?: string
    toolbarRight?: React.ReactNode
    onRowClick?: (row: TData) => void
    tableClassName?: string
    excelEntity?: ExcelEntityKey
    toolbarLayout?: "default" | "compact"
    toolbarArrangement?: "default" | "report-right-scroll"
    serverFiltering?: {
        statusOptions?: Array<{ value: string; label: string }>
        typeOptions?: Array<{ value: string; label: string }>
        showDateRange?: boolean
    }
}

async function getResponseErrorMessage(response: Response, fallback: string) {
    try {
        const json = await response.json()
        if (typeof json?.error === "string" && json.error.trim().length > 0) {
            return json.error
        }
    } catch {
        // noop
    }
    return fallback
}

function getDownloadFileName(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) return fallback

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1])
        } catch {
            return utf8Match[1]
        }
    }

    const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
    if (basicMatch?.[1]) return basicMatch[1]

    return fallback
}

function normalizeFilterValue(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((item) => normalizeFilterValue(item)).join(" ")
    if (typeof value === "object") {
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }
    return String(value)
}

const includesTextFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
    const rawNeedle = String(filterValue ?? "").trim()
    if (!rawNeedle) return true

    const haystack = normalizeFilterValue(row.getValue(columnId))
    return matchesTokenizedSearch(haystack, rawNeedle)
}

function getFilterPlaceholder(header: unknown) {
    if (typeof header === "string" && header.trim().length > 0) {
        return `${header}...`
    }
    return "Filtrele..."
}

function parsePageIndexFromSearchParam(value: string | null) {
    const pageNumber = Number(value)
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return 0
    return pageNumber - 1
}

function normalizeColumnId(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");
}

function isActionsColumnId(value: string) {
    const normalized = normalizeColumnId(value);
    return (
        normalized === "actions" ||
        normalized === "action" ||
        normalized === "islemler" ||
        normalized === "islem" ||
        normalized.endsWith("_actions") ||
        normalized.endsWith("_islemler")
    );
}

function humanizeColumnId(value: string) {
    return value
        .replace(/^_+|_+$/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getColumnDisplayName<TData>(column: TanstackColumn<TData, unknown>) {
    const header = column.columnDef.header;
    if (typeof header === "string" && header.trim().length > 0) {
        return header.trim();
    }

    const accessorKey = (column.columnDef as { accessorKey?: unknown }).accessorKey;
    if (typeof accessorKey === "string" && accessorKey.trim().length > 0) {
        return humanizeColumnId(accessorKey);
    }

    return humanizeColumnId(column.id || "sütun");
}

function SelectionCheckbox({
    checked,
    indeterminate,
    disabled,
    onChange,
    ariaLabel,
}: {
    checked: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    onChange: (nextChecked: boolean) => void;
    ariaLabel: string;
}) {
    const ref = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = Boolean(indeterminate) && !checked;
        }
    }, [checked, indeterminate]);

    return (
        <input
            ref={ref}
            type="checkbox"
            aria-label={ariaLabel}
            className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-300"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
        />
    );
}

export function DataTable<TData, TValue>({
    columns,
    data,
    toolbarRight,
    onRowClick,
    tableClassName,
    excelEntity,
    toolbarLayout = "compact",
    toolbarArrangement = "default",
}: DataTableProps<TData, TValue>) {
    const { isAdmin } = useDashboardScope()
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pageParamKey = React.useMemo(() => (excelEntity ? `${excelEntity}Page` : "tablePage"), [excelEntity])
    const urlPageIndex = React.useMemo(
        () => parsePageIndexFromSearchParam(searchParams.get(pageParamKey)),
        [pageParamKey, searchParams]
    )
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: urlPageIndex,
        pageSize: 10,
    })
    const [showColumnFilters, setShowColumnFilters] = React.useState(false)
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
    const [isDesktop, setIsDesktop] = React.useState(false)
    const loadedVisibilityKeyRef = React.useRef<string | null>(null)
    const [firstStickyColWidth, setFirstStickyColWidth] = React.useState(0)
    const firstHeaderCellRef = React.useRef<HTMLTableCellElement | null>(null)
    const canBulkDelete = Boolean(excelEntity) && isAdmin
    const canSelectRows = canBulkDelete
    const visibilityStorageKey = React.useMemo(
        () => `datatable:visibility:${excelEntity || "default"}:${pathname}`,
        [excelEntity, pathname]
    )
    const tableColumns = React.useMemo(() => {
        if (!canSelectRows) return columns

        const selectionColumn = {
            id: "__select__",
            header: ({ table }: { table: TanstackTable<TData> }) => {
                const allRows = table.getRowModel().rows.length
                const allSelected = table.getIsAllPageRowsSelected()
                const someSelected = table.getIsSomePageRowsSelected()

                return (
                    <div className="flex items-center justify-center">
                        <SelectionCheckbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            disabled={allRows === 0}
                            ariaLabel="Tum satirlari sec"
                            onChange={(nextChecked) => table.toggleAllPageRowsSelected(nextChecked)}
                        />
                    </div>
                )
            },
            cell: ({ row }: { row: TanstackRow<TData> }) => (
                <div className="flex items-center justify-center">
                    <SelectionCheckbox
                        checked={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        ariaLabel="Satiri sec"
                        onChange={(nextChecked) => row.toggleSelected(nextChecked)}
                    />
                </div>
            ),
            enableSorting: false,
            enableColumnFilter: false,
            enableHiding: false,
            size: 42,
            meta: { nonDataColumn: true },
        } as unknown as ColumnDef<TData, TValue>

        const nextColumns = [...columns]
        const actionsIndex = nextColumns.findIndex((column) => {
            const idCandidate = String((column as { id?: unknown }).id || "")
            if (idCandidate && isActionsColumnId(idCandidate)) return true
            const accessorCandidate = String((column as { accessorKey?: unknown }).accessorKey || "")
            return accessorCandidate ? isActionsColumnId(accessorCandidate) : false
        })

        if (actionsIndex >= 0) {
            nextColumns.splice(actionsIndex, 0, selectionColumn)
            return nextColumns
        }

        return [...nextColumns, selectionColumn]
    }, [canSelectRows, columns])

    const table = useReactTable({
        data,
        columns: tableColumns,
        defaultColumn: {
            filterFn: includesTextFilter,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: (row) => {
            if (!canSelectRows) return false
            const original = row.original as { id?: unknown }
            return typeof original?.id === "string" && original.id.trim().length > 0
        },
        getRowId: (originalRow, index) => {
            const rowId = (originalRow as { id?: unknown })?.id
            return typeof rowId === "string" && rowId.trim().length > 0 ? rowId : String(index)
        },
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        autoResetPageIndex: false,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
        },
    })

    const filteredCount = table.getFilteredRowModel().rows.length
    const totalCount = data.length
    const pageIndex = table.getState().pagination.pageIndex
    const pageSize = table.getState().pagination.pageSize
    const pageStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
    const pageEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)
    const hasActiveFilter = columnFilters.some((filter) => String(filter.value ?? "").trim().length > 0)
    const hasAnyFilterableColumn = table.getAllLeafColumns().some((column) => column.getCanFilter())
    const hideableColumns = React.useMemo(
        () =>
            table
                .getAllLeafColumns()
                .filter(
                    (column) =>
                        column.getCanHide() &&
                        column.id !== "__select__" &&
                        !isActionsColumnId(column.id)
                ),
        [table]
    )
    const hasAnyHideableColumn = hideableColumns.length > 0
    const visibleHideableColumnCount = hideableColumns.filter((column) => column.getIsVisible()).length
    const hasToolbar = Boolean(toolbarRight || excelEntity || hasAnyFilterableColumn || hasAnyHideableColumn)
    const isCompactToolbar = toolbarLayout === "compact"
    const isReportRightScroll = isCompactToolbar && toolbarArrangement === "report-right-scroll"
    const visibleLeafColumns = table.getVisibleLeafColumns()
    const visibleColumnCount = visibleLeafColumns.length
    const stickyEnabled = isDesktop && visibleColumnCount >= 2
    const actionsColumnIndex = React.useMemo(() => {
        for (let i = visibleLeafColumns.length - 1; i >= 0; i -= 1) {
            if (isActionsColumnId(visibleLeafColumns[i]?.id || "")) return i
        }
        return -1
    }, [visibleLeafColumns])
    const selectedRowIds = table
        .getSelectedRowModel()
        .rows.map((row) => {
            const original = row.original as unknown as { id?: unknown }
            return typeof original?.id === "string" ? original.id : null
        })
        .filter((id): id is string => Boolean(id))

    React.useEffect(() => {
        setPagination((prev) => {
            if (prev.pageIndex === urlPageIndex) return prev
            return { ...prev, pageIndex: urlPageIndex }
        })
    }, [urlPageIndex])

    React.useEffect(() => {
        const nextPageNumber = pagination.pageIndex + 1
        const currentPageNumber = Number(searchParams.get(pageParamKey) || "1")
        if (currentPageNumber === nextPageNumber) return

        const params = new URLSearchParams(searchParams.toString())
        if (nextPageNumber <= 1) {
            params.delete(pageParamKey)
        } else {
            params.set(pageParamKey, String(nextPageNumber))
        }

        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [pageParamKey, pagination.pageIndex, pathname, router, searchParams])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (loadedVisibilityKeyRef.current === visibilityStorageKey) return
        loadedVisibilityKeyRef.current = visibilityStorageKey

        const raw = window.localStorage.getItem(visibilityStorageKey)
        if (!raw) return

        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (!parsed || typeof parsed !== "object") return
            const allowed = new Set(table.getAllLeafColumns().map((column) => column.id))
            const nextState: VisibilityState = {}

            Object.entries(parsed).forEach(([key, value]) => {
                if (!allowed.has(key)) return
                if (typeof value !== "boolean") return
                nextState[key] = value
            })

            setColumnVisibility(nextState)
        } catch {
            // noop
        }
    }, [table, visibilityStorageKey])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        window.localStorage.setItem(visibilityStorageKey, JSON.stringify(columnVisibility))
    }, [columnVisibility, visibilityStorageKey])

    React.useEffect(() => {
        if (typeof window === "undefined") return

        const media = window.matchMedia("(min-width: 768px)")
        const update = () => setIsDesktop(media.matches)
        update()

        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", update)
            return () => media.removeEventListener("change", update)
        }

        media.addListener(update)
        return () => media.removeListener(update)
    }, [])

    React.useLayoutEffect(() => {
        const element = firstHeaderCellRef.current
        if (!element || !stickyEnabled) {
            setFirstStickyColWidth(0)
            return
        }

        const measure = () => {
            setFirstStickyColWidth(Math.ceil(element.getBoundingClientRect().width))
        }

        measure()
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(element)
        return () => resizeObserver.disconnect()
    }, [stickyEnabled, visibleColumnCount, showColumnFilters, tableClassName])

    const getStickyStyle = React.useCallback(
        (columnIndex: number): React.CSSProperties | undefined => {
            if (!stickyEnabled) return undefined
            if (columnIndex === 0) return { left: 0 }
            if (columnIndex === 1) return { left: firstStickyColWidth }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) return { right: 0 }
            return undefined
        },
        [actionsColumnIndex, firstStickyColWidth, stickyEnabled]
    )

    const getStickyHeaderClass = React.useCallback(
        (columnIndex: number) => {
            if (!stickyEnabled) return ""
            if (columnIndex === 0 || columnIndex === 1) {
                return "sticky z-30 bg-slate-50/95 border-r border-slate-200"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-30 bg-slate-50/95 border-l border-slate-200 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.2)]"
            }
            return ""
        },
        [actionsColumnIndex, stickyEnabled]
    )

    const getStickyFilterClass = React.useCallback(
        (columnIndex: number) => {
            if (!stickyEnabled) return ""
            if (columnIndex === 0 || columnIndex === 1) {
                return "sticky z-20 bg-slate-50/95 border-r border-slate-200"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-20 bg-slate-50/95 border-l border-slate-200 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]"
            }
            return ""
        },
        [actionsColumnIndex, stickyEnabled]
    )

    const getStickyBodyClass = React.useCallback(
        (columnIndex: number) => {
            if (!stickyEnabled) return ""
            if (columnIndex === 0 || columnIndex === 1) {
                return "sticky z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50/80"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-10 border-l border-slate-100 bg-white group-hover:bg-slate-50/80 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"
            }
            return ""
        },
        [actionsColumnIndex, stickyEnabled]
    )

    const handleBulkDelete = React.useCallback(async () => {
        if (!excelEntity || isBulkDeleting || isExporting || isImporting) return

        const ids = [...new Set(selectedRowIds)]

        if (ids.length === 0) {
            toast.warning("Toplu silme için önce satır seçmelisiniz.")
            return
        }

        const confirmed = window.confirm(
            `Seçili ${ids.length} kayıt toplu silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
        )
        if (!confirmed) return

        setIsBulkDeleting(true)
        try {
            const result = await bulkDeleteByExcelEntity(excelEntity, ids)
            if (result.deleted > 0) {
                table.resetRowSelection()
                router.refresh()
            }
            if (result.failed === 0) {
                toast.success(`Toplu silme tamamlandı: ${result.deleted} kayıt silindi.`)
                return
            }

            toast.warning(`Toplu silme tamamlandı: ${result.deleted} silindi, ${result.failed} silinemedi.`, {
                description: result.errors?.length ? result.errors.join(" | ") : undefined,
            })
        } catch (error) {
            toast.error("Toplu silme başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            })
        } finally {
            setIsBulkDeleting(false)
        }
    }, [excelEntity, isBulkDeleting, isExporting, isImporting, router, selectedRowIds, table])

    const handleExport = React.useCallback(async () => {
        if (!excelEntity || isExporting || isImporting) return

        setIsExporting(true)
        try {
            const params = new URLSearchParams()
            const selectedSirket = searchParams.get("sirket")
            const selectedYil = searchParams.get("yil")
            if (selectedSirket) params.set("sirket", selectedSirket)
            if (selectedYil) params.set("yil", selectedYil)

            const endpoint = `/api/excel/${excelEntity}${params.toString() ? `?${params.toString()}` : ""}`
            const response = await fetch(endpoint, { method: "GET" })

            if (!response.ok) {
                throw new Error(await getResponseErrorMessage(response, "Excel dışa aktarma başarısız oldu."))
            }

            const blob = await response.blob()
            const fallbackName = `${excelEntity}-${new Date().toISOString().slice(0, 10)}.xlsx`
            const fileName = getDownloadFileName(response.headers.get("content-disposition"), fallbackName)

            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)

            toast.success("Excel dışa aktarma tamamlandı.")
        } catch (error) {
            toast.error("Excel dışa aktarma başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            })
        } finally {
            setIsExporting(false)
        }
    }, [excelEntity, isExporting, isImporting, searchParams])

    const handleImportFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !excelEntity) return

        setIsImporting(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const params = new URLSearchParams()
            const selectedSirket = searchParams.get("sirket")
            const selectedYil = searchParams.get("yil")
            if (selectedSirket) params.set("sirket", selectedSirket)
            if (selectedYil) params.set("yil", selectedYil)
            const endpoint = `/api/excel/${excelEntity}${params.toString() ? `?${params.toString()}` : ""}`

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            })

            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                const errorMessage =
                    typeof payload?.error === "string" && payload.error.trim().length > 0
                        ? payload.error
                        : "Excel içe aktarma başarısız oldu."
                throw new Error(errorMessage)
            }

            const createdCount = Number(payload?.created ?? 0)
            const updatedCount = Number(payload?.updated ?? 0)
            const skippedCount = Number(payload?.skipped ?? 0)
            const totalCount = Number(payload?.total ?? 0)
            const paginationHint =
                excelEntity === "arac" && createdCount + updatedCount > 10
                    ? " • Not: Araç listesi sayfalıdır; altta Sonraki ile devam edebilirsiniz."
                    : ""
            toast.success("Excel içe aktarma tamamlandı.", {
                description: `Toplam ${totalCount} satır işlendi • ${createdCount} eklendi • ${updatedCount} güncellendi • ${skippedCount} atlandı${paginationHint}`,
            })
            router.refresh()
        } catch (error) {
            toast.error("Excel içe aktarma başarısız.", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            })
        } finally {
            event.target.value = ""
            setIsImporting(false)
        }
    }, [excelEntity, router, searchParams])

    return (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {hasToolbar ? (
                <div
                    className={
                        isCompactToolbar
                            ? "flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 xl:flex-row xl:items-center xl:justify-between xl:flex-nowrap"
                            : "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4"
                    }
                >
                    <div
                        className={
                            isReportRightScroll
                                ? "flex w-full min-w-0 items-center justify-start gap-2 overflow-x-auto pb-1"
                            : isCompactToolbar
                                    ? `w-full grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-start ${toolbarRight ? "xl:w-auto" : "xl:w-full"} xl:flex-nowrap`
                                    : "flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
                        }
                    >
                        {hasAnyFilterableColumn ? (
                            <Button
                                type="button"
                                variant={showColumnFilters ? "default" : "outline"}
                                size="sm"
                                className={
                                    isReportRightScroll
                                        ? "h-10 min-w-[140px] shrink-0"
                                        : isCompactToolbar
                                            ? "h-10 w-full sm:w-auto"
                                            : "h-10 w-full sm:w-auto"
                                }
                                onClick={() => setShowColumnFilters((prev) => !prev)}
                            >
                                <Filter className="h-4 w-4" />
                                Detaylı Filtre
                            </Button>
                        ) : null}

                        {hasAnyHideableColumn ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={
                                            isReportRightScroll
                                                ? "h-10 min-w-[140px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                                : isCompactToolbar
                                                    ? "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                                    : "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                        }
                                    >
                                        <Columns3 className="h-4 w-4" />
                                        Sütun Seç
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-60">
                                    <DropdownMenuLabel>Görünecek Sütunlar</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {hideableColumns.map((column) => {
                                        const checked = column.getIsVisible()
                                        const disableHide = checked && visibleHideableColumnCount <= 1
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                checked={checked}
                                                disabled={disableHide}
                                                onCheckedChange={(nextChecked) => column.toggleVisibility(Boolean(nextChecked))}
                                                onSelect={(event) => event.preventDefault()}
                                            >
                                                {getColumnDisplayName(column)}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={(event) => {
                                            event.preventDefault()
                                            table.resetColumnVisibility()
                                        }}
                                    >
                                        Varsayılan Sütunlar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}

                        {hasAnyFilterableColumn && hasActiveFilter ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={
                                    isReportRightScroll
                                        ? "h-10 min-w-[150px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                        : isCompactToolbar
                                            ? "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                            : "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                }
                                onClick={() => table.resetColumnFilters()}
                            >
                                <FilterX className="h-4 w-4" />
                                Filtreleri Temizle
                            </Button>
                        ) : null}

                        {excelEntity ? (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleImportFileChange}
                                />
                                <div
                                    className={
                                        isReportRightScroll
                                            ? "ml-auto flex shrink-0 items-center gap-2"
                                            : isCompactToolbar
                                                ? "col-span-2 grid grid-cols-2 gap-2 sm:ml-auto sm:w-auto sm:flex sm:items-center sm:gap-2"
                                                : "flex w-full items-center gap-2 sm:w-auto"
                                    }
                                >
                                    {canBulkDelete && selectedRowIds.length > 0 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={
                                                isReportRightScroll
                                                    ? "h-10 min-w-[140px] shrink-0 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                    : "h-10 w-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 sm:w-auto"
                                            }
                                            onClick={handleBulkDelete}
                                            disabled={isBulkDeleting || isImporting || isExporting || selectedRowIds.length === 0}
                                        >
                                            {isBulkDeleting ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                            Toplu Sil ({selectedRowIds.length})
                                        </Button>
                                    ) : null}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={
                                            isReportRightScroll
                                                ? "h-10 min-w-[120px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                                : "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                        }
                                        onClick={handleExport}
                                        disabled={isExporting || isImporting}
                                    >
                                        {isExporting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        Dışa Aktar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={
                                            isReportRightScroll
                                                ? "h-10 min-w-[120px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                                : "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                        }
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isImporting || isExporting}
                                    >
                                        {isImporting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="h-4 w-4" />
                                        )}
                                        İçe Aktar
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </div>

                    {toolbarRight ? (
                        <div
                            className={
                                isReportRightScroll
                                    ? "w-full min-w-0 overflow-x-auto pb-1"
                                    : isCompactToolbar
                                        ? "w-full xl:ml-auto xl:w-auto xl:flex-none"
                                        : "w-full sm:w-auto"
                            }
                        >
                            {toolbarRight}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <Table className={tableClassName}>
                <TableHeader className="bg-slate-50/80">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="border-b-slate-200 hover:bg-transparent">
                            {headerGroup.headers.map((header, headerIndex) => {
                                const canSort = header.column.getCanSort()
                                const sortedState = header.column.getIsSorted()
                                const headerContent = header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())
                                return (
                                    <TableHead
                                        key={header.id}
                                        ref={headerIndex === 0 ? firstHeaderCellRef : undefined}
                                        className={cn(
                                            "h-11 whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500",
                                            getStickyHeaderClass(headerIndex)
                                        )}
                                        style={getStickyStyle(headerIndex)}
                                    >
                                        {canSort ? (
                                            <button
                                                type="button"
                                                onClick={header.column.getToggleSortingHandler()}
                                                className="inline-flex select-none items-center gap-1.5 text-left"
                                            >
                                                <span>{headerContent}</span>
                                                {sortedState === "asc" ? (
                                                    <ArrowUp className="h-3.5 w-3.5 text-slate-600" />
                                                ) : sortedState === "desc" ? (
                                                    <ArrowDown className="h-3.5 w-3.5 text-slate-600" />
                                                ) : (
                                                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                                                )}
                                            </button>
                                        ) : (
                                            headerContent
                                        )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}

                    {showColumnFilters ? (
                        <TableRow className="border-b-slate-200 bg-slate-50/90 hover:bg-slate-50/90">
                            {table.getVisibleLeafColumns().map((column, columnIndex) => {
                                const canFilter = column.getCanFilter()
                                const currentValue = column.getFilterValue()
                                const inputValue =
                                    typeof currentValue === "string" || typeof currentValue === "number"
                                        ? String(currentValue)
                                        : ""

                                return (
                                    <TableHead
                                        key={`filter-${column.id}`}
                                        className={cn("px-3 py-2", getStickyFilterClass(columnIndex))}
                                        style={getStickyStyle(columnIndex)}
                                    >
                                        {canFilter ? (
                                            <Input
                                                value={inputValue}
                                                onChange={(event) => column.setFilterValue(event.target.value)}
                                                placeholder={getFilterPlaceholder(column.columnDef.header)}
                                                className="h-8 min-w-[120px] border-slate-200 bg-white text-[11px]"
                                            />
                                        ) : null}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ) : null}
                </TableHeader>

                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                onClick={() => onRowClick && onRowClick(row.original)}
                                className={`
                                    group border-b-slate-100 transition-colors hover:bg-slate-50/80
                                    ${onRowClick ? "cursor-pointer" : ""}
                                `}
                            >
                                {row.getVisibleCells().map((cell, cellIndex) => (
                                    <TableCell
                                        key={cell.id}
                                        className={cn(
                                            "px-4 py-3 align-middle text-[13px] text-slate-700",
                                            getStickyBodyClass(cellIndex)
                                        )}
                                        style={getStickyStyle(cellIndex)}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-32 bg-slate-50/30 text-center font-medium text-slate-500"
                            >
                                Kayıt bulunamadı.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
                <div className="text-[11px] text-slate-500">
                    Toplam adet: <span className="font-semibold text-slate-700">{filteredCount}</span>
                    {hasActiveFilter ? <span className="ml-1 text-slate-400">/ {totalCount} kayıt</span> : null}
                    {table.getPageCount() > 1 ? (
                        <span className="ml-2 text-slate-400">
                            ({pageStart}-{pageEnd} arası)
                        </span>
                    ) : null}
                </div>
                {table.getPageCount() > 1 ? (
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="h-8 border-slate-200 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                        >
                            Önceki
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="h-8 border-slate-200 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                        >
                            Sonraki
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
