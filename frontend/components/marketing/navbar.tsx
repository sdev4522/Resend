'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserNav } from '@/components/shared/user-nav';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { Menu, MessageSquareQuote, ArrowRight } from 'lucide-react';

export function MarketingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const { openLogin, openRegister } = useAuthDialog();
  const [sheetOpen, setSheetOpen] = useState(false);

  const destinationDashboard = user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40  backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-foreground text-lg transition-opacity hover:opacity-90"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <MessageSquareQuote className="h-4.5 w-4.5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Resend</span>
        </Link>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link
            href="/#features"
            className="hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/#comparison"
            className="hover:text-foreground transition-colors"
          >
            Comparison
          </Link>
          <Link
            href="/#pricing"
            className="hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/#faq"
            className="hover:text-foreground transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Button
                render={<Link href={destinationDashboard} />}
                variant="outline"
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-lg"
              >
                Dashboard
              </Button>
              <UserNav />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={openLogin}
                className="hidden sm:inline-flex h-9 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={openRegister}
                className="h-9 px-4 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Get Started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Mobile Navigation Sheet */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" />}>
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="flex items-center gap-2 font-bold text-lg">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                  </div>
                  <span>Resend</span>
                </SheetTitle>

                <div className="mt-8 flex flex-col gap-4 text-sm font-medium">
                  <Link
                    href="/#features"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Features
                  </Link>
                  <Link
                    href="/#how-it-works"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    How It Works
                  </Link>
                  <Link
                    href="/#comparison"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Comparison
                  </Link>
                  <Link
                    href="/#pricing"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/#faq"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    FAQ
                  </Link>

                  <div className="mt-6 pt-6 border-t flex flex-col gap-2.5">
                    {isAuthenticated ? (
                      <Button
                        render={<Link href={destinationDashboard} />}
                        className="w-full rounded-lg"
                        onClick={() => setSheetOpen(false)}
                      >
                        Go to Dashboard
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="w-full rounded-lg"
                          onClick={() => {
                            setSheetOpen(false);
                            openLogin();
                          }}
                        >
                          Sign In
                        </Button>
                        <Button
                          className="w-full rounded-lg"
                          onClick={() => {
                            setSheetOpen(false);
                            openRegister();
                          }}
                        >
                          Get Started Free
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
