"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

interface QueryBarAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (value: string) => void;
  columns: Array<{ name: string; type: string }>;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
}

export function QueryBarAutocomplete({
  value,
  onChange,
  onExecute,
  columns,
  placeholder = "Enter filter expression, e.g. status >= 400 AND host LIKE '%api%'",
  isLoading = false,
  className,
}: QueryBarAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const tokens = value.split(/\s+/);
    const lastToken = tokens[tokens.length - 1];

    if (lastToken.length === 0) {
      return columns.slice(0, 10);
    }

    const searchTerm = lastToken.toLowerCase();
    return columns
      .filter((col) => col.name.toLowerCase().includes(searchTerm))
      .slice(0, 10);
  }, [value, columns]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const suggestion = suggestions[selectedIndex];
        const newValue = value.replace(/\S+$/, suggestion.name);
        onChange(newValue);
        setIsOpen(false);
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onExecute(value);
        setIsOpen(false);
      }

      if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [value, suggestions, selectedIndex, onChange, onExecute]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      setIsOpen(newValue.length > 0 && suggestions.length > 0);
    },
    [onChange, suggestions.length]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: { name: string }) => {
      const newValue = value.replace(/\S+$/, suggestion.name);
      onChange(newValue);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (value.length > 0 && suggestions.length > 0) {
      setIsOpen(true);
    }
  }, [value, suggestions.length]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(e.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pl-10 pr-10"
          disabled={isLoading}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 h-7 w-7 p-0"
            onClick={handleClear}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.name}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className="font-medium">{suggestion.name}</span>
              <span className="text-xs text-muted-foreground">
                {suggestion.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}