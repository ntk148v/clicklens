"use client";

import { useEffect, useRef, useCallback } from "react";
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
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";

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

// Light theme for SQL editor
const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      backgroundColor: "#fafafa",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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
    // Syntax highlighting
    ".cm-keyword": { color: "#9333ea" },
    ".cm-string": { color: "#16a34a" },
    ".cm-number": { color: "#2563eb" },
    ".cm-comment": { color: "#737373", fontStyle: "italic" },
    ".cm-operator": { color: "#0ea5e9" },
    ".cm-punctuation": { color: "#525252" },
    ".cm-variableName": { color: "#171717" },
    ".cm-typeName": { color: "#dc2626" },
    ".cm-function": { color: "#ea580c" },
    // Autocomplete
    ".cm-tooltip": {
      backgroundColor: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "'JetBrains Mono', monospace",
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

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  onExplain?: () => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  onExplain,
  placeholder = "Enter SQL query...",
  readOnly = false,
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());

  // Handle Ctrl+Enter to execute
  const executeKeymap = keymap.of([
    {
      key: "Ctrl-Enter",
      mac: "Cmd-Enter",
      run: () => {
        onExecute?.();
        return true;
      },
    },
    {
      key: "Ctrl-Shift-e",
      mac: "Cmd-Shift-e",
      run: () => {
        onExplain?.();
        return true;
      },
    },
  ]);

  const updateListener = useCallback(
    (update: { docChanged: boolean; state: EditorState }) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        autocompletion(),
        sql({ dialect: clickhouseDialect }),
        syntaxHighlighting(defaultHighlightStyle),
        editorTheme,
        executeKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of(updateListener),
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

  // Update content when value changes externally
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.state.doc.toString();
    if (currentValue !== value) {
      editor.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
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
