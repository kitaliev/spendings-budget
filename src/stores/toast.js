import { defineStore } from 'pinia';

// Module-level (not state): a setTimeout handle isn't serializable app state
// and never needs to be reactive — it only exists to let a new show() cancel
// a still-pending hide from a previous toast.
let hideTimer = null;

export const useToastStore = defineStore('toast', {
  state: () => ({
    message: '',
  }),
  actions: {
    show(message, duration = 2200) {
      this.message = message;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        this.message = '';
      }, duration);
    },
  },
});
