'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { cn } from '@/lib/utils';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function MarketingCTABanner() {
  const { openRegister, openLogin } = useAuthDialog();

  return (
    <div className="px-6">
      <div className="dark:border relative overflow-hidden my-16 w-full dark bg-background text-foreground max-w-screen-lg mx-auto rounded-2xl py-10 md:py-16 px-6 md:px-14 border">
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          className={cn(
            '[mask-image:radial-gradient(400px_circle_at_right,white,rgba(255,255,255,0.6),transparent)]',
            'inset-x-0 inset-y-[-30%] h-[200%] skew-y-12'
          )}
        />
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          className={cn(
            '[mask-image:radial-gradient(400px_circle_at_top_left,white,rgba(255,255,255,0.6),transparent)]',
            'inset-x-0 inset-y-0 h-[200%] skew-y-12'
          )}
        />
        <div className="relative z-0 flex flex-col gap-3">
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to Scale Your Customer Conversations?
          </h3>
          <p className="mt-2 text-base md:text-lg text-muted-foreground max-w-xl">
            Streamline customer support, broadcast marketing, and conversational automation on WhatsApp.
          </p>
        </div>
        <div className="relative z-0 mt-10 flex flex-col sm:flex-row gap-4">
          <Button size="lg" className="rounded-full h-11 px-8 cursor-pointer" onClick={openRegister}>
            Get Started <ArrowUpRight className="ml-1.5 !h-4 !w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-11 px-8 cursor-pointer"
            onClick={openLogin}
          >
            Sign In to Existing Account
          </Button>
        </div>
      </div>
    </div>
  );
}
