import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { cronDB } from "./db";
import log from "encore.dev/log";

// Task reminders API endpoint
export const taskRemindersHandler = api<void, void>(
  { expose: false, method: "POST", path: "/cron/task-reminders" },
  async () => {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find tasks that are due within the next hour and haven't been reminded recently
      const dueTasks = await cronDB.queryAll`
        SELECT 
          t.id, t.title, t.due_at, t.property_id,
          p.name as property_name,
          u.id as assignee_user_id, u.display_name as assignee_name, u.email as assignee_email,
          o.name as org_name
        FROM tasks t
        JOIN properties p ON t.property_id = p.id
        JOIN organizations o ON t.org_id = o.id
        LEFT JOIN staff s ON t.assignee_staff_id = s.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE t.status IN ('open', 'in_progress')
          AND t.due_at BETWEEN ${now} AND ${oneHourFromNow}
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = u.id 
              AND n.type = 'task_reminder'
              AND n.payload_json->>'task_id' = t.id::text
              AND n.created_at > NOW() - INTERVAL '1 hour'
          )
      `;

      for (const task of dueTasks) {
        if (task.assignee_user_id) {
          // Create notification for assignee
          await cronDB.exec`
            INSERT INTO notifications (org_id, user_id, type, payload_json)
            VALUES (
              (SELECT org_id FROM users WHERE id = ${task.assignee_user_id}),
              ${task.assignee_user_id},
              'task_reminder',
              ${JSON.stringify({
                task_id: task.id,
                task_title: task.title,
                property_name: task.property_name,
                due_at: task.due_at,
                message: `Task "${task.title}" is due soon at ${task.property_name}`
              })}
            )
          `;

          log.info(`Created task reminder for user ${task.assignee_name} (${task.assignee_email}) - Task: ${task.title}`);
        }
      }

      if (dueTasks.length > 0) {
        log.info(`Processed ${dueTasks.length} task reminders`);
      }
    } catch (error) {
      log.error("Task reminders failed:", error);
    }
  }
);

// Task reminders cron job - runs every 5 minutes
const taskReminders = new CronJob("task-reminders", {
  title: "Task Reminders",
  schedule: "*/5 * * * *",
  endpoint: taskRemindersHandler,
});
