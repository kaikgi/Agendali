import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBroadcastLogs, useBroadcastCampaigns } from "@/hooks/useBroadcast";

export default function BroadcastLogs() {
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const { data: campaigns } = useBroadcastCampaigns();
  const { data: logs, isLoading } = useBroadcastLogs(campaignFilter === "all" ? undefined : campaignFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filtrar por campanha:</span>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {campaigns?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Logs de Envio ({logs?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !logs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead>ID Provedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-sm">{l.establishment_name || '—'}</TableCell>
                      <TableCell className="text-xs">{l.phone}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === 'sent' ? 'default' : 'destructive'} className={l.status === 'sent' ? 'bg-green-600' : ''}>
                          {l.status === 'sent' ? 'Sucesso' : 'Falha'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">{l.error || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{l.provider_message_id || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
