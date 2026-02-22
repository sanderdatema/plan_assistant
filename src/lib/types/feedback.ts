export interface FeedbackPayload {
  schemaVersion: 1;
  planTitle: string;
  planVersion: number;
  sessionId: string;
  status: "reviewing" | "approved" | "needs-work";
  phaseStatuses: Record<
    string,
    {
      phaseId: string;
      status: "pending" | "approved" | "needs-work";
      note?: string;
    }
  >;
  subItemStatuses: Record<
    string,
    {
      subItemId: string;
      phaseId: string;
      status: "pending" | "approved" | "needs-work";
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
