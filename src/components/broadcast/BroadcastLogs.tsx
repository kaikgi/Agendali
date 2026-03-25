import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBroadcastLogs, useBroadcastCampaigns } from "@/hooks/useBroadcast";

const LOG_STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Sucesso", variant: "default" },
  failed: { label: "Falha", variant: "destructive" },
};

export default function BroadcastLogs() {
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const { data: campaigns } = useBroadcastCampaigns();
  const { data: logs, isLoading } = useBroadcastLogs(campaignFilter === "all" ? undefined : campaignFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filtrar por campanha:</span>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {campaigns?.map((campaign: any) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs de Envio ({logs?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !logs?.length ? (
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
                    <TableHead>Erro / Retorno</TableHead>
                    <TableHead>ID Provedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const statusMeta = LOG_STATUS_META[log.status] || LOG_STATUS_META.failed;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{log.establishment_name || "—"}</TableCell>
                        <TableCell className="text-xs">{log.phone}</TableCell>
                        <TableCell>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[360px] whitespace-pre-wrap break-words text-xs">
                          {log.error || "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{log.provider_message_id || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}