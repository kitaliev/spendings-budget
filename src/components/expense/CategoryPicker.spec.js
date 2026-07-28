import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryPicker from './CategoryPicker.vue';
import { useCategoriesStore } from '../../stores/categories.js';

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useCategoriesStore();
  store.items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
});

describe('CategoryPicker at the root level', () => {
  it('lists root categories with a chevron only where children exist, no back row', () => {
    const wrapper = mount(CategoryPicker);
    const rows = wrapper.findAll('.category-picker__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.category-picker__name').text()).toBe('Еда');
    expect(rows[0].find('.category-picker__chevron').find('svg').exists()).toBe(true);
    expect(rows[1].find('.category-picker__chevron').find('svg').exists()).toBe(false);
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
  });

  it('emits pick immediately for a leaf category', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[1].trigger('click'); // Развлечения
    expect(wrapper.emitted('pick')[0][0]).toMatchObject({ id: 'fun' });
  });
});

describe('CategoryPicker drill-down', () => {
  it('shows subcategories plus a back row after tapping a parent', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click'); // Еда
    const rows = wrapper.findAll('.category-picker__row');
    expect(rows[0].classes()).toContain('category-picker__row--back');
    expect(rows[1].find('.category-picker__name').text()).toBe('Продукты');
  });

  it('does not emit pick when drilling into a parent category', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click');
    expect(wrapper.emitted('pick')).toBeUndefined();
  });

  it('returns to the root level when Назад is clicked', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click');
    await wrapper.find('.category-picker__row--back').trigger('click');
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
    const names = wrapper.findAll('.category-picker__row').map((r) => r.find('.category-picker__name').text());
    expect(names).toEqual(['Еда', 'Развлечения']);
  });
});

describe('CategoryPicker.reset (exposed for the parent to call after commit)', () => {
  it('collapses back to the root level', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click'); // drill into Еда
    wrapper.vm.reset();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
  });
});
