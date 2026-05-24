# OmniMind AI - Security Specification

This document details the critical security rules, identity validations, and data invariants governing the Firestore database in OmniMind AI.

## 1. Data Invariants

1. **User Profiling**: Each user's private settings are stored in `/users/{userId}`. Users can only read and write their own profile document (`request.auth.uid == userId`).
2. **Chat Sessions**: Access to `/chats/{chatId}` and its subcollection `/messages/{messageId}` is strictly restricted to the user who created them (`resource.data.userId == request.auth.uid`). No other authenticated user can read or query another user's chat logs.
3. **Documents**: Access to uploaded records inside `/documents/{documentId}` is locked under ownership filters (`userId == auth.uid`).
4. **Knowledge Entries**: Personal semantic context items stored in `/knowledge/{itemId}` are restricted strictly to user-level ownership.
5. **Productivity Nodes**: `/notes/{noteId}`, `/tasks/{taskId}`, and `/goals/{goalId}` are user-scoped entities. Cross-tenant writes are strictly blocked.

---

## 2. The "Dirty Dozen" Vulnerability Payloads

The following payloads represent illegal requests designed to test updates and creation traps. The security rules will instantly fail these transactions with `PERMISSION_DENIED`.

| Payload ID | Targeted Collection | Attack Vector | Expected Result |
|---|---|---|---|
| DD-01 | `users/alice` | Spoof profile of `alice` as authenticated user `bob` | `PERMISSION_DENIED` |
| DD-02 | `users/bob` | Malicious user bob attempts to sets `isAdmin: true` during profile update | `PERMISSION_DENIED` |
| DD-03 | `chats/chat1` | Create chat session where `userId` is set to different uid `victim123` | `PERMISSION_DENIED` |
| DD-04 | `chats/chat1/messages/msg1` | Inject a message payload claiming `role` is `user` but posting to another user's chat session | `PERMISSION_DENIED` |
| DD-05 | `documents/doc1` | Attacker queries files and is returned notes uploaded by target | `PERMISSION_DENIED` |
| DD-06 | `tasks/task1` | Complete task belonging to victim user | `PERMISSION_DENIED` |
| DD-07 | `goals/goal1` | Inject a value size overflow attack via description string size > 2000 | `PERMISSION_DENIED` |
| DD-08 | `notes/note1` | Update a whitelisted field but include a ghost field `superAdminOverride: true` | `PERMISSION_DENIED` |
| DD-09 | `chats/chat1` | Bypassing schema layout by omitting the `title` field | `PERMISSION_DENIED` |
| DD-10 | `chats/chat1` | Injecting massive IDs with size > 1500 chars to cause resource exhaustion | `PERMISSION_DENIED` |
| DD-11 | `notes/note1` | Attempting to update `createdAt` field after creation (immutability bypass) | `PERMISSION_DENIED` |
| DD-12 | `tasks/task1` | Attempting to set standard client timestamp instead of authentic server `request.time` | `PERMISSION_DENIED` |

---

## 3. Standard Global Rules Declarations

The `firestore.rules` matches this spec using rigorous verification blocks wrapping all CRUD methods.
