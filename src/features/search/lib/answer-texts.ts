function readAnswerText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function extractAnswerTexts(rawAnswers: unknown[] | undefined) {
  if (!Array.isArray(rawAnswers)) {
    return [];
  }

  const answers: string[] = [];
  const seen = new Set<string>();

  for (const item of rawAnswers) {
    const answer =
      readAnswerText(item) ??
      (item && typeof item === "object" && "answer" in item
        ? readAnswerText(item.answer)
        : undefined);

    if (!answer || seen.has(answer)) {
      continue;
    }

    seen.add(answer);
    answers.push(answer);
  }

  return answers;
}
