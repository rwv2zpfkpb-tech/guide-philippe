export function splitReviewText(text: string): { headline: string; rest: string } {
  const trimmed = text.trim();
  const sentenceEnd = trimmed.search(/[.!?](?:\s|$)/);
  if (sentenceEnd === -1) return { headline: trimmed, rest: "" };
  return {
    headline: trimmed.slice(0, sentenceEnd + 1),
    rest: trimmed.slice(sentenceEnd + 1).trim(),
  };
}

export function firstSentence(text: string): string {
  return splitReviewText(text).headline;
}
