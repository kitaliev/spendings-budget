import { defineStore } from 'pinia';
import { useBudgetRatesStore } from './budgetRates.js';
import { useTransactionsStore } from './transactions.js';
import { calculateAvailable } from '../utils/budgetMath.js';
import { daysElapsedInMonth, todayKey } from '../utils/date.js';

export const useBudgetStore = defineStore('budget', {
  getters: {
    availableForMonth() {
      const rates = useBudgetRatesStore();
      const transactions = useTransactionsStore();
      return (monthKey, todayDateKey = todayKey()) => {
        const daysElapsed = daysElapsedInMonth(monthKey, todayDateKey);
        return calculateAvailable({
          monthKey,
          daysElapsed,
          rateSegments: rates.segments,
          transactions: transactions.items,
        });
      };
    },
    spendForMonth() {
      const transactions = useTransactionsStore();
      return (monthKey) =>
        transactions.items
          .filter((t) => t.date.startsWith(monthKey))
          .reduce((sum, t) => sum + t.amount, 0);
    },
  },
});
