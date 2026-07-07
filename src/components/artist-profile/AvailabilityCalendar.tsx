import { useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isBefore } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  availability: Record<string, "available" | "unavailable">;
  onUpdate: (avail: Record<string, "available" | "unavailable">) => void;
  readOnly?: boolean;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const AvailabilityCalendar = ({ availability, onUpdate, readOnly }: Props) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const toggleDay = (dateStr: string) => {
    if (readOnly) return;
    const current = availability[dateStr];
    const next = current === "available" ? "unavailable" : current === "unavailable" ? undefined : "available";
    const updated = { ...availability };
    if (next) {
      updated[dateStr] = next;
    } else {
      delete updated[dateStr];
    }
    onUpdate(updated);
  };

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Availability</h3>
      <div className="rounded-xl border border-card-border bg-card p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
            <ChevronLeft size={18} className="text-muted-foreground" />
          </button>
          <span className="font-display font-semibold text-sm">{format(currentMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const status = availability[dateStr];
            const past = isBefore(day, new Date()) && !isToday(day);

            return (
              <button
                key={dateStr}
                disabled={past || readOnly}
                onClick={() => toggleDay(dateStr)}
                className={cn(
                  "h-8 w-full rounded-md text-xs font-medium transition",
                  past && "text-muted-foreground/40 cursor-not-allowed",
                  !past && !status && "hover:bg-muted",
                  status === "available" && "bg-success/20 text-success border border-success/30",
                  status === "unavailable" && "bg-destructive/15 text-destructive border border-destructive/30",
                  isToday(day) && !status && "ring-1 ring-primary"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {!readOnly && (
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-success/30 border border-success/40" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive/20 border border-destructive/30" /> Unavailable
            </span>
            <span>Tap to cycle</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default AvailabilityCalendar;
