import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Landing - Generated Experience',
    description: 'Generated with the UI Motion Builder',
}

export default function LandingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="scroll-smooth">
            <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
                <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                        <Link href="/" className="text-base font-semibold tracking-tight">
                            Landing
                        </Link>
                        <nav className="flex items-center gap-6">
                            <Link
                                href="/"
                                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Landing
                            </Link>
                        </nav>
                    </div>
                </header>
                <main className="flex-1">
                    {children}
                </main>
                <footer className="border-t border-border bg-muted/40">
                    <div className="container mx-auto flex flex-col gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
                        <span>&copy; 2026 Landing. All rights reserved.</span>
                        <nav className="flex flex-wrap items-center gap-4">
                            <Link
                                href="/"
                                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Landing
                            </Link>
                        </nav>
                    </div>
                </footer>
            </body>
        </html>
    )
}
