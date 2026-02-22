# Add Authentication to API

## Overview
Add JWT-based authentication to the REST API endpoints.

## Phase 1 - Auth Middleware
Set up the authentication middleware and JWT verification.

### Overview
Create middleware that validates JWT tokens on protected routes.

### Changes Required:

#### 1. JWT Middleware
**File**: `src/middleware/auth.ts` (new)

Validate Bearer tokens from the Authorization header.

```typescript
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  // verify token
}
```

#### 2. Token Utilities
**File**: `src/utils/jwt.ts` (new)

Helper functions for creating and verifying tokens.

### Success Criteria:

#### Automated Verification:
- [ ] Middleware rejects invalid tokens: `npm test -- auth`

#### Manual Verification:
- [ ] Protected routes return 401 without token

## Phase 2 - User Login
Implement the login endpoint and session management.

### Overview
Create login endpoint that returns JWT tokens.

### Changes Required:

#### 1. Login Controller
**File**: `src/controllers/auth.ts` (new)

Handle POST /api/login with username/password validation.

### Success Criteria:

#### Automated Verification:
- [ ] Login returns valid JWT: `npm test -- login`

#### Manual Verification:
- [ ] Can log in via curl
