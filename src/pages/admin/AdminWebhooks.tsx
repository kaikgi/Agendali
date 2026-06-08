import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Webhook, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminWebhooks() {
  const [search, setSearch] = useState("");

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-webhook-events", search],
    queryFn: async () => {
      let query = supabase
        .from("billing_webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.or(
          `event_id.ilike.%${search}%,event_type.ilike.%${search}%,kiwify_product_id.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      // Try to extract email from payload for display
      return (data || []).map((evt: Record<string, unknown>) => {
        const payload = evt.payload as Record<string, unknown> | null;
        const customer = payload?.Customer as Record<string, unknown> | null;
        const product = payload?.Product as Record<string, unknown> | null;
        const email =
          (customer?.email as string) ||
          (payload?.customer_email as string) ||
          null;
        const productName =
          (product?.product_name as string) ||
          (payload?.product_name as string) ||
          "";
        return { ...evt, _email: email, _product_name: productName };
      });
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kiwify Webhooks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Últimos 50 eventos recebidos do webhook Kiwify
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Buscar por email, order_id, product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !events?.length ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Webhook size={40} className="mb-3 opacity-40" />
          <p>Nenhum evento encontrado</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((evt: Record<string, unknown>) => {
                const ignored = evt.ignored as boolean;
                const processed = !!evt.processed_at;
                const hasError = !!evt.processing_error;
                const ignoreReason = evt.ignore_reason as string | null;

                return (
                  <TableRow key={evt.id as string}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(evt.received_at as string), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {(evt._email as string) || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">
                      {(evt._product_name as string) || (evt.kiwify_product_id as string) || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {evt.event_type as string}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate">
                      {evt.event_id as string}
                    </TableCell>
                    <TableCell>
                      {ignored ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <AlertTriangle size={12} />
                          Ignorado
                        </Badge>
                      ) : hasError ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <XCircle size={12} />
                          Erro
                        </Badge>
                      ) : processed ? (
                        <Badge className="gap-1 text-xs bg-green-600 hover:bg-green-700">
                          <CheckCircle size={12} />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[180px] truncate">
                      {ignoreReason || (evt.processing_error as string) || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
