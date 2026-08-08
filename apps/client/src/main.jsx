import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AdminApp } from './AdminApp.jsx';
import { LocaleProvider } from './i18n/LocaleContext.jsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element was not found.');
}

function Root() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const isAdmin = hash === '#/admin' || hash.startsWith('#/admin/');

  return (
    <LocaleProvider>
      {isAdmin ? <AdminApp /> : <App />}
    </LocaleProvider>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
