# Widget Dashboard Implementation Plan

## Overview

Build a widget dashboard for the admin panel. Users need to create, arrange, and configure widgets.

## Current State

The admin panel has a static layout with no customization options.

### Key Discoveries

- Config loaded from JSON file (`src/config/dashboard.ts:15`)
- Layout engine exists but unused (`src/lib/layout.ts:42`)

## What We're NOT Doing

- Mobile responsive layout -- Not in scope for v1
- Widget marketplace -- Future feature

## Implementation Approach

Use a grid-based layout system with drag-and-drop support. Each widget is a self-contained Svelte component.

## Phase 1: Grid Layout Engine

### Overview

Build the core grid layout system with fixed-size cells.

### Changes Required:

#### 1. Grid Component

**File**: `src/lib/components/Grid.svelte`

Create the main grid container with CSS Grid.

```svelte
<div class="grid" style="grid-template-columns: repeat({cols}, 1fr)">
  <slot />
</div>
```

#### 2. Cell Component

**File**: `src/lib/components/Cell.svelte`

Individual grid cell with position tracking.

### Success Criteria:

#### Automated Verification:

- [ ] Grid renders correctly: `npm test -- grid`
- [ ] Cells snap to grid positions: `npm test -- cell`

#### Manual Verification:

- [ ] Grid displays in the admin panel
- [ ] Cells are visually distinct

## Phase 2: Widget System

### Overview

Create the widget abstraction layer and registry.

### Changes Required:

#### 1. Widget Registry

**File**: `src/lib/widgets/registry.ts`

Central registry for all available widget types.

#### 2. Base Widget

**File**: `src/lib/widgets/BaseWidget.svelte`

Abstract base component all widgets extend.

```typescript
interface WidgetConfig {
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
}
```

### Success Criteria:

#### Automated Verification:

- [ ] Widget registry loads: `npm test -- registry`

#### Manual Verification:

- [ ] Widgets render in grid cells

## Testing Strategy

### Unit Tests

- Grid layout calculations
- Widget registry operations

### Integration Tests

- Full dashboard render with multiple widgets

### Manual Testing Steps

1. Open admin panel
2. Verify grid renders
3. Add widgets

## References

- CSS Grid specification
- Similar implementation: `examples/dashboard`
