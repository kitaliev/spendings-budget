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

  // No rule needed for layout today — as direct children of a flex
  // container these get auto-"blockified" into flex items regardless of
  // display, the same reason .top-bar__title above works with none. Given
  // explicitly anyway (rather than left with no rule at all) since that
  // "harmless today" state is exactly what let three other components'
  // orphaned classes go unnoticed this session until they broke something.
  &__left,
  &__right {
    display: flex;
    align-items: center;
  }

  &__title {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
}
</style>
