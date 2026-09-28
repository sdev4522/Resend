'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface ProfileDetailField {
  label: string;
  value: string | React.ReactNode;
  icon?: React.ReactNode;
}

interface ProfileDetailsProps {
  title?: string;
  description?: string;
  details: ProfileDetailField[];
}

export function ProfileDetails({
  title = 'Account Information',
  description = 'Verified identity and system metadata from the database',
  details,
}: ProfileDetailsProps) {
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {details.map((field, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border bg-muted/30 flex flex-col space-y-1"
            >
              <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                {field.icon}
                <span>{field.label}</span>
              </dt>
              <dd className="text-sm font-mono font-medium text-foreground break-all">
                {field.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
