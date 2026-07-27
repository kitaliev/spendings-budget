import { defineStore } from 'pinia';
import * as transactionsDb from '../db/transactions.js';

export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    items: [],
  }),
  actions: {
    async load() {
      this.items = await transactionsDb.listTransactions();
    },
    async create({ amount, date, categoryId }) {
      const transaction = await transactionsDb.createTransaction({ amount, date, categoryId });
      this.items.push(transaction);
      return transaction;
    },
    async update(id, changes) {
      const updated = await transactionsDb.updateTransaction(id, changes);
      const index = this.items.findIndex((t) => t.id === id);
      if (index !== -1) this.items[index] = updated;
      return updated;
    },
    async remove(id) {
      await transactionsDb.deleteTransaction(id);
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});
