import { defineStore } from 'pinia';
import * as categoriesDb from '../db/categories.js';

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    items: [],
  }),
  getters: {
    active: (state) => state.items.filter((c) => !c.archived),
    rootCategories() {
      return this.active.filter((c) => c.parentId === null);
    },
    childrenOf() {
      return (parentId) => this.active.filter((c) => c.parentId === parentId);
    },
    byId: (state) => (id) => state.items.find((c) => c.id === id),
    // A category's subtree is itself plus every descendant, found by walking
    // childrenOf recursively. Pure category-tree shape (no transactions
    // involved), so it lives next to childrenOf/rootCategories rather than
    // inside whichever component first needed it — CategoryPie sums a
    // parent's spend by looking up every leaf under it via this getter, and
    // any future consumer needing "this category and everything under it"
    // (e.g. warning on delete, or another aggregate view) can reuse it too.
    subtreeIds() {
      const walk = (categoryId) => {
        const ids = [categoryId];
        for (const child of this.childrenOf(categoryId)) {
          ids.push(...walk(child.id));
        }
        return ids;
      };
      return walk;
    },
  },
  actions: {
    async load() {
      await categoriesDb.seedDefaultCategoryIfEmpty();
      this.items = await categoriesDb.listCategories();
    },
    async create({ name, emoji, parentId = null }) {
      const category = await categoriesDb.createCategory({ name, emoji, parentId });
      this.items.push(category);
      return category;
    },
    async archive(id) {
      await categoriesDb.archiveCategory(id);
      this.items = await categoriesDb.listCategories();
    },
    async remove(id) {
      await categoriesDb.deleteCategory(id);
      this.items = await categoriesDb.listCategories();
    },
  },
});
