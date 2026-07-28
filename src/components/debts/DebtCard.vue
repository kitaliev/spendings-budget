<template>
  <div class="debt-card">
    <button type="button" class="debt-card__top" @click="open = !open">
      <span class="debt-card__title">
        <span class="debt-card__name">{{ debt.name }}</span>
        <span v-if="debt.comment" class="debt-card__comment">{{ debt.comment }}</span>
      </span>
      <span class="debt-card__amount">{{ formatMoney(remaining) }}</span>
    </button>

    <!-- Purely decorative reinforcement of the percentage/total already
         spelled out as text right below — same treatment as CategoryPie's
         chart circle. -->
    <div class="debt-card__meter" aria-hidden="true">
      <div class="debt-card__meter-fill" :style="{ width: paidPct + '%' }"></div>
    </div>
    <div class="debt-card__meta">
      <span>Выплачено {{ paidPct }}%</span>
      <span>Всего {{ formatMoney(debt.amount) }}</span>
    </div>

    <div v-if="open" class="debt-card__detail">
      <div v-if="payments.length === 0" class="debt-card__hist-row">
        <span>Платежей ещё нет</span>
      </div>
      <div v-for="payment in payments" :key="payment.id" class="debt-card__hist-row">
        <span>{{ shortDate(payment.date) }}</span>
        <span>{{ formatMoney(payment.amount) }}</span>
      </div>
      <form class="debt-card__pay-form" @submit.prevent="submitPayment">
        <input v-model="payAmount" type="number" inputmode="decimal" min="1" step="1" placeholder="Сумма" class="debt-card__pay-input" />
        <button type="submit" class="debt-card__pay-btn">Оплатить</button>
      </form>
    </div>
  </div>
</template>

<script>
import { useDebtsStore } from '../../stores/debts.js';
import { useToastStore } from '../../stores/toast.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey, shortDate } from '../../utils/date.js';

export default {
  name: 'DebtCard',
  props: {
    debt: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      open: false,
      payAmount: '',
      // Neither the db layer (db/debts.js's addPayment) nor the store (pay())
      // validates the amount at all — this component is the only place that
      // can. Also guards against a fast double-submit creating the same
      // payment twice during the await gap, same shape as ExpenseModal's
      // commit() guard.
      submitting: false,
    };
  },
  computed: {
    debtsStore() {
      return useDebtsStore();
    },
    remaining() {
      return this.debtsStore.remainingOf(this.debt.id);
    },
    payments() {
      return this.debtsStore.paymentsFor(this.debt.id);
    },
    paidPct() {
      if (this.debt.amount === 0) return 0;
      // Clamped at 100 — overpaying a debt (remaining goes negative) is
      // possible and already handled correctly by the headline figure
      // itself, but "Выплачено 120%" reads as a bug rather than a real
      // state, and the meter bar has no reason to run past its own track.
      return Math.min(100, Math.round(((this.debt.amount - this.remaining) / this.debt.amount) * 100));
    },
  },
  methods: {
    formatMoney,
    shortDate,
    async submitPayment() {
      if (this.submitting) return;
      // A native number input still allows a leading "-" regardless of
      // inputmode/min/step (those are soft UI hints, not enforcement —
      // @submit.prevent also skips native constraint-validation blocking).
      // !(amount > 0) rejects NaN (empty/invalid text), zero, and negative
      // values uniformly — a plain `amount <= 0` check would let NaN
      // through, since every comparison against NaN is false.
      const amount = Math.round(parseFloat(this.payAmount));
      if (!(amount > 0)) {
        useToastStore().show('Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      try {
        await this.debtsStore.pay(this.debt.id, amount, todayKey());
        this.payAmount = '';
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.debt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 15px;
  margin-bottom: 12px;

  &__top {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    gap: 10px;

    // This row's own height is emergent (one line with no comment measures
    // ~24px, well under the 44px accessible touch-target minimum — verified
    // in a real browser) — widened via an invisible hit area rather than
    // forcing extra visual height that would look like empty padding on a
    // short card. -10px vertically is enough to clear 44px even for the
    // shortest (no-comment) case; horizontal expansion isn't needed since
    // the button already spans the card's full width.
    &::before {
      content: '';
      position: absolute;
      top: -10px;
      bottom: -10px;
      left: 0;
      right: 0;
    }
  }

  &__name {
    display: block;
    font-size: 15px;
    font-weight: 650;
    margin-bottom: 3px;
  }

  &__comment {
    display: block;
    font-size: 12.5px;
    color: var(--ink-muted);
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 17px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__meter {
    height: 5px;
    border-radius: 3px;
    background: var(--accent-wash);
    margin: 12px 0 6px;
    overflow: hidden;
  }

  &__meter-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--ink-muted);
  }

  &__detail {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  &__hist-row {
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    padding: 5px 0;
    color: var(--ink-secondary);
    font-family: var(--font-money);
  }

  &__pay-form {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  &__pay-input {
    flex: 1;
    background: var(--surface-sunken);
    border-radius: 10px;
    padding: 10px;
    font-family: var(--font-money);
    font-size: 14px;
    // Hide the native up/down stepper — every other numeric-ish input in
    // this app is either fully custom (Keypad) or visually hidden
    // (DatePicker's native date input), so a bare spinner here would be the
    // one unstyled system control left in the whole UI.
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      appearance: none;
      margin: 0;
    }
  }

  &__pay-btn {
    padding: 10px 16px;
    border-radius: 11px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 13.5px;
    font-weight: 650;
  }
}
</style>
