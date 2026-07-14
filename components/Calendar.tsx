"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, spanDates, todayISO } from "@/lib/dates";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function Calendar({
  selectedStart,
  spanDays,
  onSelect,
}: {
  selectedStart: string | null;
  spanDays: number;
  onSelect: (date: string) => void;
}) {
  const today = todayISO();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [heldByMonth, setHeldByMonth] = useState<Record<string, string[]>>({});

  const key = monthKey(year, month);

  useEffect(() => {
    if (heldByMonth[key]) return;
    const from = `${key}-01`;
    const to = addDays(
      `${key}-${String(new Date(Date.UTC(year, month + 1, 0)).getUTCDate()).padStart(2, "0")}`,
      1
    );
    let cancelled = false;
    fetch(`/api/availability?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setHeldByMonth((prev) => ({ ...prev, [key]: data.held || [] }));
        }
      })
      .catch(() => {
        if (!cancelled) setHeldByMonth((prev) => ({ ...prev, [key]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, year, month, heldByMonth]);

  const held = useMemo(() => new Set(heldByMonth[key] || []), [heldByMonth, key]);
  const selectedSpan = useMemo(
    () => new Set(selectedStart ? spanDates(selectedStart, spanDays) : []),
    [selectedStart, spanDays]
  );

  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const atCurrentMonth =
    year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7)) - 1;

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e${i}`} className="calCell empty" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${key}-${String(day).padStart(2, "0")}`;
    const isPast = iso < today;
    const isHeld = held.has(iso);
    const isSelected = selectedSpan.has(iso);
    const cls = [
      "calCell",
      isPast ? "past" : isHeld ? "held" : "open",
      isSelected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cells.push(
      <button
        key={iso}
        type="button"
        className={cls}
        disabled={isPast || isHeld}
        onClick={() => onSelect(iso)}
        aria-label={isHeld ? `${iso} held` : iso}
      >
        <span>{day}</span>
        {isHeld && !isPast && <span className="heldTag">HELD</span>}
      </button>
    );
  }

  return (
    <div>
      <div className="calHeader">
        <div className="calMonth">
          {MONTHS[month]} {year}
        </div>
        <div className="calNav">
          <button
            type="button"
            onClick={() => shift(-1)}
            disabled={atCurrentMonth}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month">
            ›
          </button>
        </div>
      </div>
      <div className="calGrid">
        {DOW.map((d, i) => (
          <div key={i} className="calDow">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
