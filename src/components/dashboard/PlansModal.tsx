import { X } from 'lucide-react';
import { PlanCardsGrid } from '@/components/billing/PlanCardsGrid';

interface PlansModalProps {
  open: boolean;
  onClose: () => void;
}

export function PlansModal({ open, onClose }: PlansModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background border rounded-2xl shadow-xl max-w-4xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Escolha seu plano</h2>
          <p className="text-muted-foreground mt-1">
            Assine agora para liberar o acesso completo
          </p>
        </div>

        <PlanCardsGrid compact ctaLabel="Assinar" />
      </div>
    </div>
  );
}
