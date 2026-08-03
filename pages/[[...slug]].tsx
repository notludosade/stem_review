import fs from 'fs';
import path from 'path';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { Layout } from '../components/Layout';
import { LegacyContent } from '../components/LegacyContent';
import { splitHtmlFragment } from '../lib/content';
import { extractScripts } from '../lib/scripts';

const CONTENT_DIR = path.join(process.cwd(), 'content');

interface ExtractedScript {
  src: string | null;
  content: string | null;
}

interface PageProps {
  title: string;
  body: string;
  scripts: ExtractedScript[];
}

export default function CatchAllPage({ title, body, scripts }: PageProps) {
  return (
    <Layout title={title}>
      <LegacyContent body={body} scripts={scripts} />
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.html'));
  const paths = files.map((file) => {
    const slug = file === 'index.html' ? [] : [file];
    return { params: { slug } };
  });
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<PageProps> = async ({ params }) => {
  const slugParts = (params?.slug as string[] | undefined) || [];
  const fileName = slugParts.length === 0 ? 'index.html' : slugParts.join('/');
  const filePath = path.join(CONTENT_DIR, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const { title, body } = splitHtmlFragment(html);
  // extractScripts must run on the full `html`, never on `body` alone: 11 of
  // the 23 real content files have their <script> tags in the head, before
  // the first <div>, which `body` excludes by design.
  //
  // The shell's own Layout/AuthStatus (Task 5) now owns sign-in/sign-out UI
  // for every page rendered through this route. Legacy pages carry their own
  // <span class="auth-slot"> populated by assets/auth.js — re-executing that
  // script here would duplicate the shell's auth UI on-page. The empty
  // .auth-slot markup itself is harmless (invisible, unpopulated) and is left
  // alone; only the script that would populate it is filtered out.
  const scripts = extractScripts(html).filter((script) => script.src !== 'assets/auth.js');
  return { props: { title, body, scripts } };
};
