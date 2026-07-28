<template>
  <div class="budget-dashboard">
    <TopBar>
      <template #left>
        <MonthNav :label="monthLabel" :can-go-next="canGoNext" @prev="prevMonth" @next="nextMonth" />
      </template>
      <template #right>
        <button type="button" class="budget-dashboard__settings" aria-label="Настройки" @click="$emit('open-settings')">⚙️</button>
      </template>
    </TopBar>

    <div class="budget-dashboard__hero">
      <p class="budget-dashboard__hero-label">{{ heroLabel }}</p>
      <div
        class="budget-dashboard__hero-value"
        :class="{ 'budget-dashboard__hero-value--negative': available < 0 }"
      >{{ formatMoney(available) }}</div>
    </div>

    <div class="budget-dashboard__stat">
      <span>Расход за {{ monthGenitive }}</span>
      <span>{{ formatMoney(spend) }}</span>
    </div>

    <MonthChart :months="chartMonths" @select="goToMonth" />

    <CategoryPie :month-key="currentMonthKey" />

    <TransactionList :month-key="currentMonthKey" @edit="$emit('edit-transaction', $event)" />
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import MonthNav from '../layout/MonthNav.vue';
import MonthChart from './MonthChart.vue';
import CategoryPie from './CategoryPie.vue';
import TransactionList from './TransactionList.vue';
import { useBudgetStore } from '../../stores/budget.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey, toMonthKey, monthNameWithYear } from '../../utils/date.js';

// No MONTH_NAMES, MONTH_GENITIVE, or MONTH_INITIALS array here — every
// Russian month string this component needs is derived from Intl at the
// point of use (below), the same reasoning monthNameWithYear() already
// applies: a hardcoded string list is a second source of truth that can
// drift from what Intl actually produces, for zero benefit over deriving
// it directly.
function genitiveMonthName(monthNum) {
  const withDay = new Date(2000, monthNum - 1, 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return withDay.replace(/^\d+ /, '');
}

function monthInitial(monthNum) {
  return new Date(2000, monthNum - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }).charAt(0).toUpperCase();
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  name: 'BudgetDashboard',
  components: { TopBar, MonthNav, MonthChart, CategoryPie, TransactionList },
  // No store .load() call anywhere in this file, on purpose: screen-level
  // components only read reactive state that App.vue already loaded once at
  // startup. Keeps loading in one place and lets this component's own tests
  // seed store state directly with no load() racing in to overwrite it.
  // Apply the same rule to any other screen-level component.
  emits: ['open-settings', 'edit-transaction'],
  data() {
    return {
      currentMonthKey: toMonthKey(todayKey()),
    };
  },
  computed: {
    budgetStore() {
      return useBudgetStore();
    },
    isCurrentMonth() {
      return this.currentMonthKey === toMonthKey(todayKey());
    },
    canGoNext() {
      return !this.isCurrentMonth;
    },
    monthLabel() {
      return monthNameWithYear(this.currentMonthKey);
    },
    monthGenitive() {
      const m = Number(this.currentMonthKey.slice(5, 7));
      return genitiveMonthName(m);
    },
    heroLabel() {
      return this.isCurrentMonth ? 'Бюджет на сегодня' : 'Остаток на конец месяца';
    },
    available() {
      return this.budgetStore.availableForMonth(this.currentMonthKey);
    },
    spend() {
      return this.budgetStore.spendForMonth(this.currentMonthKey);
    },
    chartMonths() {
      const year = this.currentMonthKey.slice(0, 4);
      const realCurrentMonth = toMonthKey(todayKey());
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const empty = key > realCurrentMonth;
        return {
          key,
          short: monthInitial(i + 1),
          total: empty ? 0 : this.budgetStore.spendForMonth(key),
          empty,
          active: key === this.currentMonthKey,
          negative: !empty && this.budgetStore.availableForMonth(key) < 0,
        };
      });
    },
  },
  methods: {
    formatMoney,
    // No lower bound on purpose. Before any rate segment's effectiveFrom,
    // availableForMonth/spendForMonth already resolve to a flat 0 rather
    // than crashing (see rateActiveOn's "no fallback" comment in
    // utils/budgetMath.js) — an arbitrarily old month just renders a plain
    // "0 ₽" screen. Each tap moves exactly one month with no repeat or
    // acceleration, so reaching a meaningless year takes thousands of taps;
    // not worth a floor against a state that's both harmless and
    // impractical to reach by accident. (nextMonth's bound is different: it
    // stops a real, one-tap-away, user-visible case — showing a future
    // month that hasn't happened yet.)
    prevMonth() {
      this.currentMonthKey = shiftMonth(this.currentMonthKey, -1);
    },
    nextMonth() {
      if (this.canGoNext) this.currentMonthKey = shiftMonth(this.currentMonthKey, 1);
    },
    // key always comes from this month's own MonthChart, whose 12 columns
    // are built from currentMonthKey's year (see chartMonths above) — this
    // composition never hands back a key outside that year, so there is
    // nothing here to validate against.
    goToMonth(key) {
      this.currentMonthKey = key;
    },
  },
};
</script>

<style lang="scss">
.budget-dashboard {
  // The screen's own outer margin — every child here (TopBar, hero, stat
  // card, MonthChart, CategoryPie) only ever specifies its own SMALL
  // internal padding (2-16px), none of it enough on its own to keep content
  // off the physical screen edges. Confirmed by rendering this composed
  // with real data at a real 390px viewport: without this, the hero figure,
  // month labels, and section titles all sit flush against both edges.
  padding: 0 18px;

  &__settings {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;

    // Visual circle stays 34px per design, but the tappable area is widened
    // to the 44px accessible touch-target minimum via an invisible hit area,
    // same pattern as MonthNav's arrows. Symmetric on all sides (unlike
    // MonthNav's) since nothing else shares this corner of TopBar for it to
    // encroach on.
    //
    // inset is one pixel more than the 5px the 34->44 gap alone would need:
    // this element's own 1px border shrinks its padding box (the ::before's
    // actual containing block per the CSS abs-pos spec) by 1px on every
    // side, so an inset of -5px here only reaches 4px past the *visible*
    // border edge — measured 42px live, not 44px, until compensated.
    &::before {
      content: '';
      position: absolute;
      inset: -6px;
    }
  }

  &__hero {
    padding: 4px 2px 18px;
  }

  &__hero-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin: 0 0 6px;
  }

  &__hero-value {
    font-family: var(--font-money);
    font-size: 42px;
    font-weight: 600;
    letter-spacing: -0.01em;

    &--negative {
      color: var(--negative);
    }
  }

  &__stat {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-bottom: 22px;
    font-size: 14px;
    color: var(--ink-secondary);
  }
}
</style>
