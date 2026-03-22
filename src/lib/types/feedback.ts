import type { PhaseStatus } from "../utils/status.js";

export type FeedbackStatus = "reviewing" | "approved" | "needs-work";

export interface FeedbackPayload {
  schemaVersion: 1;
  planTitle: string;
  planVersion: number;
  sessionId: string;
  status: FeedbackStatus;
  phaseStatuses: Record<
    string,
    {
      phaseId: string;
      status: PhaseStatus;
      note?: string;
    }
  >;
  subItemStatuses: Record<
    string,
    {
      subItemId: string;
      phaseId: string;
      status: PhaseStatus;
    }
  >;
  comments: FeedbackComment[];
  submittedAt?: string;
  updatedAt: string;
}

export interface FeedbackComment {
  id: string;
  section: string;
  quote: string;
  comment: string;
  phaseId?: string;
  resolved: boolean;
  createdAt: string;
}
