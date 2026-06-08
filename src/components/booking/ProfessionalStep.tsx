import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Professional } from '@/hooks/useProfessionals';

interface ProfessionalStepProps {
  professionals: Professional[];
  selectedProfessionalId: string | null;
  onSelect: (professional: Professional) => void;
  isLoading: boolean;
}

export function ProfessionalStep({
  professionals,
  selectedProfessionalId,
  onSelect,
  isLoading,
}: ProfessionalStepProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold mb-4">Escolha o profissional</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum profissional disponível para este serviço.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold mb-4">Escolha o profissional</h2>
      {professionals.map((professional) => (
        <button
          key={professional.id}
          onClick={() => onSelect(professional)}
          className={cn(
            'w-full p-4 rounded-lg border text-left transition-all flex items-center gap-4',
            'hover:border-foreground/50',
            selectedProfessionalId === professional.id
              ? 'border-foreground bg-accent'
              : 'border-border'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt={professional.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-medium">{professional.name}</h3>
          </div>
        </button>
      ))}
    </div>
  );
}
