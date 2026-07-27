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
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import MonthNav from '../layout/MonthNav.vue';
import MonthChart from './MonthChart.vue';
import CategoryPie from './CategoryPie.vue';
import { useBudgetStore } from '../../stores/budget.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey, toMonthKey, monthNameWithYear } from '../../utils/date.js';

// MONTH_NAMES doesn't exist here on purpose — monthLabel below reuses
// monthNameWithYear() (utils/date.js), the same "Месяц ГГГГ" formatter
// MonthChart's aria-labels already use, instead of a second, independently
// maintained name array producing the same string a different way.
const MONTH_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_INITIALS = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  name: 'BudgetDashboard',
  components: { TopBar, MonthNav, MonthChart, CategoryPie },
  emits: ['open-settings'],
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
      return MONTH_GENITIVE[m - 1];
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
          short: MONTH_INITIALS[i],
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
  &__settings {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
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
