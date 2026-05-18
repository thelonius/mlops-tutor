import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// hljs-CSS грузится динамически через <link id="hljs-css"> в index.html;
// useSystemTheme подменяет href по prefers-color-scheme.
import { StoreProvider } from './state/store';
import { UiProvider } from './state/ui';
import { ToastProvider } from './components/Toast';
import { GlossaryProvider } from './components/Glossary/GlossaryProvider';
import { TtsProvider } from './components/TtsProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <UiProvider>
        <ToastProvider>
          <GlossaryProvider>
            <TtsProvider>
              <App />
            </TtsProvider>
          </GlossaryProvider>
        </ToastProvider>
      </UiProvider>
    </StoreProvider>
  </StrictMode>,
);
