"use client"

import * as React from "react"
import {
    Column as TanstackColumn,
    ColumnDef,
    ColumnFiltersState,
    ColumnOrderState,
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
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Columns3, Download, Filter, FilterX, Loader2, Pin, PinOff, Trash2, Upload } from "lucide-react"
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
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu"
import type { ExcelEntityKey } from "@/lib/excel-entities"
import { cn } from "@/lib/utils"
import { matchesTokenizedSearch } from "@/lib/search-query"
import { EmptyState } from "./empty-state"

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
    columnViewPresets?: Array<{ id: string; label: string; columnIds: string[] }>
}

type SavedColumnView = {
    id: string
    name: string
    columnIds: string[]
    createdAt: string
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

function isStatusColumnName(value: string) {
    const normalized = normalizeColumnId(value);
    return normalized === "durum" || normalized === "status" || normalized === "mevcut durum";
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

function isStatusColumn<TData>(column: TanstackColumn<TData, unknown>) {
    return isStatusColumnName(column.id) || isStatusColumnName(getColumnDisplayName(column));
}

function isNonDataColumnId(value: string) {
    return value === "__select__" || isActionsColumnId(value);
}

function areStringArraysEqual(left: string[], right: string[]) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item === right[index]);
}

function areNumberRecordsEqual(left: Record<string, number>, right: Record<string, number>) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
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
    columnViewPresets = [],
}: DataTableProps<TData, TValue>) {
    const { isAdmin } = useDashboardScope()
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
    const [pinnedColumnIds, setPinnedColumnIds] = React.useState<string[]>([])
    const [rowSelection, setRowSelection] = React.useState({})
    const allRowsPageSize = Math.max(data.length, 1)
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: allRowsPageSize,
    })
    const [showColumnFilters, setShowColumnFilters] = React.useState(false)
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
    const [isDesktop, setIsDesktop] = React.useState(false)
    const loadedVisibilityKeyRef = React.useRef<string | null>(null)
    const loadedPinningKeyRef = React.useRef<string | null>(null)
    const loadedViewKeyRef = React.useRef<string | null>(null)
    const [hydratedVisibilityKey, setHydratedVisibilityKey] = React.useState<string | null>(null)
    const [hydratedPinningKey, setHydratedPinningKey] = React.useState<string | null>(null)
    const [hydratedViewKey, setHydratedViewKey] = React.useState<string | null>(null)
    const [savedColumnViews, setSavedColumnViews] = React.useState<SavedColumnView[]>([])
    const headerCellRefs = React.useRef(new Map<string, HTMLTableCellElement>())
    const [leftPinnedOffsets, setLeftPinnedOffsets] = React.useState<Record<string, number>>({})
    const canBulkDelete = Boolean(excelEntity) && isAdmin
    const canSelectRows = canBulkDelete
    const visibilityStorageKey = React.useMemo(
        () => `datatable:visibility:${excelEntity || "default"}:${pathname}`,
        [excelEntity, pathname]
    )
    const pinningStorageKey = React.useMemo(
        () => `datatable:pinned:${excelEntity || "default"}:${pathname}`,
        [excelEntity, pathname]
    )
    const viewStorageKey = React.useMemo(
        () => `datatable:views:${excelEntity || "default"}:${pathname}`,
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
            return nextColumns as ColumnDef<TData, TValue>[]
        }

        return [...nextColumns, selectionColumn] as ColumnDef<TData, TValue>[]
    }, [canSelectRows, columns])

    const table = useReactTable<TData>({
        data,
        columns: tableColumns,
        defaultColumn: {
            filterFn: includesTextFilter as FilterFn<TData>,
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
        onColumnOrderChange: setColumnOrder,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        autoResetPageIndex: false,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            columnOrder,
            rowSelection,
            pagination,
        },
    })

    const allLeafColumns = table.getAllLeafColumns()
    const statusColumnId = allLeafColumns.find((column) => !isNonDataColumnId(column.id) && isStatusColumn(column))?.id || null
    const filteredCount = table.getFilteredRowModel().rows.length
    const totalCount = data.length
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
    const hideableColumnIds = React.useMemo(
        () => hideableColumns.map((column) => column.id),
        [hideableColumns]
    )
    const hideableColumnIdSet = React.useMemo(
        () => new Set(hideableColumnIds),
        [hideableColumnIds]
    )
    const hasToolbar = Boolean(toolbarRight || excelEntity || hasAnyFilterableColumn || hasAnyHideableColumn)
    const isCompactToolbar = toolbarLayout === "compact"
    const isReportRightScroll = isCompactToolbar && toolbarArrangement === "report-right-scroll"
    const visibleLeafColumns = table.getVisibleLeafColumns()
    const selectedExportColumns = React.useMemo(
        () =>
            visibleLeafColumns
                .filter((column) => !isNonDataColumnId(column.id))
                .map((column) => ({
                    label: getColumnDisplayName(column).trim(),
                    key: column.id.trim(),
                }))
                .filter((column) => column.label.length > 0 || column.key.length > 0),
        [visibleLeafColumns]
    )
    const visibleColumnCount = visibleLeafColumns.length
    const visibleColumnIds = visibleLeafColumns.map((column) => column.id)
    const visibleColumnIdsKey = visibleColumnIds.join("\u001F")
    const visibleColumnIdSet = React.useMemo(() => new Set(visibleColumnIds), [visibleColumnIdsKey])
    const leftPinnedColumnIds = React.useMemo(() => {
        const ordered: string[] = []

        if (statusColumnId && visibleColumnIdSet.has(statusColumnId)) {
            ordered.push(statusColumnId)
        }

        pinnedColumnIds.forEach((columnId) => {
            if (columnId === statusColumnId) return
            if (!visibleColumnIdSet.has(columnId)) return
            if (isNonDataColumnId(columnId)) return
            if (!ordered.includes(columnId)) ordered.push(columnId)
        })

        return ordered
    }, [pinnedColumnIds, statusColumnId, visibleColumnIdSet])
    const leftPinnedColumnIdsKey = leftPinnedColumnIds.join("\u001F")
    const leftPinnedColumnIdSet = React.useMemo(() => new Set(leftPinnedColumnIds), [leftPinnedColumnIds])
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

    const sanitizeColumnViewIds = React.useCallback(
        (input: string[]) => {
            const uniqueIds = Array.from(new Set(input))
            return uniqueIds.filter((columnId) => hideableColumnIdSet.has(columnId) && !isNonDataColumnId(columnId))
        },
        [hideableColumnIdSet]
    )

    const applyColumnView = React.useCallback(
        (columnIds: string[]) => {
            const sanitizedIds = sanitizeColumnViewIds(columnIds)
            if (sanitizedIds.length === 0) {
                toast.warning("Bu görünümde gösterilecek geçerli sütun bulunamadı.")
                return
            }

            const visibleSet = new Set(sanitizedIds)
            setColumnVisibility((prev) => {
                const next: VisibilityState = { ...prev }
                hideableColumnIds.forEach((columnId) => {
                    next[columnId] = visibleSet.has(columnId)
                })
                if (statusColumnId) next[statusColumnId] = true
                return next
            })
        },
        [hideableColumnIds, sanitizeColumnViewIds, statusColumnId]
    )

    const normalizedColumnViewPresets = React.useMemo(
        () =>
            columnViewPresets
                .map((preset) => ({
                    ...preset,
                    columnIds: sanitizeColumnViewIds(preset.columnIds || []),
                }))
                .filter((preset) => preset.label.trim().length > 0 && preset.columnIds.length > 0),
        [columnViewPresets, sanitizeColumnViewIds]
    )

    React.useEffect(() => {
        setPagination((prev) => {
            if (prev.pageIndex === 0 && prev.pageSize === allRowsPageSize) return prev
            return { pageIndex: 0, pageSize: allRowsPageSize }
        })
    }, [allRowsPageSize])

    React.useEffect(() => {
        // Listelerde sayfalama kullanılmıyor; filtre değişse de tüm eşleşen satırlar görünür kalmalı.
        setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
    }, [columnFilters])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (loadedVisibilityKeyRef.current === visibilityStorageKey) return
        loadedVisibilityKeyRef.current = visibilityStorageKey

        const raw = window.localStorage.getItem(visibilityStorageKey)
        if (!raw) {
            setHydratedVisibilityKey(visibilityStorageKey)
            return
        }

        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (!parsed || typeof parsed !== "object") {
                setHydratedVisibilityKey(visibilityStorageKey)
                return
            }
            const allowed = new Set(table.getAllLeafColumns().map((column) => column.id))
            const nextState: VisibilityState = {}

            Object.entries(parsed).forEach(([key, value]) => {
                if (!allowed.has(key)) return
                if (typeof value !== "boolean") return
                if (statusColumnId && key === statusColumnId) {
                    nextState[key] = true
                    return
                }
                nextState[key] = value
            })

            setColumnVisibility(nextState)
        } catch {
            // noop
        } finally {
            setHydratedVisibilityKey(visibilityStorageKey)
        }
    }, [statusColumnId, table, visibilityStorageKey])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (hydratedVisibilityKey !== visibilityStorageKey) return
        window.localStorage.setItem(visibilityStorageKey, JSON.stringify(columnVisibility))
    }, [columnVisibility, hydratedVisibilityKey, visibilityStorageKey])

    React.useEffect(() => {
        if (!statusColumnId) return
        setColumnVisibility((prev) => {
            if (prev[statusColumnId] !== false) return prev
            return { ...prev, [statusColumnId]: true }
        })
    }, [statusColumnId])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (loadedPinningKeyRef.current === pinningStorageKey) return
        loadedPinningKeyRef.current = pinningStorageKey

        const raw = window.localStorage.getItem(pinningStorageKey)
        if (!raw) {
            setHydratedPinningKey(pinningStorageKey)
            return
        }

        try {
            const parsed = JSON.parse(raw) as unknown
            if (!Array.isArray(parsed)) {
                setHydratedPinningKey(pinningStorageKey)
                return
            }

            const allowed = new Set(
                table
                    .getAllLeafColumns()
                    .filter((column) => !isNonDataColumnId(column.id) && column.id !== statusColumnId)
                    .map((column) => column.id)
            )
            const nextPinned = parsed
                .filter((value): value is string => typeof value === "string")
                .filter((value, index, array) => allowed.has(value) && array.indexOf(value) === index)

            setPinnedColumnIds(nextPinned)
        } catch {
            // noop
        } finally {
            setHydratedPinningKey(pinningStorageKey)
        }
    }, [pinningStorageKey, statusColumnId, table])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (hydratedPinningKey !== pinningStorageKey) return
        window.localStorage.setItem(pinningStorageKey, JSON.stringify(pinnedColumnIds))
    }, [hydratedPinningKey, pinnedColumnIds, pinningStorageKey])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (loadedViewKeyRef.current === viewStorageKey) return
        loadedViewKeyRef.current = viewStorageKey

        const raw = window.localStorage.getItem(viewStorageKey)
        if (!raw) {
            setSavedColumnViews([])
            setHydratedViewKey(viewStorageKey)
            return
        }

        try {
            const parsed = JSON.parse(raw) as unknown
            if (!Array.isArray(parsed)) {
                setSavedColumnViews([])
                setHydratedViewKey(viewStorageKey)
                return
            }

            const normalized = parsed
                .filter((item): item is SavedColumnView => {
                    if (!item || typeof item !== "object") return false
                    const candidate = item as Partial<SavedColumnView>
                    return (
                        typeof candidate.id === "string" &&
                        typeof candidate.name === "string" &&
                        Array.isArray(candidate.columnIds) &&
                        typeof candidate.createdAt === "string"
                    )
                })
                .map((item) => ({
                    id: item.id,
                    name: item.name,
                    columnIds: sanitizeColumnViewIds(item.columnIds),
                    createdAt: item.createdAt,
                }))
                .filter((item) => item.columnIds.length > 0)

            setSavedColumnViews(normalized)
        } catch {
            setSavedColumnViews([])
        } finally {
            setHydratedViewKey(viewStorageKey)
        }
    }, [sanitizeColumnViewIds, viewStorageKey])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (hydratedViewKey !== viewStorageKey) return
        window.localStorage.setItem(viewStorageKey, JSON.stringify(savedColumnViews))
    }, [hydratedViewKey, savedColumnViews, viewStorageKey])

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

    React.useEffect(() => {
        const allColumnIds = table.getAllLeafColumns().map((column) => column.id)
        const statusIds = statusColumnId ? [statusColumnId] : []
        const pinnedIds = pinnedColumnIds.filter(
            (columnId) => columnId !== statusColumnId && allColumnIds.includes(columnId) && !isNonDataColumnId(columnId)
        )
        const reservedIds = new Set([...statusIds, ...pinnedIds])
        const actionsIds = allColumnIds.filter((columnId) => isActionsColumnId(columnId))
        const selectionIds = allColumnIds.filter((columnId) => columnId === "__select__")
        actionsIds.forEach((columnId) => reservedIds.add(columnId))
        selectionIds.forEach((columnId) => reservedIds.add(columnId))

        const restIds = allColumnIds.filter((columnId) => !reservedIds.has(columnId))
        const nextOrder = [...statusIds, ...pinnedIds, ...restIds, ...selectionIds, ...actionsIds]

        setColumnOrder((prev) => (areStringArraysEqual(prev, nextOrder) ? prev : nextOrder))
    }, [pinnedColumnIds, statusColumnId, table])

    React.useLayoutEffect(() => {
        if (!stickyEnabled || leftPinnedColumnIds.length === 0) {
            setLeftPinnedOffsets({})
            return
        }

        const measure = () => {
            let nextLeft = 0
            const nextOffsets: Record<string, number> = {}

            leftPinnedColumnIds.forEach((columnId) => {
                nextOffsets[columnId] = nextLeft
                const element = headerCellRefs.current.get(columnId)
                nextLeft += Math.ceil(element?.getBoundingClientRect().width || 0)
            })

            setLeftPinnedOffsets((prev) => (areNumberRecordsEqual(prev, nextOffsets) ? prev : nextOffsets))
        }

        measure()

        if (typeof ResizeObserver === "undefined") return
        const resizeObserver = new ResizeObserver(measure)
        leftPinnedColumnIds.forEach((columnId) => {
            const element = headerCellRefs.current.get(columnId)
            if (element) resizeObserver.observe(element)
        })

        return () => resizeObserver.disconnect()
    }, [leftPinnedColumnIdsKey, leftPinnedColumnIds.length, stickyEnabled, visibleColumnCount, showColumnFilters, tableClassName])

    const setHeaderCellRef = React.useCallback((columnId: string, element: HTMLTableCellElement | null) => {
        if (element) {
            headerCellRefs.current.set(columnId, element)
            return
        }

        headerCellRefs.current.delete(columnId)
    }, [])

    const togglePinnedColumn = React.useCallback((columnId: string) => {
        if (!columnId || columnId === statusColumnId || isNonDataColumnId(columnId)) return

        setPinnedColumnIds((prev) => {
            if (prev.includes(columnId)) {
                return prev.filter((item) => item !== columnId)
            }

            return [...prev, columnId]
        })
    }, [statusColumnId])

    const handleSaveCurrentColumnView = React.useCallback(() => {
        const selectedIds = sanitizeColumnViewIds(
            hideableColumns
                .filter((column) => column.getIsVisible())
                .map((column) => column.id)
        )
        if (selectedIds.length === 0) {
            toast.warning("Kaydetmek için en az bir sütun görünür olmalı.")
            return
        }

        const rawName = window.prompt("Görünüm adı girin:", "Yeni Görünüm")
        const viewName = rawName?.trim()
        if (!viewName) return

        const existing = savedColumnViews.find(
            (item) => item.name.trim().toLocaleLowerCase("tr-TR") === viewName.toLocaleLowerCase("tr-TR")
        )
        const nextId = existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        setSavedColumnViews((prev) => {
            const nextItem: SavedColumnView = {
                id: nextId,
                name: viewName,
                columnIds: selectedIds,
                createdAt: new Date().toISOString(),
            }
            if (!existing) return [nextItem, ...prev]
            return [nextItem, ...prev.filter((item) => item.id !== existing.id)]
        })

        toast.success(existing ? "Sütun görünümü güncellendi." : "Sütun görünümü kaydedildi.")
    }, [hideableColumns, sanitizeColumnViewIds, savedColumnViews])

    const handleDeleteSavedColumnView = React.useCallback(() => {
        if (savedColumnViews.length === 0) {
            toast.warning("Silinecek kayıtlı görünüm bulunamadı.")
            return
        }

        const suggestion = savedColumnViews[0]?.name || ""
        const rawName = window.prompt("Silmek istediğiniz görünüm adını yazın:", suggestion)
        const targetName = rawName?.trim()
        if (!targetName) return

        const target = savedColumnViews.find(
            (item) => item.name.trim().toLocaleLowerCase("tr-TR") === targetName.toLocaleLowerCase("tr-TR")
        )
        if (!target) {
            toast.warning("Bu adla kayıtlı görünüm bulunamadı.")
            return
        }

        const confirmed = window.confirm(`"${target.name}" görünümünü silmek istiyor musunuz?`)
        if (!confirmed) return

        setSavedColumnViews((prev) => prev.filter((item) => item.id !== target.id))
        toast.success("Kayıtlı görünüm silindi.")
    }, [savedColumnViews])

    const getStickyStyle = React.useCallback(
        (columnIndex: number, columnId: string): React.CSSProperties | undefined => {
            if (!stickyEnabled) return undefined
            if (leftPinnedColumnIdSet.has(columnId)) return { left: leftPinnedOffsets[columnId] || 0 }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) return { right: 0 }
            return undefined
        },
        [actionsColumnIndex, leftPinnedColumnIdSet, leftPinnedOffsets, stickyEnabled]
    )

    const getStickyHeaderClass = React.useCallback(
        (columnIndex: number, columnId: string) => {
            if (!stickyEnabled) return ""
            if (leftPinnedColumnIdSet.has(columnId)) {
                return "sticky z-30 bg-slate-50/95 border-r border-slate-200"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-30 bg-slate-50/95 border-l border-slate-200 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.2)]"
            }
            return ""
        },
        [actionsColumnIndex, leftPinnedColumnIdSet, stickyEnabled]
    )

    const getStickyFilterClass = React.useCallback(
        (columnIndex: number, columnId: string) => {
            if (!stickyEnabled) return ""
            if (leftPinnedColumnIdSet.has(columnId)) {
                return "sticky z-20 bg-slate-50/95 border-r border-slate-200"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-20 bg-slate-50/95 border-l border-slate-200 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]"
            }
            return ""
        },
        [actionsColumnIndex, leftPinnedColumnIdSet, stickyEnabled]
    )

    const getStickyBodyClass = React.useCallback(
        (columnIndex: number, columnId: string) => {
            if (!stickyEnabled) return ""
            if (leftPinnedColumnIdSet.has(columnId)) {
                return "sticky z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50/80"
            }
            if (actionsColumnIndex >= 0 && columnIndex === actionsColumnIndex) {
                return "sticky z-10 border-l border-slate-100 bg-white group-hover:bg-slate-50/80 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"
            }
            return ""
        },
        [actionsColumnIndex, leftPinnedColumnIdSet, stickyEnabled]
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
            const selectedAy = searchParams.get("ay")
            const selectedDisFirmaId = searchParams.get("disFirmaId")
            const selectedExternalMode = searchParams.get("externalMode")
            if (selectedSirket) params.set("sirket", selectedSirket)
            if (selectedYil) params.set("yil", selectedYil)
            if (selectedAy) params.set("ay", selectedAy)
            if (selectedDisFirmaId) params.set("disFirmaId", selectedDisFirmaId)
            if (selectedExternalMode) params.set("externalMode", selectedExternalMode)
            selectedExportColumns.forEach((column) => {
                if (column.label) params.append("column", column.label)
                if (column.key) params.append("columnKey", column.key)
            })

            const endpoint = `/api/excel/${excelEntity}${params.toString() ? `?${params.toString()}` : ""}`
            const filteredRowIds = table
                .getFilteredRowModel()
                .rows.map((row) => {
                    const original = row.original as { id?: unknown }
                    return typeof original?.id === "string" && original.id.trim().length > 0
                        ? original.id.trim()
                        : null
                })
                .filter((id): id is string => Boolean(id))

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    selectedColumns: selectedExportColumns.map((column) => column.label).filter(Boolean),
                    selectedColumnKeys: selectedExportColumns.map((column) => column.key).filter(Boolean),
                    filteredRowIds,
                    restrictToFilteredRows: hasActiveFilter,
                }),
            })

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
    }, [excelEntity, hasActiveFilter, isExporting, isImporting, searchParams, selectedExportColumns, table])

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
            const selectedAy = searchParams.get("ay")
            const selectedDisFirmaId = searchParams.get("disFirmaId")
            const selectedExternalMode = searchParams.get("externalMode")
            if (selectedSirket) params.set("sirket", selectedSirket)
            if (selectedYil) params.set("yil", selectedYil)
            if (selectedAy) params.set("ay", selectedAy)
            if (selectedDisFirmaId) params.set("disFirmaId", selectedDisFirmaId)
            if (selectedExternalMode) params.set("externalMode", selectedExternalMode)
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
            toast.success("Excel içe aktarma tamamlandı.", {
                description: `Toplam ${totalCount} satır işlendi • ${createdCount} eklendi • ${updatedCount} güncellendi • ${skippedCount} atlandı`,
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
                                <DropdownMenuContent align="start" className="w-72">
                                    <DropdownMenuLabel>Görünecek Sütunlar</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {hideableColumns.map((column) => {
                                        const checked = column.getIsVisible()
                                        const disableHide = checked && visibleHideableColumnCount <= 1
                                        const isStatus = statusColumnId === column.id
                                        const isPinned = isStatus || pinnedColumnIds.includes(column.id)
                                        const disableVisibilityToggle = isStatus || disableHide
                                        const displayName = getColumnDisplayName(column)
                                        return (
                                            <div
                                                key={column.id}
                                                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                <button
                                                    type="button"
                                                    aria-label={isStatus ? `${displayName} zaten sabit` : isPinned ? `${displayName} sabitlemesini kaldır` : `${displayName} sütununu sabitle`}
                                                    title={isStatus ? "Durum sütunu her zaman sabit kalır" : isPinned ? "Sabitlemeyi kaldır" : "Sola sabitle"}
                                                    disabled={isStatus}
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        togglePinnedColumn(column.id)
                                                    }}
                                                    className={cn(
                                                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                                                        isPinned
                                                            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                                                            : "border-slate-200 bg-white text-slate-400 hover:border-indigo-200 hover:text-indigo-600",
                                                        isStatus && "cursor-not-allowed opacity-70"
                                                    )}
                                                >
                                                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={disableVisibilityToggle}
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        if (disableVisibilityToggle) return
                                                        column.toggleVisibility(!checked)
                                                    }}
                                                    className={cn(
                                                        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left",
                                                        disableVisibilityToggle ? "cursor-not-allowed opacity-70" : "hover:bg-white"
                                                    )}
                                                >
                                                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-700">
                                                        {checked ? <Check className="h-3 w-3" /> : null}
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate">{displayName}</span>
                                                    {isStatus ? (
                                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                                            Sabit
                                                        </span>
                                                    ) : null}
                                                </button>
                                            </div>
                                        )
                                    })}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={(event) => {
                                            event.preventDefault()
                                            table.resetColumnVisibility()
                                            setPinnedColumnIds([])
                                        }}
                                    >
                                        Varsayılan Sütunlar
                                    </DropdownMenuItem>
                                    {normalizedColumnViewPresets.length > 0 ? (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Hazır Görünümler</DropdownMenuLabel>
                                            {normalizedColumnViewPresets.map((preset) => (
                                                <DropdownMenuItem
                                                    key={`preset-${preset.id}`}
                                                    onSelect={(event) => {
                                                        event.preventDefault()
                                                        applyColumnView(preset.columnIds)
                                                        toast.success(`"${preset.label}" görünümü uygulandı.`)
                                                    }}
                                                >
                                                    {preset.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Özel Görünümler</DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onSelect={(event) => {
                                            event.preventDefault()
                                            handleSaveCurrentColumnView()
                                        }}
                                    >
                                        Mevcut görünümü kaydet
                                    </DropdownMenuItem>
                                    {savedColumnViews.map((view) => (
                                        <DropdownMenuItem
                                            key={`saved-${view.id}`}
                                            onSelect={(event) => {
                                                event.preventDefault()
                                                applyColumnView(view.columnIds)
                                                toast.success(`"${view.name}" görünümü uygulandı.`)
                                            }}
                                        >
                                            {view.name}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem
                                        onSelect={(event) => {
                                            event.preventDefault()
                                            handleDeleteSavedColumnView()
                                        }}
                                    >
                                        Kayıtlı görünüm sil
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
                                        ref={(element) => setHeaderCellRef(header.column.id, element)}
                                        className={cn(
                                            "h-11 whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500",
                                            getStickyHeaderClass(headerIndex, header.column.id)
                                        )}
                                        style={getStickyStyle(headerIndex, header.column.id)}
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
                                        className={cn("px-3 py-2", getStickyFilterClass(columnIndex, column.id))}
                                        style={getStickyStyle(columnIndex, column.id)}
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
                                onClick={() => onRowClick && onRowClick(row.original as TData)}
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
                                            getStickyBodyClass(cellIndex, cell.column.id)
                                        )}
                                        style={getStickyStyle(cellIndex, cell.column.id)}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow className="hover:bg-transparent">
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-auto p-0 border-none"
                            >
                                <EmptyState entity={excelEntity} />
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
                <div className="text-[11px] text-slate-500">
                    Toplam adet: <span className="font-semibold text-slate-700">{filteredCount}</span>
                    {hasActiveFilter ? <span className="ml-1 text-slate-400">/ {totalCount} kayıt</span> : null}
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
