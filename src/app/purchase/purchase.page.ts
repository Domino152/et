import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LoadingController,
  ToastController,
  AlertController
} from '@ionic/angular';

import { CameraService, CapturedImage } from '../services/camera.service';
import { DriveService } from '../services/drive.service';
import { AuthService } from '../services/auth.service';

export interface PaymentOption {
  label: string;
  value: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-purchase',
  templateUrl: 'purchase.page.html',
  styleUrls: ['purchase.page.scss']
})
export class PurchasePage implements OnInit {
  form!: FormGroup;
  capturedImage: CapturedImage | null = null;
  isSubmitting = false;
  maxDate = new Date().toISOString();
  minDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  paymentOptions: PaymentOption[] = [
    { label: 'Paid by Myself',  value: 'self',    icon: 'person-outline',    color: 'tertiary' },
    { label: 'Paid by Company', value: 'company', icon: 'business-outline',  color: 'secondary' }
  ];

  isAuthenticated = false;
  userEmail = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cameraService: CameraService,
    private driveService: DriveService,
    private authService: AuthService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      date:        [new Date().toISOString(), Validators.required],
      description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
      paymentType: ['', Validators.required]
    });
    this.checkAuth();
  }

  ionViewWillEnter(): void {
    this.checkAuth();
  }

  private checkAuth(): void {
    const user = this.authService.getUser();
    if (user) {
      this.isAuthenticated = true;
      this.userEmail = user.email;
    } else {
      this.isAuthenticated = false;
      this.userEmail = '';
    }
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

  // ─── Camera ────────────────────────────────────────────────────────────────

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

  removeImage(): void {
    this.capturedImage = null;
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.showToast('Please fill in all required fields.', 'warning');
      return;
    }

    if (!this.capturedImage) {
      await this.showToast('Please capture a receipt photo.', 'warning');
      return;
    }

    try {
      await this.authService.getAccessToken();
      this.checkAuth();
    } catch (err: any) {
      await this.showToast(err?.message || 'Please sign in with Google first.', 'danger');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingCtrl.create({
      message: 'Uploading to Google Drive…',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const paymentLabel = this.paymentOptions.find(
        p => p.value === this.form.value.paymentType
      )?.label ?? this.form.value.paymentType;

      const result = await this.driveService.uploadFile({
        base64Image: this.capturedImage.base64Data,
        mimeType:    this.capturedImage.mimeType,
        description: this.form.value.description.trim(),
        date:        this.form.value.date,
        folderName:  'Purchase',
        paymentType: paymentLabel
      });

      await loading.dismiss();
      await this.showSuccessAlert(result.fileName, result.folderName, paymentLabel);
      this.resetForm();

    } catch (err: any) {
      await loading.dismiss();
      await this.showToast(
        `Upload failed: ${err?.message ?? 'Unknown error'}`,
        'danger'
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/home']);
  }

  private resetForm(): void {
    this.form.reset({
      date:        new Date().toISOString(),
      description: '',
      paymentType: ''
    });
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

  private async showSuccessAlert(
    fileName: string,
    folder: string,
    paymentType: string
  ): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Upload Successful!',
      message:
        `"${fileName}" has been saved to the <b>${folder}</b> folder on Google Drive.<br><br>` +
        `Payment: <b>${paymentType}</b>`,
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

  // ─── Template helpers ──────────────────────────────────────────────────────

  get dateCtrl()        { return this.form.get('date')!; }
  get descriptionCtrl() { return this.form.get('description')!; }
  get paymentTypeCtrl() { return this.form.get('paymentType')!; }

  getSelectedPaymentLabel(): string {
    const val = this.paymentTypeCtrl.value;
    return this.paymentOptions.find(p => p.value === val)?.label ?? '';
  }
}
