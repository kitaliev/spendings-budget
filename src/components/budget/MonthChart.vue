<template>
  <div class="month-chart">
    <div class="month-chart__bars">
      <button
        v-for="month in scaledMonths"
        :key="month.key"
        type="button"
        class="month-chart__col"
        :class="{
          'month-chart__col--active': month.active,
          'month-chart__col--negative': month.negative,
          'month-chart__col--empty': month.empty,
        }"
        :disabled="month.empty"
        :aria-label="month.label"
        @click="$emit('select', month.key)"
      >
        <span class="month-chart__bar-wrap">
          <span class="month-chart__bar" :style="{ '--h': month.heightPct }"></span>
        </span>
        <!-- The visible glyph is a single, deliberately ambiguous letter (see
             monthLabel below) — aria-hidden so assistive tech reads only the
             richer aria-label above, not this letter as well. -->
        <span class="month-chart__label" aria-hidden="true">{{ month.short }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'MonthChart',
  props: {
    months: {
      type: Array,
      required: true,
    },
  },
  emits: ['select'],
  computed: {
    scaledMonths() {
      const max = Math.max(1, ...this.months.map((m) => m.total));
      return this.months.map((m) => ({
        ...m,
        // A real past month can genuinely have total: 0 (tracked and spent
        // nothing) and still gets this 6% floor — same as it would for a
        // tiny nonzero spend that rounds down close to it. That's accepted
        // here, not a bug: per spec this chart is a coarse, unlabeled
        // height-only comparison (no value labels anywhere on it), so a bar
        // that reads as "short" rather than "gone" is the right precision
        // for "little to nothing was spent." Empty (future) months use a
        // shorter, dimmed floor instead (below), which is the distinction
        // that actually matters — "hasn't happened yet" staying visually
        // distinct from "happened, near-zero."
        heightPct: m.empty ? 4 : Math.max(6, Math.round((m.total / max) * 100)),
        label: this.monthLabel(m),
      }));
    },
  },
  methods: {
    // Builds a real accessible name from data already on the month (key,
    // total) instead of leaving the button's name as the bare visible letter
    // — see the aria-hidden note on the template's label span for why that
    // letter alone isn't enough for a screen-reader user.
    monthLabel(month) {
      const [year, monthNum] = month.key.split('-').map(Number);
      const rawName = new Date(year, monthNum - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
      const heading = `${rawName.charAt(0).toUpperCase()}${rawName.slice(1)} ${year}`;
      if (month.empty) return `${heading}, ещё не наступил`;
      const amount = formatMoney(month.total);
      return month.negative ? `${heading}, перерасход, ${amount}` : `${heading}, ${amount}`;
    },
  },
};
</script>

<style lang="scss">
.month-chart {
  margin-bottom: 28px;

  &__bars {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    align-items: end;
    height: 74px;
    gap: 3px;
    padding: 0 2px;
  }

  &__col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    gap: 6px;

    &--active .month-chart__bar {
      background: var(--accent);
    }

    &--negative .month-chart__bar {
      background: var(--negative);
    }

    &--empty .month-chart__bar {
      opacity: 0.35;
    }

    &--active .month-chart__label {
      color: var(--accent-strong);
      font-weight: 700;
    }
  }

  &__bar-wrap {
    flex: 1 1 auto;
    display: flex;
    align-items: flex-end;
    width: 100%;
    justify-content: center;
  }

  &__bar {
    width: 60%;
    max-width: 14px;
    border-radius: 3px 3px 0 0;
    background: var(--surface-raised);
    height: calc(var(--h, 0) * 1%);
    min-height: 3px;
  }

  &__label {
    font-size: 9px;
    color: var(--ink-muted);
  }
}
</style>
