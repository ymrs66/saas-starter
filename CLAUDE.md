# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Database Setup
```bash
# Initial setup - creates .env file from prompts
pnpm db:setup

# Run migrations
pnpm db:migrate

# Seed database with default user (test@test.com / admin123)
pnpm db:seed

# Open Drizzle Studio for database inspection
pnpm db:studio

# Generate new migrations after schema changes
pnpm db:generate
```

### Running the Application
```bash
# Development server (uses Turbopack)
pnpm dev

# Production build
pnpm build

# Production server
pnpm start
```

### Local Postgres (Docker)
```bash
# Start database
docker compose up -d

# Stop database
docker compose down
```
Database runs on port 54322 (not the default 5432).

### Stripe Webhooks
```bash
# Listen for Stripe webhooks locally
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Architecture Overview

### Authentication System
- **JWT-based sessions** stored in HTTP-only cookies (lib/auth/session.ts)
- Session expiry: 24 hours, auto-refreshed on GET requests
- Password hashing: bcryptjs with 10 salt rounds
- **Global middleware** (middleware.ts): Protects /dashboard routes, redirects unauthenticated users to /sign-in
- **Local middleware** (lib/auth/middleware.ts): Three helper functions for Server Actions:
  - `validatedAction`: Zod schema validation only
  - `validatedActionWithUser`: Schema validation + user authentication
  - `withTeam`: Retrieves authenticated user's team data

### Database Layer
- **ORM**: Drizzle with PostgreSQL
- **Schema** (lib/db/schema.ts): Single source of truth for all tables
- **Queries** (lib/db/queries.ts): Centralized data access functions, always use `getUser()` to check authentication
- **Articles** (lib/db/articles-queries.ts): Article-specific CRUD operations with permission checks
- **Type safety**: Use exported types from schema (User, Team, Article, etc.)
- **Permission helpers**: `canUserAccessArticle()` for read access, `canUserModifyArticle()` for write access
- **Soft deletes**: Users marked with `deletedAt` timestamp, email modified to `${email}-${id}-deleted` for uniqueness

### Route Organization
Next.js App Router with route groups:
- **(login)**: Unauthenticated routes (sign-in, sign-up)
- **(dashboard)**: Protected routes requiring authentication
  - `/dashboard` - Main dashboard home
  - `/dashboard/articles` - Article CRUD management
  - `/dashboard/pricing` - Pricing page with Stripe checkout
  - `/dashboard/general` - User account settings
  - `/dashboard/security` - Password/account security
  - `/dashboard/activity` - Activity logs
- **(public)**: Public-facing content (e.g., published articles)
- **api/**: API routes for REST endpoints and webhooks
  - `/api/articles` - Article API (GET with pagination, POST)
  - `/api/articles/[id]` - Single article operations (GET, PUT, DELETE)
  - `/api/categories` - Category management
  - `/api/stripe/webhook` - Stripe webhook handler
  - `/api/stripe/checkout` - Checkout session creation

### Server Actions Pattern
All Server Actions follow this structure:
1. Authenticate user with `getUser()` (from lib/db/queries.ts)
2. Validate input with Zod schemas (from lib/validations/)
3. Check permissions (e.g., `canUserModifyArticle()`)
4. Perform database operation
5. Call `revalidatePath()` to update UI
6. Return `ActionState` with success/error messages

### Stripe Integration
- Checkout: Creates session via api/stripe/checkout/route.ts
- Webhooks: Handles subscription events in api/stripe/webhook/route.ts
- Customer Portal: Managed through Stripe Customer Portal
- Test mode: Always use test keys (sk_test_*, whsec_*)

### Activity Logging
- Enum-based activity types in schema (ActivityType)
- Common events: SIGN_UP, SIGN_IN, CREATE_ARTICLE, UPDATE_ARTICLE, etc.
- Logs stored in activityLogs table with user/team associations

### Multi-Tenancy Model
- Users belong to Teams via teamMembers junction table
- Teams have RBAC with Owner/Member roles
- Team-level subscription management with Stripe
- Articles belong to both Users (author) and Teams (owner)

### Article System
- **Status types**: `draft` (team members only), `published` (public), `unpublished` (team members only)
- **Team ownership**: All articles have a `teamId` - only team members can create, update, delete, or view non-public articles
- **Slug generation**: URL-friendly, validated with regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- **Categories**: Optional single category per article
- **Tags**: Many-to-many relationship via articleTags junction table
- **Timestamps**: `createdAt`, `updatedAt`, `publishedAt` (set when status changes to published)

### Authorization Rules

#### Team-based Access Control
All articles must have a `teamId` field. Access is controlled as follows:

**Published Articles:**
- Viewable by anyone (public access)
- Only team members can modify or delete

**Draft/Unpublished Articles:**
- Only team members can view, create, update, or delete
- Completely hidden from non-team members

**Permission Functions:**
- `canUserAccessArticle(articleId, userId)`: Checks if user can view an article (public OR team member)
- `canUserModifyArticle(articleId, userId)`: Checks if user can edit/delete an article (team member only)
- `getTeamMembership(userId, teamId)`: Verifies team membership

**Implementation Pattern:**
```typescript
// Check team membership before article operations
const user = await getUser();
const team = await getTeamForUser();
if (!team) {
  return { error: 'チームが見つかりません' };
}

// Create article with team context
await createArticle({
  userId: user.id,
  teamId: team.id,
  // ... other fields
});

// Verify permissions for modifications
const canModify = await canUserModifyArticle(articleId, user.id);
if (!canModify) {
  return { error: 'この記事を編集する権限がありません' };
}
```

## Key Patterns

### Adding New Features
1. Define schema in lib/db/schema.ts with proper relations
2. Export TypeScript types using `$inferSelect` and `$inferInsert`
3. Create queries in lib/db/ (separate file for complex features)
4. Define Zod validation schemas in lib/validations/
5. Create Server Actions in route-specific actions.ts files
6. Use middleware helpers (validatedActionWithUser, etc.)
7. Add activity logging for audit trail
8. Revalidate affected paths after mutations

### Working with Server Actions
- Always prefix files with 'use server'
- Use curried functions for actions needing IDs: `updateArticleAction(id)` returns `(prevState, formData) => Promise<ActionState>`
- Handle both FormData and direct object inputs
- Return ActionState for client-side error/success handling

### Database Migrations
1. Update lib/db/schema.ts
2. Run `pnpm db:generate` to create migration files
3. Run `pnpm db:migrate` to apply migrations
4. Migration files are stored in lib/db/migrations/

## UI Component Guidelines

### Component Library Strategy
- **Always use shadcn/ui components** as the foundation for all UI elements
- Install new shadcn components via CLI when needed: `pnpm dlx shadcn@latest add <component>`
- Custom/reusable UI primitives should be placed in `/components/ui/*`
- Business logic components and page-specific components go in `/components/*` or colocated with routes

### Color Scheme Standards
**CRITICAL**: All components must follow the existing SaaS Starter color scheme using semantic tokens. Never use hardcoded colors.

**Semantic Color Tokens:**
```typescript
// Light and Dark mode compatible
- bg-background / text-foreground     // Main background and text
- bg-card / text-card-foreground      // Card backgrounds
- bg-primary / text-primary-foreground // Primary actions (buttons, links)
- bg-secondary / text-secondary-foreground // Secondary elements
- bg-muted / text-muted-foreground    // Muted/disabled content
- bg-accent / text-accent-foreground  // Hover states, highlights
- bg-destructive / text-destructive-foreground // Errors, delete actions
- border-border                        // All borders
- border-input                         // Form inputs
- ring-ring                            // Focus rings
```

**FORBIDDEN Patterns:**
```typescript
// ❌ NEVER use hardcoded colors
className="bg-orange-500 text-white"
className="text-gray-700 bg-gray-50"
className="border-gray-300"

// ✅ ALWAYS use semantic tokens
className="bg-primary text-primary-foreground"
className="text-foreground bg-background"
className="border-border"
```

### Component Structure Pattern
```typescript
// Preferred component structure
interface ComponentNameProps {
  // Props definition with clear types
  title: string;
  onAction?: () => void;
}

export function ComponentName({ title, onAction }: ComponentNameProps) {
  // Implementation
  return (
    <div className="bg-card text-card-foreground border border-border">
      <h2 className="text-foreground">{title}</h2>
      <Button onClick={onAction}>Action</Button>
    </div>
  );
}
```

### Styling Best Practices
- Use Tailwind utility classes exclusively - no custom CSS unless absolutely necessary
- Leverage theme design tokens from `app/globals.css` for consistency
- Use CSS variable notation for dynamic colors: `bg-primary/10` for 10% opacity
- Prefer semantic spacing: `p-4`, `gap-4`, `space-y-4` over arbitrary values
- Use responsive variants: `text-sm lg:text-base` for mobile-first design

### Button Styling
```typescript
// ✅ Correct - uses shadcn Button with semantic colors
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

// ❌ Wrong - hardcoded colors override theme
<Button className="bg-orange-500 hover:bg-orange-600">Action</Button>
```

### Form Input Styling
```typescript
// ✅ Correct - uses shadcn Input with theme colors
<Input
  placeholder="Email"
  className="rounded-full" // Additional styling only
/>

// ❌ Wrong - hardcoded colors and focus states
<Input
  className="border-gray-300 focus:ring-orange-500 text-gray-900"
/>
```

### Common Patterns
**Cards:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Content</p>
  </CardContent>
</Card>
```

**Icons with theme colors:**
```typescript
// ✅ Use semantic colors
<AlertCircle className="h-12 w-12 text-primary" />
<Check className="h-5 w-5 text-primary" />

// ❌ Don't use hardcoded colors
<AlertCircle className="h-12 w-12 text-orange-500" />
```

**Status badges:**
```typescript
<Badge variant="default">Published</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Pending</Badge>
```

### Adding New Components
When you need functionality not provided by existing shadcn components:
1. Check if shadcn offers the component: https://ui.shadcn.com/docs/components
2. Install via CLI: `pnpm dlx shadcn@latest add <component-name>`
3. Create custom components in `/components/ui/` only if shadcn doesn't provide it
4. Always use semantic color tokens, never hardcoded colors
5. Follow the established naming and structure patterns

## Environment Variables
Required variables (see .env.example):
- `POSTGRES_URL`: Database connection string
- `STRIPE_SECRET_KEY`: Stripe API key (use sk_test_* for development)
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret
- `BASE_URL`: Application base URL (http://localhost:3000 for local)
- `AUTH_SECRET`: JWT signing secret (generate with `openssl rand -base64 32`)

## Testing
Default seeded user credentials:
- Email: test@test.com
- Password: admin123

Stripe test card:
- Number: 4242 4242 4242 4242
- Expiry: Any future date
- CVC: Any 3-digit number

## Technology Stack
- **Framework**: Next.js 15.4 with App Router and Turbopack
- **Runtime**: React 19.1
- **Language**: TypeScript 5.8 (strict mode)
- **Database**: PostgreSQL (via Docker, port 54322)
- **ORM**: Drizzle 0.43 with postgres-js driver
- **UI**: shadcn/ui components, Radix UI primitives, Tailwind CSS 4.1
- **Auth**: JWT sessions (jose), bcryptjs for password hashing
- **Payments**: Stripe 18.1 (subscriptions, webhooks, customer portal)
- **Validation**: Zod schemas
- **Data fetching**: SWR 2.3
- **Package manager**: pnpm 10.17
- **Theme**: Dark mode support via next-themes

## API Response Patterns
Articles API example:
```typescript
// GET /api/articles?page=1&limit=10&status=published&search=keyword
{
  articles: Article[],
  pagination: {
    page: number,
    limit: number,
    totalCount: number,
    totalPages: number
  }
}
```

Server Actions return type:
```typescript
type ActionState = {
  error?: string;
  success?: string;
  [key: string]: any; // Additional data like articleId, newData, etc.
}
```
