import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create your Resend account and claim a free trial.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
