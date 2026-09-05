import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  const year = new Date().getFullYear();

  return (
    <footer style={{ maxWidth: '1080px', margin: '40px auto 0', padding: '24px 20px 40px', textAlign: 'center', fontSize: '0.85rem', opacity: 0.7 }}>
      <p>{t('tagline')}</p>
      <nav style={{ display: 'flex', gap: '16px', justifyContent: 'center', margin: '10px 0' }}>
        <Link href={`/${locale}/about`} style={{ color: 'inherit', textDecoration: 'underline' }}>{t('about')}</Link>
        <Link href={`/${locale}/privacy`} style={{ color: 'inherit', textDecoration: 'underline' }}>{t('privacy')}</Link>
      </nav>
      <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>© {year} choigamegiaitri.com — {t('rights')}</p>
    </footer>
  );
}
