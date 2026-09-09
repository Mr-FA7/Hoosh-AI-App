import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketingLayout } from './layout/MarketingLayout';
import './styles/marketing.css';

import HomePage from './pages/HomePage';
import FeaturesPage from './pages/FeaturesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import DownloadPage from './pages/DownloadPage';
import DocsPage from './pages/DocsPage';
import ModelsPage from './pages/ModelsPage';
import SecurityPage from './pages/SecurityPage';
import LicensePage from './pages/LicensePage';
import AboutPage from './pages/AboutPage';
import ChangelogPage from './pages/ChangelogPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.querySelector('.hoosh-marketing');
    if (root instanceof HTMLElement) root.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function MarketingRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="download" element={<DownloadPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="license" element={<LicensePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="changelog" element={<ChangelogPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

/**
 * Hosted marketing site only. Local/desktop never mounts this tree.
 * BrowserRouter is fine on aihoosh.com with SPA fallback in server.js.
 */
export default function MarketingApp() {
  return (
    <BrowserRouter>
      <MarketingRoutes />
    </BrowserRouter>
  );
}
