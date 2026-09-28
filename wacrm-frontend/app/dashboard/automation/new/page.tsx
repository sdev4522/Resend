'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateAutomationDialog } from '@/components/automation/create-automation-dialog';

export default function NewAutomationPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center p-6">
      <CreateAutomationDialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          router.push('/dashboard/automation');
        }}
      />
    </div>
  );
}
