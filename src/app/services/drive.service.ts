import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CameraService } from './camera.service';

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId: string;
  folderName: string;
}

export interface UploadPayload {
  base64Image: string;
  mimeType: string;
  description: string;
  date: string;
  folderName: 'Expense' | 'Purchase';
  paymentType?: string;
}

export interface HistoryItem {
  id: string;
  name: string;
  type: string;
  date: string;
  webViewLink: string;
  createdTime: string;
}

@Injectable({ providedIn: 'root' })
export class DriveService {
  private readonly ROOT_FOLDER_NAME = 'Expense Tracker';
  private folderIdCache: Record<string, string> = {};

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cameraService: CameraService
  ) {}

  // ── Upload ──────────────────────────────────────────────────────────────────

  async uploadFile(payload: UploadPayload): Promise<DriveUploadResult> {
    const token      = await this.authService.getAccessToken();
    const rootId     = await this.ensureRootFolder(token);
    const subId      = await this.ensureSubFolder(payload.folderName, rootId, token);
    const monthName  = this.getMonthFolderName(payload.date);
    const monthId    = await this.ensureSubFolder(monthName, subId, token);
    return this.uploadToFolder(payload, monthId, token);
  }

  // ── History ─────────────────────────────────────────────────────────────────

  async getRecentFiles(limit = 5): Promise<HistoryItem[]> {
    try {
      const token = await this.authService.getAccessToken();
      if (!token) return [];

      // Since we use the 'drive.file' scope, we only see files created by this app anyway.
      // A simple query for non-folders that aren't trashed is most reliable.
      const query = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
      
      const url = `${environment.driveApiUrl}/files`;
      const params = {
        q: query,
        pageSize: limit.toString(),
        fields: 'files(id,name,description,createdTime,webViewLink)',
        orderBy: 'createdTime desc'
      };

      const res: any = await firstValueFrom(
        this.http.get(url, { 
          headers: this.jsonHeaders(token),
          params: params
        })
      );

      return (res?.files || []).map((f: any) => {
        const desc = f.description || '';
        return {
          id:          f.id,
          name:        f.name,
          type:        this.parseTypeFromDescription(desc),
          date:        this.parseDateFromDescription(desc) || this.formatDriveDate(f.createdTime),
          webViewLink: f.webViewLink || '',
          createdTime: f.createdTime,
        };
      });
    } catch (err) {
      console.error('DriveService.getRecentFiles error:', err);
      return [];
    }
  }

  private formatDriveDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return 'Unknown Date';
    }
  }

  // ── Folder helpers ──────────────────────────────────────────────────────────

  private async ensureRootFolder(token: string): Promise<string> {
    const key = 'root';
    if (this.folderIdCache[key]) return this.folderIdCache[key];
    const existing = await this.findFolder(this.ROOT_FOLDER_NAME, null, token);
    const id = existing || await this.createFolder(this.ROOT_FOLDER_NAME, null, token);
    return (this.folderIdCache[key] = id);
  }

  private async ensureSubFolder(name: string, parentId: string, token: string): Promise<string> {
    const key = `sub_${parentId}_${name}`;
    if (this.folderIdCache[key]) return this.folderIdCache[key];
    const existing = await this.findFolder(name, parentId, token);
    const id = existing || await this.createFolder(name, parentId, token);
    return (this.folderIdCache[key] = id);
  }

  private async findFolder(name: string, parentId: string | null, token: string): Promise<string | null> {
    let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const url = `${environment.driveApiUrl}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    try {
      const res: any = await firstValueFrom(this.http.get(url, { headers: this.jsonHeaders(token) }));
      return res?.files?.[0]?.id ?? null;
    } catch { return null; }
  }

  private async createFolder(name: string, parentId: string | null, token: string): Promise<string> {
    const body: any = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) body.parents = [parentId];
    const res: any = await firstValueFrom(
      this.http.post(`${environment.driveApiUrl}/files`, body, { headers: this.jsonHeaders(token) })
    );
    if (!res?.id) throw new Error(`Failed to create folder "${name}"`);
    return res.id;
  }

  // ── Upload to folder ────────────────────────────────────────────────────────

  private async uploadToFolder(payload: UploadPayload, folderId: string, token: string): Promise<DriveUploadResult> {
    const ext      = payload.mimeType.split('/')[1] ?? 'jpg';
    const safeName = payload.description.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100);
    const fileName = `${safeName}.${ext}`;

    // ⚠️  IMPORTANT: Keep [ExpenseTracker] tag so history query finds these files
    const descParts = [
      'App: [ExpenseTracker]',
      `Type: ${payload.folderName}`,
      `Date: ${payload.date}`,
      `Description: ${payload.description}`,
    ];
    if (payload.paymentType) descParts.push(`Payment: ${payload.paymentType}`);

    const metadata = {
      name:        fileName,
      description: descParts.join(' | '),
      parents:     [folderId],
      mimeType:    payload.mimeType,
    };

    const boundary   = 'expense_tracker_boundary_xyz789';
    const imageBytes = this.base64ToUint8Array(payload.base64Image);
    const body       = this.buildMultipart(boundary, metadata, imageBytes, payload.mimeType);

    const headers = new HttpHeaders({
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   `multipart/related; boundary="${boundary}"`,
    });

    const url = `${environment.driveUploadUrl}/files?uploadType=multipart&fields=id,name,webViewLink`;
    const res: any = await firstValueFrom(this.http.post(url, body, { headers }));
    if (!res?.id) throw new Error('Upload returned no file ID.');

    return {
      fileId:      res.id,
      fileName:    res.name      ?? fileName,
      webViewLink: res.webViewLink ?? '',
      folderId,
      folderName:  payload.folderName,
    };
  }

  // ── Parse helpers ───────────────────────────────────────────────────────────

  private parseTypeFromDescription(desc: string): string {
    if (!desc) return 'Expense';
    if (desc.toLowerCase().includes('type: purchase')) return 'Purchase';
    return 'Expense';
  }

  private parseDateFromDescription(desc: string): string | null {
    if (!desc) return null;
    const m = desc.match(/Date:\s*([^|]+)/i);
    return m ? m[1].trim() : null;
  }

  private getMonthFolderName(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      const months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return 'Unknown Month'; }
  }

  // ── Multipart helpers ───────────────────────────────────────────────────────

  private jsonHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private buildMultipart(boundary: string, metadata: object, imageBytes: Uint8Array, mimeType: string): ArrayBuffer {
    const enc = new TextEncoder();
    const metaPart  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
    const imgHeader = enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
    const closing   = enc.encode(`\r\n--${boundary}--`);
    const total     = metaPart.length + imgHeader.length + imageBytes.length + closing.length;
    const combined  = new Uint8Array(total);
    let offset = 0;
    for (const chunk of [metaPart, imgHeader, imageBytes, closing]) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined.buffer;
  }
}