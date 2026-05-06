import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Group } from '../models';
import { handleFirestoreError, OperationType } from '../hooks/useAuth';

import { useAuth } from './useAuth';

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Build query for groups where user is owner or member
    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGroups = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Group;
      });
      
      setGroups(fetchedGroups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'groups');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { groups, loading };
}
