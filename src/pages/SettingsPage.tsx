import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { loadTemplates } from '../services/templateLoader';
import { toErrorMessage } from '../utils/errors';
import type { DailyTaskTemplate } from '../types';

export function SettingsPage() {
  const { authed, login, logout } = useAuth();
  const [templates, setTemplates] = useState<DailyTaskTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates()
      .then(setTemplates)
      .catch((e) => setError(toErrorMessage(e)));
  }, []);

  const handleLogout = async () => {
    await logout();
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
        <h2>テンプレート</h2>
        {error && <p className="error">{error}</p>}
        {templates && (
          <pre className="template-preview">{JSON.stringify(templates, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
