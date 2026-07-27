<template>
  <div class="top-bar">
    <div class="top-bar__left">
      <slot name="left">
        <span class="top-bar__title">{{ title }}</span>
      </slot>
    </div>
    <div class="top-bar__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'TopBar',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss">
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 14px;

  &__title {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
}
</style>
