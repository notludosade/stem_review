import { useEffect } from 'react';

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
    for (const script of scripts) {
      const el = document.createElement('script');
      if (script.src) {
        el.src = script.src;
        // `defer` is meaningless on a script inserted this way — the defer
        // attribute only affects parser-inserted <script> tags. Scripts
        // created via document.createElement default to async=true, which
        // executes in network-completion order rather than document order.
        // Phase B's pages depend on document order (data files before the
        // logic that reads them, etc.) — async=false restores that.
        el.async = false;
      } else if (script.content) {
        el.textContent = script.content;
      }
      document.body.appendChild(el);
      created.push(el);
    }
    return () => {
      created.forEach((el) => el.remove());
    };
  }, [scripts]);

  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}
