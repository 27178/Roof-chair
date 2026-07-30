import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rot = document.getElementById('root');
if (!rot) throw new Error('Hittade inte rotelementet');

createRoot(rot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
