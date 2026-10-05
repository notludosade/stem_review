import { useEffect } from 'react';
import { runWithDomReadyReplay } from '../lib/scripts';

interface ExtractedScript {
  src: string | null;
  content: string | null;
}

interface LegacyContentProps {
  body: string;
  scripts: ExtractedScript[];
}

export function LegacyContent({ body, scripts }: LegacyContentProps) {
  useEffect(() => {
    const created: HTMLScriptElement[] = [];
    let cancelled = false;

    async function loadScripts() {
      for (const script of scripts) {
        if (cancelled) return;

        const el = document.createElement('script');
        created.push(el);
        if (script.src) {
          el.src = script.src;
          // Dynamically inserted scripts ignore `defer`. Waiting for each
          // load preserves the source order of external and inline scripts.
          await new Promise<void>((resolve) => {
            el.addEventListener('load', () => resolve(), { once: true });
            el.addEventListener('error', () => resolve(), { once: true });
            document.body.appendChild(el);
          });
        } else if (script.content) {
          el.textContent = script.content;
          runWithDomReadyReplay(document, () => document.body.appendChild(el));
        }
      }
    }

    void loadScripts();
    return () => {
      cancelled = true;
      created.forEach((el) => el.remove());
    };
  }, [scripts]);

  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}
