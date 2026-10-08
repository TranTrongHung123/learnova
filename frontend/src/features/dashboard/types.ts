import type { DiscoveredSession, PageResult } from "@/features/discovery/types";
import type { Notification } from "@/features/notification/types";

export type DashboardResult = {
  attemptId: string;
  sessionId: string;
  title: string;
  completedAt: string;
  rawScore: string;
  totalScore: string;
  passed: boolean;
};

export type ParticipantDashboard = {
  serverTime: string;
  available: PageResult<DiscoveredSession>;
  upcoming: PageResult<DiscoveredSession>;
  completed: PageResult<DiscoveredSession>;
  inProgress: { id: string; sessionId: string; title: string; deadline: string }[];
  scores: { visibleSessionCount: number; averagePercentage: string | null };
  recentResults: DashboardResult[];
  unreadCount: number;
  notifications: Notification[];
};

export type DashboardSession = { id: string; title: string; startTime: string; endTime: string };

export type CreatorDashboard = {
  serverTime: string;
  counts: {
    questions: number;
    exams: number;
    activeSessions: number;
    upcomingSessions: number;
    participants: number;
  };
  questionCounts: { draft: number; active: number; archived: number };
  activeSessions: DashboardSession[];
  upcomingSessions: DashboardSession[];
  recentExams: { id: string; name: string; status: string }[];
  recentResults: DashboardResult[];
};

export type AdminDashboard = {
  serverTime: string;
  users: number;
  activeUsers: number;
  participants: number;
  creators: number;
  admins: number;
  exams: number;
  sessions: number;
  activeSessions: number;
  upcomingSessions: number;
};
