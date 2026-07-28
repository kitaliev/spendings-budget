<template>
  <div class="category-picker">
    <button
      v-if="stack.length"
      type="button"
      class="category-picker__row category-picker__row--back"
      @click="back"
    >
      <ChevronLeft class="category-picker__emoji" aria-hidden="true" :size="18" />
      <span class="category-picker__name">Назад</span>
      <span class="category-picker__chevron" aria-hidden="true"></span>
    </button>
    <button
      v-for="category in currentLevel"
      :key="category.id"
      type="button"
      class="category-picker__row"
      @click="select(category)"
    >
      <span class="category-picker__emoji" aria-hidden="true">{{ category.emoji }}</span>
      <span class="category-picker__name">{{ category.name }}</span>
      <span class="category-picker__chevron" aria-hidden="true">
        <ChevronRight v-if="hasChildren(category)" :size="16" />
      </span>
    </button>
  </div>
</template>

<script>
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { useCategoriesStore } from '../../stores/categories.js';

export default {
  name: 'CategoryPicker',
  components: { ChevronLeft, ChevronRight },
  emits: ['pick'],
  data() {
    return {
      stack: [],
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    currentLevel() {
      const parentId = this.stack.length ? this.stack[this.stack.length - 1] : null;
      return parentId === null
        ? this.categoriesStore.rootCategories
        : this.categoriesStore.childrenOf(parentId);
    },
  },
  methods: {
    hasChildren(category) {
      return this.categoriesStore.childrenOf(category.id).length > 0;
    },
    select(category) {
      if (this.hasChildren(category)) {
        this.stack.push(category.id);
      } else {
        this.$emit('pick', category);
      }
    },
    back() {
      this.stack.pop();
    },
    reset() {
      this.stack = [];
    },
  },
};
</script>

<style lang="scss">
.category-picker {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  background: var(--surface-sunken);
  border-radius: 16px;
  padding: 6px;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 8px;
    border-radius: 10px;
    text-align: left;
  }

  &__emoji {
    font-size: 19px;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 15px;
  }

  &__chevron {
    display: flex;
    align-items: center;
    color: var(--ink-muted);
  }

  &__row--back {
    color: var(--accent-strong);
    font-weight: 600;
  }
}
</style>
