import { useEffect, useState } from 'react';
import { isAuthenticated, logout as logoutFromGoogle, startLogin } from '../services/googleAuth';

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  const logout = async () => {
    await logoutFromGoogle();
    setAuthed(false);
  };

  return {
    authed,
    login: startLogin,
    logout,
  };
}
