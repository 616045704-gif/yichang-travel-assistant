# Dify Blocking Integration Hardening Design

**Date:** 2026-09-05  
**Status:** Proposed for implementation  
**Scope:** Harden the existing `chat` and `trip` Dify Chatflow integration while retaining blocking mode.

## 1. Goals and non-goals

This change keeps the current CloudBase-first architecture and addresses the remaining reliability, history, data-model, and abuse-control gaps.

Goals:

- Keep Dify credentials only in CloudBase function environment variables.
- Keep all Dify requests behind the `aiService` cloud function.
- Query verified local place data before Dify and pass it as `local_verified_facts`.
- Keep `chat` and `trip` conversations independent.
- Prevent concurrent requests with the same request ID from invoking Dify more than once.
- Repair conversation state after a partial database write.
- Show the user's original question or trip conditions in history.
- Return the newest 50 owner-scoped history items deterministically.
- Enforce owner-scoped AI limits of 3 new requests per minute and 20 per day.
- Stop silently treating local content database failures as empty content.

Non-goals:

- No asynchronous worker, streaming response, payment, booking, ticketing, merchant onboarding, phone login, or third-party mini-program content copying.
- No secrets, real user identifiers, or Dify conversation identifiers are exposed to the mini-program or committed to Git.
- No destructive migration of existing AI records.

## 2. Request flow

Both `chat` and `trip` use the same blocking orchestration pattern:

1. Authenticate the caller and derive the trusted owner ID from CloudBase context.
2. Validate and normalize the request. The client supplies a request ID, but never an owner ID or a Dify conversation ID.
3. Query the local `places` and `place_contents` collections. Only verified place facts are formatted as `local_verified_facts`.
4. In a CloudBase transaction, claim the deterministic request record and, for a new request, consume the applicable minute and daily quota.
5. Invoke the correct Dify Chatflow in blocking mode with bounded network retries and the existing total upstream timeout.
6. Persist the public result and internal Dify conversation ID, then update the owner-and-kind session pointer.
7. Return only the public response DTO to the mini-program.

The `trip` Chatflow receives these custom inputs:

- `destination`
- `people`
- `totalBudgetCny`
- `days`
- `preferences`
- optional `local_verified_facts`

The built-in `query` field remains the current user message. The `chat` flow also uses `query` and receives verified local context through its configured context input.

## 3. Idempotency and concurrency

Each request record uses a deterministic document ID derived from `ownerId + requestId`. Its normalized input is hashed separately.

The transaction handles existing records as follows:

- Same request ID and same input, status `succeeded`: return the cached public result. If the record contains an internal Dify conversation ID, repair the session pointer before returning.
- Same request ID and same input, status `running` and claim not stale: do not call Dify again. Return a safe `CONFLICT` response explaining that the request is still processing and can be retried shortly.
- Same request ID and different input: return `CONFLICT`; the client must generate a new request ID.
- Same request ID and status `failed` or `timed_out`: allow an explicit retry by reclaiming the record. The same logical request is not charged quota again.
- Stale `running` claim: move it to a retryable state before reclaiming it. A claim becomes stale after 90 seconds, which is longer than the 45-second Dify request deadline.

The initial request claim and quota consumption occur in one database transaction. This prevents simultaneous CloudBase invocations from both treating the same request as new.

Dify does not provide a guaranteed idempotency key for this API. Therefore, exact-once upstream execution cannot be promised after an ambiguous network disconnect where Dify may have completed but CloudBase did not receive the response. The implementation must not claim otherwise. Bounded automatic retries remain limited to transient failures, and ambiguous failures are recorded and surfaced safely instead of inventing a successful result.

## 4. Persistence model

The implementation retains the current combined request-and-response record model rather than introducing role-per-message records.

### `ai_messages`

Stores `chat` requests and responses with these canonical fields:

- `_id`: deterministic hash of owner ID and request ID
- `ownerId`
- `requestId`
- `kind`: `chat`
- `inputHash`
- sanitized request fields, including the user's question
- public result fields
- internal `difyConversationId`, optional and never returned to the client
- `status`: `running`, `succeeded`, `failed`, or `timed_out`
- attempt, claim, and one-time quota-charge timestamps
- `createdAt`
- `updatedAt`

### `trip_requests`

Uses the same operational fields with `kind: trip` and sanitized trip inputs: destination, people, total budget, days, preferences, and current question.

### `ai_sessions`

Keeps one internal session pointer per owner and kind. `chat` and `trip` therefore remain independent. A result record is the recovery source if writing the result succeeds but updating the session fails.

### `usage_counters`

Stores deterministic owner-and-window counters for rate limiting. The collection must use `ADMINONLY` permissions.

Existing combined records remain readable. Missing new status fields or an internal conversation ID are tolerated, and the existing `ai_sessions` pointer remains a fallback. No destructive data migration is required.

## 5. Atomic finalization and repair

After Dify succeeds, the cloud function stores the result and internal Dify conversation ID and updates the matching session pointer within one transaction where supported by the CloudBase SDK.

If the platform cannot guarantee the whole finalization transaction, the durable result record is written first and becomes the recovery source. A repeated request that finds a successful cached record repairs `ai_sessions` from the stored internal conversation ID before returning. Session repair is owner- and kind-scoped and never exposes the identifier to the frontend.

Failed or timed-out attempts update the request record with a safe status and diagnostic category. Raw credentials, authorization headers, full upstream payloads, and sensitive identifiers are not logged.

## 6. History contract and UI

`AiHistoryItem` gains a safe user-input display field:

- `chat`: the original question.
- Initial `trip`: a concise summary of destination, people, days, total budget, and preferences.
- Follow-up `trip`: the follow-up question.

The AI page renders the user bubble before the assistant response. It never renders Dify conversation IDs or secrets.

History queries are owner-scoped and ordered using:

`where(ownerId).orderBy(createdAt, 'desc').limit(50)`

The cloud function merges chat and trip records, sorts them newest-first with a deterministic ID tie-breaker, and returns the newest 50 items. Database documentation and index definitions are updated to match the implemented combined-record model. Both record collections receive an index on `ownerId ASC, createdAt DESC, _id ASC`.

## 7. Rate limiting

Only the first upstream attempt for a logical request consumes quota:

- Maximum 3 new AI requests per owner per fixed one-minute window.
- Maximum 20 new AI requests per owner per calendar day in `Asia/Shanghai`.
- A cached replay or retry of the same request ID and input does not consume quota again.
- Different owners have independent counters.

The counters are incremented atomically with the request claim. Exceeding either limit returns a safe `RATE_LIMITED` response with a clear retry message; Dify is not called.

## 8. Local data failure behavior

Missing optional `place_contents` documents are treated as absent content. Other CloudBase errors—permission failures, timeouts, unavailable service, malformed responses, and unexpected SDK errors—are propagated to the normal error handler. The function must not silently call Dify with empty local context when the verified local data service is failing.

## 9. Error handling

- Network and transient Dify errors retain bounded retries.
- The upstream deadline remains shorter than the mini-program cloud-call timeout.
- Validation errors return a clear non-retryable message.
- `CONFLICT` identifies request-ID reuse or an already-running request.
- `RATE_LIMITED` identifies quota exhaustion.
- Local database and terminal upstream failures return understandable retry guidance; the UI must not show a blank page or fabricated result.

## 10. Test strategy

Automated coverage must include:

- successful blocking `chat` and `trip` calls with verified local facts;
- independent chat/trip conversation pointers;
- cached idempotent replay;
- same request ID with different input conflict;
- concurrent claim allowing only one Dify invocation;
- partial result/session write followed by cached session repair;
- failed, timed-out, and stale-claim retry paths;
- quota boundaries, rollover windows, cached replay, and owner isolation;
- newest-first history with a deterministic 50-item limit;
- question and trip-condition display in frontend history;
- propagation of non-missing local content database errors;
- blocking timeout, transient retry, and safe error messages;
- package scans proving no Dify URL, key, authorization header, or internal conversation ID leaks into the mini-program bundle.

Before delivery, run the full unit suite, type checking, linting, both builds, package inspection, documentation verification, and diff checks. After deployment, perform real CloudBase smoke tests for chat, trip, follow-up continuity, cached replay, history, rate-limit rejection, and session recovery. Independent code review and QA records must reference the tested Git commit and clearly identify any environment-only checks not performed.

## 11. Rollout

1. Update shared contracts, cloud persistence/orchestration, frontend history rendering, database schema, and index definitions with automated tests.
2. Run local verification and create focused commits for independently reviewable changes.
3. Deploy the cloud function without placing keys in files or command output.
4. Create `usage_counters` with `ADMINONLY` permissions.
5. Create or verify the required `ai_messages` and `trip_requests` compound indexes.
6. Run real-environment smoke tests and record the results.
7. Complete independent code review and QA before final acceptance.
