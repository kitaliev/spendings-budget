import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Keypad from './Keypad.vue';

describe('Keypad', () => {
  it('renders 16 keys in calculator order', () => {
    const wrapper = mount(Keypad);
    const labels = wrapper.findAll('.keypad__key').map((b) => b.text());
    expect(labels).toEqual([
      '7', '8', '9', '÷',
      '4', '5', '6', '×',
      '1', '2', '3', '−',
      ',', '0', '⌫', '+',
    ]);
  });

  it('emits "key" with the digit value when a digit is pressed', async () => {
    const wrapper = mount(Keypad);
    await wrapper.findAll('.keypad__key')[0].trigger('click');
    expect(wrapper.emitted('key')[0]).toEqual(['7']);
  });

  it('emits "key" with "del" for the delete button', async () => {
    const wrapper = mount(Keypad);
    await wrapper.findAll('.keypad__key')[14].trigger('click');
    expect(wrapper.emitted('key')[0]).toEqual(['del']);
  });

  it('marks the four operator keys distinctly from digits', () => {
    const wrapper = mount(Keypad);
    const keys = wrapper.findAll('.keypad__key');
    expect(keys[3].classes()).toContain('keypad__key--op'); // ÷
    expect(keys[0].classes()).not.toContain('keypad__key--op'); // 7
  });

  it('labels the delete key for assistive tech, since ⌫ alone has no guaranteed spoken reading', () => {
    const wrapper = mount(Keypad);
    const keys = wrapper.findAll('.keypad__key');
    expect(keys[14].attributes('aria-label')).toBe('Стереть');
  });
});
