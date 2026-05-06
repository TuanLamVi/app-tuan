import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  FirestoreError 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction } from '../models';
import { handleFirestoreError, OperationType } from '../hooks/useAuth';

export function useTransactions(groupId: string, txLimit: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!groupId) return;

    const q = query(
      collection(db, 'groups', groupId, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(txLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTx = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as Transaction));
      
      setTransactions(fetchedTx);
      setHasMore(snapshot.docs.length === txLimit);
      setLoading(false);
    }, (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}/transactions`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, txLimit]);

  return { transactions, loading, error, hasMore };
}
