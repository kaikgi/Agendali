import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Calendar, Clock, User, Briefcase, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface BookingSuccessProps {
  serviceName: string;
  professionalName: string;
  date: Date;
  time: string;
  establishmentName: string;
  manageUrl?: string | null;
  pendingApproval?: boolean;
}

export function BookingSuccess({
  serviceName,
  professionalName,
  date,
  time,
  establishmentName,
  manageUrl,
}: BookingSuccessProps) {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleGoToAppointments = () => {
    if (session) {
      // User is logged in, go directly to appointments
      navigate('/client/appointments');
    } else {
      // User is not logged in, go to login with redirect
      navigate('/client/login', { state: { from: '/client/appointments' } });
    }
  };

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold">Agendamento confirmado!</h2>
        <p className="text-muted-foreground mt-2">Seu horário em {establishmentName} foi reservado.</p>
      </div>

      <div className="bg-muted rounded-lg p-6 text-left space-y-4 max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-muted-foreground" />
          <span>{serviceName}</span>
        </div>
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-muted-foreground" />
          <span>{professionalName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span>{format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span>{time}</span>
        </div>
      </div>

      {/* Primary and secondary actions */}
      <div className="space-y-3 max-w-sm mx-auto">
        <Button className="w-full" onClick={handleGoToAppointments}>
          <Calendar className="w-4 h-4 mr-2" />
          Ir para Meus Agendamentos
        </Button>
        
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>

      {/* Discrete manage link for users without account */}
      {manageUrl && (
        <div className="pt-4 border-t border-border max-w-sm mx-auto">
          <p className="text-xs text-muted-foreground mb-2">
            Precisa alterar este agendamento sem conta?
          </p>
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <a href={manageUrl} className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Clique aqui para gerenciar
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
