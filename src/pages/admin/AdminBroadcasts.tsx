import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Radio, FileText, Wifi } from "lucide-react";
import { useBroadcastCampaigns, useBroadcastContacts, useBroadcastLogs, useWhatsAppInstance } from "@/hooks/useBroadcast";
import BroadcastOverview from "@/components/broadcast/BroadcastOverview";
import BroadcastConnection from "@/components/broadcast/BroadcastConnection";
import BroadcastContacts from "@/components/broadcast/BroadcastContacts";
import BroadcastCampaigns from "@/components/broadcast/BroadcastCampaigns";
import BroadcastLogs from "@/components/broadcast/BroadcastLogs";

export default function AdminBroadcasts() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disparos WhatsApp</h1>
        <p className="text-muted-foreground">Gerencie campanhas de mensagens em massa</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2"><Radio className="h-4 w-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="connection" className="gap-2"><Wifi className="h-4 w-4" />Conexão</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><Users className="h-4 w-4" />Contatos</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Send className="h-4 w-4" />Campanhas</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><FileText className="h-4 w-4" />Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><BroadcastOverview /></TabsContent>
        <TabsContent value="connection"><BroadcastConnection /></TabsContent>
        <TabsContent value="contacts"><BroadcastContacts /></TabsContent>
        <TabsContent value="campaigns"><BroadcastCampaigns /></TabsContent>
        <TabsContent value="logs"><BroadcastLogs /></TabsContent>
      </Tabs>
    </div>
  );
}
