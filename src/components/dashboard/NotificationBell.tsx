import { useState } from 'react';
import { Bell, Star, Check, Trash2, CheckCheck, Calendar, XCircle, RefreshCw, Clock, Eye, ThumbsUp, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useInAppNotifications, InAppNotification } from '@/hooks/useInAppNotifications';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_appointment':
      return (
        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
      );
    case 'pending_approval':
      return (
        <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
      );
    case 'cancelled_appointment':
      return (
        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case 'rescheduled_appointment':
      return (
        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case 'new_rating':
      return (
        <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
      );
    default:
      return (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

function getActionLabel(type: string): { label: string; icon: React.ReactNode } {
  switch (type) {
    case 'new_appointment':
      return { label: 'Ver agendamento', icon: <Eye className="h-3 w-3" /> };
    case 'pending_approval':
      return { label: 'Revisar aprovação', icon: <ThumbsUp className="h-3 w-3" /> };
    case 'cancelled_appointment':
      return { label: 'Ver detalhes', icon: <Eye className="h-3 w-3" /> };
    case 'rescheduled_appointment':
      return { label: 'Ver reagendamento', icon: <Eye className="h-3 w-3" /> };
    case 'new_rating':
      return { label: 'Ver avaliação', icon: <Star className="h-3 w-3" /> };
    default:
      return { label: 'Ver detalhes', icon: <ExternalLink className="h-3 w-3" /> };
  }
}

function getNavigationPath(notification: InAppNotification): string {
  switch (notification.type) {
    case 'new_appointment':
    case 'pending_approval':
    case 'cancelled_appointment':
    case 'rescheduled_appointment':
      return '/dashboard/agenda';
    case 'new_rating':
      return '/dashboard/avaliacoes';
    default:
      return '/dashboard';
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
  onAction,
}: {
  notification: InAppNotification;
  onMarkAsRead: () => void;
  onRemove: () => void;
  onAction: () => void;
}) {
  const action = getActionLabel(notification.type);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 border-b border-border last:border-0 transition-colors',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      {/* Top: icon + text + actions */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{notification.title}</span>
            {!notification.is_read && (
              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              title="Marcar como lida"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Bottom: action button */}
      <div className="pl-11">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {action.icon}
          {action.label}
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  } = useInAppNotifications();

  const handleAction = (notification: InAppNotification) => {
    markAsRead(notification.id);
    navigate(getNavigationPath(notification));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold">Notificações</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px]">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onRemove={() => removeNotification(notification.id)}
                  onAction={() => handleAction(notification)}
                />
              ))}
            </ScrollArea>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearNotifications}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar todas as notificações
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
