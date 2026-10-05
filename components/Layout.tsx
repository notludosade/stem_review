import Head from 'next/head';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
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
  { href: '/pathways.html', label: 'Tracks' },
  { href: '/problem-sets.html', label: 'Problem Sets' },
  { href: '/sandbox.html', label: 'Sandbox' },
];

const SUBJECT_CATEGORIES = [
  {
    label: 'Math',
    href: '/math.html',
    courses: [
      ['Algebra/Geometry Fundamentals Review', '/Algebra%20Geometry%20Fundamentals%20Review/index.html'],
      ['Precalculus', '/Precalculus/index.html'],
      ['Discrete Math', '/Discrete%20Math/index.html'],
      ['Mathematical Proofs', '/Mathematical%20Proofs/index.html'],
      ['AP Calculus BC', '/AP%20STEM%2B/AP_CALC/index.html'],
      ['Linear Algebra A', '/Linear%20Algebra%20A/index.html'],
      ['Multivariable Calculus', '/Multivariable%20Calculus/index.html'],
      ['Differential Equations', '/Differential%20Equations/index.html'],
    ],
  },
  {
    label: 'Science',
    href: '/science.html',
    courses: [
      ['AP Physics 1', '/AP%20Physics%201/index.html'],
      ['AP Physics 2', '/AP%20Physics%202/index.html'],
      ['AP Physics C: Mechanics', '/AP%20Physics%20C%20Mechanics/index.html'],
      ['AP Physics C: Electricity & Magnetism', '/AP%20Physics%20C%20Electricity%20and%20Magnetism/index.html'],
      ['Quantum Physics & Optics', '/Quantum%20Physics%20and%20Optics/index.html'],
    ],
  },
  {
    label: 'Technology & Computer Science',
    href: '/technology.html',
    courses: [
      ['Computer Programming Ethics', '/Computer%20Programming%20Ethics/index.html'],
      ['Computer Programming 1', '/Computer%20Programming%201/index.html'],
      ['Computer Programming 2', '/Computer%20Programming%202/index.html'],
      ['Computer Programming 2+', '/Computer%20Programming%202%2B/index.html'],
      ['Programming with Packages', '/Programming%20with%20Packages/index.html'],
      ['AI Developer', '/AI%20Developer/index.html'],
      ['Software Engineering', '/Software%20Engineering/index.html'],
      ['Data Handling CB', '/Data%20Handling%20CB/index.html'],
      ['Computer Networking Fundamentals', '/Computer%20Networking%20Fundamentals/index.html'],
      ['Cloud Computing A', '/Cloud%20Computing%20A/index.html'],
      ['Systems Programming & Architecture', '/Systems%20Programming%20%26%20Architecture/index.html'],
      ['Cloud Computing B / DevOps', '/Cloud%20Computing%20B/index.html'],
      ['Applied Machine/Deep Learning', '/Applied%20Machine%20Deep%20Learning/index.html'],
      ['Game Engine Architecture', '/Game%20Engine%20Architecture/index.html'],
      ['Video Game Modding', '/Video%20Game%20Modding/index.html'],
    ],
  },
  {
    label: 'Engineering & Physics',
    href: '/engineering.html',
    courses: [
      ['Engineering 1', '/Engineering%201/index.html'],
      ['Career Applied Engineering', '/Career%20Applied%20Engineering/index.html'],
      ['CAD & Prototyping', '/CAD%20%26%20Prototyping/index.html'],
      ['Thermodynamics', '/Thermodynamics/index.html'],
      ['Mechatronics', '/Mechatronics/index.html'],
      ['Advanced Robotics', '/Advanced%20Robotics/index.html'],
    ],
  },
  {
    label: 'Advanced+',
    href: '/advanced.html',
    courses: [
      ['Real Analysis A', '/Advanced%2B%20Courses/Real%20Analysis%20A/index.html'],
      ['Real Analysis B', '/Advanced%2B%20Courses/Real%20Analysis%20B/index.html'],
      ['Advanced Algorithms', '/Advanced%2B%20Courses/Advanced%20Algorithms/index.html'],
      ['Linear Algebra B', '/Advanced%2B%20Courses/Linear%20Algebra%20B/index.html'],
      ['Topology: Fundamentals', '/Advanced%2B%20Courses/Topology%20Fundamentals/index.html'],
      ['Quantum Computing', '/Advanced%2B%20Courses/Quantum%20Computing/index.html'],
    ],
  },
] as const;

function SubjectsMenu() {
  return (
    <details className="group/subjects sm:relative">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-1 text-sm whitespace-nowrap text-[var(--site-text)]',
          'hover:text-[var(--site-accent)] [&::-webkit-details-marker]:hidden'
        )}
      >
        Subjects
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-open/subjects:rotate-180"
        />
      </summary>
      <div
        className={cn(
          'absolute top-full right-4 left-4 z-20 mt-3 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl',
          'border border-[var(--site-border)] bg-[var(--site-bg)] p-2 shadow-xl',
          'sm:top-auto sm:right-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2'
        )}
      >
        <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-[var(--site-muted)] uppercase">
          Course categories
        </p>
        {SUBJECT_CATEGORIES.map((category) => (
          <details
            key={category.href}
            name="subject-category"
            className="group/category border-t border-[var(--site-border)] first:border-t-0"
          >
            <summary
              className={cn(
                'flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5',
                'text-sm font-medium text-[var(--site-text)] hover:bg-[var(--site-accent-soft)]',
                '[&::-webkit-details-marker]:hidden'
              )}
            >
              <span>{category.label}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-[var(--site-muted)]">
                {category.courses.length}
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-open/category:rotate-180"
                />
              </span>
            </summary>
            <div className="grid gap-0.5 px-2 pb-2">
              <a
                href={category.href}
                className="rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--site-accent)] hover:bg-[var(--site-accent-soft)]"
              >
                Browse all {category.label} →
              </a>
              {category.courses.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-md px-2 py-1.5 text-sm text-[var(--site-text)] hover:bg-[var(--site-accent-soft)] hover:text-[var(--site-accent)]"
                >
                  {label}
                </a>
              ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

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
          <a
            href="/dashboard.html"
            className="text-sm whitespace-nowrap text-[var(--site-text)] hover:text-[var(--site-accent)]"
          >
            Dashboard
          </a>
          <SubjectsMenu />
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
