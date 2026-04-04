import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { DriveService, HistoryItem } from '../services/drive.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  isAuthenticated = false;
  userEmail = '';
  isSigningIn = false;

  historyItems: HistoryItem[] = [];
  isLoadingHistory = false;

  constructor(
    private authService: AuthService,
    private driveService: DriveService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    await this.authService.initialize().catch(() => {});
    this.checkAuth();
  }

  ionViewWillEnter() {
    if (this.isAuthenticated) {
      this.loadHistory();
    }
  }

  private checkAuth() {
    const user = this.authService.getUser();
    if (user) {
      this.isAuthenticated = true;
      this.userEmail = user.email;
      // Small delay ensures token is ready for API calls
      setTimeout(() => this.loadHistory(), 300);
    } else {
      this.isAuthenticated = false;
      this.userEmail = '';
      this.historyItems = [];
    }
  }

  async loadHistory() {
    if (!this.isAuthenticated || this.isLoadingHistory) return;
    
    this.isLoadingHistory = true;
    try {
      const items = await this.driveService.getRecentFiles(4);
      console.log('History items loaded:', items.length);
      this.historyItems = items;
    } catch (err) {
      console.error('Failed to load history:', err);
      this.historyItems = [];
    } finally {
      this.isLoadingHistory = false;
    }
  }

  openDriveLink(url: string | undefined) {
    if (url) {
      window.open(url, '_blank');
    }
  }


  async signIn() {
    this.isSigningIn = true;
    const loading = await this.loadingCtrl.create({ message: 'Signing in...' });
    await loading.present();
    try {
      await this.authService.signIn();
      this.checkAuth();
    } catch (err: any) {
      const msg = err?.message || 'Sign-in failed.';
      if (!msg.includes('cancelled') && !msg.includes('cancel')) {
        const alert = await this.alertCtrl.create({
          header: 'Sign In Failed',
          message: msg,
          buttons: ['OK']
        });
        await alert.present();
      }
    } finally {
      await loading.dismiss();
      this.isSigningIn = false;
    }
  }

  async signOut() {
    await this.authService.signOut();
    this.checkAuth();
  }

  navigateTo(page: string) {
    this.router.navigate([`/${page}`]);
  }
}