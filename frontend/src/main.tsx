import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import 'highlight.js/styles/github-dark.css';
import { StoreProvider } from './state/store';
import { ToastProvider } from './components/Toast';
import { GlossaryProvider } from './components/Glossary/GlossaryProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <GlossaryProvider>
          <App />
        </GlossaryProvider>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
