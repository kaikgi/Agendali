import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Número', test: (p) => /[0-9]/.test(p) },
  { label: 'Caractere especial (!@#$%)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]/.test(p) },
];

function getStrength(password: string): number {
  if (!password) return 0;
  const passed = requirements.filter((req) => req.test(password)).length;
  return Math.round((passed / requirements.length) * 100);
}

function getStrengthLabel(strength: number): { label: string; color: string } {
  if (strength === 0) return { label: '', color: '' };
  if (strength < 40) return { label: 'Fraca', color: 'text-destructive' };
  if (strength < 60) return { label: 'Razoável', color: 'text-amber-500' };
  if (strength < 80) return { label: 'Boa', color: 'text-blue-500' };
  return { label: 'Forte', color: 'text-green-500' };
}

function getBarColor(strength: number): string {
  if (strength < 40) return 'bg-destructive';
  if (strength < 60) return 'bg-amber-500';
  if (strength < 80) return 'bg-blue-500';
  return 'bg-green-500';
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = getStrength(password);
  const { label, color } = getStrengthLabel(strength);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          {label && <span className={cn('text-xs font-medium', color)}>{label}</span>}
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              getBarColor(strength)
            )}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {requirements.map((req, i) => {
          const passed = req.test(password);
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                passed ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {passed ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <X className="h-3 w-3 shrink-0" />
              )}
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Export for validation
export function isPasswordStrong(password: string): boolean {
  return requirements.every((req) => req.test(password));
}

export { requirements as passwordRequirements };
