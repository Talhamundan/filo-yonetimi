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
import { useRouter, useSearchParams } from "next/navigation"
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
}: DataTableProps<TData, TValue>) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)

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

    const filteredCount = table.getFilteredRowModel().rows.length
    const totalCount = data.length
    const pageIndex = table.getState().pagination.pageIndex
    const pageSize = table.getState().pagination.pageSize
    const pageStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
    const pageEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)
    const hasActiveFilter = table.getState().columnFilters.some((filter) =>
        String(filter.value ?? "").trim().length > 0
    )
    const hasToolbar = Boolean(searchKey || toolbarRight || excelEntity)

    const handleExport = React.useCallback(async () => {
        if (!excelEntity || isExporting) return

        setIsExporting(true)
        try {
            const params = new URLSearchParams()
            const selectedSirket = searchParams.get("sirket")
            const selectedYil = searchParams.get("yil")

            if (selectedSirket) {
                params.set("sirket", selectedSirket)
            }
            if (selectedYil) {
                params.set("yil", selectedYil)
            }

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
    }, [excelEntity, isExporting, searchParams])

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
                <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-slate-100 bg-slate-50/50">
                    {searchKey ? (
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                                onChange={(event) =>
                                    table.getColumn(searchKey)?.setFilterValue(event.target.value)
                                }
                                className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-lg shadow-sm w-full"
                            />
                        </div>
                    ) : null}
                    <div className="w-full sm:w-auto flex items-center justify-end gap-2 flex-wrap">
                        {toolbarRight ? <div className="w-full sm:w-auto">{toolbarRight}</div> : null}
                        {excelEntity ? (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleImportFileChange}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
                                    className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
                            </>
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
