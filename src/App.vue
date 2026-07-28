<template>
  <div id="app-shell" class="app-shell">
    <!-- showExpenseModal must count here too, not just showSettings — with
         TransactionList (rows behind this same content div) a keyboard/AT
         user could otherwise Tab into a background row while the modal is
         open and silently switch its editingTransaction, discarding
         whatever unsaved amount was typed, with zero warning. -->
    <div class="app-shell__content" :inert="showSettings || showExpenseModal">
      <template v-if="ready">
        <BudgetDashboard
          v-if="activeTab === 'budget'"
          @open-settings="showSettings = true"
          @edit-transaction="openEditModal"
        />
        <DebtsScreen v-else />
      </template>
      <p v-else class="app-shell__loading">Загрузка…</p>
    </div>

    <div class="app-shell__tabs" :inert="showSettings || showExpenseModal">
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
      // Every store read on screen (dashboard figures, category list, debts)
      // is empty until created()'s Promise.all below resolves — rendering
      // the real screens before then shows a misleadingly-confident "0 ₽"
      // and an empty, non-functional category picker in the always-on-launch
      // modal, worst on exactly the cold-IndexedDB case that matters most
      // for a first impression.
      ready: false,
      activeTab: 'budget',
      showSettings: false,
      showExpenseModal: false, // flips true once ready, see created() below
      editingTransaction: null,
    };
  },
  computed: {
    toastStore() {
      return useToastStore();
    },
  },
  async created() {
    try {
      await Promise.all([
        useCategoriesStore().load(),
        useBudgetRatesStore().load(),
        useTransactionsStore().load(),
        useDebtsStore().load(),
      ]);
      this.showExpenseModal = true; // greets the user on every launch, once there's real data to enter against
    } catch (err) {
      // Nothing else in this app has a retry affordance for a failed initial
      // load (quota exceeded, IndexedDB blocked in private mode, etc.) — a
      // toast at least tells the user why the screen came up empty, rather
      // than leaving them to guess. `ready` still flips in `finally` so the
      // app isn't stuck on the loading screen forever.
      useToastStore().show('Не удалось загрузить данные. Перезапустите приложение.');
    } finally {
      this.ready = true;
    }
  },
  methods: {
    openAddModal() {
      this.editingTransaction = null;
      this.showExpenseModal = true;
    },
    openEditModal(transaction) {
      this.editingTransaction = transaction;
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

  &__loading {
    padding: 40px 18px;
    text-align: center;
    color: var(--ink-muted);
    font-size: 14px;
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
