'use client';

import React from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#09090b', color: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center', background: '#18181b', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272a' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem' }}>Application Error</h1>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            A critical error occurred. Please refresh the browser window or return to the homepage.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{ background: '#25D366', color: '#09090b', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '9999px', fontWeight: '600', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <Link
              href="/"
              style={{ background: 'transparent', color: '#f4f4f5', border: '1px solid #3f3f46', padding: '0.625rem 1.25rem', borderRadius: '9999px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
            >
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
