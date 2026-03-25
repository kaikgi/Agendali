import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Wifi, WifiOff, Loader2, CheckCircle2, KeyRound, Plug, TestTube, RefreshCw, Phone, Server, Shield } from "lucide-react";
import { useWhatsAppInstance, useConnectInstance, useDisconnectInstance, useUpdateInstanceToken, useConnectExistingInstance, useTestConnection } from "@/hooks/useBroadcast";

export default function BroadcastConnection() {
  const { data: instanceData, isLoading, refetch } = useWhatsAppInstance();
  const connect = useConnectInstance();
  const disconnect = useDisconnectInstance();
  const updateToken = useUpdateInstanceToken();
  const connectExisting = useConnectExistingInstance();
  const testConnection = useTestConnection();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showTokenField, setShowTokenField] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [form, setForm] = useState({ instance_name: "", instance_token: "", server_url: "", device_name: "", connected_phone: "", notes: "" });

  const instance = instanceData?.instance;
  const isConnected = instance?.is_connected;

  const getStatusLabel = () => {
    if (!instance) return "Sem instância";
    if (isConnected) return "Conectada";
    if (instance.status === 'open') return "Conectada";
    if (instance.status === 'close' || instance.status === 'disconnected') return "Desconectada";
    if (instance.status === 'connecting') return "Conectando...";
    if (instance.status === 'error') return "Erro";
    return instance.status || "Desconhecido";
  };

  const getStatusColor = () => {
    if (isConnected || instance?.status === 'open') return "bg-green-600";
    if (instance?.status === 'connecting') return "bg-yellow-600";
    if (instance?.status === 'error') return "bg-red-600";
    return "";
  };

  const handleConnectExisting = () => {
    if (!form.instance_name || !form.instance_token || !form.server_url) return;
    console.log("[BroadcastConnection] Connecting existing instance:", form.instance_name);
    connectExisting.mutate(form, {
      onSuccess: () => {
        setShowConnectDialog(false);
        setForm({ instance_name: "", instance_token: "", server_url: "", device_name: "", connected_phone: "", notes: "" });
      },
    });
  };

  const handleSaveToken = () => {
    if (!newToken.trim()) return;
    updateToken.mutate(newToken.trim(), {
      onSuccess: () => { setNewToken(""); setShowTokenField(false); },
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Active Instance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">Status:</span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Badge variant={isConnected ? "default" : "secondary"} className={getStatusColor()}>
                {getStatusLabel()}
              </Badge>
            )}
          </div>

          {/* Instance Details */}
          {instance && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{instance.instance_name}</span>

                {instance.connected_phone && (
                  <>
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-medium">{instance.connected_phone}</span>
                  </>
                )}

                <span className="text-muted-foreground">Server:</span>
                <span className="font-medium truncate text-xs">{instance.server_url}</span>

                {instance.device_name && (
                  <>
                    <span className="text-muted-foreground">Dispositivo:</span>
                    <span className="font-medium">{instance.device_name}</span>
                  </>
                )}

                {instance.last_validated_at && (
                  <>
                    <span className="text-muted-foreground">Última validação:</span>
                    <span className="font-medium">{new Date(instance.last_validated_at).toLocaleString("pt-BR")}</span>
                  </>
                )}

                {instance.last_connection_at && (
                  <>
                    <span className="text-muted-foreground">Última conexão:</span>
                    <span className="font-medium">{new Date(instance.last_connection_at).toLocaleString("pt-BR")}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {/* Connect existing - always available */}
            <Button variant={instance ? "outline" : "default"} onClick={() => setShowConnectDialog(true)}>
              <Plug className="h-4 w-4 mr-2" />
              {instance ? "Trocar instância" : "Conectar instância existente"}
            </Button>

            {/* Test connection */}
            {instance && (
              <Button variant="outline" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
                {testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
            )}

            {/* Disconnect */}
            {instance && isConnected && (
              <Button variant="destructive" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
                Desconectar
              </Button>
            )}

            {/* Refresh */}
            {instance && (
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Connected badge */}
          {instance && isConnected && (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600 py-1.5 px-3">
              <CheckCircle2 className="h-4 w-4" /> Instância Ativa e Conectada
            </Badge>
          )}

          {/* Update Token */}
          {instance && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <Button variant="outline" size="sm" onClick={() => setShowTokenField(!showTokenField)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Atualizar Token da Instância
              </Button>
              {showTokenField && (
                <div className="flex gap-2 items-center">
                  <Input type="password" placeholder="Cole o novo Instance Token aqui" value={newToken} onChange={(e) => setNewToken(e.target.value)} className="max-w-sm" />
                  <Button size="sm" onClick={handleSaveToken} disabled={updateToken.isPending || !newToken.trim()}>
                    {updateToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowTokenField(false); setNewToken(""); }}>Cancelar</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Existing Instance Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Conectar instância existente</DialogTitle>
            <DialogDescription>Informe os dados da instância já criada na plataforma externa para vinculá-la ao Agendali.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inst-name" className="flex items-center gap-1"><Server className="h-3.5 w-3.5" /> Nome da instância *</Label>
              <Input id="inst-name" placeholder="Ex: agendali-broadcast" value={form.instance_name} onChange={(e) => setForm(f => ({ ...f, instance_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-token" className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Instance Token / API Key *</Label>
              <Input id="inst-token" type="password" placeholder="Token da instância" value={form.instance_token} onChange={(e) => setForm(f => ({ ...f, instance_token: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-url" className="flex items-center gap-1"><Wifi className="h-3.5 w-3.5" /> Server URL *</Label>
              <Input id="inst-url" placeholder="https://api.exemplo.com" value={form.server_url} onChange={(e) => setForm(f => ({ ...f, server_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-device">Nome do dispositivo (opcional)</Label>
              <Input id="inst-device" placeholder="Ex: Celular Agendali" value={form.device_name} onChange={(e) => setForm(f => ({ ...f, device_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-phone" className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefone (opcional)</Label>
              <Input id="inst-phone" placeholder="5511999999999" value={form.connected_phone} onChange={(e) => setForm(f => ({ ...f, connected_phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-notes">Observações (opcional)</Label>
              <Textarea id="inst-notes" placeholder="Notas internas..." value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConnectDialog(false)}>Cancelar</Button>
            <Button onClick={handleConnectExisting} disabled={connectExisting.isPending || !form.instance_name || !form.instance_token || !form.server_url}>
              {connectExisting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
              Conectar e Validar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
