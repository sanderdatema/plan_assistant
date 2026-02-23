export function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green/15 text-green";
    case "needs-work":
      return "bg-orange/15 text-orange";
    default:
      return "bg-accent/15 text-accent";
  }
}

export function sessionStatusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green/15 text-green";
    case "archived":
      return "bg-text-dim/15 text-text-dim";
    case "active":
    default:
      return "bg-accent/15 text-accent";
  }
}

export function diffStatusColor(status: string): string {
  switch (status) {
    case "added":
      return "border-l-green bg-green/5";
    case "removed":
      return "border-l-red bg-red/5";
    case "changed":
      return "border-l-orange bg-orange/5";
    default:
      return "border-l-border";
  }
}

export function diffStatusBadge(status: string): string {
  switch (status) {
    case "added":
      return "bg-green/15 text-green";
    case "removed":
      return "bg-red/15 text-red";
    case "changed":
      return "bg-orange/15 text-orange";
    default:
      return "bg-text-dim/15 text-text-dim";
  }
}
