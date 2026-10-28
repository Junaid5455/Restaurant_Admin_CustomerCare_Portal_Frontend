import type { MenuCategory, MenuItem } from './api/admin-menu';
import { toNumber } from './format';

/** Columns of the import/export file, in order. */
export const CSV_COLUMNS = ['category', 'name', 'description', 'price', 'available', 'featured', 'new'] as const;
type Column = (typeof CSV_COLUMNS)[number];

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 1024 * 1024;

// ── CSV reading / writing ────────────────────────────────────────────────────────────────────────────────

/** Parses CSV text (quotes, escaped quotes, CRLF, embedded newlines). Detects `;` as the delimiter when the header uses it. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// A cell starting with = + - @ can run as a formula when the file is opened in a spreadsheet.
const FORMULA = /^[=+\-@]/;
const guard = (v: string) => (FORMULA.test(v) ? `'${v}` : v);
const unguard = (v: string) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function exportMenuCsv(categories: MenuCategory[], items: MenuItem[]): string {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const sorted = [...items].sort((a, b) => (order.get(a.category_id ?? '') ?? 999) - (order.get(b.category_id ?? '') ?? 999) || a.name.localeCompare(b.name));
  return toCsv([
    [...CSV_COLUMNS],
    ...sorted.map((i) => [
      guard(name.get(i.category_id ?? '') ?? ''),
      guard(i.name),
      guard(i.description ?? ''),
      toNumber(i.price).toFixed(2),
      i.is_available ? 'yes' : 'no',
      i.is_featured ? 'yes' : 'no',
      i.is_new ? 'yes' : 'no',
    ]),
  ]);
}

export function templateCsv(): string {
  return toCsv([
    [...CSV_COLUMNS],
    ['Mains', 'Chicken Biryani', 'Fragrant basmati rice layered with spiced chicken', '850.00', 'yes', 'yes', 'no'],
    ['Breads', 'Garlic Naan', 'Tandoor-baked bread brushed with garlic butter', '120.00', 'yes', 'no', 'yes'],
  ]);
}

// ── Import ───────────────────────────────────────────────────────────────────────────────────────────────

export interface ImportRow {
  /** 1-based line in the file (the header is line 1). */
  line: number;
  category: string;
  name: string;
  description: string;
  /** Two-decimal string, or '' when the column was blank. */
  price: string;
  available: boolean | null;
  featured: boolean | null;
  isNew: boolean | null;
  action: 'create' | 'update' | 'skip' | 'error';
  existingId?: string;
  /** The category will be created because no category has this name yet. */
  newCategory: boolean;
  problems: string[];
}

export interface ImportPlan {
  rows: ImportRow[];
  /** A problem with the file as a whole (wrong columns, empty, too big). */
  fileError: string | null;
}

const ALIASES: Record<string, Column> = {
  category: 'category', categories: 'category',
  name: 'name', item: 'name', 'item name': 'name', title: 'name',
  description: 'description', desc: 'description',
  price: 'price', amount: 'price',
  available: 'available', is_available: 'available', availability: 'available',
  featured: 'featured', is_featured: 'featured',
  new: 'new', is_new: 'new',
};

function bool(v: string): boolean | null | 'bad' {
  const t = v.trim().toLowerCase();
  if (t === '') return null;
  if (['yes', 'y', 'true', '1', 'available', 'on'].includes(t)) return true;
  if (['no', 'n', 'false', '0', 'unavailable', 'off'].includes(t)) return false;
  return 'bad';
}

/** Turns CSV text into a reviewable plan: what will be created, updated or rejected, and why. */
export function planImport(text: string, categories: MenuCategory[], items: MenuItem[], updateExisting: boolean): ImportPlan {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], fileError: 'That file is empty.' };

  const header = grid[0].map((h) => ALIASES[h.trim().toLowerCase()]);
  const col = (c: Column) => header.indexOf(c);
  if (col('name') < 0) return { rows: [], fileError: 'The first row must be a header that includes a "name" column. Download the template to see the format.' };
  if (grid.length === 1) return { rows: [], fileError: 'The file has a header but no items.' };
  if (grid.length - 1 > MAX_IMPORT_ROWS) return { rows: [], fileError: `That file has ${grid.length - 1} rows. Import up to ${MAX_IMPORT_ROWS} at a time.` };

  const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
  const itemByName = new Map(items.map((i) => [i.name.trim().toLowerCase(), i]));
  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];

  grid.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const get = (c: Column) => (col(c) >= 0 ? unguard((r[col(c)] ?? '').trim()) : '');
    const problems: string[] = [];
    const name = get('name');
    const description = get('description');
    const category = get('category');
    const rawPrice = get('price');

    const key = name.toLowerCase();
    let existing = name ? itemByName.get(key) : undefined;
    if (!name) problems.push('Name is missing');
    else if (name.length > 200) problems.push('Name is over 200 characters');
    else if (seen.has(key)) problems.push(`Same name as line ${seen.get(key)}`);
    else seen.set(key, line);

    let price = '';
    if (rawPrice !== '') {
      // Allow a currency prefix ("Rs. 1,100", "PKR 450", "$9.50") and thousands separators, nothing else.
      const digits = rawPrice.replace(/^(?:rs\.?|pkr|usd|\$)\s*/i, '').replace(/,/g, '');
      const n = /^\d+(\.\d+)?$/.test(digits) ? Number(digits) : NaN;
      if (!Number.isFinite(n)) problems.push('Price must be a number, like 450 or 99.50');
      else if (n >= 1_000_000) problems.push('Price is too large');
      else price = n.toFixed(2);
    }

    const flags = (['available', 'featured', 'new'] as const).map((c) => {
      const v = bool(get(c));
      if (v === 'bad') problems.push(`"${get(c)}" isn't yes or no (${c})`);
      return v === 'bad' ? null : v;
    });

    const isUpdate = !!existing && updateExisting;
    if (!isUpdate && !existing) {
      if (!description) problems.push('Description is missing');
      if (rawPrice === '') problems.push('Price is missing');
      if (!category) problems.push('Category is missing');
    }
    if (description.length > 2000) problems.push('Description is over 2,000 characters');
    if (category.length > 100) problems.push('Category name is over 100 characters');

    let action: ImportRow['action'] = problems.length ? 'error' : existing ? (updateExisting ? 'update' : 'skip') : 'create';
    if (action === 'update' && !description && !price && !category && flags.every((f) => f === null)) action = 'skip';
    rows.push({
      line, category, name, description, price,
      available: flags[0], featured: flags[1], isNew: flags[2],
      action, existingId: existing?.id,
      newCategory: !!category && !catByName.has(category.toLowerCase()),
      problems,
    });
    existing = undefined;
  });

  return { rows, fileError: null };
}

export function failedRowsCsv(rows: { row: ImportRow; error: string }[]): string {
  return toCsv([
    [...CSV_COLUMNS, 'error'],
    ...rows.map(({ row, error }) => [
      guard(row.category), guard(row.name), guard(row.description), row.price,
      row.available === null ? '' : row.available ? 'yes' : 'no',
      row.featured === null ? '' : row.featured ? 'yes' : 'no',
      row.isNew === null ? '' : row.isNew ? 'yes' : 'no',
      error,
    ]),
  ]);
}
