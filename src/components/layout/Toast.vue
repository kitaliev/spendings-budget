<template>
  <Transition name="toast">
    <div v-if="message" class="toast" role="status" aria-live="polite" aria-atomic="true">{{ message }}</div>
  </Transition>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    message: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss">
.toast {
  // Rendered inside .app-shell__tabs (see App.vue), a non-scrolling wrapper
  // shared with TabBar. bottom: 100% + margin-bottom sits it just above that
  // wrapper's top edge — i.e. just above TabBar's actual rendered height,
  // whatever that emergently turns out to be — without ever needing to know
  // that height as a number. A guessed pixel constant was tried first and
  // measurably wrong (real TabBar height ≠ the guess); anchoring to the
  // wrapper's own top edge is exact by construction instead of by estimate.
  position: absolute;
  left: 50%;
  bottom: 100%;
  margin-bottom: 12px;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--ground);
  font-size: 13px;
  font-weight: 600;
  padding: 11px 18px;
  border-radius: 12px;
  white-space: nowrap;
  z-index: 50;

  &-enter-active,
  &-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
}
</style>
