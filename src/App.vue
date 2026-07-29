<template>
  <div id="app-shell" class="app-shell">
    <!-- showExpenseModal/showRestorePrompt must count here too, not just
         showSettings — with TransactionList (rows behind this same content
         div) a keyboard/AT user could otherwise Tab into a background row
         while an overlay is open and silently switch its editingTransaction,
         discarding whatever unsaved amount was typed, with zero warning. -->
    <div class="app-shell__content" :inert="showSettings || showExpenseModal || showRestorePrompt">
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

    <div class="app-shell__tabs" :inert="showSettings || showExpenseModal || showRestorePrompt">
      <Toast :message="toastStore.message" />
      <TabBar :active-tab="activeTab" @update:active-tab="activeTab = $event" @add-expense="openAddModal" />
    </div>

    <template v-if="showSettings">
      <SettingsScreen class="app-shell__settings-overlay" />
      <button type="button" class="app-shell__settings-close" aria-label="Закрыть настройки" @click="closeSettings">
        <X :size="16" />
      </button>
    </template>

    <div v-if="showRestorePrompt" class="restore-prompt" role="dialog" aria-modal="true" aria-labelledby="restore-prompt-text">
      <div class="restore-prompt__backdrop"></div>
      <div class="restore-prompt__sheet">
        <p id="restore-prompt-text" class="restore-prompt__text">
          Похоже, локальных данных ещё нет. Восстановить последнюю резервную копию с сервера?
        </p>
        <button type="button" class="restore-prompt__confirm" :disabled="restoring" @click="confirmRestore">Восстановить</button>
        <button type="button" class="restore-prompt__dismiss" @click="dismissRestorePrompt">Не сейчас</button>
      </div>
    </div>

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
import { X } from '@lucide/vue';
import { useCategoriesStore } from './stores/categories.js';
import { useBudgetRatesStore } from './stores/budgetRates.js';
import { useTransactionsStore } from './stores/transactions.js';
import { useDebtsStore } from './stores/debts.js';
import { useBackupStore } from './stores/backup.js';
import { useToastStore } from './stores/toast.js';

export default {
  name: 'App',
  components: { BudgetDashboard, DebtsScreen, SettingsScreen, ExpenseModal, TabBar, Toast, X },
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
      showRestorePrompt: false,
      // Set only when confirmRestore() redirects to Settings because the
      // user wasn't logged in yet — remembers that closing Settings should
      // resume the restore (if login actually succeeded meanwhile) rather
      // than stranding the user with no way back to the prompt they
      // already dismissed to get there.
      resumeRestoreAfterLogin: false,
      // Double-tap guard on confirmRestore(), same class of protection as
      // SettingsScreen.saveRate()/backup.js's own login()/sync() — neither
      // the store nor the API layer rejects a second concurrent restore()
      // call on its own.
      restoring: false,
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
      // "Empty" is judged by transactions/debts, not categories — categories
      // always has at least the seeded default (see categoriesStore.load()),
      // so it's never a useful signal for "this looks like a fresh install".
      const isEmpty = useTransactionsStore().items.length === 0 && useDebtsStore().items.length === 0;
      if (isEmpty) {
        this.showRestorePrompt = true;
      } else {
        this.showExpenseModal = true; // greets the user on every launch, once there's real data to enter against
      }
    } catch (err) {
      // Nothing else in this app has a retry affordance for a failed initial
      // load (quota exceeded, IndexedDB blocked in private mode, etc.) — a
      // toast at least tells the user why the screen came up empty, rather
      // than leaving them to guess. `ready` still flips in `finally` so the
      // app isn't stuck on the loading screen forever.
      console.error('Store load failed:', err);
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
    async confirmRestore() {
      const backupStore = useBackupStore();
      const loggedIn = await backupStore.checkStatus().catch(() => false);
      if (!loggedIn) {
        // Decision #8: no second, separate login surface for this prompt —
        // send the user to the same login form Settings already has, and
        // remember to resume the restore once they close it (see
        // closeSettings() below) rather than stranding them with no way
        // back to what they just confirmed.
        this.showRestorePrompt = false;
        this.resumeRestoreAfterLogin = true;
        this.showSettings = true;
        return;
      }
      if (this.restoring) return;
      this.restoring = true;
      try {
        await backupStore.restore();
        this.showRestorePrompt = false;
        this.showExpenseModal = true;
      } catch {
        // Restore prompt stays open so the user can retry immediately — a
        // failed restore (network drop mid-request, etc.) shouldn't silently
        // strand them with no path forward, and there's nothing destructive
        // about leaving local IndexedDB exactly as empty as it already was.
        useToastStore().show('Не удалось восстановить резервную копию. Попробуйте ещё раз.');
      } finally {
        this.restoring = false;
      }
    },
    dismissRestorePrompt() {
      this.showRestorePrompt = false;
      this.showExpenseModal = true;
    },
    async closeSettings() {
      this.showSettings = false;
      if (this.resumeRestoreAfterLogin) {
        this.resumeRestoreAfterLogin = false;
        // Only actually restore if login genuinely succeeded while
        // Settings was open — if the user just closed it without logging
        // in, this falls through to opening the expense modal normally,
        // the same as declining the prompt outright, rather than nagging
        // them again.
        if (useBackupStore().loggedIn) {
          try {
            await useBackupStore().restore();
          } catch {
            // Nothing in this session can re-trigger the restore prompt (it's
            // a one-shot flag already consumed by created()) — land the user
            // on the normal app rather than a bare, empty dashboard with no
            // explanation, and tell them how to retry.
            useToastStore().show('Не удалось восстановить резервную копию. Перезапустите приложение, чтобы попробовать снова.');
          }
        }
        this.showExpenseModal = true;
      }
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

.restore-prompt {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
  }

  &__sheet {
    position: relative;
    width: 100%;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    padding: 22px 18px calc(18px + env(safe-area-inset-bottom));
  }

  &__text {
    font-size: 14.5px;
    color: var(--ink-secondary);
    margin-bottom: 16px;
  }

  &__confirm {
    width: 100%;
    min-height: 44px;
    border-radius: 12px;
    background: var(--accent-strong);
    color: var(--surface);
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 8px;
  }

  &__dismiss {
    width: 100%;
    min-height: 44px;
    color: var(--ink-muted);
    font-size: 14px;
  }
}
</style>
