'use client';

import { useState, type FormEvent } from 'react';
import { ImageField, MenuFrame, MiniSwitch, Thumb } from './menu-kit';
import { QueryGate } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { menuError, useMenu, useMenuCache } from '@/hooks/use-admin-menu';
import { useRestaurantSettings } from '@/hooks/use-restaurant-settings';
import { adminMenuApi, type MenuCategory } from '@/lib/api/admin-menu';
import { mapSaveError } from './settings-kit';

function CategoryModal({ category, restaurantId, categories, onClose }: { category: MenuCategory | null; restaurantId: string | undefined; categories: MenuCategory[]; onClose: () => void }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [active, setActive] = useState(category?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    const n = name.trim();
    if (!n) found.name = 'Give this category a name';
    else if (n.length > 100) found.name = 'Keep the name under 100 characters';
    else if (categories.some((c) => c.id !== category?.id && c.name.trim().toLowerCase() === n.toLowerCase())) found.name = 'You already have a category with this name';
    if (description.trim().length > 500) found.description = 'Keep the description under 500 characters';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.sv-modal [aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      if (category) {
        const patch: Record<string, unknown> = {};
        if (n !== category.name) patch.name = n;
        if (description.trim() !== (category.description ?? '')) patch.description = description.trim();
        if (active !== category.is_active) patch.is_active = active;
        if (Object.keys(patch).length) await adminMenuApi.updateCategory(category.id, patch);
        if (file) await adminMenuApi.uploadCategoryImage(category.id, file);
        else if (removed && category.image) await adminMenuApi.removeCategoryImage(category.id);
      } else {
        if (!restaurantId) throw new Error("We couldn't find your restaurant. Reload and try again.");
        const nextOrder = categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
        await adminMenuApi.createCategory(restaurantId, { name: n, description: description.trim(), is_active: active, order: nextOrder }, file);
      }
      await cache.refresh();
      push(category ? 'Category saved' : 'Category added');
      onClose();
    } catch (err) {
      const m = mapSaveError(err, ['name', 'description']);
      setErrors({ name: m.fields.name, description: m.fields.description });
      setFormError(m.form ? menuError(err) : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy="cat-title">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id="cat-title" className="sv-modal-title">{category ? 'Edit category' : 'Add a category'}</h2>
            {formError && <Alert>{formError}</Alert>}
            <TextField label="Name" value={name} maxLength={100} placeholder="e.g. Starters" onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} error={errors.name} />
            <TextArea label="Description (optional)" rows={2} maxLength={500} value={description} onChange={(e) => { setDescription(e.target.value); setErrors((x) => ({ ...x, description: undefined })); }} error={errors.description} />
            <ImageField label="Category picture" hint="Optional. JPG, PNG, WebP or GIF, up to 5 MB." name={name} src={removed ? null : category?.image ?? null} onPick={(f) => { setFile(f); setRemoved(f === null); }} />
            <Switch label="Show to guests" description="Hidden categories stay here but guests don't see them." checked={active} onChange={setActive} />
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <Button type="submit" loading={busy} loadingText="Saving…">{category ? 'Save category' : 'Add category'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Categories({ categories }: { categories: MenuCategory[] }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const settings = useRestaurantSettings();
  const [editing, setEditing] = useState<MenuCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MenuCategory | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(c: MenuCategory, next: boolean) {
    const undo = cache.patchCategory(c.id, { is_active: next });
    setBusyId(c.id);
    try {
      await adminMenuApi.updateCategory(c.id, { is_active: next });
      push(`${c.name} is now ${next ? 'shown' : 'hidden'}`);
    } catch (e) {
      undo();
      push(menuError(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function move(c: MenuCategory, dir: -1 | 1) {
    const i = categories.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const reordered = [...categories];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const changes = reordered.map((x, idx) => ({ x, idx })).filter(({ x, idx }) => x.order !== idx);
    const undos = changes.map(({ x, idx }) => cache.patchCategory(x.id, { order: idx }));
    setBusyId(c.id);
    try {
      await Promise.all(changes.map(({ x, idx }) => adminMenuApi.updateCategory(x.id, { order: idx })));
      await cache.refresh();
    } catch (e) {
      undos.forEach((u) => u());
      push(menuError(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: MenuCategory) {
    setDeleteBusy(true);
    try {
      await adminMenuApi.deleteCategory(c.id);
      await cache.refresh();
      push(`${c.name} deleted`);
      setDeleting(null);
    } catch (e) {
      push(menuError(e), 'error');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <MenuFrame
      active="categories"
      title="Categories"
      description="Group your dishes. Guests see categories in this order."
      actions={
        <Button onClick={() => setEditing('new')} disabled={!settings.data?.id}>
          + Add category
        </Button>
      }
    >
      {categories.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">🗂</div>
          <strong>No categories yet</strong>
          <span>Create one (like Starters or Drinks) before adding dishes.</span>
          <Button onClick={() => setEditing('new')} disabled={!settings.data?.id}>Add your first category</Button>
        </div>
      ) : (
        <div className="card">
          <ul className="ad-cats" aria-label="Categories">
            {categories.map((c, i) => (
              <li key={c.id} className={c.is_active ? '' : 'is-off'}>
                <Thumb src={c.image} name={c.name} />
                <div className="ad-list-main">
                  <div className="ad-list-title">
                    {c.name} {!c.is_active && <span className="badge badge-neutral">Hidden</span>}
                  </div>
                  <div className="ad-list-sub">
                    {c.item_count} {c.item_count === 1 ? 'item' : 'items'}
                    {c.description ? ` · ${c.description}` : ''}
                  </div>
                </div>
                <div className="ad-row-tools">
                  <MiniSwitch checked={c.is_active} label={`Show ${c.name} to guests`} disabled={busyId === c.id} onChange={(v) => toggle(c, v)} />
                  <button type="button" className="ad-icon-btn" aria-label={`Move ${c.name} up`} disabled={i === 0 || busyId !== null} onClick={() => move(c, -1)}>↑</button>
                  <button type="button" className="ad-icon-btn" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1 || busyId !== null} onClick={() => move(c, 1)}>↓</button>
                  <button type="button" className="ad-link" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>Edit</button>
                  <button type="button" className="ad-link danger" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && <CategoryModal category={editing === 'new' ? null : editing} restaurantId={settings.data?.id} categories={categories} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message={deleting.item_count ? `${deleting.item_count} ${deleting.item_count === 1 ? 'dish' : 'dishes'} will stay on your menu but no longer belong to a category. This can't be undone.` : "This can't be undone."}
          confirmLabel="Delete category"
          busy={deleteBusy}
          onConfirm={() => remove(deleting)}
          onClose={() => !deleteBusy && setDeleting(null)}
        />
      )}
    </MenuFrame>
  );
}

export function MenuCategoriesView() {
  const query = useMenu();
  return <QueryGate query={query}>{(data) => <Categories categories={data.categories} />}</QueryGate>;
}
