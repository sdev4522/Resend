import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Start a 14-day free trial of Resend.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
