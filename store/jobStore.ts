import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  JobPosting,
  saveJob,
  getJob,
  getAllJobs,
  getJobsByStatus,
  deleteJob,
  updateJobStatus,
} from '@/lib/indexeddb';

interface JobStore {
  // State
  jobs: JobPosting[];
  currentJobId: string | null;
  isScanning: boolean;
  scanError: string | null;
  filterStatus: JobPosting['status'] | 'all';

  // Actions
  loadJobs: () => Promise<void>;
  addJob: (job: JobPosting) => Promise<void>;
  updateJob: (id: string, updates: Partial<JobPosting>) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  setCurrentJob: (id: string | null) => void;
  setJobStatus: (id: string, status: JobPosting['status']) => Promise<void>;
  setFilterStatus: (status: JobPosting['status'] | 'all') => void;
  setScanError: (error: string | null) => void;
  setIsScanning: (isScanning: boolean) => void;

  // Getters
  getCurrentJob: () => JobPosting | undefined;
  getFilteredJobs: () => JobPosting[];
  getJobStats: () => {
    total: number;
    scanned: number;
    applied: number;
    interviewing: number;
    rejected: number;
    offer: number;
    avgMatch: number;
  };
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      // Initial State
      jobs: [],
      currentJobId: null,
      isScanning: false,
      scanError: null,
      filterStatus: 'all',

      // Actions
      loadJobs: async () => {
        const jobs = await getAllJobs();
        // Sort by created date (newest first)
        jobs.sort((a, b) => b.createdAt - a.createdAt);
        set({ jobs });
      },

      addJob: async (job) => {
        await saveJob(job);
        set((state) => ({
          jobs: [job, ...state.jobs],
        }));
      },

      updateJob: async (id, updates) => {
        const job = await getJob(id);
        if (job) {
          const updatedJob = { ...job, ...updates, updatedAt: Date.now() };
          await saveJob(updatedJob);
          set((state) => ({
            jobs: state.jobs.map((j) => (j.id === id ? updatedJob : j)),
          }));
        }
      },

      removeJob: async (id) => {
        await deleteJob(id);
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
          currentJobId: state.currentJobId === id ? null : state.currentJobId,
        }));
      },

      setCurrentJob: (id) => {
        set({ currentJobId: id });
      },

      setJobStatus: async (id, status) => {
        await updateJobStatus(id, status);
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, status, updatedAt: Date.now() } : j
          ),
        }));
      },

      setFilterStatus: (status) => {
        set({ filterStatus: status });
      },

      setScanError: (error) => {
        set({ scanError: error });
      },

      setIsScanning: (isScanning) => {
        set({ isScanning });
      },

      // Getters
      getCurrentJob: () => {
        const { jobs, currentJobId } = get();
        return jobs.find((j) => j.id === currentJobId);
      },

      getFilteredJobs: () => {
        const { jobs, filterStatus } = get();
        if (filterStatus === 'all') return jobs;
        return jobs.filter((j) => j.status === filterStatus);
      },

      getJobStats: () => {
        const { jobs } = get();
        const stats = {
          total: jobs.length,
          scanned: 0,
          applied: 0,
          interviewing: 0,
          rejected: 0,
          offer: 0,
          avgMatch: 0,
        };

        let totalMatch = 0;
        let matchCount = 0;

        jobs.forEach((job) => {
          stats[job.status]++;
          if (job.overallMatch !== undefined) {
            totalMatch += job.overallMatch;
            matchCount++;
          }
        });

        stats.avgMatch = matchCount > 0 ? Math.round(totalMatch / matchCount) : 0;

        return stats;
      },
    }),
    {
      name: 'job-store',
      partialize: (state) => ({
        currentJobId: state.currentJobId,
        filterStatus: state.filterStatus,
      }),
    }
  )
);
