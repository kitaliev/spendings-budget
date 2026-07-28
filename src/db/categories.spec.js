import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import {
  createCategory,
  listCategories,
  getChildren,
  archiveCategory,
  deleteCategory,
  seedDefaultCategoryIfEmpty,
} from './categories.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('seedDefaultCategoryIfEmpty', () => {
  it('creates one default category when none exist', async () => {
    await seedDefaultCategoryIfEmpty();
    const all = await listCategories();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Расход', emoji: '💰', parentId: null });
  });

  it('does nothing if a category already exists', async () => {
    await createCategory({ name: 'Еда', emoji: '🍔' });
    await seedDefaultCategoryIfEmpty();
    const all = await listCategories();
    expect(all).toHaveLength(1);
  });
});

describe('createCategory / getChildren', () => {
  it('nests a subcategory under its parent', async () => {
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });
    const children = await getChildren(parent.id);
    expect(children.map((c) => c.id)).toEqual([child.id]);
  });

  it('getChildren(null) returns root categories, not every non-root one', async () => {
    // IndexedDB never indexes a record whose indexed field is null, so a
    // naive getAllFromIndex(..., null) silently returns the wrong set
    // instead of an empty one — this pins the explicit guard against that.
    const root = await createCategory({ name: 'Еда', emoji: '🍔' });
    const nested = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: root.id });
    const roots = await getChildren(null);
    expect(roots.map((c) => c.id)).toEqual([root.id]);
    expect(roots.map((c) => c.id)).not.toContain(nested.id);
  });
});

describe('archiveCategory', () => {
  it('marks the category and its whole subtree as archived, keeping the rows', async () => {
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });

    await archiveCategory(parent.id);

    const all = await listCategories();
    expect(all.find((c) => c.id === parent.id).archived).toBe(true);
    expect(all.find((c) => c.id === child.id).archived).toBe(true);
    expect(all).toHaveLength(2); // nothing deleted
  });
});

describe('deleteCategory', () => {
  it('cascades: deletes the category, its subtree, and their transactions', async () => {
    const db = await (await import('./index.js')).getDb();
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });
    await db.add('transactions', { id: 't1', amount: 500, date: '2026-07-20', categoryId: child.id });

    await deleteCategory(parent.id);

    const remainingCategories = await listCategories();
    expect(remainingCategories).toHaveLength(0);
    const remainingTx = await db.getAll('transactions');
    expect(remainingTx).toHaveLength(0);
  });
});
