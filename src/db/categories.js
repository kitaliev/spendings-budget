import { getDb } from './index.js';

export async function createCategory({ name, emoji, parentId = null }) {
  const db = await getDb();
  const category = { id: crypto.randomUUID(), name, emoji, parentId, archived: false };
  await db.add('categories', category);
  return category;
}

export async function listCategories() {
  const db = await getDb();
  return db.getAll('categories');
}

export async function getChildren(parentId) {
  const db = await getDb();
  // IndexedDB never indexes a record whose indexed field is `null` (root
  // categories all have parentId: null), and idb's getAllFromIndex(..., null)
  // collapses to "no filter" rather than "match null" — so without this
  // guard, getChildren(null) would silently return every non-root category
  // instead of the roots. Handled here so any caller can rely on parentId's
  // documented nullable semantics without knowing that IDB quirk.
  if (parentId === null) {
    const all = await db.getAll('categories');
    return all.filter((c) => c.parentId === null);
  }
  return db.getAllFromIndex('categories', 'parentId', parentId);
}

// Hard-deletes id and its entire subtree, plus every transaction belonging
// to any of them. Irreversible — the caller (Settings' category tree) is
// responsible for confirming with the user first.
async function collectSubtreeIds(store, rootId) {
  const ids = [rootId];
  const children = await store.index('parentId').getAll(rootId);
  for (const child of children) {
    ids.push(...(await collectSubtreeIds(store, child.id)));
  }
  return ids;
}

// Soft: flips archived on id and its whole subtree, touches no other data.
// Reversible in principle (nothing un-sets it yet, but no row is destroyed).
export async function archiveCategory(id) {
  const db = await getDb();
  const tx = db.transaction('categories', 'readwrite');
  // Collecting the subtree through the same transaction that then writes to
  // it (rather than a separate read via the plain db handle beforehand)
  // closes a TOCTOU gap: any other readwrite transaction touching
  // `categories` queues behind this one until tx.done, so a category
  // created/reparented mid-walk can't slip in uncounted.
  const ids = await collectSubtreeIds(tx.store, id);
  for (const catId of ids) {
    const category = await tx.store.get(catId);
    if (category) await tx.store.put({ ...category, archived: true });
  }
  await tx.done;
}

export async function deleteCategory(id) {
  const db = await getDb();
  const tx = db.transaction(['categories', 'transactions'], 'readwrite');
  const categoriesStore = tx.objectStore('categories');
  const ids = await collectSubtreeIds(categoriesStore, id);
  const txByCategory = tx.objectStore('transactions').index('categoryId');
  for (const catId of ids) {
    await categoriesStore.delete(catId);
    let cursor = await txByCategory.openCursor(catId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export async function seedDefaultCategoryIfEmpty() {
  const db = await getDb();
  const count = await db.count('categories');
  if (count === 0) {
    await createCategory({ name: 'Расход', emoji: '💰', parentId: null });
  }
}
