'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrency } from '@/lib/currency/currency-context';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CurrencySwitcher() {
  const { selectedCurrency, currencySymbol, supportedCurrencies, setCurrency } = useCurrency();
  const activeCurrencies = supportedCurrencies.filter((c) => c.enabled !== false);

  if (activeCurrencies.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-mono font-bold rounded-full border-muted-foreground/20 hover:border-primary/50 transition-colors shadow-2xs"
          />
        }
      >
        <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>
          {currencySymbol} {selectedCurrency}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Select Currency
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
        </DropdownMenuGroup>
        {activeCurrencies.map((c) => {
          const isSelected = selectedCurrency.toUpperCase() === c.code.toUpperCase();
          return (
            <DropdownMenuItem
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className="flex items-center justify-between py-1.5 px-2 text-xs cursor-pointer rounded-lg font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground w-4 text-center">{c.symbol}</span>
                <span className="font-semibold">{c.code}</span>
                <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[80px]">
                  ({c.name || c.code})
                </span>
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
