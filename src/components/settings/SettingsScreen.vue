<template>
  <div class="settings-screen">
    <TopBar title="Настройки" />

    <div class="settings-group">
      <p class="settings-group__title">Бюджет</p>
      <div class="settings-list">
        <div class="settings-row">
          <span class="settings-row__label">Дневной бюджет</span>
          <form v-if="editingRate" class="settings-row__rate-form" @submit.prevent="saveRate">
            <input
              v-model="rateInput"
              type="number"
              inputmode="decimal"
              min="1"
              step="1"
              placeholder="Сумма"
              aria-label="Дневной бюджет"
              class="settings-row__rate-input"
            />
            <button type="submit" class="settings-row__rate-save">Сохранить</button>
          </form>
          <button v-else type="button" class="settings-row__value" @click="startEditingRate">
            {{ formatMoney(budgetRatesStore.currentRate) }} <ChevronRight aria-hidden="true" :size="15" />
          </button>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <p class="settings-group__title">Категории</p>
      <CategoryTree />
    </div>
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import CategoryTree from './CategoryTree.vue';
import { ChevronRight } from '@lucide/vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useToastStore } from '../../stores/toast.js';
import { formatMoney, parsePositiveAmount } from '../../utils/currency.js';

export default {
  name: 'SettingsScreen',
  components: { TopBar, CategoryTree, ChevronRight },
  data() {
    return {
      editingRate: false,
      rateInput: '',
      // Same reasoning as DebtCard/DebtsScreen's own submitting guards —
      // neither the db layer nor the store rejects a second concurrent
      // addRate() call, and a double-tap on Сохранить would otherwise
      // create two rate segments for the same date.
      submitting: false,
    };
  },
  computed: {
    budgetRatesStore() {
      return useBudgetRatesStore();
    },
  },
  methods: {
    formatMoney,
    startEditingRate() {
      this.rateInput = String(this.budgetRatesStore.currentRate);
      this.editingRate = true;
    },
    async saveRate() {
      if (this.submitting) return;
      const amount = parsePositiveAmount(this.rateInput);
      if (!amount) {
        useToastStore().show('Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      try {
        await this.budgetRatesStore.setRate(amount);
        this.editingRate = false;
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
// TopBar's own padding (6px 2px 14px) isn't enough alone to keep content off
// the physical screen edges — the same gap already found and fixed in
// BudgetDashboard and DebtsScreen's root, confirmed here too by rendering at
// a real 390px viewport (.settings-list sat flush against both edges).
.settings-screen {
  padding: 0 18px;
}

.settings-group {
  margin-bottom: 22px;

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
    margin: 0 0 10px;
  }
}

.settings-list {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;

  &__label {
    font-size: 14.5px;
  }

  &__value {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-family: var(--font-money);
    color: var(--ink-muted);
  }

  &__rate-form {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__rate-input {
    width: 90px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-family: var(--font-money);
    font-size: 14px;
    // Same rule as DebtCard's __pay-input and DebtsScreen's __add-amount —
    // every numeric-ish input in this app is either fully custom or visually
    // hidden; a bare spinner here would be the one unstyled system control
    // left in the UI.
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      appearance: none;
      margin: 0;
    }
  }

  &__rate-save {
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--accent-strong);
    font-weight: 600;
    font-size: 13px;
  }
}
</style>
