<template>
  <div class="category-tree">
    <button type="button" class="category-tree__add-toggle" @click="toggleAddForm">
      {{ addingOpen ? '‹ Отмена' : '+ Добавить категорию' }}
    </button>

    <form v-if="addingOpen" class="category-tree__add-form" @submit.prevent="submitAdd">
      <input v-model="newEmoji" class="category-tree__add-emoji" placeholder="🙂" maxlength="16" />
      <input v-model="newName" class="category-tree__add-name" placeholder="Название" />
      <select v-model="newParentId" class="category-tree__add-parent" aria-label="Родительская категория">
        <option :value="null">Без родителя</option>
        <option v-for="row in rows" :key="row.category.id" :value="row.category.id">
          {{ '—'.repeat(row.depth) }} {{ row.category.name }}
        </option>
      </select>
      <button type="submit" class="category-tree__add-submit">Создать</button>
    </form>

    <div
      v-for="row in rows"
      :key="row.category.id"
      class="tree-row"
      :class="{ 'tree-row--revealed': revealedId === row.category.id }"
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
      <!-- transform: translateX(100%) (below) only moves this box visually
           — it stays focusable, tabbable, and hit-testable even while off
           the visible row (a well-known off-canvas pitfall), which would
           let ordinary Tab navigation reach and activate an unconfirmed,
           effectively-irreversible Archive on every row. inert removes it
           from focus/tab order/hit-testing entirely while hidden. -->
      <div class="tree-row__actions" :inert="revealedId !== row.category.id">
        <button type="button" class="tree-row__action tree-row__action--archive" @click="archive(row.category.id)">Архив</button>
        <button type="button" class="tree-row__action tree-row__action--delete" @click="confirmDelete(row.category)">Удалить</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useToastStore } from '../../stores/toast.js';

// Takes childrenOf itself (a bound function), not a raw array to re-filter
// — childrenOf already IS "categories with this parentId," so refiltering
// a raw array here would just be a second, driftable copy of that same
// logic with an extra depth counter layered on top.
function flattenTree(childrenOf, parentId, depth) {
  const result = [];
  for (const child of childrenOf(parentId)) {
    result.push({ category: child, depth });
    result.push(...flattenTree(childrenOf, child.id, depth + 1));
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
      addingOpen: false,
      newName: '',
      newEmoji: '',
      newParentId: null,
      // Shared across submitAdd/archive/confirmDelete (same shape as
      // ExpenseModal sharing one flag between commit() and onDelete()) —
      // neither the db layer nor the store rejects a second concurrent
      // write call for any of them.
      submitting: false,
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
      return flattenTree(this.categoriesStore.childrenOf, null, 0);
    },
  },
  methods: {
    toggleRevealed(id) {
      this.revealedId = this.revealedId === id ? null : id;
    },
    async archive(id) {
      // Reuses the same submitting flag as submitAdd — same shape as
      // ExpenseModal sharing one submitting flag between commit() and
      // onDelete(). Tapping Архив and immediately re-revealing the same
      // row's actions (the panel becomes hit-testable again once :inert
      // lifts after re-render) could otherwise fire a second concurrent
      // archive/delete before the first resolves.
      if (this.submitting) return;
      this.revealedId = null;
      this.submitting = true;
      try {
        await this.categoriesStore.archive(id);
      } finally {
        this.submitting = false;
      }
    },
    transactionCountFor(categoryId) {
      const ids = subtreeIds(this.categoriesStore.items, categoryId);
      return this.transactionsStore.items.filter((t) => ids.includes(t.categoryId)).length;
    },
    async confirmDelete(category) {
      if (this.submitting) return;
      this.revealedId = null;
      const count = this.transactionCountFor(category.id);
      const confirmed = window.confirm(
        `Удалить «${category.name}» и все её транзакции (${count})? Это нельзя отменить.`
      );
      if (!confirmed) return;
      this.submitting = true;
      try {
        await this.categoriesStore.remove(category.id);
      } finally {
        this.submitting = false;
      }
    },
    // Shared by cancel and a successful submit — without this, tapping
    // ‹ Отмена left the typed name/emoji/parent sitting in data(), so
    // reopening the form (or a future edit-mode reuse of this same form)
    // would resurface a stale, possibly-abandoned-mid-entry draft, the same
    // "stale value on reopen" bug class already fixed once this session for
    // ExpenseModal (commit 51b34d9).
    resetAddForm() {
      this.newName = '';
      this.newEmoji = '';
      this.newParentId = null;
    },
    toggleAddForm() {
      this.addingOpen = !this.addingOpen;
      if (!this.addingOpen) this.resetAddForm();
    },
    async submitAdd() {
      if (this.submitting) return;
      const name = this.newName.trim();
      if (!name) {
        useToastStore().show('Введите название');
        return;
      }
      this.submitting = true;
      try {
        await this.categoriesStore.create({
          name,
          emoji: this.newEmoji.trim() || '📁',
          parentId: this.newParentId,
        });
        this.addingOpen = false;
        this.resetAddForm();
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.category-tree {
  &__add-toggle {
    // min-height + flex-centering, not just padding — the same emergent-
    // height gap already found and fixed on every other text/icon button
    // this session (CategoryTree's own tree-row__more among them).
    min-height: 44px;
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 0 14px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--accent-strong);
  }

  &__add-form {
    display: flex;
    gap: 6px;
    padding: 0 14px 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  &__add-emoji {
    // Same 44px-touch-target reasoning as __add-toggle/__add-parent — a
    // text input is still something a real finger has to tap into.
    min-height: 44px;
    width: 44px;
    text-align: center;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px;
  }

  &__add-name {
    min-height: 44px;
    flex: 1;
    min-width: 100px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 14px;
  }

  &__add-parent {
    // Same min-height reasoning as __add-toggle above — a native <select>
    // with just 6px vertical padding and a 13px line renders well under
    // the 44px touch-target minimum on a real phone, same as a custom
    // button would.
    min-height: 44px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 13px;
  }

  &__add-submit {
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--accent-strong);
    font-weight: 600;
    font-size: 13px;
    padding: 6px 12px;
  }
}

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
      // #8a8f73 (this chip's original color) only reaches 3.36:1 against
      // this white text — below the 4.5:1 WCAG AA minimum for this size/
      // weight. Darkened within the same olive family to 7.38:1.
      background: #54583f;
    }

    &--delete {
      // Not var(--negative): that token is tuned as a *foreground* ink
      // color (used elsewhere for text/icons on the app's own surface),
      // with a dark-mode value intentionally lightened for legibility
      // there — which is the opposite of what a solid fill behind white
      // text needs (it fails contrast, 3.04:1, in dark mode). Fixed
      // regardless of theme instead, like a dedicated destructive-action
      // chip color: 6.08:1 against white.
      background: #a8412b;
    }
  }
}
</style>
