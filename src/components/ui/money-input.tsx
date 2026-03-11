import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'prefix'> {
  /** Value in the unit (reais, not cents). null = empty */
  value: number | null | undefined;
  /** Called with the numeric value (reais) or null when empty */
  onChange: (value: number | null) => void;
  /** Show R$ prefix */
  prefix?: boolean;
  /** "percentage" mode: integer 0-100. Default: "currency" */
  mode?: 'currency' | 'percentage';
}

/**
 * Monetary / percentage input that lets the user freely type, erase,
 * and edit without fighting with forced-zero behaviour.
 */
const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, prefix = false, mode = 'currency', className, ...props }, ref) => {
    // Internal string state so the user can type freely
    const [display, setDisplay] = React.useState(() => formatInitial(value, mode));

    // Sync display when external value changes (e.g. form reset)
    React.useEffect(() => {
      const expected = formatInitial(value, mode);
      // Only update if the numeric meaning changed (avoid cursor jump while typing)
      const currentNumeric = parseDisplay(display, mode);
      if (currentNumeric !== value && !(currentNumeric === null && (value === null || value === undefined || value === 0))) {
        setDisplay(expected);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Allow only digits, comma, dot, and minus
      raw = raw.replace(/[^0-9.,-]/g, '');

      setDisplay(raw);

      // Parse to number
      const parsed = parseDisplay(raw, mode);
      onChange(parsed);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, format nicely
      const parsed = parseDisplay(display, mode);
      if (parsed !== null && !isNaN(parsed)) {
        if (mode === 'currency') {
          setDisplay(parsed.toFixed(2).replace('.', ','));
        } else {
          setDisplay(String(parsed));
        }
      } else {
        setDisplay('');
      }
      props.onBlur?.(e);
    };

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {mode === 'percentage' ? '%' : 'R$'}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={(e) => e.target.select()}
          className={cn(prefix && 'pl-10', className)}
          placeholder={mode === 'currency' ? '0,00' : '0'}
          {...props}
        />
      </div>
    );
  }
);

MoneyInput.displayName = 'MoneyInput';

function formatInitial(value: number | null | undefined, mode: string): string {
  if (value === null || value === undefined) return '';
  if (value === 0) return '';
  if (mode === 'currency') return value.toFixed(2).replace('.', ',');
  return String(value);
}

function parseDisplay(raw: string, mode: string): number | null {
  if (!raw || raw.trim() === '' || raw === '-') return null;
  const normalized = raw.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return null;
  if (mode === 'percentage') {
    return Math.min(100, Math.max(0, Math.round(parsed)));
  }
  return Math.max(0, parsed);
}

export { MoneyInput };
export type { MoneyInputProps };
