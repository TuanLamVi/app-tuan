import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

export class PushNotificationService {
  static async requestPermission(uid: string) {
    if (!messaging) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: (import.meta as any).env.VITE_FCM_VAPID_KEY
        });

        if (token) {
          await this.saveToken(uid, token);
          return token;
        }
      }
    } catch (error) {
      console.error('Failed to get FCM token:', error);
    }
  }

  private static async saveToken(uid: string, token: string) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  }

  static listenForMessages() {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      if (payload.notification) {
        toast(payload.notification.body || 'Thông báo mới', {
          icon: '🔔',
          duration: 5000,
        });
        
        // Also show browser notification if granted
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(payload.notification.title || 'Thông báo', {
            body: payload.notification.body,
            icon: 'https://www.gstatic.com/images/branding/product/1x/notifications_v2_48dp.png'
          });
        }
      }
    });
  }
}
