import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureSessionTokenFromUrl } from './services/sessionToken';
import './index.css';

captureSessionTokenFromUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
