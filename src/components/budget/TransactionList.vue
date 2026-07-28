<template>
  <div class="transaction-list">
    <p class="transaction-list__title">Транзакции за месяц</p>
    <p v-if="rows.length === 0" class="transaction-list__empty">Пока нет расходов в этом месяце</p>
    <button
      v-for="row in rows"
      :key="row.transaction.id"
      type="button"
      class="transaction-list__row"
      @click="$emit('edit', row.transaction)"
    >
      <span class="transaction-list__date">{{ row.transaction.date.slice(8, 10) }}</span>
      <span class="transaction-list__emoji">{{ row.category ? row.category.emoji : '❓' }}</span>
      <span class="transaction-list__name">{{ row.category ? row.category.name : 'Без категории' }}</span>
      <span class="transaction-list__amount">{{ formatMoney(row.transaction.amount) }}</span>
    </button>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'TransactionList',
  props: {
    monthKey: {
      type: String,
      required: true,
    },
  },
  emits: ['edit'],
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    rows() {
      const transactionsStore = useTransactionsStore();
      return transactionsStore.items
        .filter((t) => t.date.startsWith(this.monthKey))
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((transaction) => ({
          transaction,
          category: this.categoriesStore.byId(transaction.categoryId),
        }));
    },
  },
  methods: {
    formatMoney,
  },
};
</script>

<style lang="scss">
.transaction-list {
  padding-bottom: 12px;

  // Own scoped rule, not a shared/global class — .section-title doesn't
  // exist anywhere in this codebase and was already found and fixed twice
  // this session for exactly this reason (CategoryPie, SettingsScreen).
  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
    margin: 0 0 10px;
  }

  &__empty {
    font-size: 13px;
    color: var(--ink-muted);
    padding: 8px 4px;
  }

  &__row {
    // min-height, not just the 9px vertical padding — the same emergent-
    // height gap already found and fixed on every other row/button this
    // session (DebtCard's top row, CategoryTree's tree-row, etc.).
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 4px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  &__date {
    font-family: var(--font-money);
    font-size: 12px;
    color: var(--ink-muted);
    width: 20px;
  }

  &__emoji {
    font-size: 15px;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 14px;
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 13px;
    color: var(--ink-secondary);
  }
}
</style>
