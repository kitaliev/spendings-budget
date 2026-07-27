<template>
  <div v-if="visible" class="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
    <div class="expense-modal__backdrop"></div>
    <div class="expense-modal__sheet">
      <div class="expense-modal__handle-row">
        <div class="expense-modal__handle"></div>
        <button type="button" class="expense-modal__close" aria-label="Закрыть" @click="close">✕</button>
      </div>

      <div class="expense-modal__entry">
        <p id="expense-modal-title" class="expense-modal__entry-label">Сумма расхода</p>
        <div class="expense-modal__entry-value">{{ raw || '0' }}</div>
      </div>

      <DatePicker v-model="date" />

      <CategoryPicker ref="picker" @pick="commit" />

      <Keypad @key="onKey" />

      <button v-if="editingTransaction" type="button" class="expense-modal__delete" @click="onDelete">Удалить</button>
    </div>
  </div>
</template>

<script>
import Keypad from './Keypad.vue';
import DatePicker from './DatePicker.vue';
import CategoryPicker from './CategoryPicker.vue';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useToastStore } from '../../stores/toast.js';
import { evaluateExpression } from '../../utils/calculator.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey } from '../../utils/date.js';

export default {
  name: 'ExpenseModal',
  components: { Keypad, DatePicker, CategoryPicker },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    editingTransaction: {
      type: Object,
      default: null,
    },
  },
  emits: ['close'],
  data() {
    return {
      raw: '',
      date: todayKey(),
      // The category picker only resets/re-renders after the store write
      // below resolves, so the exact same leaf row a user just tapped is
      // still on screen — and still tappable — for the whole await gap.
      // This guards commit()/onDelete() against a fast double-tap creating
      // (or deleting) the same transaction twice.
      submitting: false,
    };
  },
  watch: {
    editingTransaction: {
      immediate: true,
      handler(transaction) {
        if (transaction) {
          this.raw = String(transaction.amount).replace('.', ',');
          this.date = transaction.date;
        } else {
          this.raw = '';
          this.date = todayKey();
        }
      },
    },
  },
  methods: {
    onKey(key) {
      // A write started by a previous commit/delete can still be in flight
      // (see commit()/onDelete()) with nothing else in the UI disabled
      // meanwhile — without this guard, typing a new amount during that gap
      // silently merges with whatever the stale commit resets `raw` to once
      // it resolves.
      if (this.submitting) return;
      if (key === 'del') {
        this.raw = this.raw.slice(0, -1);
      } else if (key === ',') {
        const lastNumber = this.raw.split(/[+\-−×÷]/).pop();
        if (!lastNumber.includes(',')) this.raw += ',';
      } else if (['+', '−', '×', '÷'].includes(key)) {
        if (!this.raw) return;
        // Tapping a second operator replaces the pending one (the "changed
        // my mind" convention — matches calculator.js's own normalize(),
        // which was built specifically to collapse consecutive operators
        // this way; dropping the new tap instead would leave that behavior
        // unreachable through the app's only real caller).
        this.raw = /[+\-−×÷]$/.test(this.raw) ? this.raw.slice(0, -1) + key : this.raw + key;
      } else {
        this.raw += key;
      }
    },
    async commit(category) {
      if (!this.raw || this.submitting) return;
      // Dividing to split a shared cost (e.g. "1000÷3") is ordinary use of a
      // calculator-style amount field — round to whole rubles here, the same
      // place the amount<=0 business rule below lives, rather than storing
      // and later re-displaying raw float noise.
      const amount = Math.round(evaluateExpression(this.raw));
      const toast = useToastStore();
      if (amount <= 0) {
        // Reachable through completely ordinary keypad input, not just a
        // leading operator — e.g. "5−10" is a ordinarily-typed subtraction
        // that evaluates to a negative result. An expense's amount must be
        // positive; reject before it ever reaches the store, rather than
        // storing a negative transaction that later formatting (amount ->
        // string -> re-parsed on edit) can't safely round-trip.
        toast.show('Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      // Snapshot which session (this specific edit target, or this specific
      // add session) the write below is for. App.vue keeps one persistent
      // ExpenseModal instance and only swaps its props, so by the time the
      // await resolves the user could have closed the sheet, or reopened it
      // for a different transaction entirely — applying this commit's
      // completion side effects (closing, resetting, touching the picker)
      // onto that unrelated later session would be wrong, and the picker
      // itself may no longer even be mounted (visible could now be false).
      const session = this.editingTransaction;
      try {
        const transactionsStore = useTransactionsStore();

        if (session) {
          await transactionsStore.update(session.id, {
            amount,
            date: this.date,
            categoryId: category.id,
          });
          toast.show(`Изменено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
          if (this.editingTransaction === session) this.close();
        } else {
          await transactionsStore.create({ amount, date: this.date, categoryId: category.id });
          toast.show(`Добавлено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
          if (this.editingTransaction === session) {
            this.raw = '';
            this.date = todayKey();
            this.$refs.picker?.reset();
          }
        }
      } finally {
        this.submitting = false;
      }
    },
    async onDelete() {
      if (this.submitting) return;
      this.submitting = true;
      const session = this.editingTransaction;
      try {
        const transactionsStore = useTransactionsStore();
        await transactionsStore.remove(session.id);
        if (this.editingTransaction === session) this.close();
      } finally {
        this.submitting = false;
      }
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>

<style lang="scss">
.expense-modal {
  position: absolute;
  inset: 0;
  z-index: 10;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
  }

  &__sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    background: var(--surface);
    border-radius: 26px 26px 0 0;
    display: flex;
    flex-direction: column;
    height: 88%;
    padding: 6px 18px 16px;
  }

  &__handle-row {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 10px 0 2px;
  }

  &__handle {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--border-strong);
  }

  &__close {
    position: absolute;
    right: 0;
    top: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--surface-raised);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--ink-secondary);
  }

  &__entry {
    text-align: center;
    padding: 10px 0 14px;
    flex: 0 0 auto;
  }

  &__entry-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 8px;
  }

  &__entry-value {
    font-family: var(--font-money);
    font-size: 40px;
    font-weight: 600;
    letter-spacing: -0.01em;
    min-height: 48px;
  }

  &__delete {
    margin-top: 10px;
    padding: 10px;
    text-align: center;
    color: var(--negative);
    font-weight: 600;
    font-size: 14px;
  }
}
</style>
