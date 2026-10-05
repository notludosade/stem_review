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

type NavItem = readonly [label: string, href: string];

interface NavCategory {
  readonly label: string;
  readonly href: string;
  readonly items: readonly NavItem[];
}

// Hand-maintained, mirroring each hub page (pathways.html, projects.html,
// applications.html, Goals/, problem-sets.html, sandbox.html). Every href is
// checked against content/ by scripts/check-nav-links.js in npm test.
const TRACK_CATEGORIES: readonly NavCategory[] = [
  {
    label: 'Pathways',
    href: '/pathways.html',
    items: [
      ['Software Engineer', '/Pathways/software-engineer.html'],
      ['AI & Data', '/Pathways/ai-data.html'],
      ['Mathematics', '/Pathways/mathematics.html'],
      ['Engineering & Physics', '/Pathways/engineering-physics.html'],
      ['Competitive Programmer', '/Pathways/competitive-programmer.html'],
      ['Cloud & DevOps', '/Pathways/cloud-devops.html'],
      ['Robotics & Mechatronics', '/Pathways/robotics-mechatronics.html'],
      ['Quantum Science', '/Pathways/quantum-science.html'],
      ['General Programmer (Career)', '/Pathways/general-programmer.html'],
      ['AI Developer: CB/RWA (Career)', '/Pathways/ai-developer-cbrwa.html'],
    ],
  },
  {
    label: 'Projects',
    href: '/projects.html',
    items: [
      ['Software Engineer Capstone', '/Projects/software-engineer-capstone.html'],
      ['AI & Data Capstone', '/Projects/ai-data-capstone.html'],
      ['Mathematics Capstone', '/Projects/mathematics-capstone.html'],
      ['Engineering & Physics Capstone', '/Projects/engineering-physics-capstone.html'],
      ['Competitive Programmer Capstone', '/Projects/competitive-programmer-capstone.html'],
      ['Cloud & DevOps Capstone', '/Projects/cloud-devops-capstone.html'],
      ['Robotics & Mechatronics Capstone', '/Projects/robotics-mechatronics-capstone.html'],
      ['Quantum Science Capstone', '/Projects/quantum-science-capstone.html'],
      ['General Programmer Capstone', '/Projects/general-programmer-capstone.html'],
      ['AI Developer: CB/RWA Capstone', '/Projects/ai-developer-cbrwa-capstone.html'],
    ],
  },
  {
    label: 'Applications',
    href: '/applications.html',
    items: [
      ['Scaling a Viral App Overnight', '/Applications/scaling-a-viral-app.html'],
      ['A/B Testing a Feature Launch', '/Applications/ab-testing-a-feature-launch.html'],
      ['Why Your Video Call Freezes', '/Applications/why-your-video-call-freezes.html'],
      ['Designing a Roller Coaster Safely', '/Applications/designing-a-roller-coaster-safely.html'],
      ['How Recommendation Engines Actually Work', '/Applications/how-recommendation-engines-work.html'],
      ['Modeling an Epidemic', '/Applications/modeling-an-epidemic.html'],
      ['Route Planning Like a GPS App', '/Applications/route-planning-like-gps.html'],
      ['The Bias Hiding in a Hiring Algorithm', '/Applications/bias-in-a-hiring-algorithm.html'],
      ['Keeping a Satellite in Orbit', '/Applications/keeping-a-satellite-in-orbit.html'],
    ],
  },
  {
    label: 'Goals',
    href: '/new.html',
    items: [
      ['Get Ahead in School', '/Goals/get-ahead.html'],
      ['Prepare for College STEM', '/Goals/prepare-for-college.html'],
      ['Become Stronger at Math', '/Goals/stronger-at-math.html'],
      ['Challenge Myself', '/Goals/challenge-myself.html'],
      ['Review & Test Myself', '/Goals/review-and-test.html'],
      ['Describe Your Own Goal', '/new.html#explore'],
      ['My Plan', '/my-plan.html'],
    ],
  },
];

const PROBLEM_SET_CATEGORIES: readonly NavCategory[] = [
  {
    label: 'Timed Mastery',
    href: '/problem-sets.html',
    items: [
      ['Precalculus (Timed)', '/timed-mastery.html?course=precalculus'],
      ['AP Calculus BC (Timed)', '/timed-mastery.html?course=ap-calculus-bc'],
    ],
  },
  {
    label: 'Mathematics',
    href: '/problem-sets.html',
    items: [
      ['Algebra & Geometry Fundamentals Review', '/problem-set.html?course=algebra-geometry'],
      ['Precalculus', '/problem-set.html?course=precalculus'],
      ['AP Calculus BC', '/problem-set.html?course=ap-calculus-bc'],
      ['Multivariable Calculus', '/problem-set.html?course=multivariable-calculus'],
      ['Linear Algebra A', '/problem-set.html?course=linear-algebra-a'],
      ['Differential Equations', '/problem-set.html?course=differential-equations'],
      ['Mathematical Proofs', '/problem-set.html?course=mathematical-proofs'],
      ['Discrete Math', '/problem-set.html?course=discrete-math'],
    ],
  },
  {
    label: 'Technology & Computer Science',
    href: '/problem-sets.html',
    items: [
      ['Computer Programming 1', '/problem-set.html?course=computer-programming-1'],
      ['Computer Programming 2', '/problem-set.html?course=computer-programming-2'],
      ['Data Handling CB', '/problem-set.html?course=data-handling-cb'],
      ['Computer Networking Fundamentals', '/problem-set.html?course=computer-networking-fundamentals'],
      ['Systems Programming & Architecture', '/problem-set.html?course=systems-programming-architecture'],
    ],
  },
  {
    label: 'Science, Engineering & Physics',
    href: '/problem-sets.html',
    items: [
      ['AP Physics 1', '/problem-set.html?course=ap-physics-1'],
      ['AP Physics 2', '/problem-set.html?course=ap-physics-2'],
      ['AP Physics C: Mechanics', '/problem-set.html?course=ap-physics-c-mechanics'],
      ['Quantum Physics & Optics', '/problem-set.html?course=quantum-physics-optics'],
      ['Engineering 1', '/problem-set.html?course=engineering-1'],
    ],
  },
  {
    label: 'Advanced+',
    href: '/problem-sets.html',
    items: [
      ['Real Analysis A', '/problem-set.html?course=real-analysis-a'],
      ['Advanced Algorithms', '/problem-set.html?course=advanced-algorithms'],
    ],
  },
];

const SANDBOX_CATEGORIES: readonly NavCategory[] = [
  {
    label: 'Core Languages',
    href: '/sandbox.html',
    items: [
      ['Python Sandbox', '/python-sandbox.html'],
      ['Java Sandbox', '/java-sandbox.html'],
      ['JavaScript Sandbox', '/javascript-sandbox.html'],
      ['C++ Sandbox', '/cpp-sandbox.html'],
    ],
  },
  {
    label: 'Package Mastery',
    href: '/sandbox.html',
    items: [['Pandas Package Mastery', '/pandas-sandbox.html']],
  },
  {
    label: 'Guided Projects',
    href: '/sandbox.html',
    items: [['Guided Programming Projects', '/python-projects.html']],
  },
];

const SUBJECT_CATEGORIES: readonly NavCategory[] = [
  {
    label: 'Math',
    href: '/math.html',
    items: [
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
    items: [
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
    items: [
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
    items: [
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
    items: [
      ['Real Analysis A', '/Advanced%2B%20Courses/Real%20Analysis%20A/index.html'],
      ['Real Analysis B', '/Advanced%2B%20Courses/Real%20Analysis%20B/index.html'],
      ['Advanced Algorithms', '/Advanced%2B%20Courses/Advanced%20Algorithms/index.html'],
      ['Linear Algebra B', '/Advanced%2B%20Courses/Linear%20Algebra%20B/index.html'],
      ['Topology: Fundamentals', '/Advanced%2B%20Courses/Topology%20Fundamentals/index.html'],
      ['Quantum Computing', '/Advanced%2B%20Courses/Quantum%20Computing/index.html'],
    ],
  },
];

interface NavMenuProps {
  label: string;
  eyebrow: string;
  categories: readonly NavCategory[];
}

// One dropdown per top-level section. All top-level menus share
// name="nav-menu", so opening one closes whichever other was open.
function NavMenu({ label, eyebrow, categories }: NavMenuProps) {
  return (
    <details name="nav-menu" className="group/menu sm:relative">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-1 text-sm whitespace-nowrap text-[var(--site-text)]',
          'hover:text-[var(--site-accent)] [&::-webkit-details-marker]:hidden'
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-open/menu:rotate-180"
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
          {eyebrow}
        </p>
        {categories.map((category) => (
          <details
            key={category.label}
            name={`${label}-category`}
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
                {category.items.length}
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
              {category.items.map(([itemLabel, href]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-md px-2 py-1.5 text-sm text-[var(--site-text)] hover:bg-[var(--site-accent-soft)] hover:text-[var(--site-accent)]"
                >
                  {itemLabel}
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
          <NavMenu label="Subjects" eyebrow="Course categories" categories={SUBJECT_CATEGORIES} />
          <NavMenu label="Tracks" eyebrow="Guided routes" categories={TRACK_CATEGORIES} />
          <NavMenu label="Problem Sets" eyebrow="Practice banks" categories={PROBLEM_SET_CATEGORIES} />
          <NavMenu label="Sandbox" eyebrow="Code practice" categories={SANDBOX_CATEGORIES} />
          <a
            href="/about.html"
            className="text-sm whitespace-nowrap text-[var(--site-text)] hover:text-[var(--site-accent)]"
          >
            About
          </a>
          <AuthStatus />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
