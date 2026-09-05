import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from './LanguageSwitcher';

export default async function Header({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const site = await getTranslations({ locale, namespace: 'site' });

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      maxWidth: '1080px',
      margin: '0 auto',
      padding: '16px 20px',
      flexWrap: 'wrap'
    }}>
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      
      <Link href={`/${locale}`} style={{ fontWeight: 800, fontSize: '1.1rem', textDecoration: 'none', color: 'inherit' }}>
        🎮 {site('brand')}
      </Link>
      
      <nav style={{ display: 'flex', gap: '18px' }}>
        <Link href={`/${locale}`} style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.92rem' }}>{t('home')}</Link>
        <Link href={`/${locale}#games`} style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.92rem' }}>{t('allGames')}</Link>
      </nav>
      
      <LanguageSwitcher />
    </header>
  );
}
