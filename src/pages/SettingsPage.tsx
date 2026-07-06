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
          <>
            <p className="status-ok">Google アカウント連携済み</p>
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              ログアウト
            </button>
          </>
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
