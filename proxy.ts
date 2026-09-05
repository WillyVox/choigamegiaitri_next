import { NextRequest, NextResponse } from 'next/server';

import { locales, defaultLocale, type Locale } from './src/routing';


const COOKIE_NAME = 'NEXT_LOCALE';

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const geoCountry =
    // @ts-expect-error `geo` is injected by the Vercel Edge runtime; not in NextRequest's public types
    request.geo?.country ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry'); 

  if (geoCountry === 'VN') return 'vi';

  const acceptLanguage = request.headers.get('accept-language') || '';
  if (acceptLanguage.toLowerCase().includes('vi')) return 'vi';

  return defaultLocale;
}

// Change "middleware" to "proxy" here: // [!code focus]
export function proxy(request: NextRequest) { // [!code ++]
// export function middleware(request: NextRequest) { // [!code --]
  const { pathname } = request.nextUrl;

  const alreadyLocalized = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (alreadyLocalized) return NextResponse.next();

  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)']
};
