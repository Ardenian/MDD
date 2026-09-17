/**
 * The guard in front of a destructive action exists to make it deliberate, not to test
 * typing accuracy — so surrounding whitespace and letter case never decide the answer.
 */
export function matchesConfirmPhrase(typed: string, phrase: string): boolean {
  return typed.trim().toLocaleLowerCase() === phrase.trim().toLocaleLowerCase();
}
