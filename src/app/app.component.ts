import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { SyncQueueService } from './services/sync-queue.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform,
    private authService: AuthService,
    private notificationService: NotificationService,
    private syncQueueService: SyncQueueService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.platform.ready();
    await this.initializeApp();
  }

  async initializeApp(): Promise<void> {
    // Initialize Google Auth
    await this.authService.initialize().catch(e => console.warn('[App] Auth init:', e));

    // Initialize notifications + schedule daily reminder at 6PM
    await this.notificationService.initialize();
    await this.notificationService.scheduleDailyReminder(18, 0);

    // Process any queued uploads on start
    this.syncQueueService.processQueue();

    // Handle hardware back button (Android)
    if (this.platform.is('capacitor')) {
      App.addListener('backButton', async ({ canGoBack }) => {
        if (!canGoBack) {
          await App.minimizeApp();
        } else {
          window.history.back();
        }
      });
    }

    // Hide splash screens after initialization is complete
    setTimeout(() => {
      // Hide native splash (Capacitor)
      if (this.platform.is('capacitor')) {
        SplashScreen.hide();
      }
      // Hide web splash (CSS)
      document.body.classList.add('app-ready');
    }, 800);
  }
}