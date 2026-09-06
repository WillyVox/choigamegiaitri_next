'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'cookie_consent';

export default function ConsentBanner({ locale }: { locale: string }) {
  const t = useTranslations('consent');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      /* ignore */
    }
    if (!saved) setVisible(true);
  }, []);

  function applyConsent(granted: boolean) {
    try {
      window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    } catch {
      /* ignore */
    }
    const state = granted ? 'granted' : 'denied';
    window.gtag?.('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
    if (granted) window.clarity?.('consent');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={t('title')}>
      <div className="consent-banner__panel">
        <p className="consent-banner__text">
          {t('message')}{' '}
          <a className="consent-banner__link" href={`/${locale}/privacy`}>
            {t('privacyLink')}
          </a>
        </p>
        <div className="consent-banner__actions">
          <button type="button" className="consent-banner__btn consent-banner__btn--decline" onClick={() => applyConsent(false)}>
            {t('declineAll')}
          </button>
          <button type="button" className="consent-banner__btn consent-banner__btn--accept" onClick={() => applyConsent(true)}>
            {t('acceptAll')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .consent-banner {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 100;
          display: flex;
          justify-content: center;
          padding: 14px;
          font-family: var(--font-nunito), sans-serif;
        }
        .consent-banner__panel {
          width: 100%;
          max-width: 640px;
          background: #fffaf1;
          border: 2px solid #9c6b43;
          border-radius: 18px;
          padding: 16px 18px;
          box-shadow: 0 8px 28px rgba(43, 32, 19, 0.25);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }
        .consent-banner__text {
          flex: 1 1 280px;
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.4;
          color: #57432c;
        }
        .consent-banner__link {
          color: #9c6b43;
          font-weight: 700;
          text-decoration: underline;
        }
        .consent-banner__actions {
          display: flex;
          gap: 8px;
          flex: 0 0 auto;
        }
        .consent-banner__btn {
          font-family: var(--font-baloo), sans-serif;
          border-radius: 999px;
          padding: 9px 16px;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .consent-banner__btn--decline {
          background: transparent;
          border: 2px solid #9c6b43;
          color: #74492b;
        }
        .consent-banner__btn--accept {
          background: #ffc93c;
          border: 2px solid #2b2013;
          color: #2b2013;
        }
      `}</style>
    </div>
  );
}