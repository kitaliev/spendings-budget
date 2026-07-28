import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MonthNav from './MonthNav.vue';

describe('MonthNav', () => {
  it('shows the given label', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026' } });
    expect(wrapper.find('.month-nav__label').text()).toBe('Июль 2026');
  });

  it('announces month changes to assistive tech via a polite live region', () => {
    // Clicking prev/next only ever changes this label's text (the parent owns
    // the actual month state) — without aria-live, a screen-reader user gets
    // no confirmation the month changed short of re-navigating to it by hand.
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026' } });
    const label = wrapper.find('.month-nav__label');
    expect(label.attributes('aria-live')).toBe('polite');
    expect(label.attributes('aria-atomic')).toBe('true');
  });

  it('emits prev and next when the arrows are clicked', async () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026' } });
    await wrapper.find('.month-nav__arrow--prev').trigger('click');
    await wrapper.find('.month-nav__arrow--next').trigger('click');
    expect(wrapper.emitted('prev')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
  });

  it('disables the next arrow when canGoNext is false', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026', canGoNext: false } });
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeDefined();
  });

  it('disables the prev arrow when canGoPrev is false', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Январь 2026', canGoPrev: false } });
    expect(wrapper.find('.month-nav__arrow--prev').attributes('disabled')).toBeDefined();
  });
});
