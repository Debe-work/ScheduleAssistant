import { describe, expect, it } from 'vitest';
import { splitJapaneseSentences } from './text';

describe('splitJapaneseSentences', () => {
  it('splits Japanese text after punctuation while keeping punctuation', () => {
    expect(splitJapaneseSentences('朝です。準備します。 出発します')).toEqual([
      '朝です。',
      '準備します。',
      '出発します',
    ]);
  });

  it('trims blank input to an empty array', () => {
    expect(splitJapaneseSentences('   ')).toEqual([]);
  });

  it('returns the trimmed text when there is no Japanese punctuation', () => {
    expect(splitJapaneseSentences('  No punctuation  ')).toEqual(['No punctuation']);
  });
});
