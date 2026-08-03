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
  const scripts = extractScripts(html);
  return { props: { title, body, scripts } };
};
