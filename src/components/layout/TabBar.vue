<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-bar__item"
      :class="{ 'tab-bar__item--active': tab.id === activeTab }"
      @click="$emit('update:active-tab', tab.id)"
    >
      <span class="tab-bar__icon">{{ tab.icon }}</span>{{ tab.label }}
    </button>
    <button class="tab-bar__fab" aria-label="Добавить расход" @click="$emit('add-expense')">+</button>
  </nav>
</template>

<script>
export default {
  name: 'TabBar',
  props: {
    activeTab: {
      type: String,
      required: true,
    },
  },
  emits: ['update:active-tab', 'add-expense'],
  data() {
    return {
      tabs: [
        { id: 'budget', label: 'Бюджет', icon: '💰' },
        { id: 'debts', label: 'Долги', icon: '🤝' },
      ],
    };
  },
};
</script>

<style lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 8px 18px calc(env(safe-area-inset-bottom, 0px) + 8px);
  position: relative;

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 0;
    color: var(--ink-muted);
    font-size: 10px;
    font-weight: 600;

    &--active {
      color: var(--accent-strong);
    }
  }

  &__icon {
    font-size: 19px;
    display: block;
  }

  &__fab {
    position: absolute;
    right: 16px;
    top: -24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 22px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
