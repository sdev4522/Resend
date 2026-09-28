'use client';

import React from 'react';
import { DeveloperConnection } from '@/types/developer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, QrCode, Cloud, Radio } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionsCardProps {
  connections: DeveloperConnection[];
}

export function ConnectionsCard({ connections }: ConnectionsCardProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Connection ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">WhatsApp Connections</h3>
        <p className="text-xs text-muted-foreground">
          Public opaque identifiers (<code>wa_...</code>) for routing API messages to specific WhatsApp numbers.
        </p>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="h-36 flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-sm">
            <Radio className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="font-medium">No WhatsApp accounts connected yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect a WhatsApp number via Baileys QR code or Meta Cloud API to begin sending messages.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {connections.map((conn) => {
            const isConnected = conn.status === 'connected';
            const isQR = conn.provider === 'qr';

            return (
              <Card key={conn.id} className="relative overflow-hidden border bg-card/60 shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {isQR ? <QrCode className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{conn.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">
                          +{conn.phone_number || 'Not verified'}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={
                          isConnected
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]'
                        }
                      >
                        <span
                          className={`mr-1 h-1.5 w-1.5 rounded-full ${
                            isConnected ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {conn.provider}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs p-2 bg-muted/60 rounded-md border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Public Connection ID
                      </span>
                      <code className="font-mono text-xs font-semibold text-foreground select-all">
                        {conn.id}
                      </code>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(conn.id)}
                    >
                      {copiedId === conn.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {isQR ? (
                      <span>Supports standard messaging (Text, Media, Docs). Meta templates not supported.</span>
                    ) : (
                      <span>Supports standard messaging and Meta WhatsApp approved templates.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
