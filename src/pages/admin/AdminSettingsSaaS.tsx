import { Outlet } from "react-router-dom";

export default function AdminSettingsSaaS() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações SaaS</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema Agendali</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <h3 className="font-semibold">Planos e Preços</h3>
          <p className="text-sm text-muted-foreground">
            Os planos são definidos em código (hardcoded). Para alterar preços ou limites, edite o arquivo <code className="bg-muted px-1 rounded text-xs">src/lib/hardcodedPlans.ts</code>.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <h3 className="font-semibold">Checkout (Kiwify)</h3>
          <p className="text-sm text-muted-foreground">
            Os links de checkout apontam para a Kiwify. Para alterar, edite os URLs no arquivo de planos.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <h3 className="font-semibold">Autorização por Pagamento</h3>
          <p className="text-sm text-muted-foreground">
            Novos estabelecimentos só podem ser criados após pagamento via Kiwify. O email do comprador é registrado na tabela <code className="bg-muted px-1 rounded text-xs">allowed_establishment_signups</code> e validado no cadastro.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <h3 className="font-semibold">Limites</h3>
          <p className="text-sm text-muted-foreground">
            Solo: 1 profissional • Studio: até 4 profissionais • Pro: Ilimitado. Agendamentos são ilimitados em todos os planos.
          </p>
        </div>
      </div>
    </div>
  );
}
