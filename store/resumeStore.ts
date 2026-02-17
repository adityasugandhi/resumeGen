import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MasterResume,
  ResumeVersion,
  saveMasterResume,
  getMasterResume,
  saveResumeVersion,
  getResumeVersion,
  getResumeVersionsByJob,
  getAllResumeVersions,
  deleteResumeVersion,
} from '@/lib/indexeddb';

interface ResumeStore {
  // State
  masterResume: MasterResume | null;
  resumeVersions: ResumeVersion[];
  currentVersionId: string | null;
  isOptimizing: boolean;
  optimizationError: string | null;

  // Actions
  loadMasterResume: () => Promise<void>;
  updateMasterResume: (resume: MasterResume) => Promise<void>;
  loadResumeVersions: () => Promise<void>;
  loadVersionsForJob: (jobId: string) => Promise<void>;
  addResumeVersion: (version: ResumeVersion) => Promise<void>;
  updateResumeVersion: (id: string, updates: Partial<ResumeVersion>) => Promise<void>;
  removeResumeVersion: (id: string) => Promise<void>;
  setCurrentVersion: (id: string | null) => void;
  setIsOptimizing: (isOptimizing: boolean) => void;
  setOptimizationError: (error: string | null) => void;
  acceptChange: (versionId: string, changeId: string) => Promise<void>;
  rejectChange: (versionId: string, changeId: string) => Promise<void>;
  applyAcceptedChanges: (versionId: string) => string;

  // Getters
  getCurrentVersion: () => ResumeVersion | undefined;
  getVersionsForJob: (jobId: string) => ResumeVersion[];
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set, get) => ({
      // Initial State
      masterResume: null,
      resumeVersions: [],
      currentVersionId: null,
      isOptimizing: false,
      optimizationError: null,

      // Actions
      loadMasterResume: async () => {
        const resume = await getMasterResume('default');
        set({ masterResume: resume || null });
      },

      updateMasterResume: async (resume) => {
        await saveMasterResume(resume);
        set({ masterResume: resume });
      },

      loadResumeVersions: async () => {
        const versions = await getAllResumeVersions();
        // Sort by created date (newest first)
        versions.sort((a, b) => b.createdAt - a.createdAt);
        set({ resumeVersions: versions });
      },

      loadVersionsForJob: async (jobId) => {
        const versions = await getResumeVersionsByJob(jobId);
        versions.sort((a, b) => b.createdAt - a.createdAt);
        set({ resumeVersions: versions });
      },

      addResumeVersion: async (version) => {
        await saveResumeVersion(version);
        set((state) => ({
          resumeVersions: [version, ...state.resumeVersions],
        }));
      },

      updateResumeVersion: async (id, updates) => {
        const version = await getResumeVersion(id);
        if (version) {
          const updatedVersion = { ...version, ...updates };
          await saveResumeVersion(updatedVersion);
          set((state) => ({
            resumeVersions: state.resumeVersions.map((v) =>
              v.id === id ? updatedVersion : v
            ),
          }));
        }
      },

      removeResumeVersion: async (id) => {
        await deleteResumeVersion(id);
        set((state) => ({
          resumeVersions: state.resumeVersions.filter((v) => v.id !== id),
          currentVersionId: state.currentVersionId === id ? null : state.currentVersionId,
        }));
      },

      setCurrentVersion: (id) => {
        set({ currentVersionId: id });
      },

      setIsOptimizing: (isOptimizing) => {
        set({ isOptimizing });
      },

      setOptimizationError: (error) => {
        set({ optimizationError: error });
      },

      acceptChange: async (versionId, changeId) => {
        const version = await getResumeVersion(versionId);
        if (version) {
          const acceptedChanges = version.acceptedChanges || [];
          if (!acceptedChanges.includes(changeId)) {
            acceptedChanges.push(changeId);
            await saveResumeVersion({ ...version, acceptedChanges });
            set((state) => ({
              resumeVersions: state.resumeVersions.map((v) =>
                v.id === versionId ? { ...v, acceptedChanges } : v
              ),
            }));
          }
        }
      },

      rejectChange: async (versionId, changeId) => {
        const version = await getResumeVersion(versionId);
        if (version) {
          const acceptedChanges = (version.acceptedChanges || []).filter(
            (id) => id !== changeId
          );
          await saveResumeVersion({ ...version, acceptedChanges });
          set((state) => ({
            resumeVersions: state.resumeVersions.map((v) =>
              v.id === versionId ? { ...v, acceptedChanges } : v
            ),
          }));
        }
      },

      applyAcceptedChanges: (versionId) => {
        const { resumeVersions } = get();
        const version = resumeVersions.find((v) => v.id === versionId);

        if (!version) return '';

        // If no changes accepted, return original
        if (!version.acceptedChanges || version.acceptedChanges.length === 0) {
          return version.originalLatex;
        }

        // If all changes accepted, return tailored version
        if (version.acceptedChanges.length === version.changes.length) {
          return version.tailoredLatex;
        }

        // Apply only accepted changes (simplified - would need proper LaTeX parsing)
        // For now, return tailored if any changes accepted
        return version.tailoredLatex;
      },

      // Getters
      getCurrentVersion: () => {
        const { resumeVersions, currentVersionId } = get();
        return resumeVersions.find((v) => v.id === currentVersionId);
      },

      getVersionsForJob: (jobId) => {
        const { resumeVersions } = get();
        return resumeVersions.filter((v) => v.jobId === jobId);
      },
    }),
    {
      name: 'resume-store',
      partialize: (state) => ({
        currentVersionId: state.currentVersionId,
      }),
    }
  )
);
