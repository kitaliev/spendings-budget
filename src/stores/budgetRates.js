import { defineStore } from 'pinia';
import * as ratesDb from '../db/budgetRates.js';
import { todayKey } from '../utils/date.js';

export const useBudgetRatesStore = defineStore('budgetRates', {
  state: () => ({
    segments: [],
  }),
  getters: {
    currentRate(state) {
      if (state.segments.length === 0) return 0;
      const sorted = [...state.segments].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
      return sorted[sorted.length - 1].amount;
    },
  },
  actions: {
    async load() {
      await ratesDb.seedDefaultRateIfEmpty();
      this.segments = await ratesDb.listRates();
    },
    async setRate(amount) {
      await ratesDb.addRate({ amount, effectiveFrom: todayKey() });
      this.segments = await ratesDb.listRates();
    },
  },
});
