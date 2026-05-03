export interface TableColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  format?: (value: unknown) => string;
}

export interface TableOptions {
  columns: TableColumn[];
  sortBy?: string;
  sortAsc?: boolean;
  title?: string;
  borderStyle?: 'single' | 'double' | 'rounded' | 'minimal';
  maxWidth?: number;
}

interface BorderChars {
  left: string;
  mid: string;
  right: string;
  fill: string;
  pad: string;
}

interface BorderSet {
  top: BorderChars;
  mid: BorderChars;
  row: BorderChars;
  bottom: BorderChars;
}

export function formatTable(data: Record<string, unknown>[], options: TableOptions): string {
  if (data.length === 0) return options.title ? `${options.title}\n(empty)\n` : '(empty)\n';

  let rows = [...data];
  const columns = options.columns;
  const borderStyle = options.borderStyle || 'single';

  if (options.sortBy) {
    const col = columns.find((c) => c.key === options.sortBy);
    rows.sort((a, b) => {
      const va = String(a[options.sortBy!] ?? '');
      const vb = String(b[options.sortBy!] ?? '');
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return options.sortAsc ? cmp : -cmp;
    });
  }

  const formatters: ((value: unknown) => string)[] = columns.map((col) => col.format || ((v) => String(v ?? '')));
  const cellValues: string[][] = rows.map((row) =>
    columns.map((col, i) => formatters[i](row[col.key]))
  );

  const colWidths: number[] = columns.map((col, i) => {
    const headerLen = col.header.length;
    const dataMax = Math.max(...cellValues.map((row) => row[i].length), 0);
    const natural = Math.max(headerLen, dataMax);
    if (col.width) return Math.min(col.width, natural);
    return Math.min(natural, options.maxWidth || 40);
  });

  const borders = getBorders(borderStyle);
  const lines: string[] = [];

  if (options.title) {
    lines.push(options.title);
    lines.push('');
  }

  lines.push(drawRow(colWidths, borders.top));
  lines.push(drawCellRow(colWidths, columns.map((c) => c.header), columns, borders.top));
  lines.push(drawRow(colWidths, borders.mid));

  for (let i = 0; i < cellValues.length; i++) {
    lines.push(drawCellRow(colWidths, cellValues[i], columns, borders.top));
    if (i < cellValues.length - 1 && borderStyle !== 'minimal') {
      lines.push(drawRow(colWidths, borders.row));
    }
  }

  lines.push(drawRow(colWidths, borders.bottom));
  return lines.join('\n');
}

function drawRow(widths: number[], chars: BorderChars): string {
  const parts = widths.map((w) => chars.fill.repeat(w + 2));
  return chars.left + parts.join(chars.mid) + chars.right;
}

function drawCellRow(
  widths: number[],
  values: string[],
  columns: TableColumn[],
  chars: BorderChars
): string {
  const cells = values.map((val, i) => {
    const maxW = widths[i];
    const align = columns[i]?.align || 'left';
    let display = val.length > maxW ? val.slice(0, maxW - 3) + '...' : val;
    if (align === 'center') {
      const pad = maxW - display.length;
      const left = Math.floor(pad / 2);
      const right = pad - left;
      return ' '.repeat(left) + display + ' '.repeat(right);
    } else if (align === 'right') {
      return display.padStart(maxW);
    }
    return display.padEnd(maxW);
  });
  return chars.pad + ' ' + cells.join(` ${chars.pad}${chars.mid}${chars.pad} `) + ` ${chars.pad}`;
}

function getBorders(style: string): BorderSet {
  switch (style) {
    case 'double':
      return {
        top: { left: '╔', mid: '╤', right: '╗', fill: '═', pad: '║' },
        mid: { left: '╠', mid: '╪', right: '╣', fill: '═', pad: '║' },
        row: { left: '╟', mid: '┼', right: '╢', fill: '─', pad: '║' },
        bottom: { left: '╚', mid: '╧', right: '╝', fill: '═', pad: '║' },
      };
    case 'rounded':
      return {
        top: { left: '╭', mid: '┬', right: '╮', fill: '─', pad: '│' },
        mid: { left: '├', mid: '┼', right: '┤', fill: '─', pad: '│' },
        row: { left: '├', mid: '┼', right: '┤', fill: '─', pad: '│' },
        bottom: { left: '╰', mid: '┴', right: '╯', fill: '─', pad: '│' },
      };
    case 'minimal':
      return {
        top: { left: '', mid: '', right: '', fill: '─', pad: '' },
        mid: { left: '', mid: '', right: '', fill: '─', pad: '' },
        row: { left: '', mid: '', right: '', fill: '─', pad: '' },
        bottom: { left: '', mid: '', right: '', fill: '─', pad: '' },
      };
    default:
      return {
        top: { left: '┌', mid: '┬', right: '┐', fill: '─', pad: '│' },
        mid: { left: '├', mid: '┼', right: '┤', fill: '─', pad: '│' },
        row: { left: '├', mid: '┼', right: '┤', fill: '─', pad: '│' },
        bottom: { left: '└', mid: '┴', right: '┘', fill: '─', pad: '│' },
      };
  }
}

export function formatSimpleTable(headers: string[], rows: string[][]): string {
  const columns: TableColumn[] = headers.map((h) => ({ key: h.toLowerCase(), header: h }));
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h.toLowerCase()] = row[i] || ''; });
    return obj;
  });
  return formatTable(data, { columns, borderStyle: 'single' });
}

export function formatKeyValueTable(entries: [string, string][], title?: string): string {
  const columns: TableColumn[] = [
    { key: 'key', header: 'Key', width: 30 },
    { key: 'value', header: 'Value', width: 50 },
  ];
  const data = entries.map(([k, v]) => ({ key: k, value: v }));
  return formatTable(data, { columns, title, borderStyle: 'rounded' });
}
