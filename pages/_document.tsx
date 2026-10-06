import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Synchronous on purpose: every page script reads window.STEMPlusAccount
            (sign-in state, one /api/me request) and must find it already defined. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/assets/account.js" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
