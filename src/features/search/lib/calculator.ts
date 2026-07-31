import {
  absDependencies,
  addDependencies,
  create,
  divideDependencies,
  eDependencies,
  evaluateDependencies,
  expDependencies,
  factorialDependencies,
  gcdDependencies,
  lcmDependencies,
  log1pDependencies,
  log2Dependencies,
  log10Dependencies,
  logDependencies,
  modDependencies,
  multiplyDependencies,
  nthRootDependencies,
  piDependencies,
  powDependencies,
  roundDependencies,
  signDependencies,
  sqrtDependencies,
  subtractDependencies,
} from "mathjs/number";

const calculator = create({
  ...absDependencies,
  ...addDependencies,
  ...divideDependencies,
  ...eDependencies,
  ...evaluateDependencies,
  ...expDependencies,
  ...factorialDependencies,
  ...gcdDependencies,
  ...lcmDependencies,
  ...log1pDependencies,
  ...log2Dependencies,
  ...log10Dependencies,
  ...logDependencies,
  ...modDependencies,
  ...multiplyDependencies,
  ...nthRootDependencies,
  ...piDependencies,
  ...powDependencies,
  ...roundDependencies,
  ...signDependencies,
  ...sqrtDependencies,
  ...subtractDependencies,
});

export function calculateAnswer(query: string) {
  const expression = query.trim();

  if (!expression) {
    return undefined;
  }

  try {
    const node = calculator.parse(expression);
    return `${node.toString()} = ${node.evaluate()}`;
  } catch {
    return undefined;
  }
}
