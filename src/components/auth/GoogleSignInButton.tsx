import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GoogleSignInButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function GoogleSignInButton({
  onClick,
  isLoading = false,
  disabled = false,
  label = 'Continuar com Google',
  className,
}: GoogleSignInButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'w-full h-11 gap-3 border-slate-200 bg-white text-slate-700 font-medium',
        'shadow-sm hover:shadow-md hover:bg-slate-50 hover:border-slate-300 transition-all',
        className
      )}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" />
      ) : (
        <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.9c2.28-2.1 3.6-5.19 3.6-8.82z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.9-3.01c-1.08.72-2.46 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.28v3.1C3.25 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.31 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.59H1.28A11.98 11.98 0 000 12c0 1.94.46 3.76 1.28 5.41l4.03-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.59l4.03 3.1c.94-2.82 3.58-4.92 6.69-4.92z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}
