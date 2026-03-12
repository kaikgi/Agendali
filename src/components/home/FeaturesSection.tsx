import { 
  Calendar, 
  Clock, 
  Users, 
  Mail, 
  Shield, 
  Smartphone,
  BarChart3,
  Zap,
  LucideIcon
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string[];
}

const features: Feature[] = [
  {
    icon: Calendar,
    title: "Agendamento inteligente",
    description: "Página de agendamento personalizada com seu domínio. Seus clientes agendam 24/7 sem você precisar atender.",
    details: [
      "Link personalizado para seu negócio",
      "Disponibilidade em tempo real",
      "Seleção de profissional e serviço"
    ]
  },
  {
    icon: Clock,
    title: "Gestão de horários",
    description: "Configure horários de funcionamento, bloqueios e capacidade por profissional de forma flexível.",
    details: [
      "Horários por dia da semana",
      "Bloqueios pontuais e recorrentes",
      "Intervalo entre atendimentos"
    ]
  },
  {
    icon: Users,
    title: "Multi-profissionais",
    description: "Gerencie toda sua equipe em um só lugar. Cada profissional com seus próprios serviços e disponibilidade.",
    details: [
      "Agenda individual por profissional",
      "Serviços específicos por membro",
      "Fotos e perfis personalizados"
    ]
  },
  {
    icon: Mail,
    title: "Lembretes automáticos",
    description: "Reduza faltas com lembretes via E-mail. Confirmação e cancelamento com um clique.",
    details: [
      "Notificações via E-mail",
      "Confirmação de presença",
      "Redução de no-shows"
    ]
  },
  {
    icon: Shield,
    title: "Self-service seguro",
    description: "Clientes podem remarcar ou cancelar pelo link privado, respeitando suas regras de antecedência.",
    details: [
      "Link exclusivo por agendamento",
      "Regras de antecedência mínima",
      "Política de cancelamento"
    ]
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    description: "Interface otimizada para dispositivos móveis. Seus clientes agendam em segundos.",
    details: [
      "Design responsivo premium",
      "Carregamento ultra-rápido",
      "Experiência fluida em qualquer tela"
    ]
  },
  {
    icon: BarChart3,
    title: "Métricas em tempo real",
    description: "Dashboard com insights sobre agendamentos, cancelamentos e serviços mais populares.",
    details: [
      "Visão geral do dia e semana",
      "Top serviços e profissionais",
      "Taxa de cancelamento"
    ]
  },
  {
    icon: Zap,
    title: "Setup instantâneo",
    description: "Configure seu estabelecimento em minutos e comece a receber agendamentos hoje.",
    details: [
      "Cadastro em menos de 5 minutos",
      "Configuração guiada",
      "Suporte dedicado"
    ]
  },
];

export function FeaturesSection() {
  return (
    <section id="recursos" className="py-16 md:py-24 bg-secondary/30">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-label text-muted-foreground uppercase tracking-wider mb-3">
            Recursos
          </p>
          <h2 className="text-display-sm md:text-display-md text-balance mb-4">
            Tudo que você precisa para gerenciar agendamentos
          </h2>
          <p className="text-body-md text-muted-foreground">
            Ferramentas poderosas e simples de usar, criadas para profissionais 
            que querem focar no que importa.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-5 rounded-2xl bg-card border border-border hover:border-foreground/20 hover:shadow-elegant transition-premium animate-fade-in"
              style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'both' }}
            >
              {/* Animated icon container */}
              <div className="w-12 h-12 rounded-xl bg-secondary group-hover:bg-primary flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <feature.icon 
                  size={22} 
                  className="text-foreground group-hover:text-primary-foreground transition-colors duration-300" 
                />
              </div>
              
              <h3 className="font-semibold text-base mb-2 group-hover:text-primary transition-colors duration-300">
                {feature.title}
              </h3>
              
              <p className="text-body-sm text-muted-foreground mb-3">
                {feature.description}
              </p>

              {/* Feature details list */}
              <ul className="space-y-1.5">
                {feature.details.map((detail, i) => (
                  <li 
                    key={i} 
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
