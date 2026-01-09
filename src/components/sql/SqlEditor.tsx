"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql, SQLDialect } from "@codemirror/lang-sql";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  autocompletion,
  completionKeymap,
  CompletionContext,
  type Completion,
} from "@codemirror/autocomplete";
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

// ClickHouse SQL dialect with common functions and keywords
const clickhouseDialect = SQLDialect.define({
  keywords: `
    select from where and or not in like between is null as on join left right inner outer
    full cross using natural group by order asc desc limit offset having distinct all any
    union intersect except exists case when then else end cast insert into values update set
    delete truncate create drop alter table database view index if engine partition primary key
    format with settings materialized final sample prewhere global array join using
    explain describe show use system kill query mutations processes attach detach optimize
    rename exchange set global temporary live dictionary function grant revoke role user
  `,
  types: `
    uint8 uint16 uint32 uint64 uint128 uint256 int8 int16 int32 int64 int128 int256
    float32 float64 decimal decimal32 decimal64 decimal128 decimal256
    string fixedstring uuid date date32 datetime datetime64 enum8 enum16
    array tuple map nullable lowcardinality aggregatefunction simpleaggregatefunction
    nested ipv4 ipv6 json object bool boolean
  `,
  builtin: `
    count sum avg min max any anyLast argMin argMax groupArray groupUniqArray
    sumWithOverflow sumMap minMap maxMap avgWeighted
    uniq uniqExact uniqCombined uniqHLL12 uniqTheta
    quantile quantileExact quantileTiming quantileTDigest median
    topK topKWeighted
    now today yesterday toDateTime toDate toStartOfDay toStartOfHour toStartOfMinute
    toStartOfMonth toStartOfQuarter toStartOfYear
    formatDateTime parseDateTimeBestEffort
    toString toInt32 toUInt32 toFloat64
    concat substring length lower upper trim
    arrayJoin arrayMap arrayFilter arrayExists arrayAll arrayFirst arrayLast
    tuple untuple tupleElement
    if multiIf nullIf ifNull coalesce assumeNotNull
    empty notEmpty isNull isNotNull
    has indexOf arrayElement
    dictGet dictGetOrDefault dictHas
    neighbor runningDifference runningAccumulate
    toTypeName toColumnTypeName dumpColumnStructure
    formatReadableSize formatReadableQuantity
  `,
});

// Light theme highlight style using @lezer/highlight tags
const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#9333ea", fontWeight: "600" },
  { tag: tags.string, color: "#16a34a" },
  { tag: tags.number, color: "#2563eb" },
  { tag: tags.comment, color: "#737373", fontStyle: "italic" },
  { tag: tags.operator, color: "#0ea5e9" },
  { tag: tags.punctuation, color: "#525252" },
  { tag: tags.variableName, color: "#171717" },
  { tag: tags.typeName, color: "#dc2626" },
  { tag: tags.function(tags.variableName), color: "#ea580c" },
  { tag: tags.propertyName, color: "#171717" },
  { tag: tags.bool, color: "#2563eb" },
  { tag: tags.null, color: "#737373" },
  { tag: tags.className, color: "#dc2626" },
  { tag: tags.definition(tags.variableName), color: "#171717" },
  { tag: tags.special(tags.string), color: "#16a34a" },
]);

// Dark theme highlight style using @lezer/highlight tags
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#faff69", fontWeight: "600" },
  { tag: tags.string, color: "#86efac" },
  { tag: tags.number, color: "#93c5fd" },
  { tag: tags.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: tags.operator, color: "#f9a8d4" },
  { tag: tags.punctuation, color: "#d4d4d8" },
  { tag: tags.variableName, color: "#f5f5f5" },
  { tag: tags.typeName, color: "#fdba74" },
  { tag: tags.function(tags.variableName), color: "#c4b5fd" },
  { tag: tags.propertyName, color: "#f5f5f5" },
  { tag: tags.bool, color: "#93c5fd" },
  { tag: tags.null, color: "#6b7280" },
  { tag: tags.className, color: "#fdba74" },
  { tag: tags.definition(tags.variableName), color: "#f5f5f5" },
  { tag: tags.special(tags.string), color: "#86efac" },
]);

// Light editor theme (non-syntax styles)
const lightEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      backgroundColor: "#fafafa",
    },
    ".cm-content": {
      fontFamily: "ui-monospace, monospace",
      padding: "8px 0",
      caretColor: "#171717",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#171717",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#d4d4d440",
      },
    ".cm-gutters": {
      backgroundColor: "#f5f5f5",
      color: "#737373",
      border: "none",
      borderRight: "1px solid #e5e5e5",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#fafafa",
    },
    ".cm-activeLine": {
      backgroundColor: "#f5f5f5",
    },
    ".cm-line": {
      padding: "0 8px",
    },
    ".cm-tooltip": {
      backgroundColor: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "ui-monospace, monospace",
        fontSize: "12px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "#f5f5f5",
        color: "#171717",
      },
    },
  },
  { dark: false }
);

// Dark editor theme (non-syntax styles)
const darkEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      backgroundColor: "#0a0a0a",
    },
    ".cm-content": {
      fontFamily: "ui-monospace, monospace",
      padding: "8px 0",
      caretColor: "#facc15",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#facc15",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#facc1530",
      },
    ".cm-gutters": {
      backgroundColor: "#0f0f0f",
      color: "#525252",
      border: "none",
      borderRight: "1px solid #262626",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#171717",
      color: "#a3a3a3",
    },
    ".cm-activeLine": {
      backgroundColor: "#171717",
    },
    ".cm-line": {
      padding: "0 8px",
    },
    ".cm-tooltip": {
      backgroundColor: "#171717",
      border: "1px solid #262626",
      borderRadius: "6px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.5)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "ui-monospace, monospace",
        fontSize: "12px",
        maxHeight: "300px",
      },
      "& > ul > li": {
        padding: "4px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "#facc1525",
        color: "#fafafa",
      },
    },
    ".cm-completionIcon": {
      opacity: 0.7,
    },
    ".cm-completionLabel": {
      color: "#e5e5e5",
    },
    ".cm-completionDetail": {
      color: "#737373",
      fontStyle: "italic",
      marginLeft: "8px",
    },
  },
  { dark: true }
);

interface TableInfo {
  name: string;
  engine?: string;
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  onExecuteAtCursor?: () => void;
  onCursorChange?: (position: number) => void;
  onExplain?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  databases?: string[];
  tables?: TableInfo[];
  selectedDatabase?: string | null;
}

// Keywords that should trigger table/database suggestions
const TABLE_KEYWORDS = ["from", "join", "into", "table", "update"];
const DATABASE_KEYWORDS = ["use", "database"];

// Create schema completion source - uses refs to avoid recreating
function createSchemaCompletionSource(
  tablesRef: React.RefObject<TableInfo[]>,
  databasesRef: React.RefObject<string[]>
) {
  return (context: CompletionContext) => {
    const tables = tablesRef.current || [];
    const databases = databasesRef.current || [];

    // Only provide completions if we have schema data
    if (tables.length === 0 && databases.length === 0) {
      return null;
    }

    // Get the text before the cursor
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text
      .slice(0, context.pos - line.from)
      .toLowerCase();

    // Check if we're after a relevant keyword
    const words = textBefore.split(/\s+/);
    const lastWord = words[words.length - 1] || "";
    const prevWord = words[words.length - 2] || "";

    // Check for database.table pattern (e.g., "from default.")
    const dotMatch = textBefore.match(/(\w+)\.\s*$/);
    if (dotMatch && tables.length > 0) {
      return {
        from: context.pos,
        options: tables.map(
          (t): Completion => ({
            label: t.name,
            type: "class",
            detail: t.engine || "table",
          })
        ),
      };
    }

    // Check if previous word triggers table suggestions
    if (TABLE_KEYWORDS.includes(prevWord) && !lastWord.includes(".")) {
      const options: Completion[] = [];

      // Add tables from current database
      tables.forEach((t) => {
        options.push({
          label: t.name,
          type: "class",
          detail: t.engine || "table",
        });
      });

      // Add databases with dot for cross-database queries
      databases.forEach((db) => {
        options.push({
          label: db + ".",
          type: "namespace",
          detail: "database",
        });
      });

      if (options.length > 0) {
        const wordMatch = textBefore.match(/(\w*)$/);
        const from = context.pos - (wordMatch?.[1]?.length || 0);

        const filtered = options.filter((o) =>
          o.label.toLowerCase().startsWith(lastWord.toLowerCase())
        );

        if (filtered.length > 0) {
          return { from, options: filtered };
        }
      }
    }

    // Check if previous word triggers database suggestions
    if (DATABASE_KEYWORDS.includes(prevWord) && databases.length > 0) {
      const wordMatch = textBefore.match(/(\w*)$/);
      const from = context.pos - (wordMatch?.[1]?.length || 0);

      const filtered = databases
        .map(
          (db): Completion => ({
            label: db,
            type: "namespace",
            detail: "database",
          })
        )
        .filter((o) =>
          o.label.toLowerCase().startsWith(lastWord.toLowerCase())
        );

      if (filtered.length > 0) {
        return { from, options: filtered };
      }
    }

    return null;
  };
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  onExecuteAtCursor,
  onCursorChange,
  onExplain,
  placeholder = "Enter SQL query...",
  readOnly = false,
  databases = [],
  tables = [],
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const highlightCompartment = useRef(new Compartment());
  const { resolvedTheme } = useTheme();

  // Use refs for all callbacks to ensure EditorView always has latest versions
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onExecuteRef = useRef(onExecute);
  const onExecuteAtCursorRef = useRef(onExecuteAtCursor);
  const onExplainRef = useRef(onExplain);

  // Use refs for schema data to avoid recreating completion source
  const tablesRef = useRef<TableInfo[]>(tables);
  const databasesRef = useRef<string[]>(databases);

  // Track if we're syncing from external value to prevent loops
  const isSyncingRef = useRef(false);

  // Keep all refs updated with latest props
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onExecuteRef.current = onExecute;
    onExecuteAtCursorRef.current = onExecuteAtCursor;
    onExplainRef.current = onExplain;
  }, [onExecute, onExecuteAtCursor, onExplain]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    databasesRef.current = databases;
  }, [databases]);

  // Handle Ctrl+Enter to execute, Shift+Enter for execute at cursor
  const executeKeymap = keymap.of([
    {
      key: "Ctrl-Enter",
      mac: "Cmd-Enter",
      run: () => {
        onExecuteRef.current?.();
        return true;
      },
    },
    {
      key: "Shift-Enter",
      run: () => {
        onExecuteAtCursorRef.current?.();
        return true;
      },
    },
    {
      key: "Ctrl-Shift-e",
      mac: "Cmd-Shift-e",
      run: () => {
        onExplainRef.current?.();
        return true;
      },
    },
  ]);

  // Create stable completion source
  const schemaCompletionSource = useRef(
    createSchemaCompletionSource(tablesRef, databasesRef)
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";

    // Update listener that uses refs to always get latest callbacks
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isSyncingRef.current) {
        const newValue = update.state.doc.toString();
        onChangeRef.current(newValue);
      }
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        onCursorChangeRef.current?.(pos);
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        // Autocompletion with schema suggestions
        autocompletion({
          override: [schemaCompletionSource.current],
          activateOnTyping: false, // Only trigger on Ctrl+Space
          defaultKeymap: true,
        }),
        sql({ dialect: clickhouseDialect }),
        // Use our custom highlight styles instead of defaultHighlightStyle
        highlightCompartment.current.of(
          syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle)
        ),
        themeCompartment.current.of(
          isDark ? darkEditorTheme : lightEditorTheme
        ),
        executeKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        updateListener,
        EditorView.contentAttributes.of({
          "aria-label": "SQL Editor",
        }),
        placeholder
          ? EditorView.contentAttributes.of({ "data-placeholder": placeholder })
          : [],
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorRef.current = view;

    return () => {
      view.destroy();
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme and highlighting when it changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const isDark = resolvedTheme === "dark";
    editor.dispatch({
      effects: [
        themeCompartment.current.reconfigure(
          isDark ? darkEditorTheme : lightEditorTheme
        ),
        highlightCompartment.current.reconfigure(
          syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle)
        ),
      ],
    });
  }, [resolvedTheme]);

  // Update content when value changes externally (e.g., tab switch)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.state.doc.toString();
    if (currentValue !== value) {
      // Prevent the update listener from calling onChange
      isSyncingRef.current = true;
      editor.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      isSyncingRef.current = false;
    }
  }, [value]);

  // Update readonly state
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-md border border-border"
    />
  );
}
