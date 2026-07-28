<template>
  <div class="debts-screen">
    <TopBar title="Долги">
      <template #right>
        <button
          type="button"
          class="debts-screen__add-toggle"
          aria-label="Добавить долг"
          :aria-expanded="addingOpen ? 'true' : 'false'"
          @click="addingOpen = !addingOpen"
        >
          {{ addingOpen ? '✕' : '+' }}
        </button>
      </template>
    </TopBar>

    <form v-if="addingOpen" class="debts-screen__add-form" @submit.prevent="submitAdd">
      <input v-model="newName" class="debts-screen__add-name" placeholder="Название" />
      <input v-model="newAmount" type="number" inputmode="decimal" min="1" step="1" class="debts-screen__add-amount" placeholder="Сумма" />
      <input v-model="newComment" class="debts-screen__add-comment" placeholder="Комментарий (необязательно)" />
      <button type="submit" class="debts-screen__add-submit">Добавить</button>
    </form>

    <div class="segmented">
      <button
        v-for="option in segments"
        :key="option.value"
        type="button"
        class="segmented__opt"
        :class="{ 'segmented__opt--active': option.value === direction }"
        :aria-current="option.value === direction ? 'true' : null"
        @click="direction = option.value"
      >{{ option.label }}</button>
    </div>

    <DebtCard v-for="debt in openDebts" :key="debt.id" :debt="debt" />

    <template v-if="closedDebts.length > 0">
      <button
        type="button"
        class="closed-toggle"
        :aria-expanded="closedOpen ? 'true' : 'false'"
        @click="closedOpen = !closedOpen"
      >
        <span aria-hidden="true">{{ closedOpen ? '⌄' : '›' }}</span> Закрытые ({{ closedDebts.length }})
      </button>
      <div v-if="closedOpen" class="closed-list">
        <div v-for="debt in closedDebts" :key="debt.id" class="closed-card">
          <span class="closed-card__name">{{ debt.name }}</span>
          <span>{{ formatMoney(debt.amount) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import DebtCard from './DebtCard.vue';
import { useDebtsStore } from '../../stores/debts.js';
import { useToastStore } from '../../stores/toast.js';
import { formatMoney, parsePositiveAmount } from '../../utils/currency.js';

export default {
  name: 'DebtsScreen',
  components: { TopBar, DebtCard },
  data() {
    return {
      direction: 'owed_to_me',
      closedOpen: false,
      addingOpen: false,
      newName: '',
      newAmount: '',
      newComment: '',
      // Neither the db layer nor the store validates or guards against
      // concurrent calls — same reasoning as DebtCard's submitPayment guard.
      submitting: false,
      segments: [
        { value: 'owed_to_me', label: 'Мне должны' },
        { value: 'i_owe', label: 'Я должен' },
      ],
    };
  },
  computed: {
    debtsStore() {
      return useDebtsStore();
    },
    openDebts() {
      return this.debtsStore.openByDirection(this.direction);
    },
    closedDebts() {
      return this.debtsStore.closedByDirection(this.direction);
    },
  },
  methods: {
    formatMoney,
    async submitAdd() {
      if (this.submitting) return;
      const name = this.newName.trim();
      const amount = parsePositiveAmount(this.newAmount);
      if (!name || !amount) {
        useToastStore().show(!name ? 'Введите название' : 'Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      try {
        await this.debtsStore.create({
          name,
          amount,
          comment: this.newComment.trim(),
          direction: this.direction,
        });
        this.newName = '';
        this.newAmount = '';
        this.newComment = '';
        this.addingOpen = false;
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.debts-screen {
  // Same gap as BudgetDashboard (commit 3e90b0c): every child here (TopBar,
  // segmented control, DebtCard, closed-toggle) only specifies its own
  // small internal padding, none of it enough alone to keep content off
  // the physical screen edges. Confirmed by rendering this composed with
  // real data at a real 390px viewport.
  padding: 0 18px;

  &__add-toggle {
    position: relative;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 16px;

    // Same emergent-height-style gap as BudgetDashboard's own settings
    // gear (34px, already fixed) — this one is smaller (30px) and needs
    // even more expansion. Symmetric on all sides: nothing else shares
    // this corner of TopBar for it to encroach on.
    //
    // inset is one pixel more than the 7px the 30->44 gap alone would need:
    // this element's own 1px border shrinks its padding box (the ::before's
    // actual containing block per the CSS abs-pos spec) by 1px on every
    // side, so an inset of -7px here only reaches 6px past the *visible*
    // border edge — measured 42px live, not 44px, until compensated.
    &::before {
      content: '';
      position: absolute;
      inset: -8px;
    }
  }

  &__add-form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__add-name {
    flex: 2;
    min-width: 120px;
  }

  &__add-amount {
    flex: 1;
    min-width: 80px;
    // Hide the native up/down stepper — DebtCard's own pay-input already
    // established this as an app-wide rule (every numeric-ish input is
    // either fully custom or visually hidden; a bare spinner would be the
    // one unstyled system control left in the UI).
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      appearance: none;
      margin: 0;
    }
  }

  &__add-comment {
    flex: 1 1 100%;
  }

  &__add-name,
  &__add-amount,
  &__add-comment {
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
  }

  &__add-submit {
    // Same emergent-height gap as .segmented__opt/.closed-toggle in this
    // same file (measured ~36px in a real browser with just 10px padding
    // and a 13.5px line) — caught during Task 28's whole-feature sanity
    // check, since it's the one button in this file that didn't get this
    // fix in its own original pass.
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 100%;
    padding: 10px;
    border-radius: 11px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 650;
    font-size: 13.5px;
  }
}

.segmented {
  display: flex;
  background: var(--surface-sunken);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 18px;

  &__opt {
    flex: 1;
    // min-height + flex-centering, not just padding — 8px vertical padding
    // plus a 13.5px line-height lands well under the 44px touch-target
    // minimum (the same emergent-height gap already found and fixed on
    // TabBar's items, BudgetDashboard's settings button, and DebtCard's
    // top row — MonthChart's own bug was a different shape, a button's UA
    // padding shrinking a percentage-width child, not a height shortfall).
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 4px;
    border-radius: 9px;
    color: var(--ink-secondary);

    &--active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  }
}

.closed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  // Same emergent-height gap as .segmented__opt above (measured at 34px in a
  // real browser with just the 10px/10px padding and a 12.5px text line) —
  // min-height clears the 44px touch-target minimum while align-items:
  // center (already needed for the chevron+label row) keeps the content
  // centered rather than pinned to the top.
  min-height: 44px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-muted);
  padding: 10px 4px;
  width: 100%;
}

.closed-card {
  display: flex;
  justify-content: space-between;
  padding: 10px 6px;
  font-size: 13px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);

  &__name {
    text-decoration: line-through;
    text-decoration-color: var(--border-strong);
  }
}
</style>
