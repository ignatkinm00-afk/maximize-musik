import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTelegram } from './lib/telegram';
import './styles/global.css';
import './styles/admin.css';
import './styles/social.css';

initTelegram();

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(<App />);
