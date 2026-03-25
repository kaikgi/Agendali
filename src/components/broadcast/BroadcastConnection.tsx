import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Wifi, WifiOff, QrCode, RefreshCw, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { useWhatsAppInstance, useCheckOrCreateInstance, useConnectInstance, useDisconnectInstance, useUpdateInstanceToken } from "@/hooks/useBroadcast";

export default function BroadcastConnection() {
  const { data: instanceData, isLoading, refetch } = useWhatsAppInstance();
  const checkOrCreate = useCheckOrCreateInstance();
  const connect = useConnectInstance();
  const disconnect = useDisconnectInstance();
  const updateToken = useUpdateInstanceToken();

  const [showTokenField, setShowTokenField] = useState(false);
  const [newToken, setNewToken] = useState("");

  const instance = instanceData?.instance;
  const isConnected = instance?.is_connected;
  const qrCode = instance?.qr_code || instanceData?.qrcode;

  const getStatusLabel = () => {
    if (!instance) return "Sem instância";
    if (isConnected) return "Conectada";
    if (instance.status === 'qr_ready') return "Aguardando QR Code";
    if (instance.status === 'connecting') return "Conectando...";
    if (instance.status === 'close' || instance.status === 'disconnected') return "Desconectada";
    return instance.status || "Desconhecido";
  };

  const getStatusColor = () => {
    if (isConnected) return "bg-green-600";
    if (instance?.status === 'qr_ready' || instance?.status === 'connecting') return "bg-yellow-600";
    return "";
  };

  const handleSaveToken = () => {
    if (!newToken.trim()) return;
    updateToken.mutate(newToken.trim(), {
      onSuccess: () => { setNewToken(""); setShowTokenField(false); },
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">Status:</span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Badge variant={isConnected ? "default" : "secondary"} className={getStatusColor()}>
                {getStatusLabel()}
              </Badge>
            )}
            {instance?.instance_name && (
              <span className="text-xs text-muted-foreground">({instance.instance_name})</span>
            )}
          </div>

          {instance?.last_connection_at && (
            <p className="text-xs text-muted-foreground">
              Última conexão: {new Date(instance.last_connection_at).toLocaleString("pt-BR")}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {!instance && !isLoading && (
              <Button onClick={() => checkOrCreate.mutate()} disabled={checkOrCreate.isPending}>
                {checkOrCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Criar / Sincronizar Instância
              </Button>
            )}

            {instance && !isConnected && (
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Conectar
              </Button>
            )}

            {instance && isConnected && (
              <>
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600 py-1.5 px-3">
                  <CheckCircle2 className="h-4 w-4" /> Instância Conectada
                </Badge>
                <Button variant="destructive" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                  {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </>
            )}

            {instance && (
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* QR Code */}
          {qrCode && !isConnected && (
            <div className="border rounded-lg p-4 bg-white inline-block">
              <p className="text-sm font-medium mb-2">Escaneie o QR Code com seu WhatsApp:</p>
              {qrCode.startsWith('data:') ? (
                <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
              ) : (
                <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-64 h-64" />
              )}
              <p className="text-xs text-muted-foreground mt-2">O QR Code expira rapidamente. Clique em "Conectar" para gerar um novo.</p>
            </div>
          )}

          {/* Update Instance Token */}
          {instance && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenField(!showTokenField)}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Atualizar Token da Instância
              </Button>

              {showTokenField && (
                <div className="flex gap-2 items-center">
                  <Input
                    type="password"
                    placeholder="Cole o novo Instance Token aqui"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveToken}
                    disabled={updateToken.isPending || !newToken.trim()}
                  >
                    {updateToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowTokenField(false); setNewToken(""); }}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
