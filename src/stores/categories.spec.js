import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCategoriesStore } from './categories.js';
import * as categoriesDb from '../db/categories.js';

vi.mock('../db/categories.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
});

describe('useCategoriesStore.load', () => {
  it('populates items from the database', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.items).toHaveLength(1);
  });
});

describe('useCategoriesStore.rootCategories', () => {
  it('excludes archived and nested categories', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
      { id: '3', name: 'Старое', emoji: '📦', parentId: null, archived: true },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.rootCategories.map((c) => c.id)).toEqual(['1']);
  });
});

describe('useCategoriesStore.childrenOf', () => {
  it('returns active children of a given parent', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.childrenOf('1').map((c) => c.id)).toEqual(['2']);
  });
});

describe('useCategoriesStore.archive', () => {
  it('delegates to the db layer and reloads', async () => {
    categoriesDb.listCategories.mockResolvedValue([]);
    categoriesDb.archiveCategory.mockResolvedValue(undefined);
    const store = useCategoriesStore();
    await store.archive('1');
    expect(categoriesDb.archiveCategory).toHaveBeenCalledWith('1');
    expect(categoriesDb.listCategories).toHaveBeenCalled();
  });
});
