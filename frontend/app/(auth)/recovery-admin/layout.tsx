import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin password recovery',
  description: 'Reset the administrator password.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
