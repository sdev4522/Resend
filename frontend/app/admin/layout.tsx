import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Resend Admin Console',
    template: '%s | Resend Admin',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
