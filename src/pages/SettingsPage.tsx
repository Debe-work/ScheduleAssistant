import { useCallback, useEffect, useState } from 'react';
import { TemplateEditor } from '../components/TemplateEditor';
import { useAuth } from '../hooks/useAuth';
import { loadDefaultTemplates, loadTemplates } from '../services/templateLoader';
import {
  clearStoredTemplates,
  hasStoredTemplates,
  saveStoredTemplates,
} from '../storage/templateStorage';
import { toErrorMessage } from '../utils/errors';
import type { DailyTaskTemplate } from '../types';

export function SettingsPage() {
  const { authed, login, logout } = useAuth();
  const [templates, setTemplates] = useState<DailyTaskTemplate[] | null>(null);
  const [usingCustom, setUsingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const loadEditorTemplates = useCallback(async () => {
    const [loaded, custom] = await Promise.all([
      loadTemplates(),
      Promise.resolve(hasStoredTemplates()),
    ]);
    setTemplates(loaded);
    setUsingCustom(custom);
    setEditorKey((key) => key + 1);
  }, []);

  useEffect(() => {
    loadEditorTemplates().catch((e) => setError(toErrorMessage(e)));
  }, [loadEditorTemplates]);

  const handleLogout = async () => {
    await logout();
  };

  const handleSave = (nextTemplates: DailyTaskTemplate[]) => {
    saveStoredTemplates(nextTemplates);
    setTemplates(nextTemplates);
    setUsingCustom(true);
  };

  const handleReset = async () => {
    clearStoredTemplates();
    try {
      const defaults = await loadDefaultTemplates();
      setTemplates(defaults);
      setUsingCustom(false);
      setEditorKey((key) => key + 1);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  return (
    <div className="page page-settings">
      <h1>設定</h1>

      <section>
        <h2>認証</h2>
        {authed === null && <p>確認中…</p>}
        {authed === true && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p className="status-ok">Googleアカウント連携済</p>
            <button
              type="button"
              className="btn btn-icon"
              onClick={handleLogout}
              title="ログアウト"
              aria-label="ログアウト"
            >
              {/* SVGアイコン例：ログアウト */}
              <svg width="44" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M16 17v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 12h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
       
          </div>
        )}
        {authed === false && (
          <button type="button" className="btn btn-primary" onClick={() => login()}>
            Google アカウント連携
          </button>
        )}
      </section>

      <section>
        <h2>デイリータスクテンプレート</h2>
        <p className="template-editor-intro">
          スケジュール生成に使うタスク定義です。形式に沿ったパラメータだけを選んで入力できます。
        </p>
        {error && <p className="error">{error}</p>}
        {templates && (
          <TemplateEditor
            key={editorKey}
            initialTemplates={templates}
            usingCustom={usingCustom}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
        {!templates && !error && <p className="loading">読み込み中…</p>}
      </section>
    </div>
  );
}
