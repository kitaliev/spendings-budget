import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Toast from './Toast.vue';

describe('Toast', () => {
  it('renders nothing when there is no message', () => {
    const wrapper = mount(Toast, { props: { message: '' } });
    expect(wrapper.find('.toast').exists()).toBe(false);
  });

  it('renders the message when present', () => {
    const wrapper = mount(Toast, { props: { message: 'Готово' } });
    expect(wrapper.find('.toast').text()).toBe('Готово');
  });
});
