import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DatePicker from './DatePicker.vue';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 27)); // 27 July 2026
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DatePicker', () => {
  it('marks "Сегодня" active when modelValue is today', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-27' } });
    expect(wrapper.findAll('.date-row__btn')[0].classes()).toContain('date-row__btn--active');
  });

  it('marks "Вчера" active when modelValue is yesterday', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-26' } });
    expect(wrapper.findAll('.date-row__btn')[1].classes()).toContain('date-row__btn--active');
  });

  it('marks the native-date button active for any other date', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    expect(wrapper.findAll('.date-row__btn')[2].classes()).toContain('date-row__btn--active');
  });

  it('shows the formatted date on the native button when mounted directly with an "other" date, before any change event fires', () => {
    // Covers the edit-existing-transaction case (Task 17): the label must be
    // correct on first render, not only after the user interacts with the
    // native input themselves.
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    expect(wrapper.findAll('.date-row__btn')[2].text()).toBe('1 июл.');
  });

  it('emits update:modelValue with today when "Сегодня" is clicked', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    await wrapper.findAll('.date-row__btn')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['2026-07-27']);
  });

  it('emits update:modelValue with yesterday when "Вчера" is clicked', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    await wrapper.findAll('.date-row__btn')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['2026-07-26']);
  });

  it('emits update:modelValue when the native date input changes', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-27' } });
    await wrapper.find('.date-row__native').setValue('2026-07-10');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['2026-07-10']);
  });
});
