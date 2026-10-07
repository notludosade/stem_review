import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import searchApi from '../lib/global-search';
import { cn } from '../lib/utils';

export interface SearchSeed {
  type: string;
  title: string;
  href: string;
  context?: string;
  keywords?: readonly string[];
}

interface SearchEntry extends SearchSeed {
  searchText: string;
  label?: string;
  matchTerms?: string[];
  correctedQuery?: string;
  score?: number;
}

interface SkillCatalog {
  skills: unknown[];
  applications: unknown[];
  pathways: unknown[];
  capstones: Record<string, string[]>;
}

const { buildSearchIndex, searchIndex, normalize } = searchApi as {
  buildSearchIndex: (catalog: SkillCatalog, seeds: readonly SearchSeed[]) => SearchEntry[];
  searchIndex: (entries: SearchEntry[], query: string, limit?: number) => SearchEntry[];
  normalize: (value: string) => string;
};

const SUGGESTIONS = ['chain rule', 'satellite', 'python', 'AI engineer'];
const GROUP_ORDER = ['LESSON', 'PRACTICE', 'COURSE', 'SKILL', 'APPLICATION', 'SANDBOX', 'PROJECT', 'CALCULATOR', 'PATHWAY', 'GOAL', 'RELATED', 'PAGE'];

function HighlightedText({ text, terms = [] }: { text: string; terms?: string[] }) {
  const sortedTerms = terms.filter(Boolean).sort((left, right) => right.length - left.length);
  const patterns = sortedTerms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!patterns.length) return text;
  const expression = new RegExp(`(${patterns.join('|')})`, 'gi');
  return <>{text.split(expression).map((part, index) => (
    sortedTerms.some((term) => normalize(part) === normalize(term))
      ? <mark key={`${part}-${index}`} className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-800">{part}</mark>
      : part
  ))}</>;
}

export function GlobalSearch({ seeds }: { seeds: readonly SearchSeed[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const loading = useRef<Promise<void> | null>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState(false);
  const results = useMemo(() => entries ? searchIndex(entries, query, entries.length) : [], [entries, query]);
  const groupedResults = useMemo(() => {
    let index = 0;
    return GROUP_ORDER.map((label) => ({
      label,
      items: results.filter((result) => (result.label || result.type) === label).slice(0, 3).map((result) => ({ result, index: index++ })),
    })).filter((group) => group.items.length > 0);
  }, [results]);
  const displayedResults = groupedResults.flatMap((group) => group.items.map(({ result }) => result));
  const correctedQuery = results.find((result) => result.correctedQuery)?.correctedQuery || '';

  const load = useCallback(() => {
    if (entries || loading.current) return loading.current;
    loading.current = fetch('/assets/skill-catalog.json')
      .then((response) => {
        if (!response.ok) throw new Error('Search catalog unavailable');
        return response.json();
      })
      .then((catalog: SkillCatalog) => setEntries(buildSearchIndex(catalog, seeds)))
      .catch(() => {
        loading.current = null;
        setError(true);
      });
    return loading.current;
  }, [entries, seeds]);

  const open = useCallback(() => {
    setQuery('');
    setActive(0);
    setError(false);
    load();
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    window.requestAnimationFrame(() => input.current?.focus());
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !isTyping)) {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    document.getElementById(`search-result-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!displayedResults.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + displayedResults.length) % displayedResults.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      window.location.assign((displayedResults[active] || displayedResults[0]).href);
    }
  };

  const suggestions = (
    <div className="flex flex-wrap justify-center gap-2 px-3 pb-6">
      {SUGGESTIONS.map((suggestion) => (
        <button key={suggestion} type="button" onClick={() => { setQuery(suggestion); input.current?.focus(); }} className="rounded-full border border-[var(--site-border)] px-3 py-1.5 text-xs text-[var(--site-accent)] hover:bg-[var(--site-accent-soft)]">
          {suggestion}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        onPointerEnter={load}
        onFocus={load}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-[var(--site-border)] px-2.5 py-1.5',
          'text-sm whitespace-nowrap text-[var(--site-muted)] hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]'
        )}
        aria-label="Search STEM+"
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden rounded border border-[var(--site-border)] px-1 text-[10px] lg:inline">⌘K</kbd>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="global-search-title"
        onMouseDown={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        className={cn(
          'm-auto w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-[var(--site-border)]',
          'bg-[var(--site-bg)] p-0 text-[var(--site-text)] shadow-2xl backdrop:bg-black/60'
        )}
      >
        <div className="flex items-center gap-3 border-b border-[var(--site-border)] p-3">
          <Search aria-hidden="true" className="size-5 shrink-0 text-[var(--site-muted)]" />
          <label id="global-search-title" htmlFor="global-search-input" className="sr-only">Search all of STEM+</label>
          <input
            ref={input}
            id="global-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search courses, lessons, skills, practice, and projects…"
            autoComplete="off"
            role="combobox"
            aria-expanded={query.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={displayedResults.length ? `search-result-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-[var(--site-muted)]"
          />
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close search" className="rounded-md p-1 text-[var(--site-muted)] hover:bg-[var(--site-accent-soft)] hover:text-[var(--site-text)]">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div id="global-search-results" role="listbox" className="max-h-[min(65vh,36rem)] overflow-y-auto p-2">
          {!entries && !error && <p className="px-3 py-8 text-center text-sm text-[var(--site-muted)]">Loading the STEM+ catalog…</p>}
          {error && <p className="px-3 py-8 text-center text-sm text-red-500">Search could not load. Close this window and try again.</p>}
          {entries && !query && <><p className="px-3 pt-8 pb-4 text-center text-sm text-[var(--site-muted)]">Search the whole curriculum, or try one of these.</p>{suggestions}</>}
          {entries && query && results.length === 0 && <><p className="px-3 pt-8 pb-4 text-center text-sm text-[var(--site-muted)]">No results for “{query}”. Try a broader search.</p>{suggestions}</>}
          {correctedQuery && <p className="px-3 py-2 text-xs text-[var(--site-muted)]">Showing results for <button type="button" onClick={() => setQuery(correctedQuery)} className="font-semibold text-[var(--site-accent)] hover:underline">{correctedQuery}</button></p>}
          {groupedResults.map((group) => (
            <section key={group.label} aria-labelledby={`search-group-${group.label}`} className="border-t border-[var(--site-border)] first:border-t-0">
              <h3 id={`search-group-${group.label}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-[var(--site-muted)] uppercase">{group.label}</h3>
              {group.items.map(({ result, index }) => (
                <a
                  key={`${result.type}-${result.href}-${result.title}`}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === active}
                  href={result.href}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    'grid gap-0.5 rounded-xl px-3 py-2.5 no-underline',
                    index === active ? 'bg-[var(--site-accent-soft)]' : 'hover:bg-[var(--site-accent-soft)]'
                  )}
                >
                  <span className="font-medium text-[var(--site-text)]"><HighlightedText text={result.title} terms={result.matchTerms} /></span>
                  {result.context && <span className="text-xs text-[var(--site-muted)]"><HighlightedText text={result.context} terms={result.matchTerms} /></span>}
                </a>
              ))}
            </section>
          ))}
        </div>
        <p className="border-t border-[var(--site-border)] px-4 py-2 text-xs text-[var(--site-muted)]">↑↓ choose · Enter open · Esc close · / search anywhere</p>
      </dialog>
    </>
  );
}
