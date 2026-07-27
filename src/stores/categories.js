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
