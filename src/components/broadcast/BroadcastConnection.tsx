import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Wifi, WifiOff, Loader2, CheckCircle2, KeyRound, Plug, TestTube, RefreshCw, Phone, Server, Shield, AlertTriangle, XCircle, Clock, Signal } from "lucide-react";
import { useWhatsAppInstance, useDisconnectInstance, useUpdateInstanceToken, useConnectExistingInstance, useTestConnection } from "@/hooks/useBroadcast";
import { useToast } from "@/hooks/use-toast";

type InstanceStatus = 'connected' | 'disconnected' | 'connecting' | 'pending_validation' | 'invalid_token' | 'instance_not_found' | 'communication_error' | 'api_error' | 'error' | 'unknown';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2; description: string }> = {
  connected: { label: "Conectada", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2, description: "Instância ativa e pronta para envios" },
  disconnected: { label: "Desconectada", color: "bg-orange-500/15 text-orange-700 border-orange-500/30", icon: WifiOff, description: "Instância existe mas não está conectada ao WhatsApp" },
  connecting: { label: "Conectando", color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", icon: Clock, description: "Aguardando conexão..." },
  pending_validation: { label: "Pendente de validação", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: Clock, description: "Instância salva, aguardando validação com a API" },
  invalid_token: { label: "Token inválido", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: XCircle, description: "O token da instância foi rejeitado pela API" },
  instance_not_found: { label: "Não encontrada", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: AlertTriangle, description: "Instância não foi encontrada no servidor" },
  communication_error: { label: "Erro de comunicação", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: XCircle, description: "Não foi possível comunicar com o servidor" },
  api_error: { label: "Erro na API", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: XCircle, description: "A API retornou um erro inesperado" },
  error: { label: "Erro", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: XCircle, description: "Erro ao verificar a instância" },
  unknown: { label: "Desconhecido", color: "bg-muted text-muted-foreground border-border", icon: Signal, description: "Status não determinado" },
};

export default function BroadcastConnection() {
  const { data: instanceData, isLoading, refetch, isRefetching } = useWhatsAppInstance();
  const disconnect = useDisconnectInstance();
  const updateToken = useUpdateInstanceToken();
  const connectExisting = useConnectExistingInstance();
  const testConnection = useTestConnection();
  const { toast } = useToast();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showTokenField, setShowTokenField] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [form, setForm] = useState({ instance_name: "", instance_token: "", server_url: "", device_name: "", connected_phone: "", notes: "" });

  const instance = instanceData?.instance;
  const status = (instance?.status || 'unknown') as InstanceStatus;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const StatusIcon = statusCfg.icon;

  const handleConnectExisting = () => {
    if (!form.instance_name || !form.instance_token || !form.server_url) return;
    console.log("[BroadcastConnection] Connecting existing instance:", { name: form.instance_name, server: form.server_url });
    connectExisting.mutate(form, {
      onSuccess: (data: any) => {
        console.log("[BroadcastConnection] Connect success:", data);
        setShowConnectDialog(false);
        setForm({ instance_name: "", instance_token: "", server_url: "", device_name: "", connected_phone: "", notes: "" });
        refetch();
      },
      onError: (err: Error) => {
        console.error("[BroadcastConnection] Connect error:", err.message);
      },
    });
  };

  const handleSaveToken = () => {
    if (!newToken.trim()) return;
    console.log("[BroadcastConnection] Updating token");
    updateToken.mutate(newToken.trim(), {
      onSuccess: () => { setNewToken(""); setShowTokenField(false); refetch(); },
    });
  };

  const handleTest = () => {
    console.log("[BroadcastConnection] Testing connection for:", instance?.instance_name);
    testConnection.mutate(undefined, {
      onSuccess: (data: any) => {
        console.log("[BroadcastConnection] Test result:", data);
        refetch();
        if (data?.ok) {
          toast({ title: "Conexão verificada ✓", description: `Status: ${data.state || data.status}` });
        } else {
          toast({ title: "Teste falhou", description: data?.message || "Erro desconhecido", variant: "destructive" });
        }
      },
      onError: (err: Error) => {
        console.error("[BroadcastConnection] Test error:", err.message);
      },
    });
  };

  const handleRefresh = () => {
    console.log("[BroadcastConnection] Refreshing status");
    refetch();
  };

  // Empty state
  if (!isLoading && !instance) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Wifi className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Nenhuma instância conectada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Conecte uma instância WhatsApp existente para começar a enviar mensagens em massa.
              </p>
            </div>
            <Button onClick={() => setShowConnectDialog(true)} size="lg" className="mt-2">
              <Plug className="h-4 w-4 mr-2" />
              Conectar instância existente
            </Button>
          </CardContent>
        </Card>
        {renderDialog()}
      </div>
    );
  }

  function renderDialog() {
    return (
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Conectar instância existente</DialogTitle>
            <DialogDescription>Informe os dados da instância já criada na plataforma externa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inst-name" className="flex items-center gap-1 text-xs font-medium"><Server className="h-3.5 w-3.5" /> Nome da instância *</Label>
              <Input id="inst-name" placeholder="Ex: agendali-broadcast" value={form.instance_name} onChange={(e) => setForm(f => ({ ...f, instance_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-token" className="flex items-center gap-1 text-xs font-medium"><Shield className="h-3.5 w-3.5" /> Instance Token / API Key *</Label>
              <Input id="inst-token" type="password" placeholder="Token da instância" value={form.instance_token} onChange={(e) => setForm(f => ({ ...f, instance_token: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-url" className="flex items-center gap-1 text-xs font-medium"><Wifi className="h-3.5 w-3.5" /> Server URL *</Label>
              <Input id="inst-url" placeholder="https://api.exemplo.com" value={form.server_url} onChange={(e) => setForm(f => ({ ...f, server_url: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inst-device" className="text-xs font-medium">Dispositivo</Label>
                <Input id="inst-device" placeholder="Ex: agenda" value={form.device_name} onChange={(e) => setForm(f => ({ ...f, device_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inst-phone" className="flex items-center gap-1 text-xs font-medium"><Phone className="h-3.5 w-3.5" /> Telefone</Label>
                <Input id="inst-phone" placeholder="5511999999999" value={form.connected_phone} onChange={(e) => setForm(f => ({ ...f, connected_phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-notes" className="text-xs font-medium">Observações</Label>
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
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wifi className="h-5 w-5" />
                Conexão WhatsApp
              </CardTitle>
              <CardDescription className="mt-1">{statusCfg.description}</CardDescription>
            </div>
            <Badge variant="outline" className={`${statusCfg.color} gap-1.5 py-1 px-3 text-xs font-medium`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusCfg.label}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instance ? (
            <>
              {/* Instance Details Grid */}
              <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 text-sm">
                <span className="text-muted-foreground font-medium">Nome</span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded w-fit">{instance.instance_name}</span>

                {instance.connected_phone && (
                  <>
                    <span className="text-muted-foreground font-medium">Telefone</span>
                    <span>{instance.connected_phone}</span>
                  </>
                )}

                <span className="text-muted-foreground font-medium">Servidor</span>
                <span className="font-mono text-xs truncate">{instance.server_url}</span>

                {instance.device_name && (
                  <>
                    <span className="text-muted-foreground font-medium">Dispositivo</span>
                    <span>{instance.device_name}</span>
                  </>
                )}

                {instance.last_validated_at && (
                  <>
                    <span className="text-muted-foreground font-medium">Última validação</span>
                    <span>{new Date(instance.last_validated_at).toLocaleString("pt-BR")}</span>
                  </>
                )}
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testConnection.isPending}>
                  {testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <TestTube className="h-4 w-4 mr-1.5" />}
                  Testar conexão
                </Button>

                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefetching}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                <Button variant="outline" size="sm" onClick={() => setShowConnectDialog(true)}>
                  <Plug className="h-4 w-4 mr-1.5" />
                  Trocar instância
                </Button>

                {instance.is_connected && (
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <WifiOff className="h-4 w-4 mr-1.5" />}
                    Desconectar
                  </Button>
                )}
              </div>

              <Separator />

              {/* Update Token Section */}
              <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTokenField(!showTokenField)} className="text-muted-foreground hover:text-foreground">
                  <KeyRound className="h-4 w-4 mr-1.5" />
                  Atualizar Token da Instância
                </Button>
                {showTokenField && (
                  <div className="flex gap-2 items-center pl-1">
                    <Input type="password" placeholder="Cole o novo Instance Token" value={newToken} onChange={(e) => setNewToken(e.target.value)} className="max-w-sm h-9 text-sm" />
                    <Button size="sm" onClick={handleSaveToken} disabled={updateToken.isPending || !newToken.trim()}>
                      {updateToken.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Salvar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowTokenField(false); setNewToken(""); }}>Cancelar</Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Validation error info */}
      {instanceData?.validation_error && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="py-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-orange-700">Aviso de validação</p>
              <p className="text-muted-foreground text-xs mt-0.5">{instanceData.validation_error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {renderDialog()}
    </div>
  );
}
