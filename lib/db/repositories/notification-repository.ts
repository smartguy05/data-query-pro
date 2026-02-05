import { getAppDb } from '../pool';

export async function getDismissedNotifications(userId: string): Promise<string[]> {
  const sql = getAppDb()!;

  const rows = await sql<{ notification_id: string }[]>`
    SELECT notification_id FROM dismissed_notifications WHERE user_id = ${userId}
  `;

  return rows.map(r => r.notification_id);
}

export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO dismissed_notifications (user_id, notification_id)
    VALUES (${userId}, ${notificationId})
    ON CONFLICT (user_id, notification_id) DO NOTHING
  `;
}
