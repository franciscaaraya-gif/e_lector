import { Timestamp } from "firebase/firestore";

export type PollStatus = 'active' | 'closed';
export type PollType = 'simple' | 'multiple';

export type PollOption = {
  id: string;
  text: string;
};

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  pollType: PollType;
  maxSelections?: number;
  groupId: string;
  createdAt: Timestamp;
  adminId: string;
};

export type VoterInfo = {
  id: string;
  nombre: string;
  apellido: string;
};

export type VoterGroup = {
  id:string;
  name: string;
  adminId: string;
  voters: VoterInfo[];
  createdAt: Timestamp;
};

export type Vote = {
    id: string;
    pollId: string;
    selectedOptions: string[];
}

export type VoterStatus = {
  id: string; // The document ID from the 'voters' subcollection
  voterId: string; // The business logic ID of the voter
  pollId: string;
  hasVoted: boolean;
};

export type PollLookup = {
  adminId: string;
};
