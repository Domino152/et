import { Injectable } from '@angular/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
  PermissionStatus
} from '@capacitor/camera';

export interface CapturedImage {
  base64Data: string;   // raw base64 (no data-URI prefix)
  dataUrl: string;      // data:image/jpeg;base64,... – ready for <img src>
  mimeType: string;
  format: string;
}

@Injectable({ providedIn: 'root' })
export class CameraService {

  // ─── Permission ────────────────────────────────────────────────────────────

  async requestPermission(): Promise<boolean> {
    try {
      const status: PermissionStatus = await Camera.checkPermissions();
      if (status.camera === 'granted') return true;
      if (status.camera === 'denied') return false;
      const requested = await Camera.requestPermissions({ permissions: ['camera'] });
      return requested.camera === 'granted';
    } catch (err) {
      console.warn('CameraService: permission check failed', err);
      return true;
    }
  }

  // ─── Capture from Camera ────────────────────────────────────────────────────

  async capturePhoto(): Promise<CapturedImage> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Camera permission denied. Please enable it in device Settings.');
    }

    let photo: Photo;
    try {
      photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
        saveToGallery: false
      });
    } catch (err: any) {
      if (
        typeof err?.message === 'string' &&
        (err.message.toLowerCase().includes('cancel') ||
          err.message.toLowerCase().includes('no image'))
      ) {
        throw new Error('CANCELLED');
      }
      throw new Error(`Failed to capture photo: ${err?.message ?? err}`);
    }

    if (!photo.base64String) {
      throw new Error('Camera returned an empty image. Please try again.');
    }

    const mimeType = `image/${photo.format ?? 'jpeg'}`;
    return {
      base64Data: photo.base64String,
      dataUrl: `data:${mimeType};base64,${photo.base64String}`,
      mimeType,
      format: photo.format ?? 'jpeg'
    };
  }

  // ─── Select from Gallery ────────────────────────────────────────────────────

  async selectFromGallery(): Promise<CapturedImage> {
    let photo: Photo;
    try {
      photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        correctOrientation: true
      });
    } catch (err: any) {
      if (
        typeof err?.message === 'string' &&
        (err.message.toLowerCase().includes('cancel') ||
          err.message.toLowerCase().includes('no image'))
      ) {
        throw new Error('CANCELLED');
      }
      throw new Error(`Failed to select photo: ${err?.message ?? err}`);
    }

    if (!photo.base64String) {
      throw new Error('No image selected. Please try again.');
    }

    const mimeType = `image/${photo.format ?? 'jpeg'}`;
    return {
      base64Data: photo.base64String,
      dataUrl: `data:${mimeType};base64,${photo.base64String}`,
      mimeType,
      format: photo.format ?? 'jpeg'
    };
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
  }
}
