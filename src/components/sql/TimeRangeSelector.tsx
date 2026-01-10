import { useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
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

export interface TimeRangeSelectorProps {
  onApply: (start: Date, end: Date, columnName: string) => void;
  disabled?: boolean;
}

// Helper functions to replace date-fns
const subHours = (date: Date, hours: number) => {
  const newDate = new Date(date);
  newDate.setTime(newDate.getTime() - hours * 60 * 60 * 1000);
  return newDate;
};

const subDays = (date: Date, days: number) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() - days);
  return newDate;
};

const formatForInput = (date: Date) => {
  // YYYY-MM-DDThh:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function TimeRangeSelector({
  onApply,
  disabled,
}: TimeRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState("24h");
  const [columnName, setColumnName] = useState("event_time");

  // Custom range state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const presets = [
    {
      value: "1h",
      label: "Last 1 hour",
      getRange: () => [subHours(new Date(), 1), new Date()],
    },
    {
      value: "6h",
      label: "Last 6 hours",
      getRange: () => [subHours(new Date(), 6), new Date()],
    },
    {
      value: "24h",
      label: "Last 24 hours",
      getRange: () => [subHours(new Date(), 24), new Date()],
    },
    {
      value: "7d",
      label: "Last 7 days",
      getRange: () => [subDays(new Date(), 7), new Date()],
    },
    {
      value: "30d",
      label: "Last 30 days",
      getRange: () => [subDays(new Date(), 30), new Date()],
    },
  ];

  const handleApply = () => {
    let start: Date, end: Date;

    if (mode === "preset") {
      const selectedPreset = presets.find((p) => p.value === preset);
      if (selectedPreset) {
        [start, end] = selectedPreset.getRange();
      } else {
        return;
      }
    } else {
      if (!startDate || !endDate) return;
      start = new Date(startDate);
      end = new Date(endDate);
    }

    onApply(start, end, columnName);
    setOpen(false);
  };

  const initCustomDates = () => {
    const now = new Date();
    const start = subHours(now, 24);
    setStartDate(formatForInput(start));
    setEndDate(formatForInput(now));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" disabled={disabled}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          Time Range
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Select Time Range</h4>
            <p className="text-sm text-muted-foreground">
              Choose a preset or define a custom range.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="grid gap-2 mb-2">
              <Label htmlFor="column-name">Time Column</Label>
              <Input
                id="column-name"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="e.g. event_time"
                className="h-8"
              />
            </div>

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
              <Select value={preset} onValueChange={setPreset}>
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
            <Clock className="mr-2 h-4 w-4" />
            Apply to Query
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
