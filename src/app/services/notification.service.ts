import { Injectable } from '@angular/core';
import { LocalNotifications, PermissionStatus } from '@capacitor/local-notifications';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly CHANNEL_ID = 'costtrack_reminders';
  private readonly REMINDER_TAG = 'receipt_reminder';

  async initialize(): Promise<void> {
    try {
      const status: PermissionStatus = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // Create notification channel (Android 8+)
      await LocalNotifications.createChannel({
        id: this.CHANNEL_ID,
        name: 'Receipt Reminders',
        description: 'Reminds you to upload receipts',
        importance: 3, // IMPORTANCE_DEFAULT
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      });
    } catch (err) {
      console.warn('[NotificationService] init error:', err);
    }
  }

  /** Schedule a daily reminder at a given hour (24h) and minute */
  async scheduleDailyReminder(hour = 18, minute = 0): Promise<void> {
    try {
      // Cancel existing reminders first
      await this.cancelReminders();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1001,
            title: '📄 CostTrack Reminder',
            body: 'Don\'t forget to upload today\'s receipts!',
            channelId: this.CHANNEL_ID,
            schedule: {
              on: { hour, minute },
              allowWhileIdle: true,
              repeats: true,
            },
            actionTypeId: this.REMINDER_TAG,
            smallIcon: 'ic_notification',
            iconColor: '#4f46e5',
          }
        ]
      });

      console.log(`[NotificationService] Daily reminder scheduled at ${hour}:${minute}`);
    } catch (err) {
      console.warn('[NotificationService] schedule error:', err);
    }
  }

  /** Cancel all CostTrack reminders */
  async cancelReminders(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      const costTrackNotifs = pending.notifications.filter(n => n.id === 1001 || n.id === 1002);
      if (costTrackNotifs.length > 0) {
        await LocalNotifications.cancel({ notifications: costTrackNotifs });
      }
    } catch (err) {
      console.warn('[NotificationService] cancel error:', err);
    }
  }

  /** Send an immediate notification (e.g., sync completed) */
  async showInstant(title: string, body: string): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            channelId: this.CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 500) }, // 0.5s from now
            smallIcon: 'ic_notification',
            iconColor: '#4f46e5',
          }
        ]
      });
    } catch (err) {
      console.warn('[NotificationService] instant error:', err);
    }
  }
}
