import {
  escapeHtml,
  escapeCsvValue,
  normalizeWhitespace,
  truncateText,
  formatCellValueForDisplay,
  formatCellValueForCopy,
  isCellInSelection,
  extractSelectedCells,
  selectionToTsv,
  selectionToCsv,
  isCopyShortcut,
  validateSelection,
  getSelectionSize,
  isSingleCellSelection,
  getContentType,
  normalizeUnicode,
  containsRtl,
  getTextDirection,
  safeStringify,
  prepareCellData,
  MAX_CELL_DISPLAY_LENGTH,
  MAX_TOOLTIP_LENGTH,
  type CellSelection,
} from '@/lib/virtual/edge-cases';

describe('edge-cases', () => {
  describe('constants', () => {
    it('should have MAX_CELL_DISPLAY_LENGTH of 1000', () => {
      expect(MAX_CELL_DISPLAY_LENGTH).toBe(1000);
    });

    it('should have MAX_TOOLTIP_LENGTH of 5000', () => {
      expect(MAX_TOOLTIP_LENGTH).toBe(5000);
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape less-than signs', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater-than signs', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it('should escape multiple entities', () => {
      expect(escapeHtml('<div class="test">A & B</div>')).toBe(
        '&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;'
      );
    });

    it('should return unchanged string when no entities', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('escapeCsvValue', () => {
    it('should return simple values unchanged', () => {
      expect(escapeCsvValue('hello')).toBe('hello');
    });

    it('should wrap values with commas in quotes', () => {
      expect(escapeCsvValue('a,b')).toBe('"a,b"');
    });

    it('should wrap values with newlines in quotes', () => {
      expect(escapeCsvValue('a\nb')).toBe('"a\nb"');
    });

    it('should wrap values with tabs in quotes', () => {
      expect(escapeCsvValue('a\tb')).toBe('"a\tb"');
    });

    it('should escape double quotes by doubling them', () => {
      expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
    });

    it('should handle complex cases', () => {
      expect(escapeCsvValue('a"b,c\nd')).toBe('"a""b,c\nd"');
    });
  });

  describe('normalizeWhitespace', () => {
    it('should replace tabs with spaces', () => {
      expect(normalizeWhitespace('a\tb')).toBe('a b');
    });

    it('should replace newlines with spaces', () => {
      expect(normalizeWhitespace('a\nb')).toBe('a b');
    });

    it('should remove carriage returns', () => {
      expect(normalizeWhitespace('a\rb')).toBe('ab');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeWhitespace('a   b')).toBe('a b');
    });

    it('should trim whitespace', () => {
      expect(normalizeWhitespace('  hello  ')).toBe('hello');
    });

    it('should handle complex whitespace', () => {
      expect(normalizeWhitespace('  a\t\n\r  b  ')).toBe('a b');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('hello')).toBe('hello');
    });

    it('should truncate long text with ellipsis', () => {
      const longText = 'a'.repeat(1100);
      const result = truncateText(longText);
      expect(result.length).toBe(1000);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should respect custom maxLength', () => {
      const text = 'a'.repeat(100);
      const result = truncateText(text, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not truncate text at exact length', () => {
      const text = 'a'.repeat(1000);
      expect(truncateText(text)).toBe(text);
    });
  });

  describe('formatCellValueForDisplay', () => {
    it('should format null as NULL', () => {
      expect(formatCellValueForDisplay(null)).toBe('NULL');
    });

    it('should format undefined as NULL', () => {
      expect(formatCellValueForDisplay(undefined)).toBe('NULL');
    });

    it('should format true as "true"', () => {
      expect(formatCellValueForDisplay(true)).toBe('true');
    });

    it('should format false as "false"', () => {
      expect(formatCellValueForDisplay(false)).toBe('false');
    });

    it('should format numbers', () => {
      expect(formatCellValueForDisplay(42)).toBe('42');
      expect(formatCellValueForDisplay(3.14)).toBe('3.14');
    });

    it('should format NaN', () => {
      expect(formatCellValueForDisplay(NaN)).toBe('NaN');
    });

    it('should format Infinity', () => {
      expect(formatCellValueForDisplay(Infinity)).toBe('Infinity');
      expect(formatCellValueForDisplay(-Infinity)).toBe('-Infinity');
    });

    it('should format objects as JSON', () => {
      expect(formatCellValueForDisplay({ a: 1 })).toBe('{"a":1}');
    });

    it('should format arrays as JSON', () => {
      expect(formatCellValueForDisplay([1, 2, 3])).toBe('[1,2,3]');
    });

    it('should truncate very long strings', () => {
      const longString = 'a'.repeat(2000);
      const result = formatCellValueForDisplay(longString);
      expect(result.length).toBe(1000);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      expect(formatCellValueForDisplay(obj)).toBe('[Object]');
    });
  });

  describe('formatCellValueForCopy', () => {
    it('should format null as empty string', () => {
      expect(formatCellValueForCopy(null)).toBe('');
    });

    it('should format undefined as empty string', () => {
      expect(formatCellValueForCopy(undefined)).toBe('');
    });

    it('should not truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      expect(formatCellValueForCopy(longString)).toBe(longString);
    });

    it('should format objects as JSON', () => {
      expect(formatCellValueForCopy({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('isCellInSelection', () => {
    it('should return false when selection is null', () => {
      expect(isCellInSelection(0, 0, null)).toBe(false);
    });

    it('should return true for cell in selection', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 2,
      };
      expect(isCellInSelection(1, 1, selection)).toBe(true);
    });

    it('should return false for cell outside selection', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 2,
      };
      expect(isCellInSelection(5, 5, selection)).toBe(false);
    });

    it('should handle reversed selection', () => {
      const selection: CellSelection = {
        startRow: 2,
        endRow: 0,
        startCol: 2,
        endCol: 0,
      };
      expect(isCellInSelection(1, 1, selection)).toBe(true);
    });
  });

  describe('extractSelectedCells', () => {
    const data = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
      { a: 7, b: 8, c: 9 },
    ];
    const columns = ['a', 'b', 'c'];
    const getCellValue = (row: Record<string, unknown>, col: string) => row[col];

    it('should extract single cell', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      };
      const result = extractSelectedCells(data, columns, selection, getCellValue);
      expect(result).toEqual([['1']]);
    });

    it('should extract row', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 2,
      };
      const result = extractSelectedCells(data, columns, selection, getCellValue);
      expect(result).toEqual([['1', '2', '3']]);
    });

    it('should extract column', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 0,
      };
      const result = extractSelectedCells(data, columns, selection, getCellValue);
      expect(result).toEqual([['1'], ['4'], ['7']]);
    });

    it('should extract rectangular region', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 1,
      };
      const result = extractSelectedCells(data, columns, selection, getCellValue);
      expect(result).toEqual([
        ['1', '2'],
        ['4', '5'],
      ]);
    });
  });

  describe('selectionToTsv', () => {
    it('should convert selection to TSV', () => {
      const selection = [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ];
      expect(selectionToTsv(selection)).toBe('1\t2\t3\n4\t5\t6');
    });

    it('should handle empty selection', () => {
      expect(selectionToTsv([])).toBe('');
    });
  });

  describe('selectionToCsv', () => {
    it('should convert selection to CSV', () => {
      const selection = [
        ['1', '2'],
        ['3', '4'],
      ];
      expect(selectionToCsv(selection)).toBe('1,2\n3,4');
    });

    it('should include headers when provided', () => {
      const selection = [['1', '2']];
      const headers = ['a', 'b'];
      expect(selectionToCsv(selection, headers)).toBe('a,b\n1,2');
    });

    it('should escape special characters', () => {
      const selection = [['a,b', 'c"d']];
      expect(selectionToCsv(selection)).toBe('"a,b","c""d"');
    });
  });

  describe('isCopyShortcut', () => {
    it('should detect Ctrl+C', () => {
      const event = { key: 'c', ctrlKey: true, metaKey: false } as KeyboardEvent;
      expect(isCopyShortcut(event)).toBe(true);
    });

    it('should detect Cmd+C (meta key)', () => {
      const event = { key: 'c', ctrlKey: false, metaKey: true } as KeyboardEvent;
      expect(isCopyShortcut(event)).toBe(true);
    });

    it('should not detect other keys', () => {
      const event = { key: 'v', ctrlKey: true, metaKey: false } as KeyboardEvent;
      expect(isCopyShortcut(event)).toBe(false);
    });

    it('should not detect c without modifier', () => {
      const event = { key: 'c', ctrlKey: false, metaKey: false } as KeyboardEvent;
      expect(isCopyShortcut(event)).toBe(false);
    });
  });

  describe('validateSelection', () => {
    it('should clamp selection to bounds', () => {
      const selection: CellSelection = {
        startRow: -5,
        endRow: 100,
        startCol: -5,
        endCol: 100,
      };
      const result = validateSelection(selection, 10, 5);
      expect(result.startRow).toBe(0);
      expect(result.endRow).toBe(9);
      expect(result.startCol).toBe(0);
      expect(result.endCol).toBe(4);
    });
  });

  describe('getSelectionSize', () => {
    it('should calculate selection size', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 3,
      };
      expect(getSelectionSize(selection)).toEqual({ rows: 3, cols: 4 });
    });

    it('should handle reversed selection', () => {
      const selection: CellSelection = {
        startRow: 5,
        endRow: 0,
        startCol: 10,
        endCol: 0,
      };
      expect(getSelectionSize(selection)).toEqual({ rows: 6, cols: 11 });
    });
  });

  describe('isSingleCellSelection', () => {
    it('should return true for single cell', () => {
      const selection: CellSelection = {
        startRow: 5,
        endRow: 5,
        startCol: 5,
        endCol: 5,
      };
      expect(isSingleCellSelection(selection)).toBe(true);
    });

    it('should return false for multi-cell', () => {
      const selection: CellSelection = {
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
      };
      expect(isSingleCellSelection(selection)).toBe(false);
    });
  });

  describe('getContentType', () => {
    it('should return "null" for null', () => {
      expect(getContentType(null)).toBe('null');
    });

    it('should return "undefined" for undefined', () => {
      expect(getContentType(undefined)).toBe('undefined');
    });

    it('should return "array" for arrays', () => {
      expect(getContentType([])).toBe('array');
    });

    it('should return "string" for strings', () => {
      expect(getContentType('hello')).toBe('string');
    });

    it('should return "number" for numbers', () => {
      expect(getContentType(42)).toBe('number');
    });

    it('should return "boolean" for booleans', () => {
      expect(getContentType(true)).toBe('boolean');
    });

    it('should return "object" for objects', () => {
      expect(getContentType({})).toBe('object');
    });
  });

  describe('normalizeUnicode', () => {
    it('should normalize to NFC form', () => {
      const input = 'e\u0301'; // e + combining acute accent
      const result = normalizeUnicode(input);
      expect(result).toBe('é'); // precomposed form
    });
  });

  describe('containsRtl', () => {
    it('should detect Hebrew characters', () => {
      expect(containsRtl('שלום')).toBe(true);
    });

    it('should detect Arabic characters', () => {
      expect(containsRtl('مرحبا')).toBe(true);
    });

    it('should not detect RTL in Latin text', () => {
      expect(containsRtl('hello')).toBe(false);
    });
  });

  describe('getTextDirection', () => {
    it('should return "rtl" for RTL text', () => {
      expect(getTextDirection('שלום')).toBe('rtl');
    });

    it('should return "ltr" for LTR text', () => {
      expect(getTextDirection('hello')).toBe('ltr');
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple objects', () => {
      expect(safeStringify({ a: 1 })).toBe('{"a":1}');
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      const result = safeStringify(obj);
      expect(result).toContain('[Circular]');
    });

    it('should handle null', () => {
      expect(safeStringify(null)).toBe('null');
    });
  });

  describe('prepareCellData', () => {
    it('should prepare null cell data', () => {
      const result = prepareCellData(null);
      expect(result.value).toBe(null);
      expect(result.displayValue).toBe('NULL');
      expect(result.copyValue).toBe('');
      expect(result.contentType).toBe('null');
      expect(result.isNull).toBe(true);
      expect(result.isTruncated).toBe(false);
    });

    it('should prepare string cell data', () => {
      const result = prepareCellData('hello');
      expect(result.value).toBe('hello');
      expect(result.displayValue).toBe('hello');
      expect(result.copyValue).toBe('hello');
      expect(result.contentType).toBe('string');
      expect(result.isNull).toBe(false);
      expect(result.isTruncated).toBe(false);
    });

    it('should detect truncated strings', () => {
      const longString = 'a'.repeat(2000);
      const result = prepareCellData(longString);
      expect(result.isTruncated).toBe(true);
      expect(result.displayValue.length).toBe(1000);
    });

    it('should detect RTL direction', () => {
      const result = prepareCellData('שלום');
      expect(result.direction).toBe('rtl');
    });

    it('should detect LTR direction', () => {
      const result = prepareCellData('hello');
      expect(result.direction).toBe('ltr');
    });
  });
});
