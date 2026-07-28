import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToastStore } from './toast.js';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToastStore.show', () => {
  it('sets the message immediately', () => {
    const store = useToastStore();
    store.show('Добавлено: 🍔 Еда · 1 240 ₽');
    expect(store.message).toBe('Добавлено: 🍔 Еда · 1 240 ₽');
  });

  it('clears the message after the default duration', () => {
    const store = useToastStore();
    store.show('Тест');
    vi.advanceTimersByTime(2200);
    expect(store.message).toBe('');
  });

  it('restarts the timer if a new toast arrives before the old one clears', () => {
    const store = useToastStore();
    store.show('Первое');
    vi.advanceTimersByTime(1000);
    store.show('Второе');
    vi.advanceTimersByTime(1500);
    expect(store.message).toBe('Второе');
    vi.advanceTimersByTime(1000);
    expect(store.message).toBe('');
  });
});
