import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LoadingController,
  ToastController,
  AlertController,
  ActionSheetController
} from '@ionic/angular';

import { CameraService, CapturedImage } from '../services/camera.service';
import { DriveService } from '../services/drive.service';
import { AuthService } from './../services/auth.service';
import { SyncQueueService } from '../services/sync-queue.service';
import { BackendService } from '../services/backend.service';


@Component({
  selector: 'app-expense',
  templateUrl: 'expense.page.html',
  styleUrls: ['expense.page.scss']
})
export class ExpensePage implements OnInit {
  form!: FormGroup;
  capturedImage: CapturedImage | null = null;
  isSubmitting = false;
  isAuthenticated = false;
  userEmail = '';
  maxDate = new Date().toISOString();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cameraService: CameraService,
    private driveService: DriveService,
    private authService: AuthService,
    private syncQueueService: SyncQueueService,
    private backendService: BackendService,
    private loadingCtrl: LoadingController,

    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      date:        [new Date().toISOString(), Validators.required],
      description: ['', [Validators.maxLength(500)]] // optional
    });
    this.checkAuth();
  }

  ionViewWillEnter(): void {
    this.checkAuth();
  }

  private checkAuth(): void {
    const user = this.authService.getUser();
    this.isAuthenticated = !!user;
    this.userEmail = user?.email ?? '';
  }

  async signIn(): Promise<void> {
    try {
      await this.authService.signIn();
      this.checkAuth();
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancelled')) {
        const alert = await this.alertCtrl.create({
          header: 'Sign In Failed',
          message: err?.message || 'Unknown error occurred.',
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  // ─── Camera / Gallery ────────────────────────────────────────────────────────

  async showImageOptions(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select Receipt Image',
      cssClass: 'costtrack-action-sheet',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera-outline',
          handler: () => this.takePicture()
        },
        {
          text: 'Choose from Gallery',
          icon: 'image-outline',
          handler: () => this.selectFromGallery()
        },
        {
          text: 'Cancel',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async takePicture(): Promise<void> {
    try {
      this.capturedImage = await this.cameraService.capturePhoto();
    } catch (err: any) {
      if (err?.message === 'CANCELLED') return;
      if (err?.message?.toLowerCase().includes('permission')) {
        await this.showPermissionAlert();
      } else {
        await this.showToast(err?.message ?? 'Could not capture photo.', 'danger');
      }
    }
  }

  async selectFromGallery(): Promise<void> {
    try {
      this.capturedImage = await this.cameraService.selectFromGallery();
    } catch (err: any) {
      if (err?.message === 'CANCELLED') return;
      await this.showToast(err?.message ?? 'Could not select image.', 'danger');
    }
  }

  removeImage(): void {
    this.capturedImage = null;
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.showToast('Please fill in all required fields.', 'warning');
      return;
    }

    if (!this.capturedImage) {
      await this.showToast('Please attach a receipt photo.', 'warning');
      return;
    }

    // Ensure signed in
    if (!this.isAuthenticated) {
      try {
        await this.authService.signIn();
        this.checkAuth();
      } catch (err: any) {
        await this.showToast('Please sign in with Google first.', 'danger');
        return;
      }
    }

    // Auto-format name
    const rawName = this.form.value.name.trim();

    this.isSubmitting = true;
    const loading = await this.loadingCtrl.create({
      message: '🚀 Uploading to Google Drive...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const user = this.authService.getUser()!;
      const itemId = `exp_${Date.now()}`;

      // 1. ATTEMPT INSTANT UPLOAD
      try {
        console.log('[Expense] Attempting instant-first upload...');
        const driveRes = await this.driveService.uploadFile({
          base64Image: this.capturedImage.base64Data,
          mimeType: this.capturedImage.mimeType,
          description: this.form.value.description?.trim() ?? '',
          date: this.form.value.date,
          folderName: 'Expense',
          userName: rawName
        });

        const meta: any = {
          userId: user.email,
          name: rawName,
          description: this.form.value.description?.trim() ?? '',
          category: 'Expense',
          date: this.form.value.date,
          imageUrl: driveRes.webViewLink
        };

        try {
          await this.backendService.saveReceipt(meta);
        } catch (dbErr: any) {
          // Wrap error and include Drive URL for the queue
          throw { ...dbErr, _driveUrl: driveRes.webViewLink, message: dbErr.message };
        }

        
        await loading.dismiss();
        await this.showSuccessAlert(rawName, true);
        this.resetForm();

      } catch (instantErr: any) {
        console.warn('[Expense] Instant upload failed, falling back to background queue:', instantErr);
        
        // If Drive succeeded but DB failed, we have a URL!
        const existingDriveUrl = (instantErr as any)._driveUrl || '';

        // 2. FALLBACK TO BACKGROUND QUEUE
        await this.syncQueueService.enqueue({
          id: itemId,
          drivePayload: {
            base64Image: this.capturedImage.base64Data,
            mimeType: this.capturedImage.mimeType,
            description: this.form.value.description?.trim() ?? '',
            date: this.form.value.date,
            folderName: 'Expense',
            userName: rawName
          },
          metaPayload: {
            userId: user.email,
            name: rawName,
            description: this.form.value.description?.trim() ?? '',
            category: 'Expense',
            imageUrl: existingDriveUrl, 
            date: this.form.value.date
          }
        });


        await loading.dismiss();
        await this.showSuccessAlert(rawName, false);
        this.resetForm();
      }

    } catch (err: any) {
      await loading.dismiss();
      await this.showToast(`Error: ${err?.message ?? 'Unknown error'}`, 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }


  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resetForm(): void {
    this.form.reset({ name: '', date: new Date().toISOString(), description: '' });
    this.capturedImage = null;
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message, color,
      duration: 3000,
      position: 'bottom',
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }

  private async showSuccessAlert(name: string, isInstant: boolean): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: isInstant ? '✅ Receipt Saved!' : '🕒 Receipt Queued',
      message: isInstant 
        ? `<b>${name}</b> has been securely stored in Google Drive and your history.`
        : `<b>${name}</b> has been saved locally. It will sync to Google Drive when your connection improves.`,
      buttons: [
        { text: 'Add Another', role: 'cancel' },
        { text: 'Go Home', handler: () => this.router.navigate(['/home']) }
      ]
    });
    await alert.present();
  }


  private async showPermissionAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Camera Permission Required',
      message: 'Please allow camera access in your device Settings to capture photos.',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await alert.present();
  }

  get nameCtrl() { return this.form.get('name')!; }
  get dateCtrl() { return this.form.get('date')!; }
  get descriptionCtrl() { return this.form.get('description')!; }
}
