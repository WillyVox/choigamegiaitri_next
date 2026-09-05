import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const SITE_URL = 'https://choigamegiaitri.com';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('title'),
    alternates: { canonical: `${SITE_URL}/${locale}/privacy` }
  };
}

export default async function PrivacyPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return (
    <article className="static-page">
      <h1>{t('title')}</h1>
      <p>{t('body1')}</p>
      <p>{t('body2')}</p>
      <p>{t('body3')}</p>
    </article>
  );
}
