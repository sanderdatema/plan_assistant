export interface PlanJson {
  schemaVersion: 1;
  meta: {
    title: string;
    date: string;
    ticketRef?: string;
    markdownPath: string;
    projectDir: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  overview: string;
  currentState: string;
  keyDiscoveries: { text: string; codeRef?: string }[];
  scopeExclusions: { title: string; reason: string }[];
  implementationApproach: string;
  phases: Phase[];
  diagrams: Diagram[];
  testingStrategy: {
    unit: string[];
    integration: string[];
    manual: string[];
  };
  references: string[];
}

export interface Phase {
  id: string;
  number: number;
  name: string;
  overview: string;
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
