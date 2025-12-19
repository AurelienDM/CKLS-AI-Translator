import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import { SettingsPage } from './components/SettingsPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('options-root')!).render(
  <React.StrictMode>
    <AppProvider>
      <SettingsPage />
    </AppProvider>
  </React.StrictMode>,
);

