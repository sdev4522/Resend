'use client';

import React from 'react';

interface ProfileHeaderProps {
  title: string;
  description: string;
  badge?: React.ReactNode;
}

export function ProfileHeader({ title, description, badge }: ProfileHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {badge && <div className="self-start sm:self-auto">{badge}</div>}
    </div>
  );
}
