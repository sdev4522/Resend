'use client';

import React from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Cloud, ChevronDown, Check, RefreshCw } from "lucide-react";

export function AccountSelector() {
  const { accounts, selectedAccount, setSelectedAccount, refreshAccounts } = useInbox();

  return (
    <div className="p-3 border-b bg-muted/20">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>Active Connection</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshAccounts()}
          className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label="Refresh WhatsApp connections"
          title="Refresh connections"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between h-10 px-3 bg-background border shadow-2xs hover:bg-muted/40 font-normal"
            />
          }
        >
          <div className="flex items-center gap-2.5 min-w-0 text-left">
            <div className="relative shrink-0">
              {selectedAccount?.type === "qr" ? (
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <QrCode className="h-3.5 w-3.5" />
                </div>
              ) : selectedAccount?.type === "meta" ? (
                <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Cloud className="h-3.5 w-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                  ALL
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${selectedAccount?.isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {selectedAccount?.title || "Select Account"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate leading-tight">
                {selectedAccount?.number || (selectedAccount?.type === "all" ? "All Channels" : "—")}
              </p>
            </div>
          </div>

          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1.5 opacity-60" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[260px] p-1.5 shadow-lg rounded-xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1">
              Switch WhatsApp Line
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </DropdownMenuGroup>

          {accounts.map((acc) => {
            const isSelected = selectedAccount?.id === acc.id;
            return (
              <DropdownMenuItem
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/10 text-primary font-semibold" : ""
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    {acc.type === "qr" ? (
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <QrCode className="h-3.5 w-3.5" />
                      </div>
                    ) : acc.type === "meta" ? (
                      <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
                        <Cloud className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                        ALL
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${acc.isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs truncate">{acc.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {acc.number || (acc.type === "all" ? "Unified feed" : "Disconnected")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 font-mono">
                    {acc.type === "qr" ? "QR" : acc.type === "meta" ? "META" : "ALL"}
                  </Badge>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
