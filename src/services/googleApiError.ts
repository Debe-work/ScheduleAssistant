export async function readGoogleApiError(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: { message?: string; status?: string } };
    return data.error?.message ?? JSON.stringify(data);
  } catch {
    return await res.text();
  }
}

export function formatGoogleApiError(apiName: string, status: number, detail: string): string {
  if (detail.includes('has not been used in project') || detail.includes('it is disabled')) {
    return `${apiName} が Google Cloud プロジェクトで有効化されていません。README の「Google Cloud Console」に従い API を有効化してから再試行してください。\n\n詳細: ${detail}`;
  }
  return `${apiName} エラー (${status}): ${detail}`;
}
