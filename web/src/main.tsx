import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConfirmProvider, LightboxProvider, ToastProvider } from '@/components/feedback';
import { App } from '@/App';
import './styles/tokens.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/admin.css';
import './styles/app.css';

document.documentElement.classList.add('js');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <LightboxProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LightboxProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
