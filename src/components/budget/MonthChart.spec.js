import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MonthChart from './MonthChart.vue';

const months = [
  { key: '2026-01', short: 'Я', total: 61200, empty: false, active: false, negative: false },
  { key: '2026-03', short: 'М', total: 80100, empty: false, active: false, negative: true },
  { key: '2026-07', short: 'И', total: 48200, empty: false, active: true, negative: false },
  { key: '2026-08', short: 'А', total: 0, empty: true, active: false, negative: false },
  // Tracked and genuinely spent nothing — distinct from Август above, which
  // hasn't happened yet. Appended (not inserted in calendar order) so the
  // existing index-based assertions on the first four months stay stable.
  { key: '2026-02', short: 'Ф', total: 0, empty: false, active: false, negative: false },
];

describe('MonthChart', () => {
  it('renders one column per month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')).toHaveLength(5);
  });

  it('marks the active month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[2].classes()).toContain('month-chart__col--active');
  });

  it('marks an overspent month negative', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[1].classes()).toContain('month-chart__col--negative');
  });

  it('disables empty (future) months', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[3].attributes('disabled')).toBeDefined();
  });

  it('emits select with the month key when a populated column is clicked', async () => {
    const wrapper = mount(MonthChart, { props: { months } });
    await wrapper.findAll('.month-chart__col')[0].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['2026-01']);
  });

  it('gives the tallest bar a height of 100%', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    const bars = wrapper.findAll('.month-chart__bar');
    expect(bars[1].attributes('style')).toContain('--h: 100'); // Март is the max (80100)
  });

  it('gives a tracked, genuinely zero-spend month the same floor as a populated one, not the shorter empty-month floor', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    const bars = wrapper.findAll('.month-chart__bar');
    expect(bars[4].attributes('style')).toContain('--h: 6'); // Февраль: total 0, but not empty
    expect(bars[3].attributes('style')).toContain('--h: 4'); // Август: empty, shorter floor
  });
});

describe('MonthChart — accessible labels', () => {
  // The visible label is a single, deliberately ambiguous Cyrillic letter (see
  // component comment) — a screen-reader user swiping through 12 buttons that
  // each announce just one letter (often repeated, e.g. "И" for both Июнь and
  // Июль) gets no usable information. aria-label reconstructs a real name
  // from data this component already receives (month.key, month.total), so
  // the fix stays local instead of waiting on a future props-shape change.
  it('announces the month name and total for a populated month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[0].attributes('aria-label')).toBe('Январь 2026, 61 200 ₽');
  });

  it('announces overspend for a negative month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[1].attributes('aria-label')).toBe('Март 2026, перерасход, 80 100 ₽');
  });

  it('announces a future month as not yet reached, rather than as a 0 ₽ total', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[3].attributes('aria-label')).toBe('Август 2026, ещё не наступил');
  });

  it('announces a tracked, genuinely zero-spend month as a real 0 ₽ total, not as not-yet-reached', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[4].attributes('aria-label')).toBe('Февраль 2026, 0 ₽');
  });

  it('hides the bare-letter label from assistive tech so it does not compete with aria-label', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__label')[0].attributes('aria-hidden')).toBe('true');
  });
});
