import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Confirm your email address to finish signing up.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
