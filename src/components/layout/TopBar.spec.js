import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TopBar from './TopBar.vue';

describe('TopBar', () => {
  it('renders a plain title by default', () => {
    const wrapper = mount(TopBar, { props: { title: 'Долги' } });
    expect(wrapper.find('.top-bar__title').text()).toBe('Долги');
  });

  it('renders custom left content via the left slot instead of the title', () => {
    const wrapper = mount(TopBar, {
      props: { title: 'ignored' },
      slots: { left: '<span class="custom-left">custom</span>' },
    });
    expect(wrapper.find('.custom-left').exists()).toBe(true);
    expect(wrapper.find('.top-bar__title').exists()).toBe(false);
  });

  it('renders right-side content via the right slot', () => {
    const wrapper = mount(TopBar, {
      props: { title: 'Настройки' },
      slots: { right: '<button class="gear">⚙️</button>' },
    });
    expect(wrapper.find('.gear').exists()).toBe(true);
  });
});
