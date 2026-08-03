import { useEffect, useRef } from 'react';

interface ExtractedScript {
  src: string | null;
  content: string | null;
}

interface LegacyContentProps {
  body: string;
  scripts: ExtractedScript[];
}

export function LegacyContent({ body, scripts }: LegacyContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const created: HTMLScriptElement[] = [];
    for (const script of scripts) {
      const el = document.createElement('script');
      if (script.src) {
        el.src = script.src;
        el.defer = true;
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
  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: body }} />;
}
