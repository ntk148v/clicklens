/**
 * ClickHouse Functions Reference
 * Static definitions for autocompletion and signature help
 */

import type { Completion } from "@codemirror/autocomplete";

export interface FunctionSignature {
  signature: string;
  description: string;
  parameters: Array<{ name: string; description: string }>;
}

// Aggregate functions
export const AGGREGATE_FUNCTIONS: Record<string, FunctionSignature> = {
  count: {
    signature: "count()",
    description: "Counts the number of rows or non-NULL values",
    parameters: [],
  },
  sum: {
    signature: "sum(x)",
    description: "Calculates the sum of values",
    parameters: [{ name: "x", description: "Numeric column to sum" }],
  },
  avg: {
    signature: "avg(x)",
    description: "Calculates the arithmetic mean",
    parameters: [{ name: "x", description: "Numeric column" }],
  },
  min: {
    signature: "min(x)",
    description: "Returns the minimum value",
    parameters: [{ name: "x", description: "Column to find minimum" }],
  },
  max: {
    signature: "max(x)",
    description: "Returns the maximum value",
    parameters: [{ name: "x", description: "Column to find maximum" }],
  },
  uniq: {
    signature: "uniq(x)",
    description: "Approximate distinct count (HyperLogLog)",
    parameters: [{ name: "x", description: "Column to count distinct" }],
  },
  uniqexact: {
    signature: "uniqExact(x)",
    description: "Exact distinct count",
    parameters: [{ name: "x", description: "Column to count distinct" }],
  },
  uniqcombined: {
    signature: "uniqCombined(x)",
    description: "Approximate distinct count with better accuracy",
    parameters: [{ name: "x", description: "Column to count distinct" }],
  },
  quantile: {
    signature: "quantile(level)(x)",
    description: "Computes an approximate quantile",
    parameters: [
      {
        name: "level",
        description: "Quantile level (0-1), e.g., 0.5 for median",
      },
      { name: "x", description: "Numeric column" },
    ],
  },
  quantiles: {
    signature: "quantiles(level1, level2, ...)(x)",
    description: "Computes multiple quantiles at once",
    parameters: [
      { name: "levels", description: "Quantile levels (0-1)" },
      { name: "x", description: "Numeric column" },
    ],
  },
  grouparray: {
    signature: "groupArray(x)",
    description: "Creates an array of values from a group",
    parameters: [{ name: "x", description: "Column to aggregate into array" }],
  },
  groupuniqarray: {
    signature: "groupUniqArray(x)",
    description: "Creates an array of unique values",
    parameters: [{ name: "x", description: "Column to aggregate" }],
  },
  topk: {
    signature: "topK(N)(x)",
    description: "Returns approximate most frequent values",
    parameters: [
      { name: "N", description: "Number of top values to return" },
      { name: "x", description: "Column to analyze" },
    ],
  },
  argmin: {
    signature: "argMin(arg, val)",
    description: "Returns arg for the minimum val",
    parameters: [
      { name: "arg", description: "Value to return" },
      { name: "val", description: "Value to minimize" },
    ],
  },
  argmax: {
    signature: "argMax(arg, val)",
    description: "Returns arg for the maximum val",
    parameters: [
      { name: "arg", description: "Value to return" },
      { name: "val", description: "Value to maximize" },
    ],
  },
};

// Array functions
export const ARRAY_FUNCTIONS: Record<string, FunctionSignature> = {
  arrayjoin: {
    signature: "arrayJoin(arr)",
    description: "Expands array into multiple rows",
    parameters: [{ name: "arr", description: "Array to expand" }],
  },
  arraymap: {
    signature: "arrayMap(func, arr)",
    description: "Applies function to each array element",
    parameters: [
      { name: "func", description: "Lambda function: x -> expression" },
      { name: "arr", description: "Array to transform" },
    ],
  },
  arrayfilter: {
    signature: "arrayFilter(func, arr)",
    description: "Filters array elements by predicate",
    parameters: [
      { name: "func", description: "Lambda predicate: x -> boolean" },
      { name: "arr", description: "Array to filter" },
    ],
  },
  arrayexists: {
    signature: "arrayExists(func, arr)",
    description: "Returns 1 if any element matches predicate",
    parameters: [
      { name: "func", description: "Lambda predicate" },
      { name: "arr", description: "Array to check" },
    ],
  },
  arrayfirst: {
    signature: "arrayFirst(func, arr)",
    description: "Returns first element matching predicate",
    parameters: [
      { name: "func", description: "Lambda predicate" },
      { name: "arr", description: "Array to search" },
    ],
  },
  arraylast: {
    signature: "arrayLast(func, arr)",
    description: "Returns last element matching predicate",
    parameters: [
      { name: "func", description: "Lambda predicate" },
      { name: "arr", description: "Array to search" },
    ],
  },
  arrayreverse: {
    signature: "arrayReverse(arr)",
    description: "Reverses array order",
    parameters: [{ name: "arr", description: "Array to reverse" }],
  },
  arraysort: {
    signature: "arraySort(arr)",
    description: "Sorts array in ascending order",
    parameters: [{ name: "arr", description: "Array to sort" }],
  },
  arrayuniq: {
    signature: "arrayUniq(arr)",
    description: "Returns number of unique elements",
    parameters: [{ name: "arr", description: "Array to analyze" }],
  },
  has: {
    signature: "has(arr, elem)",
    description: "Checks if element exists in array",
    parameters: [
      { name: "arr", description: "Array to search" },
      { name: "elem", description: "Element to find" },
    ],
  },
  indexof: {
    signature: "indexOf(arr, elem)",
    description: "Returns 1-based index of element",
    parameters: [
      { name: "arr", description: "Array to search" },
      { name: "elem", description: "Element to find" },
    ],
  },
  length: {
    signature: "length(arr)",
    description: "Returns array length or string length",
    parameters: [{ name: "arr", description: "Array or string" }],
  },
};

// Date/Time functions
export const DATETIME_FUNCTIONS: Record<string, FunctionSignature> = {
  now: {
    signature: "now()",
    description: "Returns current date and time",
    parameters: [],
  },
  today: {
    signature: "today()",
    description: "Returns current date",
    parameters: [],
  },
  yesterday: {
    signature: "yesterday()",
    description: "Returns yesterday's date",
    parameters: [],
  },
  todate: {
    signature: "toDate(x)",
    description: "Converts to Date type",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  todatetime: {
    signature: "toDateTime(x)",
    description: "Converts to DateTime type",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  toyear: {
    signature: "toYear(date)",
    description: "Extracts year from date",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  tomonth: {
    signature: "toMonth(date)",
    description: "Extracts month (1-12) from date",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  todayofmonth: {
    signature: "toDayOfMonth(date)",
    description: "Extracts day of month (1-31)",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  todayofweek: {
    signature: "toDayOfWeek(date)",
    description: "Extracts day of week (1=Monday)",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  tohour: {
    signature: "toHour(datetime)",
    description: "Extracts hour (0-23)",
    parameters: [{ name: "datetime", description: "DateTime value" }],
  },
  tominutesecond: {
    signature: "toMinute(datetime)",
    description: "Extracts minute (0-59)",
    parameters: [{ name: "datetime", description: "DateTime value" }],
  },
  tostartofday: {
    signature: "toStartOfDay(datetime)",
    description: "Rounds down to start of day",
    parameters: [{ name: "datetime", description: "DateTime value" }],
  },
  tostartofweek: {
    signature: "toStartOfWeek(date)",
    description: "Rounds down to Monday of the week",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  tostartofmonth: {
    signature: "toStartOfMonth(date)",
    description: "Rounds down to first of month",
    parameters: [{ name: "date", description: "Date or DateTime" }],
  },
  datediff: {
    signature: "dateDiff(unit, start, end)",
    description: "Difference between dates in specified units",
    parameters: [
      {
        name: "unit",
        description:
          "'second', 'minute', 'hour', 'day', 'week', 'month', 'year'",
      },
      { name: "start", description: "Start date" },
      { name: "end", description: "End date" },
    ],
  },
  dateadd: {
    signature: "dateAdd(unit, value, date)",
    description: "Adds interval to date",
    parameters: [
      { name: "unit", description: "Time unit" },
      { name: "value", description: "Number to add" },
      { name: "date", description: "Date to modify" },
    ],
  },
  formatdatetime: {
    signature: "formatDateTime(datetime, format)",
    description: "Formats datetime as string",
    parameters: [
      { name: "datetime", description: "DateTime value" },
      { name: "format", description: "Format string, e.g., '%Y-%m-%d'" },
    ],
  },
};

// String functions
export const STRING_FUNCTIONS: Record<string, FunctionSignature> = {
  concat: {
    signature: "concat(s1, s2, ...)",
    description: "Concatenates strings",
    parameters: [{ name: "s", description: "Strings to concatenate" }],
  },
  substring: {
    signature: "substring(s, offset, length)",
    description: "Extracts substring",
    parameters: [
      { name: "s", description: "Source string" },
      { name: "offset", description: "Start position (1-based)" },
      { name: "length", description: "Number of characters" },
    ],
  },
  lower: {
    signature: "lower(s)",
    description: "Converts to lowercase",
    parameters: [{ name: "s", description: "String to convert" }],
  },
  upper: {
    signature: "upper(s)",
    description: "Converts to uppercase",
    parameters: [{ name: "s", description: "String to convert" }],
  },
  trim: {
    signature: "trim(s)",
    description: "Removes whitespace from both ends",
    parameters: [{ name: "s", description: "String to trim" }],
  },
  replaceall: {
    signature: "replaceAll(s, pattern, replacement)",
    description: "Replaces all occurrences",
    parameters: [
      { name: "s", description: "Source string" },
      { name: "pattern", description: "Pattern to find" },
      { name: "replacement", description: "Replacement string" },
    ],
  },
  like: {
    signature: "like(s, pattern)",
    description: "SQL LIKE pattern matching",
    parameters: [
      { name: "s", description: "String to match" },
      { name: "pattern", description: "Pattern with % and _ wildcards" },
    ],
  },
  match: {
    signature: "match(s, pattern)",
    description: "Regex pattern matching",
    parameters: [
      { name: "s", description: "String to match" },
      { name: "pattern", description: "Regular expression" },
    ],
  },
  splitbychar: {
    signature: "splitByChar(sep, s)",
    description: "Splits string by character",
    parameters: [
      { name: "sep", description: "Single character separator" },
      { name: "s", description: "String to split" },
    ],
  },
  splitbystring: {
    signature: "splitByString(sep, s)",
    description: "Splits string by string",
    parameters: [
      { name: "sep", description: "Separator string" },
      { name: "s", description: "String to split" },
    ],
  },
};

// Type conversion functions
export const CONVERSION_FUNCTIONS: Record<string, FunctionSignature> = {
  tostring: {
    signature: "toString(x)",
    description: "Converts to String",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  toint32: {
    signature: "toInt32(x)",
    description: "Converts to Int32",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  toint64: {
    signature: "toInt64(x)",
    description: "Converts to Int64",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  touint32: {
    signature: "toUInt32(x)",
    description: "Converts to UInt32",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  touint64: {
    signature: "toUInt64(x)",
    description: "Converts to UInt64",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  tofloat64: {
    signature: "toFloat64(x)",
    description: "Converts to Float64",
    parameters: [{ name: "x", description: "Value to convert" }],
  },
  cast: {
    signature: "cast(x, T)",
    description: "Casts value to type T",
    parameters: [
      { name: "x", description: "Value to cast" },
      { name: "T", description: "Target type as string" },
    ],
  },
};

// Conditional functions
export const CONDITIONAL_FUNCTIONS: Record<string, FunctionSignature> = {
  if: {
    signature: "if(cond, then, else)",
    description: "Conditional expression",
    parameters: [
      { name: "cond", description: "Boolean condition" },
      { name: "then", description: "Value if true" },
      { name: "else", description: "Value if false" },
    ],
  },
  multiif: {
    signature: "multiIf(cond1, then1, cond2, then2, ..., else)",
    description: "Multiple conditional branches",
    parameters: [
      { name: "cond", description: "Conditions to check" },
      { name: "then", description: "Values for each condition" },
      { name: "else", description: "Default value" },
    ],
  },
  coalesce: {
    signature: "coalesce(x, ...)",
    description: "Returns first non-NULL value",
    parameters: [{ name: "x", description: "Values to check" }],
  },
  nullif: {
    signature: "nullIf(x, y)",
    description: "Returns NULL if x equals y",
    parameters: [
      { name: "x", description: "Value to check" },
      { name: "y", description: "Value to compare" },
    ],
  },
  ifnull: {
    signature: "ifNull(x, alt)",
    description: "Returns alt if x is NULL",
    parameters: [
      { name: "x", description: "Value to check" },
      { name: "alt", description: "Alternative value" },
    ],
  },
  isnull: {
    signature: "isNull(x)",
    description: "Returns 1 if x is NULL",
    parameters: [{ name: "x", description: "Value to check" }],
  },
  isnotnull: {
    signature: "isNotNull(x)",
    description: "Returns 1 if x is not NULL",
    parameters: [{ name: "x", description: "Value to check" }],
  },
};

// Combined function lookup
export const ALL_FUNCTIONS: Record<string, FunctionSignature> = {
  ...AGGREGATE_FUNCTIONS,
  ...ARRAY_FUNCTIONS,
  ...DATETIME_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...CONVERSION_FUNCTIONS,
  ...CONDITIONAL_FUNCTIONS,
};

/**
 * Get function signature by name (case-insensitive)
 */
export function getFunctionSignature(
  name: string
): FunctionSignature | undefined {
  return ALL_FUNCTIONS[name.toLowerCase()];
}

/**
 * Convert functions to CodeMirror completion items
 */
export function getFunctionCompletions(): Completion[] {
  return Object.entries(ALL_FUNCTIONS).map(([name, info]) => ({
    label: name,
    type: "function",
    detail: info.signature,
    info: info.description,
    boost: 1, // Slightly boost functions in ranking
  }));
}
