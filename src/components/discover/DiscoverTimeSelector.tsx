import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FlexibleTimeRange,
  TimeRange,
  getFlexibleRangeFromEnum,
} from "@/lib/types/discover";
import { format } from "date-fns";

interface DiscoverTimeSelectorProps {
  value: FlexibleTimeRange;
  onChange: (range: FlexibleTimeRange) => void;
  disabled?: boolean;
}

// Helper functions for custom date initialization
const subHours = (date: Date, hours: number) => {
  const newDate = new Date(date);
  newDate.setTime(newDate.getTime() - hours * 60 * 60 * 1000);
  return newDate;
};

const formatForInput = (date: Date) => {
  // YYYY-MM-DDThh:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function DiscoverTimeSelector({
  value,
  onChange,
  disabled,
}: DiscoverTimeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  // Default preset or "custom" if active value is absolute
  const [preset, setPreset] = useState<TimeRange>("1h");

  // Custom range state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sync internal state when popover opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      if (value.type === "relative") {
        setMode("preset");
        // extract "1h" from "now-1h"
        const rangeKey = value.from.replace("now-", "") as TimeRange;
        // Simple check if it's a valid preset key, if not default to 1h
        setPreset(rangeKey);
      } else {
        setMode("custom");
        // Initialize inputs from absolute value
        try {
          const from = new Date(value.from);
          const to = value.to === "now" ? new Date() : new Date(value.to);
          setStartDate(formatForInput(from));
          setEndDate(formatForInput(to));
        } catch {
          initCustomDates();
        }
      }
    }
  };

  const presets: { value: TimeRange; label: string }[] = [
    { value: "5m", label: "Last 5 minutes" },
    { value: "15m", label: "Last 15 minutes" },
    { value: "30m", label: "Last 30 minutes" },
    { value: "1h", label: "Last 1 hour" },
    { value: "3h", label: "Last 3 hours" },
    { value: "6h", label: "Last 6 hours" },
    { value: "12h", label: "Last 12 hours" },
    { value: "24h", label: "Last 24 hours" },
    { value: "3d", label: "Last 3 days" },
    { value: "7d", label: "Last 7 days" },
  ];

  const handleApply = () => {
    if (mode === "preset") {
      onChange(getFlexibleRangeFromEnum(preset));
    } else {
      if (!startDate || !endDate) return;
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        onChange({
          type: "absolute",
          from: start.toISOString(),
          to: end.toISOString(),
          label: `${format(start, "MMM d, HH:mm")} to ${format(
            end,
            "MMM d, HH:mm"
          )}`,
        });
      } catch (e) {
        console.error("Invalid date range", e);
        return;
      }
    }
    setOpen(false);
  };

  const initCustomDates = () => {
    const now = new Date();
    const start = subHours(now, 24);
    setStartDate(formatForInput(start));
    setEndDate(formatForInput(now));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 justify-start min-w-[180px] font-normal"
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Select Time Range</h4>
            <p className="text-sm text-muted-foreground">
              Choose a preset or define a custom range.
            </p>
          </div>

          <div className="grid gap-2">
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as "preset" | "custom");
                if (v === "custom" && !startDate) {
                  initCustomDates();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Preset Range</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {mode === "preset" ? (
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as TimeRange)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-2">
                  <Label htmlFor="start-date" className="col-span-1">
                    Start
                  </Label>
                  <Input
                    id="start-date"
                    type="datetime-local"
                    className="col-span-2 h-8"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <Label htmlFor="end-date" className="col-span-1">
                    End
                  </Label>
                  <Input
                    id="end-date"
                    type="datetime-local"
                    className="col-span-2 h-8"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleApply} className="w-full">
            Apply Time Range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
