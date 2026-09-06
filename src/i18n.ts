import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { locale as getRootLocale } from 'next/root-params';
import { locales, defaultLocale } from './routing';


// You can completely omit the deprecated `requestLocale` parameter here
export default getRequestConfig(async () => {
  // 1. Read the [locale] segment directly from Next.js root parameters
  const requested = await getRootLocale();

  // 2. Fall back to your default locale if the segment is invalid or empty
  const locale = hasLocale(locales, requested) 
    ? requested 
    : defaultLocale;


  return {
    locale, // Required in v4 downstream
    messages: (await import(`messages/${locale}.json`)).default
  };
});