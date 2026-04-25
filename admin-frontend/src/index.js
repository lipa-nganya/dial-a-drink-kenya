import React from 'react';
import ReactDOM from 'react-dom/client';
import { datadogRum } from '@datadog/browser-rum';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const isProductionBuild = process.env.NODE_ENV === 'production';
const ddAllowedHost = process.env.REACT_APP_DD_ALLOWED_HOST;
const hostMatches =
  !ddAllowedHost ||
  (typeof window !== 'undefined' && window.location.hostname === ddAllowedHost);

if (isProductionBuild && hostMatches) {
  datadogRum.init({
    applicationId: '63510d94-e354-4d13-a3af-8a65d1db55f4',
    clientToken: 'pub6aa1e3ede58a2df54606cffed6024409',
    site: 'us5.datadoghq.com',
    service: process.env.REACT_APP_DD_SERVICE || 'admin-frontend',
    env: process.env.REACT_APP_DD_ENV || 'prod',
    version: process.env.REACT_APP_DD_VERSION || process.env.REACT_APP_VERSION || '0.1.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

























