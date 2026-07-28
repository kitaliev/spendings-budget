<template>
  <div id="app-shell" class="app-shell">
    <div class="app-shell__content">
      <BudgetDashboard v-if="activeTab === 'budget'" @open-settings="showSettings = true" />
      <DebtsScreen v-else />
    </div>

    <div class="app-shell__tabs">
      <Toast :message="toastStore.message" />
      <TabBar :active-tab="activeTab" @update:active-tab="activeTab = $event" @add-expense="openAddModal" />
    </div>

    <template v-if="showSettings">
      <SettingsScreen class="app-shell__settings-overlay" />
      <button type="button" class="app-shell__settings-close" aria-label="Закрыть настройки" @click="showSettings = false">✕</button>
    </template>

    <ExpenseModal
      :visible="showExpenseModal"
      :editing-transaction="editingTransaction"
      @close="closeExpenseModal"
    />
  </div>
</template>

<script>
import BudgetDashboard from './components/budget/BudgetDashboard.vue';
import DebtsScreen from './components/debts/DebtsScreen.vue';
import SettingsScreen from './components/settings/SettingsScreen.vue';
import ExpenseModal from './components/expense/ExpenseModal.vue';
import TabBar from './components/layout/TabBar.vue';
import Toast from './components/layout/Toast.vue';
import { useCategoriesStore } from './stores/categories.js';
import { useBudgetRatesStore } from './stores/budgetRates.js';
import { useTransactionsStore } from './stores/transactions.js';
import { useDebtsStore } from './stores/debts.js';
import { useToastStore } from './stores/toast.js';

export default {
  name: 'App',
  components: { BudgetDashboard, DebtsScreen, SettingsScreen, ExpenseModal, TabBar, Toast },
  data() {
    return {
      activeTab: 'budget',
      showSettings: false,
      showExpenseModal: true, // greets the user on every launch
      editingTransaction: null,
    };
  },
  computed: {
    toastStore() {
      return useToastStore();
    },
  },
  async created() {
    await Promise.all([
      useCategoriesStore().load(),
      useBudgetRatesStore().load(),
      useTransactionsStore().load(),
      useDebtsStore().load(),
    ]);
  },
  methods: {
    openAddModal() {
      this.editingTransaction = null;
      this.showExpenseModal = true;
    },
    closeExpenseModal() {
      this.showExpenseModal = false;
      this.editingTransaction = null;
    },
  },
};
</script>

<style lang="scss">
.app-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  // The two flex children below split "scrolls" from "doesn't scroll". Toast
  // must live in the latter: position: absolute inside an overflow-y: auto
  // ancestor scrolls away with that ancestor's content (verified in a real
  // browser — it does NOT behave like position: fixed), which is wrong for a
  // transient notification that should stay visible regardless of dashboard
  // scroll position.
  &__content {
    flex: 1;
    position: relative;
    overflow-y: auto;
    min-height: 0; // lets this child actually shrink/scroll instead of stretching .app-shell
  }

  &__tabs {
    position: relative; // containing block for Toast's `bottom: 100%`
    flex-shrink: 0;
  }

  &__settings-overlay {
    position: absolute;
    inset: 0;
    background: var(--ground);
    z-index: 20;
    overflow-y: auto;

    // SettingsScreen's own root already carries its own `.settings-screen`
    // class (Vue merges this passed-in class onto that same root element),
    // which sets `padding: 0 18px`. A plain `&__settings-overlay { padding:
    // ... }` here would tie with it on specificity (0,1,0 vs 0,1,0) and the
    // winner would depend on which component's compiled <style> block Vite
    // happens to place later in the bundle — not something to leave to
    // chance. Chaining `&.settings-screen` makes a compound selector
    // (0,2,0) that deterministically wins over either single-class rule
    // regardless of source order.
    &.settings-screen {
      padding: 44px 18px 18px;
    }
  }

  &__settings-close {
    position: absolute;
    top: 44px;
    right: 18px;
    z-index: 21;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface-raised);

    // Same emergent-height gap as every other small circular icon button
    // this session (DebtsScreen's 30px add-toggle, CategoryTree's 26px
    // more-button) — hit-slop rather than min-height, since this one
    // shouldn't visually grow past its drawn circle. position: absolute
    // (already needed for the button's own placement) already establishes
    // the containing block this ::before positions against.
    &::before {
      content: '';
      position: absolute;
      inset: -7px;
    }
  }
}
</style>
