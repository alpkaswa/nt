import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent chrome-extension inject scripts from breaking host app execution
window.addEventListener('error', (event) => {
  if (event.filename && event.filename.includes('chrome-extension://')) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const stack = event.reason && typeof event.reason === 'object' ? event.reason.stack : '';
  if (typeof stack === 'string' && stack.includes('chrome-extension://')) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
