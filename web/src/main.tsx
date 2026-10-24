import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConfirmProvider, LightboxProvider, ToastProvider } from '@/components/feedback';
import { App } from '@/App';
import '../../css/tokens.css';
import '../../css/components.css';
import '../../css/pages.css';
import '../../css/admin.css';
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
