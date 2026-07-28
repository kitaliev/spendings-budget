const OPERATORS = ['+', '−', '×', '÷'];

function tokenize(expression) {
  return expression.split(/([+\-−×÷])/).filter((token) => token !== '');
}

function toNumber(token) {
  return parseFloat(String(token).replace(',', '.')) || 0;
}

// Collapses a token stream into strict number/operator/number/.../number
// alternation (or []): a leading or trailing operator has nothing on one
// side to apply to and is dropped; consecutive operators keep only the most
// recent one (the "changed my mind" calculator convention — tapping ×
// right after + replaces the pending + rather than both being applied).
// Guaranteeing this shape up front means the two passes below never need to
// guess at a missing operand — "operator with nothing to apply to" is
// handled uniformly here instead of leaking into each operator's own
// incidental math (0 being the +/− identity is not a substitute for this:
// it left a trailing × silently zeroing the result). Keeps evaluateExpression
// correct on any input shape, independent of what any caller does or
// doesn't guarantee about raw.
function normalize(tokens) {
  const result = [];
  for (const token of tokens) {
    if (OPERATORS.includes(token)) {
      if (result.length === 0) continue;
      if (OPERATORS.includes(result[result.length - 1])) {
        result[result.length - 1] = token;
        continue;
      }
    }
    result.push(token);
  }
  if (result.length && OPERATORS.includes(result[result.length - 1])) {
    result.pop();
  }
  return result;
}

/**
 * Evaluates a keypad-built arithmetic string (digits, comma decimal
 * separator, + − × ÷) with standard math precedence (× ÷ before + −,
 * left-to-right within the same precedence). Never throws: an empty string
 * evaluates to 0, a trailing operator is ignored, division by zero is a
 * no-op (returns the left operand), and a malformed operator shape is
 * normalized rather than misinterpreted (see `normalize`). Does not
 * constrain the sign of the result — rejecting a non-positive amount is a
 * business rule for the caller (ExpenseModal), not an arithmetic one.
 */
export function evaluateExpression(expression) {
  const tokens = normalize(tokenize(expression));
  if (tokens.length === 0) return 0;

  // Pass 1: resolve × and ÷ left to right. `normalize` guarantees the array
  // ends on a number, so tokens[i + 1] is always defined here.
  const afterMulDiv = [toNumber(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const operand = toNumber(tokens[i + 1]);
    if (operator === '×' || operator === '÷') {
      const previous = afterMulDiv.pop();
      afterMulDiv.push(
        operator === '×' ? previous * operand : operand === 0 ? previous : previous / operand
      );
    } else {
      afterMulDiv.push(operator, operand);
    }
  }

  // Pass 2: resolve + and − left to right.
  let result = afterMulDiv[0];
  for (let i = 1; i < afterMulDiv.length; i += 2) {
    const operator = afterMulDiv[i];
    const operand = afterMulDiv[i + 1];
    result = operator === '+' ? result + operand : result - operand;
  }
  return result;
}
