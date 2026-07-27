import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryPie from './CategoryPie.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

function seed() {
  useCategoriesStore().items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'cafe', name: 'Кафе', emoji: '☕', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
  useTransactionsStore().items = [
    { date: '2026-07-05', amount: 3000, categoryId: 'groceries' },
    { date: '2026-07-06', amount: 1000, categoryId: 'cafe' },
    { date: '2026-07-07', amount: 2000, categoryId: 'fun' },
    { date: '2026-06-01', amount: 9999, categoryId: 'fun' },
  ];
}

describe('CategoryPie at the root level', () => {
  it('aggregates a parent category total from its subcategories', () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    expect(foodRow.find('.category-pie__amount').text()).toBe('4 000 ₽');
  });

  it('excludes transactions from other months', () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const funRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Развлечения'));
    expect(funRow.find('.category-pie__amount').text()).toBe('2 000 ₽');
  });
});

describe('CategoryPie drill-down', () => {
  it('drills into subcategories when a category with children is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(true);
    const names = wrapper.findAll('.category-pie__name').map((n) => n.text());
    expect(names).toEqual(['Продукты', 'Кафе']);
  });

  it('does nothing when a leaf category is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const funRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Развлечения'));
    await funRow.trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });

  it('returns to the parent level when Назад is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    await wrapper.find('.category-pie__back').trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });
});

describe('CategoryPie month changes', () => {
  it('resets the drill-down when monthKey changes', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    await wrapper.setProps({ monthKey: '2026-06' });
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });
});
