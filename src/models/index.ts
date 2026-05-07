export type Role = 'owner' | 'admin' | 'member';
export type TransactionStatus = 'pending' | 'approved' | 'rejected';
export type CampaignStatus = 'active' | 'closed';

export interface Reaction {
  [emoji: string]: string[]; // emoji -> list of userIds
}

export interface Comment {
  id: string;
  content: string;
  uid: string;
  userName: string;
  reactions?: Reaction;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[]; // List of UIDs who voted for this option
}

export interface Poll {
  id: string;
  groupId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  creatorName: string;
  allowMultiple?: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  address?: string;
  pin?: string; // Hashed string for sensitive actions
  notificationSettings?: {
    system: boolean;
    news: boolean;
  };
  pinnedGroupIds?: string[];
  groupOrder?: string[];
  lastReadChat?: Record<string, any>; // groupId -> last read timestamp
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  ownerId: string;
  deputies: string[]; // List of UIDs
  members: string[]; // List of UIDs
  settings?: {
    requireApproval: boolean;
    notifications?: {
      announcements: boolean;
      finance: boolean;
      tasks: boolean;
    };
  };
  totalFund: number;
  currency: string;
  pendingInvites: string[]; // List of emails or UIDs
  pendingOwner?: string; // UID for ownership transfer
  lastAnnoId?: string; // ID of the latest announcement
  lastMessageAt?: any; // Timestamp of the latest message
  createdAt: Date;
}

export interface Announcement {
  id: string;
  groupId: string;
  title: string;
  content: string;
  createdBy: string;
  creatorPhone?: string;
  reactions: Reaction;
  comments: Comment[];
  createdAt: Date;
}

export interface Campaign {
  id: string;
  groupId: string;
  name: string;
  description: string;
  balance: number;
  targetAmount?: number;
  status: CampaignStatus;
  settledBalance?: number;
  settledAt?: Date;
  createdAt: Date;
}

export type TaskStatus = 'pending' | 'doing' | 'done';

export interface Task {
  id: string;
  groupId: string;
  title: string;
  description: string;
  assigneeIds: string[];
  assigneeNames: string[];
  status: TaskStatus;
  dueDate?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  reactions?: Record<string, string[]>; // emoji: [userIds]
  createdAt: Date;
}

export interface Transaction {
  id: string;
  groupId: string;
  fundId?: string; // Reference to a specific fund or general group fund
  campaignId?: string; // Link to a campaign
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  note?: string;
  status: TransactionStatus;
  createdBy: string;
  creatorPhone?: string;
  reactions: Reaction;
  comments: Comment[];
  createdAt: Date;
  evidenceUrl?: string;
}

export type NotificationType = 'invite' | 'approval' | 'transfer' | 'announcement' | 'system';
export type NotificationCategory = 'announcements' | 'finance' | 'tasks' | 'general';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  data?: any; // Related IDs for navigation
  isRead: boolean;
  createdAt: Date;
}
