<template>
  <div class="keypad">
    <button
      v-for="key in keys"
      :key="key.value"
      type="button"
      class="keypad__key"
      :class="{ 'keypad__key--op': key.type === 'op', 'keypad__key--del': key.type === 'del' }"
      :aria-label="key.ariaLabel || null"
      @click="$emit('key', key.value)"
    >{{ key.label }}</button>
  </div>
</template>

<script>
export default {
  name: 'Keypad',
  emits: ['key'],
  data() {
    return {
      keys: [
        { value: '7', label: '7' }, { value: '8', label: '8' }, { value: '9', label: '9' }, { value: '÷', label: '÷', type: 'op' },
        { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }, { value: '×', label: '×', type: 'op' },
        { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '−', label: '−', type: 'op' },
        { value: ',', label: ',' }, { value: '0', label: '0' }, { value: 'del', label: '⌫', type: 'del', ariaLabel: 'Стереть' }, { value: '+', label: '+', type: 'op' },
      ],
    };
  },
};
</script>

<style lang="scss">
.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 14px;

  &__key {
    height: 50px;
    border-radius: 13px;
    background: var(--surface-sunken);
    font-size: 19px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-money);

    &--op {
      background: transparent;
      color: var(--accent-strong);
      font-family: var(--font-ui);
    }

    &--del {
      color: var(--negative);
      font-family: var(--font-ui);
      font-size: 16px;
    }
  }
}
</style>
