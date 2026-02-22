import type { FeedbackPayload, FeedbackComment } from "$lib/types/feedback.js";

let currentFeedback = $state<FeedbackPayload | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId = $state<string>("");

function genId() {
  return (
    "fb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  );
}

async function persistFeedback() {
  if (!currentFeedback || !sessionId) return;
  try {
    await fetch(`/api/sessions/${sessionId}/feedback`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFeedback),
    });
  } catch {
    // retry on next save
  }
}

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistFeedback, 500);
}

export function getFeedbackStore() {
  return {
    get feedback() {
      return currentFeedback;
    },
    get comments() {
      return currentFeedback?.comments ?? [];
    },
    get phaseStatuses() {
      return currentFeedback?.phaseStatuses ?? {};
    },
    get subItemStatuses() {
      return currentFeedback?.subItemStatuses ?? {};
    },
    get status() {
      return currentFeedback?.status ?? "reviewing";
    },

    init(
      sid: string,
      planTitle: string,
      planVersion: number,
      existing?: FeedbackPayload | null,
    ) {
      sessionId = sid;
      if (existing) {
        // Backward compat: ensure subItemStatuses exists
        if (!existing.subItemStatuses) existing.subItemStatuses = {};
        currentFeedback = existing;
      } else {
        currentFeedback = {
          schemaVersion: 1,
          planTitle,
          planVersion,
          sessionId: sid,
          status: "reviewing",
          phaseStatuses: {},
          subItemStatuses: {},
          comments: [],
          updatedAt: new Date().toISOString(),
        };
      }
    },

    addComment(
      section: string,
      quote: string,
      comment: string,
      phaseId?: string,
    ) {
      if (!currentFeedback) return;
      const newComment: FeedbackComment = {
        id: genId(),
        section,
        quote,
        comment,
        phaseId,
        resolved: false,
        createdAt: new Date().toISOString(),
      };
      currentFeedback.comments = [...currentFeedback.comments, newComment];
      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
      return newComment.id;
    },

    updateComment(id: string, comment: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.map((c) =>
        c.id === id ? { ...c, comment } : c,
      );
      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
    },

    resolveComment(id: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.map((c) =>
        c.id === id ? { ...c, resolved: !c.resolved } : c,
      );
      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
    },

    deleteComment(id: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.filter(
        (c) => c.id !== id,
      );
      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
    },

    setPhaseStatus(
      phaseId: string,
      status: "pending" | "approved" | "needs-work",
      note?: string,
    ) {
      if (!currentFeedback) return;
      currentFeedback.phaseStatuses = {
        ...currentFeedback.phaseStatuses,
        [phaseId]: { phaseId, status, note },
      };
      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
    },

    setSubItemStatus(
      subItemId: string,
      phaseId: string,
      status: "pending" | "approved" | "needs-work",
      allSubItemIds: string[],
    ) {
      if (!currentFeedback) return;
      currentFeedback.subItemStatuses = {
        ...currentFeedback.subItemStatuses,
        [subItemId]: { subItemId, phaseId, status },
      };

      // Auto-aggregate to phase level
      const statuses = allSubItemIds.map(
        (id) => currentFeedback!.subItemStatuses[id]?.status ?? "pending",
      );
      const allSame = statuses.every((s) => s === statuses[0]);
      const aggregated = allSame ? statuses[0] : "pending";
      currentFeedback.phaseStatuses = {
        ...currentFeedback.phaseStatuses,
        [phaseId]: {
          phaseId,
          status: aggregated,
          note: currentFeedback.phaseStatuses[phaseId]?.note,
        },
      };

      currentFeedback.updatedAt = new Date().toISOString();
      debouncedSave();
    },

    async submitFeedback(status: "approved" | "needs-work") {
      if (!currentFeedback) return;
      currentFeedback.status = status;
      currentFeedback.submittedAt = new Date().toISOString();
      currentFeedback.updatedAt = new Date().toISOString();

      // Save immediately (not debounced)
      if (saveTimer) clearTimeout(saveTimer);
      await persistFeedback();

      if (status === "approved") {
        await fetch(`/api/sessions/${sessionId}/approve`, { method: "POST" });
      }
    },
  };
}
