import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PreviewPage } from './pages/PreviewPage';
import { SettingsPage } from './pages/SettingsPage';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Google アカウント連携がキャンセルされました',
  missing_oauth_state: '認証セッションを確認できませんでした。もう一度お試しください',
  oauth_state_expired: '認証セッションの有効期限が切れました。もう一度お試しください',
};

export default function App() {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const errorCode = url.searchParams.get('authError');
    if (!errorCode) return;

    setAuthError(AUTH_ERROR_MESSAGES[errorCode] ?? '認証に失敗しました。もう一度お試しください');
    url.searchParams.delete('authError');
    url.searchParams.delete('iss');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <div className="app">
        <main className="main">
          {authError && <p className="error auth-error">{authError}</p>}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            ホーム
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            設定
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}
