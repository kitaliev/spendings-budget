import { defineStore } from 'pinia';
import * as debtsDb from '../db/debts.js';

export const useDebtsStore = defineStore('debts', {
  state: () => ({
    items: [],
    payments: [],
  }),
  getters: {
    paymentsFor: (state) => (debtId) => state.payments.filter((p) => p.debtId === debtId),
    remainingOf() {
      return (debtId) => {
        const debt = this.items.find((d) => d.id === debtId);
        if (!debt) return 0;
        const paid = this.paymentsFor(debtId).reduce((sum, p) => sum + p.amount, 0);
        return debt.amount - paid;
      };
    },
    byDirection() {
      return (direction) => this.items.filter((d) => d.direction === direction);
    },
    openByDirection() {
      return (direction) => this.byDirection(direction).filter((d) => this.remainingOf(d.id) > 0);
    },
    closedByDirection() {
      return (direction) => this.byDirection(direction).filter((d) => this.remainingOf(d.id) <= 0);
    },
  },
  actions: {
    async load() {
      this.items = await debtsDb.listDebts();
      this.payments = await debtsDb.listAllPayments();
    },
    async create({ name, amount, comment, direction }) {
      const debt = await debtsDb.createDebt({ name, amount, comment, direction });
      this.items.push(debt);
      return debt;
    },
    async pay(debtId, amount, date) {
      const payment = await debtsDb.addPayment({ debtId, amount, date });
      this.payments.push(payment);
      return payment;
    },
    async remove(id) {
      await debtsDb.deleteDebt(id);
      this.items = this.items.filter((d) => d.id !== id);
      this.payments = this.payments.filter((p) => p.debtId !== id);
    },
  },
});
