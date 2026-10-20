"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserNav } from "@/components/shared/user-nav";
import { useAuth } from "@/lib/auth/auth-context";
import { useAuthDialog } from "@/components/auth/auth-dialog-context";
import { Menu, MessageSquareQuote, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Comparison", id: "comparison" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
].map((l) => ({ ...l, href: `/#${l.id}` }));

const SCROLL_ON = 60; // isse neeche scroll -> floating glass pill
const SCROLL_OFF = 20; // isse upar aate hi -> full width (hysteresis: flicker nahi)

export function Navigation5() {
  const { isAuthenticated, user } = useAuth();
  const { openLogin, openRegister } = useAuthDialog();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const destinationDashboard = user?.role === "admin" ? "/admin" : "/dashboard";

  /* ---------- Scroll state ---------- */
  const { scrollY } = useScroll();

  useEffect(() => {
    setScrolled(window.scrollY > SCROLL_ON);
  }, []);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (y > SCROLL_ON) setScrolled(true);
    else if (y < SCROLL_OFF) setScrolled(false);
    if (y < 120) setActiveHref(null);
  });

  /* ---------- Scroll-spy (sirf home page par) ---------- */
  useEffect(() => {
    if (pathname !== "/") {
      setActiveHref(null);
      return;
    }
    const els = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveHref(`/#${e.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  const transition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 220, damping: 28, mass: 0.9 } as const);

  const pillTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 380, damping: 32 } as const);

  const highlighted = hoveredHref ?? activeHref;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{
        y: 0,
        opacity: 1,
        paddingTop: scrolled ? 12 : 0,
        paddingLeft: scrolled ? 12 : 0,
        paddingRight: scrolled ? 12 : 0,
      }}
      transition={transition}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
    >
      {/* Bar: full width -> floating glass pill */}
      <motion.div
        initial={false}
        animate={{
          width: scrolled ? 1000 : "100%",
          height: scrolled ? 60 : 68,
          borderRadius: scrolled ? 32 : 0,
          borderTopWidth: scrolled ? 1 : 0,
          borderLeftWidth: scrolled ? 1 : 0,
          borderRightWidth: scrolled ? 1 : 0,
          boxShadow: scrolled
            ? "0 12px 32px -12px rgba(0,0,0,0.30), inset 0 1px 0 0 rgba(255,255,255,0.18)"
            : "0 0 0 0 rgba(0,0,0,0), inset 0 1px 0 0 rgba(255,255,255,0)",
        }}
        transition={transition}
        style={{ maxWidth: "100%" }}
        className="pointer-events-auto relative isolate border-border/50"
      >
        {/* Glass layers */}
        <div
          aria-hidden
          className={`${scrolled ? "bg-background/60 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/50" : "bg-transparent"} absolute inset-0 -z-10 rounded-[inherit]`}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-gradient-to-b from-foreground/[0.05] to-transparent"
        />

        <motion.div
          initial={false}
          animate={{
            paddingLeft: scrolled ? 14 : 24,
            paddingRight: scrolled ? 10 : 24,
          }}
          transition={transition}
          className="mx-auto flex h-full w-full max-w-[1300px] items-center justify-between gap-3"
        >
          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
              <MessageSquareQuote className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Resend
            </span>
          </Link>

          {/* Desktop links (lg+) */}
          <nav
            aria-label="Main"
            onMouseLeave={() => setHoveredHref(null)}
            className="hidden items-center gap-0.5 lg:flex"
          >
            {NAV_LINKS.map((link) => {
              const isHighlighted = highlighted === link.href;
              const isActive = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredHref(link.href)}
                  onFocus={() => setHoveredHref(link.href)}
                  onBlur={() => setHoveredHref(null)}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "relative isolate rounded-full px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isHighlighted
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {isHighlighted && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={pillTransition}
                      className="absolute inset-0 -z-10 rounded-full bg-foreground/[0.07] ring-1 ring-inset ring-foreground/[0.06]"
                    />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {isAuthenticated ? (
              <>
                <Button
                  render={<Link href={destinationDashboard} />}
                  variant="outline"
                  size="sm"
                  className="hidden h-9 rounded-full px-4 text-xs font-semibold sm:inline-flex"
                >
                  Dashboard
                </Button>
                <UserNav />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openLogin}
                  className="hidden h-9 cursor-pointer rounded-full px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={openRegister}
                  className="group h-9 cursor-pointer rounded-full px-4 text-xs font-semibold shadow-xs transition-transform active:scale-[0.97]"
                >
                  <span className="hidden sm:inline">Start Free Trial</span>
                  <span className="sm:hidden">Trial</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Button>
              </>
            )}

            {/* Mobile / tablet menu */}
            <div className="lg:hidden">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open menu"
                      className="h-10 w-10 rounded-full"
                    />
                  }
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>

                <SheetContent
                  side="right"
                  className="flex w-[88%] max-w-sm flex-col gap-0 border-l border-border/50 bg-background/80 p-0 backdrop-blur-xl"
                >
                  <div className="p-6 pb-3">
                    <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <MessageSquareQuote className="h-4 w-4" />
                      </div>
                      <span>Resend</span>
                    </SheetTitle>
                  </div>

                  <nav
                    aria-label="Mobile"
                    className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
                  >
                    {NAV_LINKS.map((link, i) => {
                      const isActive = activeHref === link.href;
                      return (
                        <motion.div
                          key={link.href}
                          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: reduceMotion ? 0 : 0.06 + i * 0.05,
                            type: "spring",
                            stiffness: 300,
                            damping: 28,
                          }}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setSheetOpen(false)}
                            aria-current={isActive ? "location" : undefined}
                            className={cn(
                              "flex h-12 items-center justify-between rounded-xl px-4 text-base font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                              isActive
                                ? "bg-accent text-foreground"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                            )}
                          >
                            {link.label}
                            <ArrowRight className="h-4 w-4 opacity-40" />
                          </Link>
                        </motion.div>
                      );
                    })}
                  </nav>

                  <div className="flex flex-col gap-3 border-t border-border/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Appearance
                      </span>
                      <ThemeToggle />
                    </div>

                    {isAuthenticated ? (
                      <Button
                        render={<Link href={destinationDashboard} />}
                        className="h-11 w-full rounded-xl"
                        onClick={() => setSheetOpen(false)}
                      >
                        Go to Dashboard
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="h-11 w-full cursor-pointer rounded-xl"
                          onClick={() => {
                            setSheetOpen(false);
                            openLogin();
                          }}
                        >
                          Sign In
                        </Button>
                        <Button
                          className="h-11 w-full cursor-pointer rounded-xl"
                          onClick={() => {
                            setSheetOpen(false);
                            openRegister();
                          }}
                        >
                          Start Free Trial
                        </Button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.header>
  );
}

// Drop-in replacement: purane `MarketingNavbar` imports bhi chalenge
export { Navigation5 as MarketingNavbar };