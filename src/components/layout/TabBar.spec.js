import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TabBar from './TabBar.vue';

describe('TabBar', () => {
  it('renders exactly two tabs: Бюджет and Долги', () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    const labels = wrapper.findAll('.tab-bar__item').map((el) => el.text());
    expect(labels).toEqual(['💰Бюджет', '🤝Долги']);
  });

  it('marks the active tab', () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'debts' } });
    const items = wrapper.findAll('.tab-bar__item');
    expect(items[1].classes()).toContain('tab-bar__item--active');
    expect(items[0].classes()).not.toContain('tab-bar__item--active');
  });

  it('emits update:active-tab with the tab id when clicked', async () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    await wrapper.findAll('.tab-bar__item')[1].trigger('click');
    expect(wrapper.emitted('update:active-tab')[0]).toEqual(['debts']);
  });

  it('emits add-expense when the FAB is clicked', async () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    await wrapper.find('.tab-bar__fab').trigger('click');
    expect(wrapper.emitted('add-expense')).toHaveLength(1);
  });
});
