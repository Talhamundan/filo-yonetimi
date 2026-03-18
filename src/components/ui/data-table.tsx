"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, Search, Upload } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

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
import type { ExcelEntityKey } from "@/lib/excel-entities"

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

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    searchPlaceholder = "Ara...",
    toolbarRight,
    onRowClick,
    tableClassName,
    excelEntity,
    toolbarLayout = "compact",
    toolbarArrangement = "default",
    serverFiltering,
}: DataTableProps<TData, TValue>) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isRouting, startTransition] = React.useTransition()
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const searchParamsString = searchParams.toString()
    const isServerFilteringEnabled = Boolean(serverFiltering)
    const currentServerQ = searchParams.get("q") || ""
    const currentServerStatus = searchParams.get("status") || ""
    const currentServerType = searchParams.get("type") || ""
    const currentServerFrom = searchParams.get("from") || ""
    const currentServerTo = searchParams.get("to") || ""
    const [serverQuery, setServerQuery] = React.useState(currentServerQ)

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    React.useEffect(() => {
        if (!isServerFilteringEnabled) return
        setServerQuery(currentServerQ)
    }, [currentServerQ, isServerFilteringEnabled])

    const setServerParam = React.useCallback(
        (key: "q" | "status" | "type" | "from" | "to", value: string) => {
            const params = new URLSearchParams(searchParamsString)
            const current = params.get(key) || ""
            if (current === value) return
            if (value) params.set(key, value)
            else params.delete(key)
            params.delete("page")
            const query = params.toString()
            startTransition(() => {
                router.replace(query ? `${pathname}?${query}` : pathname)
            })
        },
        [pathname, router, searchParamsString]
    )

    React.useEffect(() => {
        if (!isServerFilteringEnabled) return
        if (serverQuery === currentServerQ) return
        const timeout = window.setTimeout(() => {
            setServerParam("q", serverQuery)
        }, 320)
        return () => window.clearTimeout(timeout)
    }, [currentServerQ, isServerFilteringEnabled, serverQuery, setServerParam])

    const resetServerFilters = React.useCallback(() => {
        const params = new URLSearchParams(searchParamsString)
        params.delete("q")
        params.delete("status")
        params.delete("type")
        params.delete("from")
        params.delete("to")
        params.delete("page")
        const query = params.toString()
        startTransition(() => {
            router.replace(query ? `${pathname}?${query}` : pathname)
        })
    }, [pathname, router, searchParamsString])

    const filteredCount = isServerFilteringEnabled ? data.length : table.getFilteredRowModel().rows.length
    const totalCount = data.length
    const pageIndex = table.getState().pagination.pageIndex
    const pageSize = table.getState().pagination.pageSize
    const pageStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
    const pageEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)
    const hasTableFilter = table.getState().columnFilters.some((filter) => String(filter.value ?? "").trim().length > 0)
    const hasServerFilter = Boolean(
        currentServerQ || currentServerStatus || currentServerType || currentServerFrom || currentServerTo
    )
    const hasActiveFilter = isServerFilteringEnabled ? hasServerFilter : hasTableFilter
    const hasToolbar = Boolean(searchKey || toolbarRight || excelEntity || isServerFilteringEnabled)
    const isCompactToolbar = toolbarLayout === "compact"
    const isReportRightScroll = isCompactToolbar && toolbarArrangement === "report-right-scroll"

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
            const fileName = getDownloadFileName(
                response.headers.get("content-disposition"),
                fallbackName
            )

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

            toast.success("Excel içe aktarma tamamlandı.", {
                description: `Toplam ${payload.total} satır işlendi • ${payload.created} eklendi • ${payload.updated} güncellendi • ${payload.skipped} atlandı`,
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
        <div className="w-full min-w-0 max-w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {hasToolbar && (
                <div
                    className={
                        isCompactToolbar
                            ? "flex flex-col gap-3 p-4 border-b border-slate-100 bg-slate-50/50 xl:flex-row xl:items-center xl:justify-between xl:flex-nowrap"
                            : "flex items-center justify-between gap-3 flex-wrap p-4 border-b border-slate-100 bg-slate-50/50"
                    }
                >
                    {searchKey ? (
                        <div
                            className={
                                isCompactToolbar
                                    ? isReportRightScroll
                                        ? "relative w-full xl:w-[280px] xl:min-w-[220px] xl:max-w-[300px] xl:shrink-0"
                                        : "relative w-full xl:w-[340px] xl:min-w-[280px] xl:max-w-[360px] xl:shrink-0"
                                    : "relative w-full max-w-sm"
                            }
                        >
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={
                                    isServerFilteringEnabled
                                        ? serverQuery
                                        : (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
                                }
                                onChange={(event) => {
                                    if (isServerFilteringEnabled) {
                                        setServerQuery(event.target.value)
                                        return
                                    }
                                    table.getColumn(searchKey)?.setFilterValue(event.target.value)
                                }}
                                className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-lg shadow-sm w-full"
                            />
                        </div>
                    ) : null}
                    <div
                        className={
                            isReportRightScroll
                                ? "w-full min-w-0 flex items-center justify-start gap-2 overflow-x-auto pb-1"
                                : isCompactToolbar
                                ? "w-full grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end xl:w-auto xl:flex-nowrap"
                                : "w-full sm:w-auto flex items-center justify-end gap-2 flex-wrap"
                        }
                    >
                        {isServerFilteringEnabled && serverFiltering?.statusOptions?.length ? (
                            <select
                                value={currentServerStatus}
                                onChange={(event) => setServerParam("status", event.target.value)}
                                className={
                                    isReportRightScroll
                                        ? "h-10 min-w-[160px] shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                                        : isCompactToolbar
                                        ? "order-3 sm:order-1 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm sm:min-w-[150px] sm:w-auto"
                                        : "h-10 min-w-[170px] rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                                }
                            >
                                <option value="">Tüm Durumlar</option>
                                {serverFiltering.statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        {isServerFilteringEnabled && serverFiltering?.typeOptions?.length ? (
                            <select
                                value={currentServerType}
                                onChange={(event) => setServerParam("type", event.target.value)}
                                className={
                                    isReportRightScroll
                                        ? "h-10 min-w-[160px] shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                                        : isCompactToolbar
                                        ? "order-5 sm:order-2 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm sm:min-w-[150px] sm:w-auto"
                                        : "h-10 min-w-[170px] rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                                }
                            >
                                <option value="">Tüm Tipler</option>
                                {serverFiltering.typeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        {isServerFilteringEnabled && serverFiltering?.showDateRange ? (
                            <>
                                <Input
                                    type="date"
                                    value={currentServerFrom}
                                    onChange={(event) => setServerParam("from", event.target.value)}
                                    className={
                                        isReportRightScroll
                                            ? "h-10 w-[150px] min-w-[150px] shrink-0 bg-white"
                                            : isCompactToolbar
                                            ? "order-1 sm:order-3 h-10 w-full min-w-0 bg-white sm:w-[148px]"
                                            : "h-10 min-w-[160px] bg-white"
                                    }
                                />
                                <Input
                                    type="date"
                                    value={currentServerTo}
                                    onChange={(event) => setServerParam("to", event.target.value)}
                                    className={
                                        isReportRightScroll
                                            ? "h-10 w-[150px] min-w-[150px] shrink-0 bg-white"
                                            : isCompactToolbar
                                            ? "order-2 sm:order-4 h-10 w-full min-w-0 bg-white sm:w-[148px]"
                                            : "h-10 min-w-[160px] bg-white"
                                    }
                                />
                            </>
                        ) : null}
                        {isServerFilteringEnabled ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={
                                    isReportRightScroll
                                        ? "h-10 min-w-[170px] shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                        : isCompactToolbar
                                        ? "order-4 sm:order-5 h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                        : "h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:w-auto"
                                }
                                onClick={resetServerFilters}
                                disabled={!hasServerFilter}
                            >
                                Filtreleri Sıfırla
                            </Button>
                        ) : null}
                        {toolbarRight ? (
                            <div
                                className={
                                    isReportRightScroll
                                        ? "shrink-0"
                                        : isCompactToolbar
                                        ? "order-[30] sm:order-none w-full col-span-2 sm:col-span-1 sm:w-auto"
                                        : "w-full sm:w-auto"
                                }
                            >
                                {toolbarRight}
                            </div>
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
                                            ? "order-[40] col-span-2 grid grid-cols-2 gap-2 sm:order-none sm:w-auto sm:flex sm:items-center sm:gap-2"
                                            : "w-full sm:w-auto flex items-center gap-2"
                                    }
                                >
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
                                            <Download className="h-4 w-4" />
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
                                            <Upload className="h-4 w-4" />
                                        )}
                                        İçe Aktar
                                    </Button>
                                </div>
                            </>
                        ) : null}
                        {isRouting ? (
                            <span
                                className={
                                    isReportRightScroll
                                        ? "inline-flex shrink-0 items-center gap-1 text-xs text-slate-500"
                                        : isCompactToolbar
                                        ? "order-[40] sm:order-none inline-flex items-center gap-1 text-xs text-slate-500 col-span-2 sm:col-span-1"
                                        : "inline-flex items-center gap-1 text-xs text-slate-500 col-span-2 sm:col-span-1"
                                }
                            >
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Güncelleniyor
                            </span>
                        ) : null}
                    </div>
                </div>
            )}
            <Table className={tableClassName}>
                    <TableHeader className="bg-slate-50/80">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-slate-200">
                                {headerGroup.headers.map((header) => {
                                    const canSort = header.column.getCanSort()
                                    const sortedState = header.column.getIsSorted()
                                    const headerContent = header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )
                                    return (
                                        <TableHead key={header.id} className="h-11 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap px-4 py-3">
                                            {canSort ? (
                                                <button
                                                    type="button"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    className="inline-flex items-center gap-1.5 text-left select-none"
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
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={() => onRowClick && onRowClick(row.original)}
                                    className={`
                                        border-b-slate-100 hover:bg-slate-50/80 transition-colors
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                    `}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-4 py-3.5 align-middle text-sm text-slate-700">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-32 text-center text-slate-500 font-medium bg-slate-50/30"
                                >
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/40">
                <div className="text-xs text-slate-500">
                    Toplam adet: <span className="font-semibold text-slate-700">{filteredCount}</span>
                    {hasActiveFilter ? (
                        <span className="ml-1 text-slate-400">/ {totalCount} kayıt</span>
                    ) : null}
                    {table.getPageCount() > 1 ? (
                        <span className="ml-2 text-slate-400">({pageStart}-{pageEnd} arası)</span>
                    ) : null}
                </div>
                {table.getPageCount() > 1 ? (
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="h-8 shadow-sm border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
                        >
                            Önceki
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="h-8 shadow-sm border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
                        >
                            Sonraki
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
