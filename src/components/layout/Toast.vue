<template>
  <Transition name="toast">
    <div v-if="message" class="toast">{{ message }}</div>
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
  position: absolute;
  left: 50%;
  bottom: 28px;
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
