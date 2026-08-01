const CALCULATOR_FUNCTIONS = new Set([
  "abs",
  "exp",
  "factorial",
  "gcd",
  "lcm",
  "log",
  "log1p",
  "log2",
  "log10",
  "mod",
  "nthRoot",
  "pow",
  "round",
  "sign",
  "sqrt",
]);

const CALCULATOR_CONSTANTS = new Set(["e", "pi"]);
const CALCULATOR_OPERATORS = new Set(["+", "-", "*", "/", "^", "%", "!"]);
const CALCULATOR_QUERY_MAX_LENGTH = 256;

function isDigit(character: string | undefined) {
  return character !== undefined && character >= "0" && character <= "9";
}

function isIdentifierStart(character: string | undefined) {
  return (
    character !== undefined &&
    ((character >= "a" && character <= "z") ||
      (character >= "A" && character <= "Z") ||
      character === "_")
  );
}

function isIdentifierPart(character: string | undefined) {
  return isIdentifierStart(character) || isDigit(character);
}

function skipWhitespace(expression: string, start: number) {
  let index = start;

  while (/\s/u.test(expression[index] ?? "")) {
    index += 1;
  }

  return index;
}

function consumeNumber(expression: string, start: number) {
  let index = start;

  if (expression[index] === ".") {
    index += 1;
  } else {
    while (isDigit(expression[index])) {
      index += 1;
    }

    if (expression[index] === ".") {
      index += 1;
    }
  }

  while (isDigit(expression[index])) {
    index += 1;
  }

  if (expression[index] !== "e" && expression[index] !== "E") {
    return index;
  }

  let exponentIndex = index + 1;

  if (expression[exponentIndex] === "+" || expression[exponentIndex] === "-") {
    exponentIndex += 1;
  }

  if (!isDigit(expression[exponentIndex])) {
    return index;
  }

  while (isDigit(expression[exponentIndex])) {
    exponentIndex += 1;
  }

  return exponentIndex;
}

export function looksLikeCalculatorExpression(query: string) {
  const expression = query.trim();

  if (
    expression.length === 0 ||
    expression.length > CALCULATOR_QUERY_MAX_LENGTH
  ) {
    return false;
  }

  let hasValue = false;
  let index = 0;
  let parenthesisDepth = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (
      isDigit(character) ||
      (character === "." && isDigit(expression[index + 1]))
    ) {
      hasValue = true;
      index = consumeNumber(expression, index);
      continue;
    }

    if (isIdentifierStart(character)) {
      const identifierStart = index;
      index += 1;

      while (isIdentifierPart(expression[index])) {
        index += 1;
      }

      const identifier = expression.slice(identifierStart, index);

      if (CALCULATOR_CONSTANTS.has(identifier)) {
        hasValue = true;
        continue;
      }

      if (!CALCULATOR_FUNCTIONS.has(identifier)) {
        return false;
      }

      const nextTokenIndex = skipWhitespace(expression, index);

      if (expression[nextTokenIndex] !== "(") {
        return false;
      }

      hasValue = true;
      continue;
    }

    if (character === "(") {
      parenthesisDepth += 1;
      index += 1;
      continue;
    }

    if (character === ")") {
      parenthesisDepth -= 1;

      if (parenthesisDepth < 0) {
        return false;
      }

      index += 1;
      continue;
    }

    if (character === ",") {
      if (parenthesisDepth === 0) {
        return false;
      }

      index += 1;
      continue;
    }

    if (CALCULATOR_OPERATORS.has(character)) {
      index += 1;
      continue;
    }

    return false;
  }

  return hasValue && parenthesisDepth === 0;
}
