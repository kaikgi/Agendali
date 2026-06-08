import { useEffect } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { PlanCardsGrid } from '@/components/billing/PlanCardsGrid';

interface BlockedAccessModalProps {
  reason: string;
}

export function BlockedAccessModal({ reason }: BlockedAccessModalProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const title = reason === 'past_due'
    ? 'Pagamento pendente'
    : reason === 'canceled'
      ? 'Assinatura cancelada'
      : reason === 'no_establishment'
        ? 'Conta não configurada'
        : 'Assinatura necessária';

  const subtitle = reason === 'past_due'
    ? 'Regularize seu pagamento para continuar usando o Agendali.'
    : reason === 'canceled'
      ? 'Sua assinatura foi cancelada. Assine novamente para continuar.'
      : reason === 'no_establishment'
        ? 'Nenhum estabelecimento encontrado para sua conta.'
        : 'Escolha um plano para acessar o Agendali.';

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-4xl space-y-8 py-8">
        <div className="text-center space-y-4">
          <Logo />
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{title}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">{subtitle}</p>
        </div>

        <PlanCardsGrid ctaLabel="Assinar agora" />

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut size={16} className="mr-2" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
