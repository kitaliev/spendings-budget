import { defineStore } from 'pinia';

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
