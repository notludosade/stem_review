import { NextRequest, NextResponse } from 'next/server';
const { verify } = require('./lib/session');

// Proxy (formerly "middleware") always runs on the Node.js runtime, so
// lib/session.js's use of Node's `crypto` (createHmac/timingSafeEqual)
// works here without modification.
//
// Every /api/* route is excluded here and does its own session check
// instead (see pages/api/me.js, pages/api/grade-frq.js): an API route
// redirected to /login.html by this proxy would hand its client-side
// `fetch().then(r => r.json())` caller an HTML page instead of JSON,
// breaking cleanly on a parse error rather than surfacing "sign in".
export const config = {
  matcher: ['/((?!_next/|assets/|favicon\\.ico|api/).*)'],
};

// Default-deny: only these paths (and anything under them) are reachable
// without an account. Everything else redirects to /login.html. Kept as an
// allowlist rather than a list of gated paths so a forgotten new page fails
// closed (gated) instead of open (accidentally free).
const FREE_PATHS = [
  '/new.html',
  '/login.html',
  '/math.html',
  '/science.html',
  '/technology.html',
  '/engineering.html',
  '/advanced.html',
  // Goal landing pages that only route into free math content, or that are
  // the same "browse the catalog" framing as advanced.html above — kept
  // free for the same reason those are. Goals/prepare-for-college.html and
  // Goals/review-and-test.html deliberately stay OFF this list: they mirror
  // pathways.html and problem-sets.html, both gated.
  '/Goals/get-ahead.html',
  '/Goals/stronger-at-math.html',
  '/Goals/challenge-myself.html',
  '/Algebra Geometry Fundamentals Review',
  '/Precalculus',
  '/Discrete Math',
  '/Mathematical Proofs',
  '/AP STEM+',
  '/Linear Algebra A',
  '/Multivariable Calculus',
  '/Differential Equations',
];

function isFree(pathname: string): boolean {
  if (pathname === '/') return true;
  return FREE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function proxy(req: NextRequest) {
  const pathname = decodeURIComponent(req.nextUrl.pathname);
  if (isFree(pathname)) return NextResponse.next();

  const session = verify(req.cookies.get('session')?.value, process.env.SESSION_SECRET);
  if (session) return NextResponse.next();

  const loginUrl = new URL('/login.html', req.url);
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
