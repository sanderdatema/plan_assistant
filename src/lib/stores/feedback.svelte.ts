import type { FeedbackPayload, FeedbackComment } from "$lib/types/feedback.js";
import type { PhaseStatus } from "$lib/utils/status.js";

const SAVE_DEBOUNCE_MS = 500;

function genId() {
  return (
    "fb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  );
}

/** If all sub-items share the same status, return it; otherwise "pending". */
export function aggregateSubItemStatuses(
  statuses: PhaseStatus[],
): PhaseStatus {
  if (statuses.length === 0) return "pending";
  return statuses.every((s) => s === statuses[0]) ? statuses[0] : "pending";
}

let instance: ReturnType<typeof createFeedbackStore> | null = null;

function createFeedbackStore() {
  let currentFeedback = $state<FeedbackPayload | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionId = $state<string>("");

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
    saveTimer = setTimeout(persistFeedback, SAVE_DEBOUNCE_MS);
  }

  /** Stamp updatedAt and schedule a persist. */
  function touch() {
    currentFeedback!.updatedAt = new Date().toISOString();
    debouncedSave();
  }

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
      touch();
      return newComment.id;
    },

    updateComment(id: string, comment: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.map((c) =>
        c.id === id ? { ...c, comment } : c,
      );
      touch();
    },

    resolveComment(id: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.map((c) =>
        c.id === id ? { ...c, resolved: !c.resolved } : c,
      );
      touch();
    },

    deleteComment(id: string) {
      if (!currentFeedback) return;
      currentFeedback.comments = currentFeedback.comments.filter(
        (c) => c.id !== id,
      );
      touch();
    },

    setPhaseStatus(
      phaseId: string,
      status: PhaseStatus,
      note?: string,
    ) {
      if (!currentFeedback) return;
      currentFeedback.phaseStatuses = {
        ...currentFeedback.phaseStatuses,
        [phaseId]: { phaseId, status, note },
      };
      touch();
    },

    setSubItemStatus(
      subItemId: string,
      phaseId: string,
      status: PhaseStatus,
      allSubItemIds: string[],
    ) {
      if (!currentFeedback) return;
      currentFeedback.subItemStatuses = {
        ...currentFeedback.subItemStatuses,
        [subItemId]: { subItemId, phaseId, status },
      };

      // Auto-aggregate to phase level
      const aggregated = aggregateSubItemStatuses(
        allSubItemIds.map(
          (id) => currentFeedback!.subItemStatuses[id]?.status ?? "pending",
        ),
      );
      currentFeedback.phaseStatuses = {
        ...currentFeedback.phaseStatuses,
        [phaseId]: {
          phaseId,
          status: aggregated,
          note: currentFeedback.phaseStatuses[phaseId]?.note,
        },
      };

      touch();
    },

    async submitFeedback(status: "approved" | "needs-work") {
      if (!currentFeedback) return;
      currentFeedback.status = status;
      currentFeedback.submittedAt = new Date().toISOString();
      currentFeedback.updatedAt = currentFeedback.submittedAt;

      // Save immediately (not debounced)
      // The feedback PUT endpoint already handles session status update
      if (saveTimer) clearTimeout(saveTimer);
      await persistFeedback();
    },
  };
}

export function getFeedbackStore() {
  if (!instance) instance = createFeedbackStore();
  return instance;
}
