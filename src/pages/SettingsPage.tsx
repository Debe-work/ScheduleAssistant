import { useEffect, useState } from 'react';
import { isAuthenticated, logout, startLogin } from '../services/googleAuth';
import { loadTemplates } from '../services/templateLoader';
import type { DailyTaskTemplate } from '../types';

export function SettingsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<DailyTaskTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false));
    loadTemplates()
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuthed(false);
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
          <button type="button" className="btn btn-primary" onClick={() => startLogin()}>
            Google アカウント連携
          </button>
        )}
      </section>

      <section>
        <h2>テンプレート</h2>
        {error && <p className="error">{error}</p>}
        {templates && (
          <pre className="template-preview">{JSON.stringify(templates, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
