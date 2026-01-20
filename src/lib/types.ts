import { Timestamp } from "firebase/firestore";

export type PollStatus = 'draft' | 'active' | 'closed';

export type PollOption = {
  id: string;
  text: string;
};

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  createdAt: Timestamp;
  adminId: string;
};

export type VoterGroup = {
  id: string;
  name: string;
  adminId: string;
  voterIds: string[];
  createdAt: Timestamp;
};
