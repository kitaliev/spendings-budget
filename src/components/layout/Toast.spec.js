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

  it('announces itself to assistive tech via a polite status live region', () => {
    // Toast has no focus target and disappears on its own timer — without
    // role="status" + aria-live, a screen-reader user gets no signal it
    // appeared at all.
    const wrapper = mount(Toast, { props: { message: 'Готово' } });
    const toast = wrapper.find('.toast');
    expect(toast.attributes('role')).toBe('status');
    expect(toast.attributes('aria-live')).toBe('polite');
    expect(toast.attributes('aria-atomic')).toBe('true');
  });
});
