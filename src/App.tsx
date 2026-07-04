import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PreviewPage } from './pages/PreviewPage';
import { SettingsPage } from './pages/SettingsPage';

function OAuthHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get('authError');
    if (!authError) return;

    alert(`認証エラー: ${authError}`);
    url.searchParams.delete('authError');
    url.searchParams.delete('iss');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <OAuthHandler>
        <div className="app">
          <main className="main">
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
      </OAuthHandler>
    </BrowserRouter>
  );
}
