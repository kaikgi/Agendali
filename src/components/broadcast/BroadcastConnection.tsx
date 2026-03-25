import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, QrCode, RefreshCw, Loader2 } from "lucide-react";
import { useWhatsAppInstance, useCheckOrCreateInstance, useConnectInstance, useDisconnectInstance } from "@/hooks/useBroadcast";

export default function BroadcastConnection() {
  const { data: instanceData, isLoading, refetch } = useWhatsAppInstance();
  const checkOrCreate = useCheckOrCreateInstance();
  const connect = useConnectInstance();
  const disconnect = useDisconnectInstance();

  const instance = instanceData?.instance;
  const isConnected = instance?.is_connected;
  const qrCode = instance?.qr_code || instanceData?.qrcode;

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
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-600" : ""}>
              {isConnected ? "Conectado" : instance?.status || "Sem instância"}
            </Badge>
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
            {!instance && (
              <Button onClick={() => checkOrCreate.mutate()} disabled={checkOrCreate.isPending}>
                {checkOrCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Criar Instância
              </Button>
            )}

            {instance && !isConnected && (
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Conectar
              </Button>
            )}

            {instance && isConnected && (
              <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
                Desconectar
              </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
