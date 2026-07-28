<template>
  <div class="category-pie">
    <p class="category-pie__title">{{ stack.length ? 'Подкатегории' : 'Расход по категориям' }}</p>
    <button v-if="stack.length" type="button" class="category-pie__back" @click="back">
      <ChevronLeft aria-hidden="true" :size="16" /> Назад ко всем категориям
    </button>

    <!-- Every amount/percentage on this chart is already in the legend below
         as text — this circle is redundant visual reinforcement, same as
         MonthChart's bare letter or TabBar's icon, so it's hidden from
         assistive tech rather than left as an unlabeled, contentless stop. -->
    <div class="category-pie__chart" :style="{ background: gradient }" aria-hidden="true"></div>

    <div class="category-pie__legend">
      <button
        v-for="row in rows"
        :key="row.category.id"
        type="button"
        class="category-pie__legend-item"
        :disabled="!row.hasChildren"
        @click="drillInto(row.category)"
      >
        <span class="category-pie__swatch" :style="{ background: row.color }"></span>
        <span class="category-pie__emoji">{{ row.category.emoji }}</span>
        <span class="category-pie__name">{{ row.category.name }}</span>
        <span class="category-pie__pct">{{ row.pct }}%</span>
        <span class="category-pie__amount">{{ formatMoney(row.amount) }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ChevronLeft } from '@lucide/vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { formatMoney } from '../../utils/currency.js';

const PALETTE = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)'];

export default {
  name: 'CategoryPie',
  components: { ChevronLeft },
  props: {
    monthKey: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      stack: [],
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    transactionsStore() {
      return useTransactionsStore();
    },
    currentLevel() {
      const parentId = this.stack.length ? this.stack[this.stack.length - 1] : null;
      return parentId === null
        ? this.categoriesStore.rootCategories
        : this.categoriesStore.childrenOf(parentId);
    },
    rows() {
      const total = this.currentLevel.reduce((sum, category) => sum + this.amountFor(category), 0);
      return this.currentLevel.map((category, index) => {
        const amount = this.amountFor(category);
        return {
          category,
          amount,
          pct: total ? Math.round((amount / total) * 100) : 0,
          color: PALETTE[index % PALETTE.length],
          hasChildren: this.categoriesStore.childrenOf(category.id).length > 0,
        };
      });
    },
    gradient() {
      const total = this.rows.reduce((sum, row) => sum + row.amount, 0);
      let acc = 0;
      const stops = this.rows.map((row) => {
        const start = total ? (acc / total) * 100 : 0;
        acc += row.amount;
        const end = total ? (acc / total) * 100 : 0;
        return `${row.color} ${start}% ${end}%`;
      });
      // stops.length (the category count) is almost always truthy — including
      // on a brand-new install's default category, or any month with zero
      // spend — which produced a conic-gradient where every stop sits at 0%,
      // rendering as a solid, misleading fill (the browser extends the last
      // stop's color across the whole circle) while the legend correctly
      // showed 0% for everything. total is the actual condition that matters.
      return total ? `conic-gradient(${stops.join(', ')})` : 'var(--surface-raised)';
    },
  },
  watch: {
    monthKey() {
      this.stack = [];
    },
  },
  methods: {
    formatMoney,
    // Sums this category's own transactions plus every descendant's, since
    // only leaf categories ever receive direct transactions and a parent's
    // slice must represent its whole subtree. subtreeIds is the categories
    // store's getter (pure category-tree shape), kept there rather than
    // reimplemented here so any other consumer needing "this category plus
    // everything under it" doesn't have to re-derive the same walk.
    amountFor(category) {
      const ids = this.categoriesStore.subtreeIds(category.id);
      return this.transactionsStore.items
        .filter((t) => t.date.startsWith(this.monthKey) && ids.includes(t.categoryId))
        .reduce((sum, t) => sum + t.amount, 0);
    },
    drillInto(category) {
      if (this.categoriesStore.childrenOf(category.id).length > 0) {
        this.stack.push(category.id);
      }
    },
    back() {
      this.stack.pop();
    },
  },
};
</script>

<style lang="scss">
.category-pie {
  margin-bottom: 8px;

  // Rendered as a bare <p> with no rule of its own until now — it fell
  // back to the UA default ~1em top/bottom margin and regular body-text
  // weight/color, out of step with every other section label in this app.
  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
    margin: 0 0 10px;
  }

  &__back {
    // Explicit, not just inherited — the shared button reset doesn't zero
    // padding, and this project has already shipped one real bug (MonthChart)
    // from a button's UA-default padding silently eating into a percentage-
    // sized child. Nothing here is percentage-sized against this box today,
    // so it's not live, but it's free to close off.
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-strong);
    margin-bottom: 10px;
  }

  &__chart {
    width: 118px;
    height: 118px;
    border-radius: 50%;
    margin-bottom: 16px;
    box-shadow: inset 0 0 0 1px var(--border);
  }

  &__legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 6px;
    border-radius: 10px;
    width: 100%;
    text-align: left;

    &:disabled {
      cursor: default;
      pointer-events: none;
    }
  }

  &__swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  // The one sibling here with no rule of its own until now — fixed-size
  // like __swatch, not flexible like __name, matching the same
  // fixed/flexible split every other icon-then-label row in this app uses
  // (e.g. CategoryTree's tree-row__emoji).
  &__emoji {
    font-size: 14px;
    flex: 0 0 auto;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 14px;
  }

  &__pct {
    font-size: 12px;
    color: var(--ink-muted);
    width: 38px;
    text-align: right;
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 13px;
    color: var(--ink-secondary);
    width: 74px;
    text-align: right;
  }
}
</style>
