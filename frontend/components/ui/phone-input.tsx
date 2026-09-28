'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CountryCode {
  country: string;
  code: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: CountryCode[] = [
  { country: 'India', code: '+91', flag: '🇮🇳', placeholder: '98765 43210' },
  { country: 'United States', code: '+1', flag: '🇺🇸', placeholder: '202 555 0123' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
  { country: 'United Arab Emirates', code: '+971', flag: '🇦🇪', placeholder: '50 123 4567' },
  { country: 'Singapore', code: '+65', flag: '🇸🇬', placeholder: '8123 4567' },
  { country: 'Australia', code: '+61', flag: '🇦🇺', placeholder: '412 345 678' },
  { country: 'Canada', code: '+1', flag: '🇨🇦', placeholder: '416 555 0199' },
  { country: 'Germany', code: '+49', flag: '🇩🇪', placeholder: '151 12345678' },
  { country: 'Saudi Arabia', code: '+966', flag: '🇸🇦', placeholder: '50 123 4567' },
  { country: 'Malaysia', code: '+60', flag: '🇲🇾', placeholder: '12 345 6789' },
  { country: 'Indonesia', code: '+62', flag: '🇮🇩', placeholder: '812 3456 7890' },
  { country: 'Brazil', code: '+55', flag: '🇧🇷', placeholder: '11 91234 5678' },
  { country: 'South Africa', code: '+27', flag: '🇿🇦', placeholder: '71 123 4567' },
  { country: 'Nigeria', code: '+234', flag: '🇳🇬', placeholder: '802 123 4567' },
];

interface PhoneInputProps {
  id?: string;
  label?: string;
  value?: string;
  onChange: (normalizedPhone: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Parses an existing normalized phone number (e.g. +919876543210) into calling code and subscriber digits
 */
function parsePhoneNumber(phone: string): { code: string; digits: string } {
  if (!phone) return { code: '+91', digits: '' };

  const trimmed = phone.trim();
  // Find matching country code from longest to shortest
  const sorted = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (trimmed.startsWith(c.code)) {
      return {
        code: c.code,
        digits: trimmed.slice(c.code.length).replace(/\D/g, ''),
      };
    }
  }

  // Fallback if starts with +
  if (trimmed.startsWith('+')) {
    const match = trimmed.match(/^(\+\d{1,4})(.*)$/);
    if (match) {
      return { code: match[1], digits: match[2].replace(/\D/g, '') };
    }
  }

  return { code: '+91', digits: trimmed.replace(/\D/g, '') };
}

export function PhoneInput({
  id = 'phone',
  label = 'Phone Number (WhatsApp)',
  value = '',
  onChange,
  disabled = false,
  required = false,
  error,
  className = '',
}: PhoneInputProps) {
  const initial = parsePhoneNumber(value);
  const [selectedCode, setSelectedCode] = useState<string>(initial.code || '+91');
  const [phoneNumber, setPhoneNumber] = useState<string>(initial.digits);

  // Synchronize internal state when value prop changes externally
  useEffect(() => {
    if (value) {
      const parsed = parsePhoneNumber(value);
      setSelectedCode(parsed.code);
      setPhoneNumber(parsed.digits);
    }
  }, [value]);

  const activeCountry = COUNTRIES.find((c) => c.code === selectedCode) || COUNTRIES[0];

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    setSelectedCode(newCode);
    const normalized = phoneNumber ? `${newCode}${phoneNumber}` : '';
    onChange(normalized);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric digits
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPhoneNumber(digitsOnly);
    const normalized = digitsOnly ? `${selectedCode}${digitsOnly}` : '';
    onChange(normalized);
  };

  return (
    <div className={`space-y-1.5 text-start ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-xs font-semibold">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      <div className="flex rounded-md shadow-xs border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden bg-background">
        {/* Country Code Selector */}
        <div className="relative shrink-0 border-r border-input bg-muted/30">
          <select
            id={`${id}-country`}
            value={selectedCode}
            onChange={handleCountryChange}
            disabled={disabled}
            className="h-10 pl-2.5 pr-6 text-xs font-medium bg-transparent appearance-none cursor-pointer focus:outline-none disabled:opacity-50"
            aria-label="Country calling code"
          >
            {COUNTRIES.map((c) => (
              <option key={`${c.country}-${c.code}`} value={c.code}>
                {c.flag} {c.code} ({c.country})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-muted-foreground text-[10px]">
            ▼
          </div>
        </div>

        {/* Subscriber Phone Digits Input */}
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={activeCountry.placeholder}
          required={required}
          value={phoneNumber}
          onChange={handlePhoneChange}
          disabled={disabled}
          className="h-10 border-0 rounded-none focus-visible:ring-0 text-sm shadow-none"
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export default PhoneInput;
