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
  return db.getAllFromIndex('categories', 'parentId', parentId);
}

async function collectSubtreeIds(db, rootId) {
  const ids = [rootId];
  const children = await db.getAllFromIndex('categories', 'parentId', rootId);
  for (const child of children) {
    ids.push(...(await collectSubtreeIds(db, child.id)));
  }
  return ids;
}

export async function archiveCategory(id) {
  const db = await getDb();
  const ids = await collectSubtreeIds(db, id);
  const tx = db.transaction('categories', 'readwrite');
  for (const catId of ids) {
    const category = await tx.store.get(catId);
    if (category) await tx.store.put({ ...category, archived: true });
  }
  await tx.done;
}

export async function deleteCategory(id) {
  const db = await getDb();
  const categoryIds = await collectSubtreeIds(db, id);
  const tx = db.transaction(['categories', 'transactions'], 'readwrite');
  const txStore = tx.objectStore('transactions');
  const txByCategory = txStore.index('categoryId');
  for (const catId of categoryIds) {
    await tx.objectStore('categories').delete(catId);
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
