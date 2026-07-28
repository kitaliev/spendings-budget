<template>
  <div class="category-tree">
    <div
      v-for="row in rows"
      :key="row.category.id"
      class="tree-row"
      :class="{ 'tree-row--sub': row.depth > 0, 'tree-row--revealed': revealedId === row.category.id }"
      :style="{ paddingLeft: 14 + row.depth * 24 + 'px' }"
    >
      <span class="tree-row__emoji">{{ row.category.emoji }}</span>
      <span class="tree-row__name">{{ row.category.name }}</span>
      <button
        type="button"
        class="tree-row__more"
        aria-label="Действия"
        :aria-expanded="revealedId === row.category.id ? 'true' : 'false'"
        @click="toggleRevealed(row.category.id)"
      >⋯</button>
      <div class="tree-row__actions">
        <button type="button" class="tree-row__action tree-row__action--archive" @click="archive(row.category.id)">Архив</button>
        <button type="button" class="tree-row__action tree-row__action--delete" @click="confirmDelete(row.category)">Удалить</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

function flattenTree(categories, parentId, depth) {
  const result = [];
  const children = categories.filter((c) => c.parentId === parentId);
  for (const child of children) {
    result.push({ category: child, depth });
    result.push(...flattenTree(categories, child.id, depth + 1));
  }
  return result;
}

// Deliberately NOT useCategoriesStore().subtreeIds() (Task 7/19) — that
// getter walks childrenOf(), which is scoped to *active* categories only.
// Deleting a category cascades to its whole subtree regardless of archived
// status (db/categories.js's deleteCategory does exactly this), so the
// transaction count shown in the confirm dialog below needs the same
// unfiltered scope, over the full (unfiltered) `items` list — otherwise an
// archived subcategory's transactions would silently be left out of the
// count, understating what's actually about to be deleted.
function subtreeIds(categories, rootId) {
  const ids = [rootId];
  const children = categories.filter((c) => c.parentId === rootId);
  for (const child of children) {
    ids.push(...subtreeIds(categories, child.id));
  }
  return ids;
}

export default {
  name: 'CategoryTree',
  data() {
    return {
      revealedId: null,
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    transactionsStore() {
      return useTransactionsStore();
    },
    rows() {
      return flattenTree(this.categoriesStore.active, null, 0);
    },
  },
  methods: {
    toggleRevealed(id) {
      this.revealedId = this.revealedId === id ? null : id;
    },
    async archive(id) {
      this.revealedId = null;
      await this.categoriesStore.archive(id);
    },
    transactionCountFor(categoryId) {
      const ids = subtreeIds(this.categoriesStore.items, categoryId);
      return this.transactionsStore.items.filter((t) => ids.includes(t.categoryId)).length;
    },
    async confirmDelete(category) {
      this.revealedId = null;
      const count = this.transactionCountFor(category.id);
      const confirmed = window.confirm(
        `Удалить «${category.name}» и все её транзакции (${count})? Это нельзя отменить.`
      );
      if (confirmed) await this.categoriesStore.remove(category.id);
    },
  },
};
</script>

<style lang="scss">
.tree-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-top: 11px;
  padding-bottom: 11px;
  padding-right: 14px;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;

  &:last-child {
    border-bottom: 0;
  }

  &__emoji {
    font-size: 16px;
    width: 22px;
    text-align: center;
    flex: 0 0 auto;
  }

  &__name {
    font-size: 14.5px;
    flex: 1 1 auto;
  }

  &__more {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-muted);
    flex: 0 0 auto;

    // Smaller than every other icon button already found and fixed this
    // way (BudgetDashboard's 34px settings gear, DebtsScreen's 30px add
    // toggle) — needs the widest hit-slop expansion of any of them.
    &::before {
      content: '';
      position: absolute;
      inset: -9px;
    }
  }

  &__actions {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    transform: translateX(100%);
    transition: transform 0.18s ease;
  }

  &--revealed &__actions {
    transform: translateX(0);
  }

  &__action {
    width: 78px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;

    &--archive {
      background: #8a8f73;
    }

    &--delete {
      background: var(--negative);
    }
  }
}
</style>
