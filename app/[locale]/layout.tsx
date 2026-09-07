import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Nunito, Baloo_2 } from 'next/font/google';
import { locales, type Locale } from '@/src/routing';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConsentBanner from '@/components/ConsentBanner';
import '../globals.css';

const nunito = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-nunito', weight: ['400', '600', '700'] });
const baloo2 = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-baloo', weight: ['500', '600', '700'] });

const SITE_URL = 'https://choigamegiaitri.com';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('title'),
      template: `%s | ${t('brand')}`
    },
    description: t('description'),
    keywords: t('keywords').split(',').map((k) => k.trim()),
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        vi: `${SITE_URL}/vi`,
        'x-default': `${SITE_URL}/en`
      }
    },
    openGraph: {
      type: 'website',
      title: t('title'),
      description: t('description'),
      url: `${SITE_URL}/${locale}`,
      siteName: t('brand'),
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 }]
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description')
    },
    robots: { index: true, follow: true },
    verification: {
      // Drop your Google Search Console verification token here once you have one:
      google: 'HBF8-dO4e4hADTYCt8hkm0FzZa15xldK2SMfG-97H_4',
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages();
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  return (
    <html lang={locale}>
      <body className={`${nunito.variable} ${baloo2.variable}`}>
        {/*
          Google Consent Mode v2: this must run before adsbygoogle.js, gtag.js,
          or Clarity so those scripts start in "denied" mode until the person
          answers the consent banner. If the person already chose on a
          previous visit, we restore that choice immediately instead of
          flashing "denied" on every reload. Must stay in the outermost
          layout that renders <body> for the beforeInteractive strategy to
          be allowed.
        */}
        <Script id="consent-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){ dataLayer.push(arguments); }
            window.gtag = gtag;
            var saved = null;
            try { saved = localStorage.getItem('cookie_consent'); } catch (e) {}
            var granted = saved === 'granted';
            gtag('consent', 'default', {
              ad_storage: granted ? 'granted' : 'denied',
              ad_user_data: granted ? 'granted' : 'denied',
              ad_personalization: granted ? 'granted' : 'denied',
              analytics_storage: granted ? 'granted' : 'denied',
              wait_for_update: 500
            });
          `}
        </Script>

        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}

        {gaId && <GoogleAnalytics gaId={gaId} />}

        {clarityId && (
          <Script id="clarity-init" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
              try {
                if (localStorage.getItem('cookie_consent') === 'granted') {
                  window.clarity('consent');
                }
              } catch (e) {}
            `}
          </Script>
        )}

        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header locale={locale} />
          <main>{children}</main>
          <Footer locale={locale} />
          <ConsentBanner locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}