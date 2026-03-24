"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardScope } from "@/components/layout/DashboardScopeContext"
import type { DashboardCalendarEvent, DashboardEventType } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

type EventWithDate = DashboardCalendarEvent & {
  eventDate: Date
  dayKey: string
}

type FilterType = "ALL" | DashboardEventType

const TYPE_META: Record<DashboardEventType, { label: string; shortLabel: string; dotClass: string; chipClass: string }> = {
  TRAFIK: {
    label: "Trafik",
    shortLabel: "Trf",
    dotClass: "bg-sky-500",
    chipClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  KASKO: {
    label: "Kasko",
    shortLabel: "Ksk",
    dotClass: "bg-orange-500",
    chipClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  MUAYENE: {
    label: "Muayene",
    shortLabel: "Mua",
    dotClass: "bg-emerald-500",
    chipClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CEZA: {
    label: "Ceza",
    shortLabel: "Cza",
    dotClass: "bg-rose-500",
    chipClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
}

const STATUS_META: Record<DashboardCalendarEvent["status"], { label: string; className: string }> = {
  GECIKTI: {
    label: "Gecikti",
    className: "text-rose-700 bg-rose-50 border-rose-200",
  },
  YUKSEK: {
    label: "Yüksek",
    className: "text-orange-700 bg-orange-50 border-orange-200",
  },
  KRITIK: {
    label: "Yüksek",
    className: "text-orange-700 bg-orange-50 border-orange-200",
  },
  YAKLASTI: {
    label: "Yaklaştı",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  PLANLI: {
    label: "Planlı",
    className: "text-slate-700 bg-slate-50 border-slate-200",
  },
}

function toDayKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDefaultSelectedDate(monthDate: Date) {
  const today = normalizeDate(new Date())
  if (today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth()) {
    return today
  }
  return normalizeDate(monthDate)
}

interface DeadlineCalendarProps {
  events: DashboardCalendarEvent[]
  compact?: boolean
}

export default function DeadlineCalendar({ events, compact = false }: DeadlineCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAccessAllCompanies } = useDashboardScope()
  const selectedYil = Number(searchParams.get("yil"))
  const selectedAy = Number(searchParams.get("ay"))
  const initialMonthDate =
    Number.isInteger(selectedYil) &&
    Number.isInteger(selectedAy) &&
    selectedAy >= 1 &&
    selectedAy <= 12
      ? new Date(selectedYil, selectedAy - 1, 1)
      : new Date()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(initialMonthDate))
  const [selectedDate, setSelectedDate] = useState(() => getDefaultSelectedDate(startOfMonth(initialMonthDate)))
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL")
  const calendarPanelRef = useRef<HTMLDivElement | null>(null)
  const [calendarPanelHeight, setCalendarPanelHeight] = useState<number | null>(null)

  const normalizedEvents = useMemo<EventWithDate[]>(() => {
    return events
      .map((event) => {
        const eventDate = normalizeDate(parseISO(event.date))
        return {
          ...event,
          eventDate,
          dayKey: toDayKey(eventDate),
        }
      })
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
  }, [events])

  const filteredEvents = useMemo(() => {
    if (activeFilter === "ALL") return normalizedEvents
    return normalizedEvents.filter((event) => event.type === activeFilter)
  }, [activeFilter, normalizedEvents])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventWithDate[]>()
    for (const event of filteredEvents) {
      const current = map.get(event.dayKey) || []
      current.push(event)
      map.set(event.dayKey, current)
    }
    for (const [key, value] of map.entries()) {
      map.set(
        key,
        value.sort((a, b) => {
          if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft
          return a.type.localeCompare(b.type)
        }),
      )
    }
    return map
  }, [filteredEvents])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const selectedDayKey = toDayKey(selectedDate)
  const selectedDayEvents = eventsByDay.get(selectedDayKey) || []

  const monthEventCount = useMemo(() => {
    return filteredEvents.filter(
      (event) =>
        event.eventDate.getFullYear() === currentMonth.getFullYear() &&
        event.eventDate.getMonth() === currentMonth.getMonth(),
    ).length
  }, [currentMonth, filteredEvents])

  const filters: { key: FilterType; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "TRAFIK", label: "Trafik" },
    { key: "KASKO", label: "Kasko" },
    { key: "MUAYENE", label: "Muayene" },
    { key: "CEZA", label: "Ceza" },
  ]

  const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

  useEffect(() => {
    const panel = calendarPanelRef.current
    if (!panel) return

    const syncHeight = () => {
      setCalendarPanelHeight(panel.offsetHeight)
    }

    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(panel)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!Number.isInteger(selectedYil) || !Number.isInteger(selectedAy) || selectedAy < 1 || selectedAy > 12) {
      return
    }
    const nextMonth = startOfMonth(new Date(selectedYil, selectedAy - 1, 1))
    setCurrentMonth(nextMonth)
    setSelectedDate(getDefaultSelectedDate(nextMonth))
  }, [selectedYil, selectedAy])

  const navigateToEvent = (href: string) => {
    const selectedSirketId = searchParams.get("sirket")
    const selectedYil = searchParams.get("yil")
    const selectedAy = searchParams.get("ay")
    if (href.includes("sirket=") || href.includes("yil=")) {
      router.push(href)
      return
    }

    const scopedParams = new URLSearchParams()
    if (selectedSirketId) scopedParams.set("sirket", selectedSirketId)
    if (selectedYil) scopedParams.set("yil", selectedYil)
    if (selectedAy) scopedParams.set("ay", selectedAy)
    const query = scopedParams.toString()
    if (!query) {
      router.push(href)
      return
    }
    const joinChar = href.includes("?") ? "&" : "?"
    router.push(`${href}${joinChar}${query}`)
  }

  return (
    <Card className={cn("shadow-sm border border-[#E2E8F0] bg-white rounded-xl", compact ? "mb-0" : "mb-5")}>
      <CardHeader className={cn(compact ? "pb-0 px-4 pt-4" : "pb-1")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className={cn("text-slate-900 flex items-center gap-2", compact ? "text-sm" : "text-base")}>
              <CalendarClock size={18} className="text-indigo-600" />
              Tarih Takvimi
            </CardTitle>
            <p className={cn("text-slate-500 mt-1", compact ? "text-xs" : "text-sm")}>
              Trafik, kasko, muayene ve ceza son tarihlerini gün bazında izleyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => {
              const active = activeFilter === filter.key
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-full border transition-colors ${
                    compact ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
                  } ${
                    active
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "pt-2 px-4 pb-2" : "pt-1 px-6 pb-3")}>
        <div className={cn("grid grid-cols-1 items-start gap-3", compact ? "xl:grid-cols-[1.7fr_1fr]" : "xl:grid-cols-[2fr_0.95fr]")}>
          <div ref={calendarPanelRef} className="rounded-lg border border-slate-200">
            <div className={cn("border-b border-slate-200 flex items-center justify-between", compact ? "px-2.5 py-1.5" : "px-3 py-2")}>
              <button
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Önceki Ay"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="font-semibold text-sm text-slate-900">
                {format(currentMonth, "MMMM yyyy", { locale: tr })}
              </p>
              <button
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Sonraki Ay"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 px-1.5 pt-1 pb-0.5">
              {weekdays.map((day) => (
                <div key={day} className={cn("text-center font-semibold text-slate-500 py-0", compact ? "text-[9px]" : "text-[10px]")}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 p-1.5">
              {monthDays.map((day) => {
                const key = toDayKey(day)
                const dayEvents = eventsByDay.get(key) || []
                const dayDots = dayEvents.slice(0, 3)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = isSameDay(day, selectedDate)
                const isToday = isSameDay(day, new Date())

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(normalizeDate(day))}
                    className={`${compact ? "h-10 md:h-11" : "h-12 md:h-14"} rounded-md border text-left p-1 flex flex-col transition-colors ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-50/70"
                        : "border-slate-200 hover:bg-slate-50"
                    } ${isCurrentMonth ? "" : "opacity-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`${compact ? "text-[11px]" : "text-xs"} font-semibold ${
                          isToday ? "text-indigo-700" : "text-slate-700"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    {dayEvents.length > 0 ? (
                      <div className="mt-auto pt-0.5 flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {dayDots.map((event) => (
                            <span
                              key={`dot-${event.id}`}
                              className={`h-1.5 w-1.5 rounded-full ${TYPE_META[event.type].dotClass}`}
                            />
                          ))}
                        </div>
                        {dayEvents.length > 3 ? (
                          <span className="text-[8px] text-slate-500 font-medium">+{dayEvents.length - 3}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className="rounded-lg border border-slate-200 flex flex-col min-h-0 overflow-hidden"
            style={calendarPanelHeight ? { height: calendarPanelHeight } : undefined}
          >
            <div className={cn("border-b border-slate-200", compact ? "px-2.5 py-1.5" : "px-3 py-2")}>
              <p className={cn("font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
                {format(selectedDate, "d MMMM yyyy", { locale: tr })}
              </p>
              <p className={cn("text-slate-500 mt-0.5", compact ? "text-[11px]" : "text-xs")}>
                Seçili filtrede bu ay {monthEventCount} kayıt var.
              </p>
            </div>

            <div className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="h-full min-h-[72px] flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Bu gün için kayıt bulunmuyor.
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => navigateToEvent(event.href)}
                    className="w-full text-left border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_META[event.type].chipClass}`}>
                        {TYPE_META[event.type].label}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_META[event.status].className}`}>
                        {STATUS_META[event.status].label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {event.plaka} - {event.title}
                    </p>
                    {canAccessAllCompanies && event.sirketAd ? (
                      <p className="text-xs text-indigo-600 font-medium mt-1">{event.sirketAd}</p>
                    ) : null}
                    {event.type === "CEZA" ? (
                      <p className="text-[11px] text-rose-600 font-semibold mt-1">Ödenmedi</p>
                    ) : null}
                    <p className="text-xs text-slate-500 mt-1">
                      {event.daysLeft < 0
                        ? `${Math.abs(event.daysLeft)} gün gecikmiş`
                        : `${event.daysLeft} gün kaldı`}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
