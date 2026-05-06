import { 
  collection, doc, runTransaction, serverTimestamp, 
  query, orderBy, limit, onSnapshot, addDoc, updateDoc,
  deleteDoc, Firestore
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, TransactionStatus, Group, Campaign } from '../models';

export class TransactionRepository {
  private groupId: string;

  constructor(groupId: string) {
    this.groupId = groupId;
  }

  async createProposal(data: Partial<Transaction>) {
    return addDoc(collection(db, 'groups', this.groupId, 'transactions'), {
      ...data,
      groupId: this.groupId,
      status: 'pending' as TransactionStatus,
      createdAt: serverTimestamp(),
      reactions: {},
      comments: []
    });
  }

  async executeTransaction(data: Partial<Transaction>) {
    return runTransaction(db, async (transaction) => {
      const groupRef = doc(db, 'groups', this.groupId);
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) throw new Error('Group not found');

      const currentFund = groupSnap.data().totalFund || 0;
      const amount = data.amount || 0;
      const newFund = data.type === 'income' ? currentFund + amount : currentFund - amount;

      // Update campaign balance if exists
      if (data.campaignId) {
        const campRef = doc(db, 'groups', this.groupId, 'campaigns', data.campaignId);
        const campSnap = await transaction.get(campRef);
        if (campSnap.exists()) {
          const currentCampBalance = campSnap.data().balance || 0;
          transaction.update(campRef, { 
            balance: data.type === 'income' ? currentCampBalance + amount : currentCampBalance - amount 
          });
        }
      }

      transaction.update(groupRef, { totalFund: newFund });

      const txRef = doc(collection(db, 'groups', this.groupId, 'transactions'));
      transaction.set(txRef, {
        ...data,
        id: txRef.id,
        groupId: this.groupId,
        status: 'approved' as TransactionStatus,
        createdAt: serverTimestamp(),
        reactions: {},
        comments: []
      });
    });
  }

  async approveProposal(txId: string, transactionData: Transaction) {
    return runTransaction(db, async (transaction) => {
      const groupRef = doc(db, 'groups', this.groupId);
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) throw new Error('Group not found');

      const currentFund = groupSnap.data().totalFund || 0;
      const amount = transactionData.amount;
      const newFund = transactionData.type === 'income' ? currentFund + amount : currentFund - amount;

      if (transactionData.campaignId) {
        const campRef = doc(db, 'groups', this.groupId, 'campaigns', transactionData.campaignId);
        const campSnap = await transaction.get(campRef);
        if (campSnap.exists()) {
          const currentCampBalance = campSnap.data().balance || 0;
          transaction.update(campRef, { 
            balance: transactionData.type === 'income' ? currentCampBalance + amount : currentCampBalance - amount 
          });
        }
      }

      transaction.update(groupRef, { totalFund: newFund });
      transaction.update(doc(db, 'groups', this.groupId, 'transactions', txId), {
        status: 'approved',
        updatedAt: serverTimestamp()
      });
    });
  }

  rejectProposal(txId: string) {
    return updateDoc(doc(db, 'groups', this.groupId, 'transactions', txId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  }

  async deleteTransaction(txId: string) {
    return deleteDoc(doc(db, 'groups', this.groupId, 'transactions', txId));
  }

  async createCampaign(data: Partial<Campaign>) {
    return addDoc(collection(db, 'groups', this.groupId, 'campaigns'), {
      ...data,
      groupId: this.groupId,
      balance: 0,
      status: 'active',
      createdAt: serverTimestamp()
    });
  }

  async settleCampaign(campaignId: string, balance: number) {
    return runTransaction(db, async (transaction) => {
      const campRef = doc(db, 'groups', this.groupId, 'campaigns', campaignId);
      const groupRef = doc(db, 'groups', this.groupId);
      
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) throw new Error('Group not found');

      // Update campaign status and freeze its balance as the final amount
      transaction.update(campRef, { 
        status: 'closed',
        settledBalance: balance,
        settledAt: serverTimestamp(),
      });
    });
  }
}
