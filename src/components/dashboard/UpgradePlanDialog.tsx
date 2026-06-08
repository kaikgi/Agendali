import { ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  feature?: 'professionals' | 'appointments' | 'establishments';
}

const featureMessages = {
  professionals: {
    title: 'Limite de profissionais atingido',
    description: 'Você atingiu o número máximo de profissionais do seu plano atual. Faça upgrade para adicionar mais membros à sua equipe.',
  },
  appointments: {
    title: 'Limite de agendamentos atingido',
    description: 'Você atingiu o limite de agendamentos do seu plano atual. Faça upgrade para ter agendamentos ilimitados.',
  },
  establishments: {
    title: 'Recurso disponível no plano Pro',
    description: 'Múltiplos estabelecimentos estão disponíveis no plano Pro. Faça upgrade para gerenciar várias unidades.',
  },
};

export function UpgradePlanDialog({
  open,
  onOpenChange,
  title,
  description,
  feature = 'professionals',
}: UpgradePlanDialogProps) {
  const navigate = useNavigate();
  const messages = featureMessages[feature];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/dashboard/assinatura');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-4">
            <Zap className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">
            {title || messages.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description || messages.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-4">
          <Button onClick={handleUpgrade} className="w-full">
            Ver planos e preços
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Continuar no plano atual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
