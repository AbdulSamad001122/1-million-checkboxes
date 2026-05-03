# video Demo
https://youtube.com/shorts/LdvdhU8uG94

# 1 Million Checkboxes

A massive, real-time multiplayer experiment where thousands of users can toggle checkboxes simultaneously. This project demonstrates high-performance state synchronization using Node.js, Socket.io, and Redis.

## Project Overview

The concept is simple: a shared board of 100,000 checkboxes that anyone can toggle. The challenge lies in the implementation: every single click must be validated, rate-limited, and broadcast to all other connected users in near real-time. 

To handle this at scale, the backend uses a distributed architecture with Redis as the central source of truth. This allows multiple server instances to stay in sync and prevents state loss during restarts.

## Tech Stack

*   **Backend:** Node.js (Express)
*   **Real-time Communication:** Socket.io
*   **State Management & Pub/Sub:** Redis (ioredis)
*   **Authentication:** Custom OIDC (OpenID Connect) Provider
*   **Frontend:** Vanilla JavaScript, Modern CSS3
*   **Dev Tools:** Nodemon, Dotenv

## Features Implemented

*   **Real-time Synchronization:** Every checkbox toggle is instantly broadcast to all connected clients.
*   **Global State Persistence:** Checkbox states are stored in a Redis Hash, ensuring the board stays exactly as users left it even if the server restarts.
*   **Multi-Instance Support:** Uses Redis Pub/Sub to synchronize events across multiple backend workers or containers.
*   **Secure Authentication:** Integrated with an OIDC provider. Users must log in to interact with the board, preventing anonymous spam.
*   **Server-Side Rate Limiting:** Prevents botting by limiting users to 3 checkbox changes every 5 seconds.
*   **Intelligent UI Feedback:** The frontend detects rate limits and "locks" the board with a countdown timer to guide user behavior.
*   **View-Only Mode:** Unauthenticated users can watch the board live but cannot make changes.
*   **Optimized Initial Load:** The full board state is fetched via a single optimized Redis request when the page loads.

## How to Run Locally

### Prerequisites

*   Node.js (v18 or higher recommended)
*   Redis server (Local or Cloud instance)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd 1-million-checkboxes
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables (see below).

4. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:8002` (or your configured PORT).

## Environment Variables Required

Create a `.env` file in the root directory with the following keys:

```env
PORT=8002
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_TOKEN_ENDPOINT=https://your-oidc-provider.com/o/token
REDIS_URL=redis://localhost:6379
```

## Redis Setup Instructions

The project requires a Redis instance to manage state and handle cross-server communication.

### Option 1: Local Redis (Docker)
The easiest way to run Redis locally is via Docker:
```bash
docker run -d --name redis-local -p 6379:6379 redis
```

### Option 2: Cloud Redis
If using a service like Redis Insight or Aiven, provide the connection string in the `REDIS_URL` variable:
```env
REDIS_URL=redis://default:password@host:port
```

## Auth Flow Explanation

The application implements a secure OIDC (OpenID Connect) flow to ensure only verified users can modify the board state.

1.  **Initiation:** The user clicks "Login". The frontend redirects to the OIDC provider's authorization page.
2.  **Callback:** After successful login, the provider redirects back with an authorization code.
3.  **Token Exchange:** The frontend sends this code to the backend (`/api/callback`), which exchanges it for an `access_token` and `id_token` using the client secret.
4.  **Verification:** For every WebSocket message, the server takes the provided token and validates it against the OIDC `userinfo` endpoint.
5.  **Caching:** Validated user profiles are cached in Redis for 24 hours to reduce latency and avoid hammering the OIDC server.

## WebSocket Flow Explanation

The real-time synchronization follows a strict pipeline to ensure consistency:

1.  **Client Action:** A logged-in user toggles a checkbox.
2.  **Socket Emit:** The client emits `client:checkbox:change` containing the checkbox ID, its new state, and the user's auth token.
3.  **Server Validation:**
    *   The server verifies the token.
    *   The server checks the rate limit for that specific user ID.
4.  **Redis Publish:** If valid, the server publishes the change to a Redis channel (`client-to-internal-server:checkbox:change`).
5.  **Redis Subscribe:** All server instances (including the one that published) receive the message via their Redis Subscriber connection.
6.  **Persistence:** The message handler updates the Redis Hash (`checkboxes:state`) with the new value.
7.  **Broadcast:** The server emits `server:checkbox:change` to every connected client via Socket.io.
8.  **UI Update:** The frontend receives the event and updates the checkbox state without a page refresh.

## Rate Limiting Logic Explanation

To prevent abuse and maintain server stability, we implemented a sliding window rate limit using Redis:

*   **Key Format:** `rate-limit:${user_id}`
*   **Logic:** Every time a user attempts a change, we increment their specific counter in Redis.
*   **Expiry:** On the first increment, we set a TTL (Time To Live) of 5 seconds on the key.
*   **Threshold:** If the counter exceeds 3 within that 5-second window, the server rejects the request and sends an error message.
*   **Frontend Sync:** The frontend also tracks these timestamps. If it detects a breach, it disables all checkboxes and displays a "Cooldown" toast with a countdown until the user can interact again.

