import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BackendService, ReceiptRecord } from '../services/backend.service';
import { SyncQueueService } from '../services/sync-queue.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  isAuthenticated = false;
  isAuthReady = false;
  userEmail = '';
  isSigningIn = false;
  
  allItems: ReceiptRecord[] = [];
  filteredItems: ReceiptRecord[] = [];
  isLoadingHistory = false;
  pendingCount = 0;
  failedCount = 0;

  selectedCategory: '' | 'Expense' | 'Purchase' = '';
  searchQuery = '';

  private authSub?: Subscription;
  private syncSub?: Subscription;

  constructor(
    private authService: AuthService,
    private backendService: BackendService,
    private syncQueueService: SyncQueueService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit(): Promise<void> {
    this.authSub = this.authService.user$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.userEmail = user?.email ?? '';
      this.isAuthReady = true;

      if (this.isAuthenticated) {
        this.loadHistory();
      } else {
        this.allItems = [];
        this.filteredItems = [];
      }
    });

    await this.authService.initialize().catch(() => {});

    // Refresh when items are uploaded successfully
    this.syncSub = this.syncQueueService.syncCompleted.subscribe(() => {
      if (this.isAuthenticated) this.loadHistory();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.syncSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.updateQueueCounts();
    if (this.isAuthenticated) this.loadHistory();
  }

  async updateQueueCounts(): Promise<void> {
    this.pendingCount = await this.syncQueueService.getPendingCount();
    this.failedCount = await this.syncQueueService.getFailedCount();
  }

  async loadHistory(force: boolean = false): Promise<void> {
    if (!this.isAuthenticated) return;
    if (!force && this.isLoadingHistory) return;

    this.isLoadingHistory = true;
    try {
      this.updateQueueCounts();
      this.allItems = await this.backendService.getReceipts(this.userEmail);
      this.applyFilters();
    } catch (err: any) {
      console.error('Failed to load history:', err);
      // Optional: alert only if forced or specific error
      if (force) {
        const alert = await this.alertCtrl.create({
          header: 'Connection Error',
          message: `Could not reach the server at 10.53.26.1. Please ensure your laptop is running the backend and both devices are on the same WiFi.`,
          buttons: ['OK']
        });
        await alert.present();
      }
    } finally {
      this.isLoadingHistory = false;
    }

  }

  onCategoryFilter(cat: '' | 'Expense' | 'Purchase'): void {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  onSearchChange(event: any): void {
    this.searchQuery = (event.target.value || '').toLowerCase().trim();
    this.applyFilters();
  }

  private applyFilters(): void {
    let items = [...this.allItems];

    if (this.selectedCategory) {
      items = items.filter(i => i.category === this.selectedCategory);
    }

    if (this.searchQuery) {
      items = items.filter(i => 
        i.name.toLowerCase().includes(this.searchQuery) ||
        i.description?.toLowerCase().includes(this.searchQuery)
      );
    }

    this.filteredItems = items;
  }

  async retryFailed(): Promise<void> {
    await this.syncQueueService.retryFailed();
    this.updateQueueCounts();
  }

  async signIn(): Promise<void> {
    this.isSigningIn = true;
    const loading = await this.loadingCtrl.create({ message: 'Signing in...' });
    await loading.present();
    try {
      await this.authService.signIn();
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

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  navigateTo(page: string): void {
    this.router.navigate([`/${page}`]);
  }

  openDriveLink(url: string | undefined): void {
    if (url) window.open(url, '_system');
  }
}