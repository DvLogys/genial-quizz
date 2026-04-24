# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (exposed on all network interfaces via --host)
npm run build        # Type-check + build for production
npm run test:unit    # Run Vitest tests (watch mode)
npm run lint         # Run oxlint then eslint, both with --fix
npm run format       # Format src/ with Prettier
npm run type-check   # vue-tsc type check only
```

Run a single test file: `npx vitest run src/path/to/file.spec.ts`

The frontend expects a backend at `VITE_API_URL` (default `http://localhost:3000/api`). The API contract lives in `openapi.yaml` at the repo root — any backend implementing that spec can serve the frontend.

## Architecture

**Stack:** Vue 3 (Composition API, `<script setup>`) + Vite + TypeScript + Pinia + Vue Router 5. The `@` alias resolves to `src/`.

**Presenter-only design:** The game is a single-presenter panel. Players are expected to be in the same physical room or watching a stream, so there are no realtime/player endpoints in the API — everything (player names, scoring) is managed in the presenter's browser.

### Routes and guards (`src/router/index.ts`)

- `/login`, `/register` — guest-only (redirect to `/quizzes` if already authenticated)
- `/quizzes` — quiz browser (my quizzes if logged in + public quizzes), anonymous-friendly
- `/quizzes/new` — auth required, redirects to `/login?redirect=...` if not authenticated
- `/quizzes/:id` — SetupView in edit mode (owner) or read-only mode (non-owner viewing a public quiz)
- `/board` — in-memory game, redirects to `/quizzes` if the game store is not in `playing` phase
- `/` and unknown paths redirect to `/quizzes`

The `beforeEach` guard calls `authStore.init()` once on first navigation to restore the session from a stored JWT.

### Backend integration

- **API client** (`src/api/client.ts`) — fetch wrapper that attaches `Authorization: Bearer <token>` from `localStorage["genial-quizz:token"]`, serializes JSON bodies, throws `ApiError` on non-2xx responses.
- **API modules** — `src/api/auth.ts` (register/login/me), `src/api/quizzes.ts` (list mine, list public, get, create, update, remove).
- **Auth store** (`src/stores/auth.ts`) — holds the current `User`, exposes `init/login/register/logout`. Token persistence is delegated to `client.ts` (`setToken`/`getToken`).
- **Images** travel inside the quiz JSON as strings: either an external URL or an inline `data:image/…;base64,…` URL from a local file upload. No separate image upload endpoint.

### Game flow

1. User lands on `/quizzes` (QuizListView) and picks a quiz to edit/view/play or creates a new one.
2. `/quizzes/:id` or `/quizzes/new` loads SetupView, which combines quiz content editing (owner only) with player setup (always editable).
3. On **Sauvegarder** (owner only), the quiz is persisted via `POST /quizzes` or `PUT /quizzes/:id`. The `isPublic` toggle controls anonymous access.
4. On **Lancer la partie**, SetupView pushes players into `playerStore`, categories into `gameStore`, calls `gameStore.startGame()`, and navigates to `/board`.
5. BoardView enforces that the game store is seeded; otherwise it bounces back to `/quizzes`.

### Stores (`src/stores/`)

- `auth.ts` — `user`, `isAuthenticated`, `initialized`; `init/login/register/logout`.
- `game.ts` — `phase` (`'setup' | 'playing'`), `categories`; `initCategories`, `markPlayed`, `getCell`, `startGame`, `resetGame`.
- `player.ts` — up to 6 players, active-player tracking, `updateScore` (adds/subtracts signed amount).

### Types (`src/types.ts`)

- Two question variants discriminated by `type`: `DirectQuestion` and `GuessTheMostQuestion`.
- `POINT_TIERS = [100, 200, 300, 500, 700, 1000]` — default tier values; custom tiers supported.
- Backend-facing types: `User`, `AuthResponse`, `QuizSummary`, `QuizDetail`, `QuizInput`.
- `QuestionCell` carries `categoryIndex`, `tierIndex`, `points`, `question`, and `played` flag (runtime only, not persisted).

### Components

- `QuestionModal.vue` — scoring logic. For `direct`: correct (+points), half (+floor(points/2)), wrong (-points), skip. For `guess_the_most`: each word revealed individually, points split evenly (`floor(points / words.length)`) and assigned per player. Calls `gameStore.markPlayed` on any close action.
- `PlayerSidebar.vue` — player list with scores and active-player highlighting.

### Quiz config (`src/config/defaultQuiz.ts`)

Still used as the seed when creating a new quiz in SetupView. Also doubles as the JSON import/export shape (SetupView keeps manual Export/Import buttons for offline backup independent of the backend).

### Styling

CSS custom properties in `src/assets/base.css` (colors, shadows, border-radii, fonts). Display font: `Fredoka One`; body font: `Outfit`. All components use `<style scoped>` with these variables.

### Linting pipeline

`oxlint` runs before `eslint` (both with `--fix`). Vitest environment is `jsdom` with setup in `src/test-setup.ts`.

## API contract

The complete API is described in `openapi.yaml` (OpenAPI 3.1). Highlights:

- JWT bearer auth (`/auth/register`, `/auth/login`, `/auth/me`).
- `GET /quizzes` (mine, auth required) and `GET /quizzes/public` (anonymous).
- `GET /quizzes/{id}` — auth optional: public quizzes are accessible to anyone, private ones only to the owner.
- `POST /quizzes`, `PUT /quizzes/{id}`, `DELETE /quizzes/{id}` — owner-only.

When changing the API shape, update both `openapi.yaml` and the TypeScript types in `src/types.ts` together.
