import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Users, CheckCircle, XCircle, Radio, Wifi } from "lucide-react";
import { useBroadcastCampaigns, useBroadcastContacts, useBroadcastLogs, useWhatsAppInstance } from "@/hooks/useBroadcast";

export default function BroadcastOverview() {
  const { data: instanceData } = useWhatsAppInstance();
  const { data: contacts } = useBroadcastContacts();
  const { data: campaigns } = useBroadcastCampaigns();
  const { data: logs } = useBroadcastLogs();

  const instance = instanceData?.instance;
  const isConnected = instance?.is_connected;
  const totalCampaigns = campaigns?.length || 0;
  const totalContacts = contacts?.length || 0;
  const totalSent = logs?.filter((l: any) => l.status === 'sent').length || 0;
  const totalFailed = logs?.filter((l: any) => l.status === 'failed').length || 0;
  const runningCampaign = campaigns?.find((c: any) => c.status === 'running');

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Status WhatsApp</CardTitle>
          <Wifi className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge variant={isConnected ? "default" : "destructive"} className={isConnected ? "bg-green-600" : ""}>
            {isConnected ? "Conectado" : instance ? "Desconectado" : "Sem instância"}
          </Badge>
          {instance?.instance_name && <p className="text-xs text-muted-foreground mt-1">{instance.instance_name}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
          <Radio className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCampaigns}</div>
          {runningCampaign && <p className="text-xs text-amber-600 mt-1">⚡ "{runningCampaign.name}" em andamento</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Contatos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalContacts}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{totalSent}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Falhas</CardTitle>
          <XCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{totalFailed}</div>
        </CardContent>
      </Card>
    </div>
  );
}
