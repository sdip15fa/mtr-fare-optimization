import React, { Suspense } from 'react'; // Import Suspense
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async'; // Import HelmetProvider
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n'; // Import the i18n configuration

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <HelmetProvider> {/* Wrap with HelmetProvider */}
      {/* Wrap App in Suspense for loading translations */}
      <Suspense fallback="Loading...">
        <App />
      </Suspense>
    </HelmetProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
