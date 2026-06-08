import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function AdminWhatsAppAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Métricas WhatsApp</h1>
        <p className="text-muted-foreground">Análise de contatos via WhatsApp</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Módulo de métricas WhatsApp ainda não ativado.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            A tabela <code className="bg-muted px-1 rounded text-xs">contact_whatsapp_events</code> precisa ser criada para habilitar esta funcionalidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
