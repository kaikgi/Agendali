import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string) => void;
}

// Format phone number to Brazilian format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 11 digits (DDD + 9 digits)
  const limited = digits.slice(0, 11);
  
  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  // 11 digits - mobile with 9
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

// Extract only digits from formatted phone
function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => 
      formatPhoneNumber(String(value || ''))
    );

    // Update display when external value changes
    React.useEffect(() => {
      if (value !== undefined) {
        setDisplayValue(formatPhoneNumber(String(value)));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      setDisplayValue(formatted);
      
      // Return only digits to the form
      const digits = extractDigits(formatted);
      onChange?.(digits);
    };

    return (
      <input
        type="tel"
        inputMode="numeric"
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput, formatPhoneNumber, extractDigits };
