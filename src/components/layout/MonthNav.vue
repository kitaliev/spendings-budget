<template>
  <div class="month-nav">
    <button
      type="button"
      class="month-nav__arrow month-nav__arrow--prev"
      :disabled="!canGoPrev"
      aria-label="Предыдущий месяц"
      @click="$emit('prev')"
    >‹</button>
    <span class="month-nav__label">{{ label }}</span>
    <button
      type="button"
      class="month-nav__arrow month-nav__arrow--next"
      :disabled="!canGoNext"
      aria-label="Следующий месяц"
      @click="$emit('next')"
    >›</button>
  </div>
</template>

<script>
export default {
  name: 'MonthNav',
  props: {
    label: {
      type: String,
      required: true,
    },
    canGoPrev: {
      type: Boolean,
      default: true,
    },
    canGoNext: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['prev', 'next'],
};
</script>

<style lang="scss">
.month-nav {
  display: flex;
  align-items: center;
  gap: 2px;

  &__arrow {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--ink-muted);

    // Visual circle stays 28px per design, but the tappable area is widened
    // to the 44px accessible touch-target minimum via an invisible hit area
    // on a pseudo-element, rather than growing the circle itself.
    &::before {
      content: '';
      position: absolute;
      top: -8px;
      right: -8px;
      bottom: -8px;
      left: -8px;
    }

    &:disabled {
      opacity: 0.25;
      pointer-events: none;
    }
  }

  &__label {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
    min-width: 126px;
    text-align: center;
  }
}
</style>
