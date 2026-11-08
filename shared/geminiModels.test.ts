import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_CATALOG,
  GEMINI_MODEL_IDS,
  getGeminiModelLabel,
  isAllowedGeminiModel,
  resolveGeminiModel,
} from './geminiModels.ts';

describe('geminiModels', () => {
  it('keeps unique model ids in the catalog', () => {
    expect(GEMINI_MODEL_IDS.size).toBe(GEMINI_MODEL_CATALOG.length);
  });

  it('defaults unknown models to gemini-3.5-flash-lite', () => {
    expect(resolveGeminiModel(undefined)).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('unknown-model')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gemini-2.0-flash')).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('accepts catalog models', () => {
    expect(isAllowedGeminiModel('gemini-2.5-flash')).toBe(true);
    expect(resolveGeminiModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });

  it('includes only supported text-generation models with pricing flags', () => {
    expect(GEMINI_MODEL_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gemini-3.8-flash', freeTier: true }),
        expect.objectContaining({ id: 'gemini-3.7-flash', freeTier: true }),
        expect.objectContaining({ id: 'gemini-3.6-flash', freeTier: true }),
        expect.objectContaining({ id: 'gemini-3.1-pro-preview', freeTier: false }),
      ]),
    );
    expect(isAllowedGeminiModel('gemini-3.1-flash-image')).toBe(false);
    expect(isAllowedGeminiModel('gemini-3.1-flash-tts-preview')).toBe(false);
    expect(isAllowedGeminiModel('gemini-embedding-2')).toBe(false);
  });

  it('returns labels for known models', () => {
    expect(getGeminiModelLabel('gemini-3.5-flash-lite')).toBe('Gemini 3.5 Flash-Lite');
    expect(getGeminiModelLabel('unknown')).toBe('unknown');
  });
});
