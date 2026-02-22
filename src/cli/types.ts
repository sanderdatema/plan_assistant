export interface SubItem {
  id: string;
  letter: string;
  name: string;
  content: string;
}

export interface Phase {
  id: string;
  number: number;
  name: string;
  overview: string;
  content?: string;
  subItems: SubItem[];
  changes: Change[];
  successCriteria: {
    automated: Criterion[];
    manual: Criterion[];
  };
}

export interface Change {
  componentName: string;
  filePath: string;
  description: string;
  codeSnippet?: string;
  codeLanguage?: string;
}

export interface Criterion {
  id: string;
  text: string;
  command?: string;
}

export interface Diagram {
  id: string;
  title: string;
  type: string;
  mermaidCode: string;
}

export interface SessionMeta {
  id: string;
  planTitle: string;
  markdownPath: string;
  projectDir: string;
  status: "active" | "approved" | "archived";
  planVersion: number;
  createdAt: string;
  updatedAt: string;
}

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
