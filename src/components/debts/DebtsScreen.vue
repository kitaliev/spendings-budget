<template>
  <div class="debts-screen">
    <TopBar title="Долги" />

    <div class="segmented">
      <button
        v-for="option in segments"
        :key="option.value"
        type="button"
        class="segmented__opt"
        :class="{ 'segmented__opt--active': option.value === direction }"
        :aria-current="option.value === direction ? 'true' : null"
        @click="direction = option.value"
      >{{ option.label }}</button>
    </div>

    <DebtCard v-for="debt in openDebts" :key="debt.id" :debt="debt" />

    <template v-if="closedDebts.length > 0">
      <button
        type="button"
        class="closed-toggle"
        :aria-expanded="closedOpen ? 'true' : 'false'"
        @click="closedOpen = !closedOpen"
      >
        <span aria-hidden="true">{{ closedOpen ? '⌄' : '›' }}</span> Закрытые ({{ closedDebts.length }})
      </button>
      <div v-if="closedOpen" class="closed-list">
        <div v-for="debt in closedDebts" :key="debt.id" class="closed-card">
          <span class="closed-card__name">{{ debt.name }}</span>
          <span>{{ formatMoney(debt.amount) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import DebtCard from './DebtCard.vue';
import { useDebtsStore } from '../../stores/debts.js';
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'DebtsScreen',
  components: { TopBar, DebtCard },
  data() {
    return {
      direction: 'owed_to_me',
      closedOpen: false,
      segments: [
        { value: 'owed_to_me', label: 'Мне должны' },
        { value: 'i_owe', label: 'Я должен' },
      ],
    };
  },
  computed: {
    debtsStore() {
      return useDebtsStore();
    },
    openDebts() {
      return this.debtsStore.openByDirection(this.direction);
    },
    closedDebts() {
      return this.debtsStore.closedByDirection(this.direction);
    },
  },
  methods: {
    formatMoney,
  },
};
</script>

<style lang="scss">
.debts-screen {
  // Same gap as BudgetDashboard (commit 3e90b0c): every child here (TopBar,
  // segmented control, DebtCard, closed-toggle) only specifies its own
  // small internal padding, none of it enough alone to keep content off
  // the physical screen edges. Confirmed by rendering this composed with
  // real data at a real 390px viewport.
  padding: 0 18px;
}

.segmented {
  display: flex;
  background: var(--surface-sunken);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 18px;

  &__opt {
    flex: 1;
    // min-height + flex-centering, not just padding — 8px vertical padding
    // plus a 13.5px line-height lands well under the 44px touch-target
    // minimum (the same emergent-height gap already found and fixed on
    // TabBar's items, BudgetDashboard's settings button, and DebtCard's
    // top row — MonthChart's own bug was a different shape, a button's UA
    // padding shrinking a percentage-width child, not a height shortfall).
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 4px;
    border-radius: 9px;
    color: var(--ink-secondary);

    &--active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  }
}

.closed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  // Same emergent-height gap as .segmented__opt above (measured at 34px in a
  // real browser with just the 10px/10px padding and a 12.5px text line) —
  // min-height clears the 44px touch-target minimum while align-items:
  // center (already needed for the chevron+label row) keeps the content
  // centered rather than pinned to the top.
  min-height: 44px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-muted);
  padding: 10px 4px;
  width: 100%;
}

.closed-card {
  display: flex;
  justify-content: space-between;
  padding: 10px 6px;
  font-size: 13px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);

  &__name {
    text-decoration: line-through;
    text-decoration-color: var(--border-strong);
  }
}
</style>
