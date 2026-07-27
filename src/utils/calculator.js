function tokenize(expression) {
  return expression.split(/([+\-−×÷])/).filter((token) => token !== '');
}

function toNumber(token) {
  return parseFloat(String(token).replace(',', '.')) || 0;
}

// Assumes `expression` alternates number/operator/number/... with no leading
// or consecutive operators — ExpenseModal's onKey handler (the only caller)
// refuses to append an operator when raw is empty or already ends in one, so
// this never actually receives a string that breaks that shape.
export function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;

  // Pass 1: resolve × and ÷ left to right.
  const afterMulDiv = [toNumber(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const operand = toNumber(tokens[i + 1] ?? '0');
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
