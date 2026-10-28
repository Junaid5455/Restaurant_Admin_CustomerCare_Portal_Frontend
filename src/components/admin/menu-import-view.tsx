'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MenuFrame } from './menu-kit';
import { QueryGate } from './settings-kit';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { menuError, useMenu, useMenuCache } from '@/hooks/use-admin-menu';
import { useRestaurantSettings } from '@/hooks/use-restaurant-settings';
import { adminMenuApi, type ItemInput, type MenuCategory, type MenuItem } from '@/lib/api/admin-menu';
import { CSV_COLUMNS, exportMenuCsv, failedRowsCsv, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, planImport, templateCsv, type ImportRow } from '@/lib/menu-csv';
import { formatMoney, toNumber } from '@/lib/format';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);

type Stage = 'pick' | 'review' | 'running' | 'done';
interface Failure {
  row: ImportRow;
  error: string;
}
interface Outcome {
  created: number;
  updated: number;
  failed: Failure[];
}

const ACTION_BADGE: Record<ImportRow['action'], { text: string; cls: string }> = {
  create: { text: 'New', cls: 'badge-good' },
  update: { text: 'Update', cls: 'badge-accent' },
  skip: { text: 'Skipped', cls: 'badge-neutral' },
  error: { text: 'Problem', cls: 'badge-crit' },
};

function Importer({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const settings = useRestaurantSettings();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [update, setUpdate] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const plan = useMemo(() => (text ? planImport(text, categories, items, update) : null), [text, categories, items, update]);
  const rows = plan?.rows ?? [];
  const counts = {
    create: rows.filter((r) => r.action === 'create').length,
    update: rows.filter((r) => r.action === 'update').length,
    skip: rows.filter((r) => r.action === 'skip').length,
    error: rows.filter((r) => r.action === 'error').length,
  };
  const newCategories = [...new Set(rows.filter((r) => r.newCategory && (r.action === 'create' || r.action === 'update')).map((r) => r.category))];
  const actionable = counts.create + counts.update;

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_IMPORT_BYTES) return setFileError('That file is over 1 MB. Split it into smaller files.');
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return setFileError('Choose a .csv file. In Excel or Sheets, use Save as → CSV.');
    const content = await file.text();
    const p = planImport(content, categories, items, update);
    if (p.fileError) return setFileError(p.fileError);
    setFileName(file.name);
    setText(content);
    setStage('review');
  }

  function reset() {
    setStage('pick');
    setText('');
    setFileName('');
    setOutcome(null);
    setFileError(null);
  }

  async function run() {
    if (!plan) return;
    const todo = plan.rows.filter((r) => r.action === 'create' || r.action === 'update');
    setStage('running');
    setProgress({ done: 0, total: todo.length });
    const failed: Failure[] = [];
    let created = 0;
    let updated = 0;

    // 1. Make sure every category exists.
    const ids = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const catErrors = new Map<string, string>();
    let order = categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
    for (const name of newCategories) {
      try {
        if (!settings.data?.id) throw new Error("We couldn't find your restaurant. Reload and try again.");
        const c = await adminMenuApi.createCategory(settings.data.id, { name, description: '', is_active: true, order: order++ });
        ids.set(name.toLowerCase(), c.id);
      } catch (e) {
        catErrors.set(name.toLowerCase(), `Couldn't create the category "${name}": ${menuError(e)}`);
      }
    }

    // 2. Create / update dishes, three at a time.
    const existingCategory = new Map(items.map((i) => [i.id, i.category_id]));
    let next = 0;
    let done = 0;
    async function worker() {
      while (next < todo.length) {
        const row = todo[next++];
        try {
          const cat = row.category ? ids.get(row.category.toLowerCase()) : undefined;
          if (row.category && !cat) throw new Error(catErrors.get(row.category.toLowerCase()) ?? 'Category is missing');
          if (row.action === 'create') {
            const body: ItemInput = {
              name: row.name, description: row.description, price: row.price, category_id: cat as string,
              is_available: row.available ?? true, is_featured: row.featured ?? false, is_new: row.isNew ?? false,
            };
            await adminMenuApi.createItem(body);
            created++;
          } else {
            const patch: Partial<ItemInput> = {};
            if (row.description) patch.description = row.description;
            if (row.price) patch.price = row.price;
            if (cat && cat !== existingCategory.get(row.existingId as string)) patch.category_id = cat;
            if (row.available !== null) patch.is_available = row.available;
            if (row.featured !== null) patch.is_featured = row.featured;
            if (row.isNew !== null) patch.is_new = row.isNew;
            await adminMenuApi.updateItem(row.existingId as string, patch);
            updated++;
          }
        } catch (e) {
          failed.push({ row, error: e instanceof Error && !('status' in e) ? e.message : menuError(e) });
        }
        setProgress({ done: ++done, total: todo.length });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    await cache.refresh();
    setOutcome({ created, updated, failed: failed.sort((a, b) => a.row.line - b.row.line) });
    setStage('done');
    push(failed.length ? `Imported with ${failed.length} problem${failed.length === 1 ? '' : 's'}` : 'Import finished', failed.length ? 'info' : 'success');
  }

  return (
    <>
      <section className="card ad-card-pad" aria-labelledby="ex-title">
        <h2 id="ex-title" className="ad-rowhead-title">Export your menu</h2>
        <p className="ad-muted" style={{ margin: 0 }}>
          Download every dish ({items.length}) as a spreadsheet file. Edit it, then import it back to update prices or availability in bulk.
        </p>
        <div className="ad-actions">
          <Button variant="ghost" onClick={() => download(`menu-${today()}.csv`, exportMenuCsv(categories, items))} disabled={items.length === 0}>
            Download menu (.csv)
          </Button>
          <button type="button" className="ad-link" onClick={() => download('menu-template.csv', templateCsv())}>Download an empty template</button>
        </div>
        {items.length === 0 && <p className="ad-muted" style={{ margin: 0 }}>Nothing to export yet.</p>}
      </section>

      <section className="card ad-card-pad" aria-labelledby="im-title">
        <h2 id="im-title" className="ad-rowhead-title">Import dishes</h2>

        {stage === 'pick' && (
          <>
            <p className="ad-muted" style={{ margin: 0 }}>
              Upload a .csv file with these columns: <code className="ad-code">{CSV_COLUMNS.join(', ')}</code>. Name, description, price and category are needed for new dishes; yes/no for the rest. Up to {MAX_IMPORT_ROWS} rows. Pictures, customizations and add-ons aren&apos;t part of the file.
            </p>
            {fileError && <Alert>{fileError}</Alert>}
            <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="sr-only" tabIndex={-1} onChange={pick} aria-label="Choose a CSV file to import" />
            <div className="ad-actions">
              <Button onClick={() => input.current?.click()}>Choose a CSV file…</Button>
            </div>
          </>
        )}

        {stage === 'review' && plan && (
          <>
            <p style={{ margin: 0 }}>
              <strong>{fileName}</strong> · {rows.length} {rows.length === 1 ? 'row' : 'rows'}
            </p>
            <div className="ad-chips" aria-label="Import summary" role="list">
              <span role="listitem" className="badge badge-good">{counts.create} new</span>
              <span role="listitem" className="badge badge-accent">{counts.update} to update</span>
              <span role="listitem" className="badge badge-neutral">{counts.skip} skipped</span>
              <span role="listitem" className={`badge ${counts.error ? 'badge-crit' : 'badge-neutral'}`}>{counts.error} with problems</span>
            </div>
            <label className="ad-check">
              <input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} /> Update dishes that already exist (matched by name). Blank cells keep the current value.
            </label>
            {newCategories.length > 0 && <Alert kind="info">New categories will be created: {newCategories.join(', ')}.</Alert>}
            {counts.error > 0 && <Alert>Rows with problems are skipped. Fix them in your file and import again, or carry on without them.</Alert>}
            <div className="ad-table-wrap ad-scroll-y">
              <table className="ad-table">
                <caption className="sr-only">Import preview</caption>
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Dish</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">Price</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <td className="ad-muted">{r.line}</td>
                      <th scope="row" style={{ textAlign: 'left' }}>{r.name || <span className="ad-muted">(no name)</span>}</th>
                      <td>{r.category || <span className="ad-muted">—</span>}</td>
                      <td className="num">{r.price ? formatMoney(toNumber(r.price)) : '—'}</td>
                      <td>
                        <span className={`badge ${ACTION_BADGE[r.action].cls}`}>{ACTION_BADGE[r.action].text}</span>
                        {r.action === 'skip' && !r.problems.length && <span className="ad-muted"> {update ? 'nothing to change' : 'already on your menu'}</span>}
                        {r.problems.length > 0 && <div className="ad-problems">{r.problems.join('. ')}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ad-actions">
              <Button onClick={run} disabled={actionable === 0}>
                Import {actionable} {actionable === 1 ? 'dish' : 'dishes'}
              </Button>
              <Button variant="ghost" onClick={reset}>Choose a different file</Button>
            </div>
          </>
        )}

        {stage === 'running' && (
          <div role="status" aria-live="polite">
            <p style={{ margin: '0 0 10px' }}>Importing… {progress.done} of {progress.total}</p>
            <div className="ad-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Import progress">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="ad-muted" style={{ margin: '10px 0 0' }}>Keep this page open until it finishes.</p>
          </div>
        )}

        {stage === 'done' && outcome && (
          <>
            <Alert kind={outcome.failed.length ? 'info' : 'success'}>
              {outcome.created} added, {outcome.updated} updated{outcome.failed.length ? `, ${outcome.failed.length} couldn't be imported` : ''}.
            </Alert>
            {outcome.failed.length > 0 && (
              <>
                <div className="ad-table-wrap ad-scroll-y">
                  <table className="ad-table">
                    <caption className="sr-only">Rows that couldn&apos;t be imported</caption>
                    <thead>
                      <tr>
                        <th scope="col">Line</th>
                        <th scope="col">Dish</th>
                        <th scope="col">What went wrong</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outcome.failed.map((f) => (
                        <tr key={f.row.line}>
                          <td className="ad-muted">{f.row.line}</td>
                          <th scope="row" style={{ textAlign: 'left' }}>{f.row.name}</th>
                          <td className="ad-problems">{f.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ad-actions">
                  <Button variant="ghost" onClick={() => download(`menu-import-problems-${today()}.csv`, failedRowsCsv(outcome.failed))}>Download these rows (.csv)</Button>
                </div>
              </>
            )}
            <div className="ad-actions">
              <Button onClick={reset}>Import another file</Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export function MenuImportView() {
  const query = useMenu();
  return (
    <MenuFrame active="import" title="Import & export" description="Move your menu in and out of a spreadsheet.">
      <QueryGate query={query}>{(data) => <Importer categories={data.categories} items={data.items} />}</QueryGate>
    </MenuFrame>
  );
}
