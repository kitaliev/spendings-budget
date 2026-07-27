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

describe('useCategoriesStore.subtreeIds', () => {
  it('returns a category id plus every descendant id, however deeply nested', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
      { id: '3', name: 'Кафе', emoji: '☕', parentId: '1', archived: false },
      { id: '5', name: 'Латте', emoji: '🥛', parentId: '3', archived: false },
      { id: '4', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.subtreeIds('1')).toEqual(['1', '2', '3', '5']);
  });

  it('returns just the category itself when it is a leaf', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '4', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.subtreeIds('4')).toEqual(['4']);
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

describe('useCategoriesStore.remove', () => {
  it('delegates to the db layer and reloads', async () => {
    categoriesDb.listCategories.mockResolvedValue([]);
    categoriesDb.deleteCategory.mockResolvedValue(undefined);
    const store = useCategoriesStore();
    await store.remove('1');
    expect(categoriesDb.deleteCategory).toHaveBeenCalledWith('1');
    expect(categoriesDb.listCategories).toHaveBeenCalled();
  });
});

describe('useCategoriesStore.create', () => {
  it('appends the created category to items', async () => {
    categoriesDb.createCategory.mockResolvedValue({
      id: '2', name: 'Здоровье', emoji: '💊', parentId: null, archived: false,
    });
    const store = useCategoriesStore();
    await store.create({ name: 'Здоровье', emoji: '💊' });
    expect(store.items.map((c) => c.id)).toEqual(['2']);
  });
});

describe('useCategoriesStore.byId', () => {
  it('finds a category by id, including an archived one', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Старое', emoji: '📦', parentId: null, archived: true },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.byId('1')).toMatchObject({ name: 'Старое' });
    expect(store.byId('missing')).toBeUndefined();
  });
});
