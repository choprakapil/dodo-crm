# Follow-up Tasks & Reminders

Never lose track of a prospect. The Follow-up workspace (`/app/follow-ups`) organizes all scheduled sales touchpoints by urgency and due date.

---

## 1. Scheduling a Follow-up

You can schedule a follow-up directly from any lead detail view:
1. Open the lead at `/app/leads/[id]`.
2. Click **+ Schedule Follow-up**.
3. Enter:
   - **Task Title** (e.g. "Send revised pricing proposal").
   - **Due Date & Time**: When the task must be completed.
   - **Priority**: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
   - **Assignee**: Who is responsible (defaults to lead owner).
   - **Description**: Detailed preparation notes.
4. Click **Create Follow-up**.

A `TASK_CREATED` entry is automatically posted to the lead's timeline.

---

## 2. Follow-up Workspace (`/app/follow-ups`)

Navigate to `/app/follow-ups` in the top navigation to view your organized task queue:
- **Today**: Tasks scheduled for today.
- **Overdue**: Critical tasks whose due date has passed without completion.
- **Upcoming**: Scheduled future tasks.
- **All Follow-ups**: Unfiltered view across all statuses.
- **Completed**: Historical log of completed follow-ups.
- **Cancelled**: Abandoned tasks with reasons.

---

## 3. One-Click Completion

When you finish a task:
1. Locate the task in the Follow-ups table or on the lead detail view.
2. Click the green **Complete** button.
3. The task immediately transitions to `COMPLETED`, stamping your user ID and timestamp.
4. A `TASK_COMPLETED` event is posted to the associated lead's timeline, keeping the whole team informed.
