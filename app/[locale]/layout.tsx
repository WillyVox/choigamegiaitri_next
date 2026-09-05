import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { Nunito, Baloo_2 } from 'next/font/google';
import { locales, type Locale } from '@/src/routing';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
      // google: 'YOUR_VERIFICATION_TOKEN'
    }
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

  return (
    <html lang={locale}>
      <body className={`${nunito.variable} ${baloo2.variable}`}>
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header locale={locale} />
          <main>{children}</main>
          <Footer locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
