# Fix Login Bug

## Phase 1: Patch Token Validation

### Changes Required:

#### 1. Fix expiry check

**File**: `src/auth.ts`

The token expiry comparison uses `<` instead of `<=`, causing tokens to expire one second early.
