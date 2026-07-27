import { describe, it, expect } from 'vitest';
import { evaluateExpression } from './calculator.js';

describe('evaluateExpression', () => {
  it('returns a plain number unchanged', () => {
    expect(evaluateExpression('120')).toBe(120);
  });

  it('adds', () => {
    expect(evaluateExpression('120+50')).toBe(170);
  });

  it('applies multiplication before addition', () => {
    expect(evaluateExpression('120+340×2')).toBe(800);
  });

  it('applies division before addition, left to right', () => {
    expect(evaluateExpression('10÷2+3')).toBe(8);
  });

  it('chains multiple operators of equal precedence left to right', () => {
    expect(evaluateExpression('100−20−10')).toBe(70);
  });

  it('treats a comma as a decimal separator', () => {
    expect(evaluateExpression('12,5+7,5')).toBe(20);
  });

  it('returns 0 for an empty expression', () => {
    expect(evaluateExpression('')).toBe(0);
  });

  it('ignores a trailing operator with nothing typed after it', () => {
    expect(evaluateExpression('120+')).toBe(120);
  });

  it('drops a leading operator rather than misreading token positions', () => {
    expect(evaluateExpression('−5')).toBe(5);
  });

  it('keeps only the most recent of consecutive operators', () => {
    // "changed my mind" — tapping × right after + replaces the pending +.
    expect(evaluateExpression('120+×2')).toBe(240);
  });

  it('is a no-op on division by zero rather than producing Infinity/NaN', () => {
    expect(evaluateExpression('10÷0')).toBe(10);
  });
});
