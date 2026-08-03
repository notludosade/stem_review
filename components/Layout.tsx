import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
}

interface Me {
  id: number;
  email: string;
  name: string | null;
}

const NAV_LINKS = [
  { href: '/math.html', label: 'Subjects' },
  { href: '/pathways.html', label: 'Tracks' },
  { href: '/problem-sets.html', label: 'Problem Sets' },
  { href: '/sandbox.html', label: 'Sandbox' },
];

function AuthStatus() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;
  if (me === null) {
    return (
      <a href="/login.html" className="text-sm text-[var(--site-accent)] hover:underline">
        Sign in
      </a>
    );
  }
  return (
    <span className="text-sm text-[var(--site-muted)]">
      {me.name || me.email} ·{' '}
      <a href="/api/auth/logout" className="text-[var(--site-accent)] hover:underline">
        Sign out
      </a>
    </span>
  );
}

export function Layout({ title, children }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/style.css" />
      </Head>
      <header
        className={cn(
          'sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
          'border-b border-[var(--site-border)] bg-[var(--site-bg)] px-4 py-3 sm:px-6'
        )}
      >
        <Link href="/" className="font-semibold text-[var(--site-text)]">
          STEM+
        </Link>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm whitespace-nowrap text-[var(--site-text)] hover:text-[var(--site-accent)]"
            >
              {link.label}
            </a>
          ))}
          <AuthStatus />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
