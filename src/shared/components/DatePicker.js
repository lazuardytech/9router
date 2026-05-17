"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "@/shared/utils/cn";

/**
 * DatePicker — shadcn-style date picker using react-day-picker.
 * Props:
 *   value: Date | null
 *   onChange: (date: Date | null) => void
 *   placeholder: string
 *   disabled: boolean
 *   className: string
 */
export default function DatePicker({ value, onChange, placeholder = "Pick a date", disabled = false, className }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayValue = value ? format(value, "MMM d, yyyy") : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
          "border-black/10 dark:border-white/10 bg-surface text-text-main",
          "hover:border-black/20 dark:hover:border-white/20",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !displayValue && "text-text-muted",
        )}
      >
        <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">calendar_today</span>
        <span className="flex-1 text-left truncate">{displayValue || placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            className="material-symbols-outlined text-[14px] text-text-muted hover:text-text-main shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange(null);
              }
            }}
          >
            close
          </span>
        )}
      </button>

      {/* Calendar popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 rounded-lg border border-black/10 dark:border-white/10",
            "bg-surface shadow-xl shadow-black/20 p-3",
            "left-0 top-full",
          )}
        >
          <DayPicker
            mode="single"
            selected={value || undefined}
            onSelect={(date) => {
              onChange(date || null);
              setOpen(false);
            }}
            initialFocus
            classNames={{
              months: "flex flex-col",
              month: "space-y-3",
              caption: "flex justify-center items-center relative px-8 py-1",
              caption_label: "text-sm font-medium text-text-main",
              nav: "flex items-center gap-1",
              nav_button: cn(
                "flex items-center justify-center size-7 rounded-md border border-black/10 dark:border-white/10",
                "text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors",
              ),
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-text-muted text-[11px] font-medium w-9 text-center",
              row: "flex w-full mt-1",
              cell: cn("relative p-0 text-center text-sm", "focus-within:relative focus-within:z-20"),
              day: cn(
                "flex items-center justify-center size-9 rounded-md text-sm font-normal",
                "text-text-main hover:bg-surface-2 transition-colors cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-primary/20",
              ),
              day_selected: "bg-primary text-primary-fg hover:bg-primary hover:text-primary-fg font-medium",
              day_today: "border border-primary/40 text-primary font-medium",
              day_outside: "text-text-muted opacity-40",
              day_disabled: "text-text-muted opacity-30 cursor-not-allowed",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <span className="material-symbols-outlined text-[16px]">chevron_left</span>,
              IconRight: () => <span className="material-symbols-outlined text-[16px]">chevron_right</span>,
            }}
          />
        </div>
      )}
    </div>
  );
}
