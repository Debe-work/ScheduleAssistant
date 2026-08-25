export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export type GeminiModelOption = {
  id: string;
  label: string;
  description?: string;
  freeTier: boolean;
};

/** Schedule generation candidates. Update via .cursor/commands/update-gemini-models.md */
export const GEMINI_MODEL_CATALOG: GeminiModelOption[] = [
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: '最新 Flash 系。品質寄り',
    freeTier: true,
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    description: '最新の高性能 Flash。品質と速度のバランス',
    freeTier: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'GA の低コスト・高速モデル。デフォルト',
    freeTier: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    description: '軽量・低コスト',
    freeTier: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    description: '高推論。API 無料枠なし',
    freeTier: false,
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    description: 'Preview 版 Flash',
    freeTier: true,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: '推論強め。無料枠の RPD は厳しめ',
    freeTier: true,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: '実績あるバランス型',
    freeTier: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    description: '最安クラス',
    freeTier: true,
  },
];

export const GEMINI_MODEL_IDS = new Set(GEMINI_MODEL_CATALOG.map((model) => model.id));

export function isAllowedGeminiModel(id: string): boolean {
  return GEMINI_MODEL_IDS.has(id);
}

export function resolveGeminiModel(id: string | undefined): string {
  return id && isAllowedGeminiModel(id) ? id : DEFAULT_GEMINI_MODEL;
}

export function getGeminiModelOption(id: string): GeminiModelOption | undefined {
  return GEMINI_MODEL_CATALOG.find((model) => model.id === id);
}

export function getGeminiModelLabel(id: string): string {
  return getGeminiModelOption(id)?.label ?? id;
}
