<template>
  <div class="date-row">
    <button
      type="button"
      class="date-row__btn"
      :class="{ 'date-row__btn--active': mode === 'today' }"
      @click="$emit('update:modelValue', todayKeyValue())"
    >Сегодня</button>
    <button
      type="button"
      class="date-row__btn"
      :class="{ 'date-row__btn--active': mode === 'yesterday' }"
      @click="$emit('update:modelValue', yesterdayKeyValue())"
    >Вчера</button>
    <!-- Not a <button>: the real control here is the native <input type="date">
         below. The <label> wraps it purely to extend the tap target to the
         whole pill (matching the other two buttons) and to widen the accname
         via standard label-wrapping-input semantics — no aria-label needed,
         the sibling <span>'s text already becomes the input's accessible
         name, and opacity:0 doesn't remove it from the a11y tree. -->
    <label class="date-row__btn" :class="{ 'date-row__btn--active': mode === 'other' }">
      <input type="date" class="date-row__native" :value="modelValue" @change="onNativeChange" />
      <span>{{ otherLabel }}</span>
    </label>
  </div>
</template>

<script>
import { todayKey, yesterdayKey } from '../../utils/date.js';

export default {
  name: 'DatePicker',
  props: {
    modelValue: {
      type: String,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    mode() {
      if (this.modelValue === todayKey()) return 'today';
      if (this.modelValue === yesterdayKey()) return 'yesterday';
      return 'other';
    },
    otherLabel() {
      // Derived from modelValue, not tracked as separate mutable state — it
      // must render correctly the instant this component mounts with an
      // existing "other" date (e.g. Task 17 editing a past transaction), not
      // only after the native input's own change handler has fired once.
      if (this.mode !== 'other') return 'Другая дата';
      // Build the label from local-time parts, not `new Date(value)` — a bare
      // YYYY-MM-DD string parses as UTC midnight and can render one day off
      // for anyone west of UTC (same class of bug fixed in Task 5's toDateKey).
      const [y, m, d] = this.modelValue.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },
  },
  methods: {
    todayKeyValue: todayKey,
    yesterdayKeyValue: yesterdayKey,
    onNativeChange(event) {
      const value = event.target.value;
      if (!value) return;
      this.$emit('update:modelValue', value);
    },
  },
};
</script>

<style lang="scss">
.date-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;

  &__btn {
    position: relative;
    flex: 1;
    text-align: center;
    font-size: 12.5px;
    font-weight: 600;
    padding: 9px 4px;
    border-radius: 11px;
    background: var(--surface-sunken);
    color: var(--ink-secondary);
    border: 1px solid transparent;
    overflow: hidden;

    &--active {
      background: var(--accent-wash);
      color: var(--accent-strong);
      border-color: var(--accent);
    }

    // The third pill is a <label>, not a <button> — the global
    // button:focus-visible rule (_reset.scss) never matches it. Its real
    // control is the input below, whose own focus outline is invisible
    // (opacity: 0 suppresses it along with everything else), so without
    // this, Tab-cycling to the native date input shows no focus indicator
    // at all.
    &:focus-within {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  &__native {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
}
</style>
