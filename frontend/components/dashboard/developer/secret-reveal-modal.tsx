'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, Copy, ShieldAlert, Key } from 'lucide-react';
import { toast } from 'sonner';

interface SecretRevealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyName: string;
  secret: string;
}

export function SecretRevealModal({
  open,
  onOpenChange,
  keyName,
  secret,
}: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Key className="h-5 w-5" />
            <DialogTitle>Save your API key</DialogTitle>
          </div>
          <DialogDescription>
            Here is your new API key for <strong>{keyName}</strong>. Store it securely.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="my-2 border-warning/50 bg-warning/10 text-warning">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning font-semibold">
            This key will only be shown once
          </AlertTitle>
          <AlertDescription className="text-xs text-warning dark:text-warning/90 leading-relaxed">
            For security reasons, we do not store the full plaintext secret in our database.
            If you lose this key, you will need to revoke it and generate a new one.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 mt-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            API secret key
          </label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-xs break-all select-all border border-border">
            <span className="flex-1 font-semibold">{secret}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="shrink-0 gap-1.5 h-8"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            I have saved this key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
