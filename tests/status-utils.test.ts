import { describe, it, expect } from "vitest";
import {
  statusLabel,
  statusBadgeClass,
  sessionStatusBadgeClass,
  diffStatusColor,
  diffStatusBadge,
} from "../src/lib/utils/status.js";

describe("statusLabel", () => {
  it("returns 'Approved' for approved", () => {
    expect(statusLabel("approved")).toBe("Approved");
  });

  it("returns 'Needs Work' for needs-work", () => {
    expect(statusLabel("needs-work")).toBe("Needs Work");
  });

  it("returns 'Pending' for pending", () => {
    expect(statusLabel("pending")).toBe("Pending");
  });

  it("returns 'Pending' for unknown status", () => {
    expect(statusLabel("unknown")).toBe("Pending");
  });
});

describe("statusBadgeClass", () => {
  it("returns green class for approved", () => {
    expect(statusBadgeClass("approved")).toBe("bg-green/15 text-green");
  });

  it("returns orange class for needs-work", () => {
    expect(statusBadgeClass("needs-work")).toBe("bg-orange/15 text-orange");
  });

  it("returns accent class for pending/default", () => {
    expect(statusBadgeClass("pending")).toBe("bg-accent/15 text-accent");
    expect(statusBadgeClass("unknown")).toBe("bg-accent/15 text-accent");
  });
});

describe("sessionStatusBadgeClass", () => {
  it("returns green for approved", () => {
    expect(sessionStatusBadgeClass("approved")).toBe("bg-green/15 text-green");
  });

  it("returns dim for archived", () => {
    expect(sessionStatusBadgeClass("archived")).toBe("bg-text-dim/15 text-text-dim");
  });

  it("returns accent for active/default", () => {
    expect(sessionStatusBadgeClass("active")).toBe("bg-accent/15 text-accent");
    expect(sessionStatusBadgeClass("unknown")).toBe("bg-accent/15 text-accent");
  });
});

describe("diffStatusColor", () => {
  it("returns green for added", () => {
    expect(diffStatusColor("added")).toBe("border-l-green bg-green/5");
  });

  it("returns red for removed", () => {
    expect(diffStatusColor("removed")).toBe("border-l-red bg-red/5");
  });

  it("returns orange for changed", () => {
    expect(diffStatusColor("changed")).toBe("border-l-orange bg-orange/5");
  });

  it("returns border for default", () => {
    expect(diffStatusColor("unchanged")).toBe("border-l-border");
  });
});

describe("diffStatusBadge", () => {
  it("returns green for added", () => {
    expect(diffStatusBadge("added")).toBe("bg-green/15 text-green");
  });

  it("returns red for removed", () => {
    expect(diffStatusBadge("removed")).toBe("bg-red/15 text-red");
  });

  it("returns orange for changed", () => {
    expect(diffStatusBadge("changed")).toBe("bg-orange/15 text-orange");
  });

  it("returns dim for default", () => {
    expect(diffStatusBadge("unchanged")).toBe("bg-text-dim/15 text-text-dim");
  });
});
