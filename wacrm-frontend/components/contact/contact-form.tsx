'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2, Send, RefreshCw } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/tracker';

const INQUIRY_REASONS = [
  { value: 'Sales', label: 'Sales & Enterprise Plans' },
  { value: 'Support', label: 'Technical & Platform Support' },
  { value: 'Billing', label: 'Billing & Invoicing' },
  { value: 'Partnership', label: 'Partnership & Reseller' },
  { value: 'General', label: 'General Inquiry' },
];

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    mobile: '',
    subject: '',
    reason: 'Sales',
    content: '',
  });

  // CAPTCHA State (Spam Protection)
  const [captchaNum1, setCaptchaNum1] = useState(4);
  const [captchaNum2, setCaptchaNum2] = useState(7);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 9) + 2;
    const n2 = Math.floor(Math.random() * 8) + 1;
    setCaptchaNum1(n1);
    setCaptchaNum2(n2);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Please enter your full name';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Name should be under 100 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Please enter your work email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      errors.subject = 'Please provide a subject for your inquiry';
    }

    if (!formData.content.trim()) {
      errors.content = 'Please describe your inquiry or project requirements';
    } else if (formData.content.trim().length < 10) {
      errors.content = 'Inquiry details should be at least 10 characters long';
    } else if (formData.content.trim().length > 5000) {
      errors.content = 'Message cannot exceed 5,000 characters';
    }

    const expectedCaptcha = captchaNum1 + captchaNum2;
    if (!captchaAnswer.trim()) {
      errors.captcha = 'Please solve the anti-spam challenge';
    } else if (parseInt(captchaAnswer.trim(), 10) !== expectedCaptcha) {
      errors.captcha = 'Incorrect answer, please try again';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setIsRateLimited(false);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    trackEvent('contact_submit_attempt');

    try {
      const captchaQuestion = `${captchaNum1} + ${captchaNum2}`;

      const res = await fetch('/api/proxy/web/submit_contact_form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
          mobile: formData.mobile.trim(),
          subject: formData.subject.trim(),
          reason: formData.reason,
          content: formData.content.trim(),
          captchaQuestion,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 429) {
        setIsRateLimited(true);
        setServerError('Too many submissions from this connection. Please wait a minute and try again.');
        setIsSubmitting(false);
        return;
      }

      if (!res.ok || !data?.success) {
        trackEvent('contact_submit_fail');
        setServerError(data?.msg || 'Could not submit your inquiry. Please try again.');
        generateCaptcha();
        setIsSubmitting(false);
        return;
      }

      trackEvent('contact_submit_success');
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      setServerError('A network error occurred. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-card/60 p-8 sm:p-10 text-center space-y-4 shadow-sm animate-in fade-in duration-300">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold tracking-tight text-foreground">
          Thanks — your message has been received.
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          We&apos;ll get back to you as soon as possible. In the meantime, you can explore documentation or sign in to your workspace.
        </p>
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsSubmitted(false);
              setFormData({
                name: '',
                email: '',
                company: '',
                mobile: '',
                subject: '',
                reason: 'Sales',
                content: '',
              });
              generateCaptcha();
            }}
          >
            Send Another Inquiry
          </Button>
          <Button size="sm" render={<Link href="/dashboard" />}>
            Go to Workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${isRateLimited ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Name & Email Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs font-medium">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
            }}
            disabled={isSubmitting}
            className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {fieldErrors.name && (
            <p className="text-[11px] text-destructive mt-1">{fieldErrors.name}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs font-medium">
            Work Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
            }}
            disabled={isSubmitting}
            className={fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {fieldErrors.email && (
            <p className="text-[11px] text-destructive mt-1">{fieldErrors.email}</p>
          )}
        </div>
      </div>

      {/* Company & Phone Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-company" className="text-xs font-medium">
            Company / Workspace <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
          </Label>
          <Input
            id="contact-company"
            placeholder="Acme Corp"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-mobile" className="text-xs font-medium">
            WhatsApp / Phone <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
          </Label>
          <Input
            id="contact-mobile"
            type="tel"
            placeholder="+1 555 123 4567"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Reason & Subject Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-reason" className="text-xs font-medium">
            Inquiry Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.reason}
            onValueChange={(val) => {
              if (val) setFormData({ ...formData, reason: val });
            }}
            disabled={isSubmitting}
          >
            <SelectTrigger id="contact-reason" className="text-sm">
              <SelectValue placeholder="Select Reason" />
            </SelectTrigger>
            <SelectContent>
              {INQUIRY_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-subject" className="text-xs font-medium">
            Subject <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-subject"
            placeholder="e.g. Scaling multi-agent WhatsApp seats"
            value={formData.subject}
            onChange={(e) => {
              setFormData({ ...formData, subject: e.target.value });
              if (fieldErrors.subject) setFieldErrors({ ...fieldErrors, subject: '' });
            }}
            disabled={isSubmitting}
            className={fieldErrors.subject ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {fieldErrors.subject && (
            <p className="text-[11px] text-destructive mt-1">{fieldErrors.subject}</p>
          )}
        </div>
      </div>

      {/* Message Body */}
      <div className="space-y-1.5">
        <Label htmlFor="contact-content" className="text-xs font-medium">
          Detailed Message <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="contact-content"
          placeholder="Please describe your use case, estimated message volume, or any specific requirements..."
          rows={5}
          value={formData.content}
          onChange={(e) => {
            setFormData({ ...formData, content: e.target.value });
            if (fieldErrors.content) setFieldErrors({ ...fieldErrors, content: '' });
          }}
          disabled={isSubmitting}
          className={`resize-none ${fieldErrors.content ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {fieldErrors.content && (
          <p className="text-[11px] text-destructive mt-1">{fieldErrors.content}</p>
        )}
      </div>

      {/* Anti-Spam Challenge */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="contact-captcha" className="text-xs font-medium text-foreground">
            Spam Verification: What is {captchaNum1} + {captchaNum2}?
          </Label>
          <button
            type="button"
            onClick={generateCaptcha}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> New challenge
          </button>
        </div>
        <Input
          id="contact-captcha"
          type="number"
          placeholder="Enter numeric answer"
          value={captchaAnswer}
          onChange={(e) => {
            setCaptchaAnswer(e.target.value);
            if (fieldErrors.captcha) setFieldErrors({ ...fieldErrors, captcha: '' });
          }}
          disabled={isSubmitting}
          className={`h-9 w-44 ${fieldErrors.captcha ? 'border-destructive' : ''}`}
        />
        {fieldErrors.captcha && (
          <p className="text-[11px] text-destructive mt-1">{fieldErrors.captcha}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl h-11 text-sm font-semibold gap-2 shadow-xs cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending Message...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send Message
          </>
        )}
      </Button>

      <p className="text-[11px] text-center text-muted-foreground">
        Protected by rate limiting &amp; challenge verification. We respect your privacy.
      </p>
    </form>
  );
}
