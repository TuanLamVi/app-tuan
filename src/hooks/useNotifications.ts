import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { Notification } from '../models';
import { NotificationService } from '../services/notificationService';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = NotificationService.subscribe(user.uid, (items) => {
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.isRead).length);
    });

    return () => unsubscribe();
  }, [user]);

  return { notifications, unreadCount };
}
