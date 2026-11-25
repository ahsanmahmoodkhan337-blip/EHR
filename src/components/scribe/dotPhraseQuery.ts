/**
 * The dot phrase being typed at the caret, or null.
 *
 * A dot phrase starts a word: the dot sits at the start of the box or after a
 * space or new line, and at least one letter follows it (`.oldcarts`, `.ros`).
 * The full stop that ends a sentence ("Denies fever.") is not a dot phrase.
 * Matching it used to open the list on every sentence, cover the buttons below
 * the box, and turn the next Enter into an inserted template.
 */
export function dotPhraseQuery(textBeforeCaret: string): string | null {
  const match = textBeforeCaret.match(/(?:^|\s)(\.[A-Za-z]\w*)$/);
  return match ? match[1] : null;
}
