import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  serverTimestamp, query, orderBy, limit, onSnapshot,
  getDocs, where, getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../models';
import { handleFirestoreError, OperationType } from '../hooks/useAuth';

export class NotificationService {
  static async sendNotification(targetUid: string, data: Partial<Notification>) {
    try {
      // Check group settings if groupId and category are provided
      const groupId = data.data?.groupId;
      const category = data.category;

      if (groupId && category && category !== 'general') {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
          const groupData = groupSnap.data();
          const groupSettings = groupData.settings?.notifications;
          
          // If category is disabled in group settings, skip sending the notification
          if (groupSettings && groupSettings[category] === false) {
            console.log(`Notification skipped: ${category} disabled for group ${groupId}`);
            return;
          }
        }
      }

      await addDoc(collection(db, 'users', targetUid, 'notifications'), {
        ...data,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  static subscribe(uid: string, callback: (notifications: Notification[]) => void) {
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as Notification));
      callback(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/notifications`);
    });
  }

  static async markAsRead(uid: string, notifId: string) {
    try {
      await updateDoc(doc(db, 'users', uid, 'notifications', notifId), {
        isRead: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/notifications/${notifId}`);
    }
  }

  static async markAllAsRead(uid: string) {
    try {
      const q = query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false));
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map(d => updateDoc(d.ref, { isRead: true }));
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/notifications`);
    }
  }

  static async deleteNotification(uid: string, notifId: string) {
    try {
      await deleteDoc(doc(db, 'users', uid, 'notifications', notifId));
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `users/${uid}/notifications/${notifId}`);
    }
  }
}
