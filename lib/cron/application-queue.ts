import {
  addToQueue,
  hasUrl as dbHasUrl,
  listByStatus as dbListByStatus,
  listAll as dbListAll,
  getById as dbGetById,
  approve as dbApprove,
  reject as dbReject,
  approveAll as dbApproveAll,
  updateQueueStatus,
} from '@/lib/db/queries/application-queue';

export type QueueStatus = 'pending' | 'approved' | 'rejected' | 'submitted' | 'failed';

export interface QueuedApplication {
  id: string;
  jobTitle: string;
  company: string;
  url: string;
  location: string;
  matchScore: number;
  gaps: string[];
  strengths: string[];
  tailoredResumePath: string;
  tailoredPdfPath: string;
  status: QueueStatus;
  queuedAt: string;
  reviewedAt?: string;
  submittedAt?: string;
  error?: string;
}

export class ApplicationQueue {
  async hasUrl(url: string): Promise<boolean> {
    return dbHasUrl(url);
  }

  async add(app: Omit<QueuedApplication, 'id' | 'status' | 'queuedAt'>): Promise<QueuedApplication> {
    return addToQueue(app);
  }

  async listPending(): Promise<QueuedApplication[]> {
    return dbListByStatus('pending');
  }

  async listByStatus(status: QueueStatus): Promise<QueuedApplication[]> {
    return dbListByStatus(status);
  }

  async listAll(): Promise<QueuedApplication[]> {
    return dbListAll();
  }

  async getById(id: string): Promise<QueuedApplication | undefined> {
    return dbGetById(id);
  }

  async approve(id: string): Promise<boolean> {
    return dbApprove(id);
  }

  async reject(id: string): Promise<boolean> {
    return dbReject(id);
  }

  async approveAll(): Promise<number> {
    return dbApproveAll();
  }

  async updateStatus(id: string, status: QueueStatus, error?: string): Promise<boolean> {
    return updateQueueStatus(id, status, error);
  }
}
