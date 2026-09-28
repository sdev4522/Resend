'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserNav } from '@/components/shared/user-nav';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { Menu, MessageSquareQuote } from 'lucide-react';

export function MarketingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const { openLogin, openRegister } = useAuthDialog();
  const [sheetOpen, setSheetOpen] = useState(false);

  const destinationDashboard = user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <nav className="fixed z-50 top-6 inset-x-4 h-14 xs:h-16 bg-background/80 backdrop-blur-sm border max-w-screen-xl mx-auto rounded-full transition-all">
      <div className="h-full flex items-center justify-between mx-auto px-4 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MessageSquareQuote className="h-4 w-4" />
          </div>
          <span>WaCRM</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
          <Link href="/#faq" className="hover:text-foreground transition-colors">
            FAQ
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Button
                render={<Link href={destinationDashboard} />}
                variant="outline"
                className="rounded-full h-9 px-4 text-sm font-medium"
              >
                Dashboard
              </Button>
              <UserNav />
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={openLogin}
                className="hidden sm:inline-flex rounded-full h-9 px-4 text-sm font-medium"
              >
                Sign In
              </Button>
              <Button
                onClick={openRegister}
                className="hidden xs:inline-flex rounded-full h-9 px-4 text-sm font-medium"
              >
                Get Started
              </Button>
            </>
          )}

          {/* Mobile Navigation Sheet */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" className="rounded-full h-9 w-9" />}>
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="flex items-center gap-2 font-bold text-lg">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                  </div>
                  <span>WaCRM</span>
                </SheetTitle>

                <div className="mt-8 flex flex-col gap-4 text-base font-medium">
                  <Link
                    href="/features"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Features
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Contact
                  </Link>
                  <Link
                    href="/#faq"
                    onClick={() => setSheetOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    FAQ
                  </Link>
                </div>

                <div className="mt-8 pt-6 border-t flex flex-col gap-3">
                  {isAuthenticated ? (
                    <Button
                      render={<Link href={destinationDashboard} onClick={() => setSheetOpen(false)} />}
                      className="w-full rounded-full"
                    >
                      Go to Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        onClick={() => {
                          setSheetOpen(false);
                          openLogin();
                        }}
                      >
                        Sign In
                      </Button>
                      <Button
                        className="w-full rounded-full"
                        onClick={() => {
                          setSheetOpen(false);
                          openRegister();
                        }}
                      >
                        Get Started
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
