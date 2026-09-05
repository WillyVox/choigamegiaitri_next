'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const COOKIE_NAME = 'NEXT_LOCALE';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: 'en' | 'vi') {
    if (next === locale) return;

    // Cookie is the source of truth read by middleware on the next request.
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    // localStorage kept in sync too, in case any client code wants to read
    // the preference without waiting on a server round-trip.
    try {
      window.localStorage.setItem(COOKIE_NAME, next);
    } catch {
      // localStorage can throw in some privacy modes — cookie above still works.
    }

    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/') || `/${next}`);
  }

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={locale === 'en'}
        className={locale === 'en' ? 'active' : ''}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo('vi')}
        aria-pressed={locale === 'vi'}
        className={locale === 'vi' ? 'active' : ''}
      >
        VI
      </button>

      <style jsx>{`
        .lang-switcher {
          display: inline-flex;
          gap: 2px;
          background: rgba(0, 0, 0, 0.06);
          padding: 3px;
          border-radius: 999px;
        }
        button {
          border: none;
          background: transparent;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
        }
        button.active {
          background: #fff;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
