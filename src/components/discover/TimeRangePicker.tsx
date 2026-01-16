"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  TimeRange,
  FlexibleTimeRange,
  getFlexibleRangeFromEnum,
} from "@/lib/types/discover";

// Quick time ranges mapping
const QUICK_RANGES: { value: TimeRange; label: string }[] = [
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

interface TimeRangePickerProps {
  value: FlexibleTimeRange;
  onChange: (range: FlexibleTimeRange) => void;
  className?: string;
}

export function TimeRangePicker({
  value,
  onChange,
  className,
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);

  // State for absolute range picker
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && value.type === "absolute") {
      try {
        setDateRange({
          from: new Date(value.from),
          to: value.to === "now" ? new Date() : new Date(value.to),
        });
      } catch {
        // Ignore invalid dates
      }
    }
  };

  const handleQuickSelect = (range: TimeRange) => {
    onChange(getFlexibleRangeFromEnum(range));
    setOpen(false);
  };

  const handleApplyAbsolute = () => {
    if (dateRange.from && dateRange.to) {
      onChange({
        type: "absolute",
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        label: `${format(dateRange.from, "MMM d, HH:mm")} to ${format(
          dateRange.to,
          "MMM d, HH:mm"
        )}`,
      });
      setOpen(false);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {value.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Tabs defaultValue="quick" className="w-[400px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick">Quick Select</TabsTrigger>
              <TabsTrigger value="absolute">Absolute Range</TabsTrigger>
            </TabsList>

            {/* Quick Select Tab */}
            <TabsContent value="quick" className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_RANGES.map((range) => (
                  <Button
                    key={range.value}
                    variant="ghost"
                    className="justify-start text-sm"
                    onClick={() => handleQuickSelect(range.value)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </TabsContent>

            {/* Absolute Range Tab */}
            <TabsContent value="absolute" className="p-0">
              <div className="flex flex-col">
                <div className="p-4 border-b">
                  <div className="grid gap-2">
                    <Label>Select Time Range</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground">
                          From
                        </span>
                        <div className="font-mono text-sm">
                          {dateRange.from
                            ? format(dateRange.from, "PPP p")
                            : "Select date"}
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground">
                          To
                        </span>
                        <div className="font-mono text-sm">
                          {dateRange.to
                            ? format(dateRange.to, "PPP p")
                            : "Select date"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-0">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) =>
                      setDateRange(range || { from: undefined, to: undefined })
                    }
                    numberOfMonths={2}
                    className="rounded-md border-0"
                  />
                </div>
                <div className="p-4 border-t bg-muted/20 flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleApplyAbsolute}
                    disabled={!dateRange.from || !dateRange.to}
                  >
                    Apply Range
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}
