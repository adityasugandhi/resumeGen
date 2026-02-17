// File system types
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string; // LaTeX content for files
  parentId: string | null;
  path: string; // Full path like "/folder1/file.tex"
  createdAt: number;
  modifiedAt: number;
  isPinned?: boolean; // For quick access
  companyId?: string; // Link to company for grouping
  companyName?: string; // Denormalized for display
}

// Company types for sidebar grouping
export interface Company {
  id: string;
  name: string;
  domain?: string; // For logo fetching (e.g., "sierra.ai")
  logoUrl?: string; // Cached logo URL
  createdAt: number;
}

export interface FolderNode extends Omit<FileNode, 'content'> {
  type: 'folder';
  children: string[]; // Array of child IDs
  isExpanded?: boolean;
}

export type FileSystemNode = FileNode | FolderNode;

// Editor types
export interface EditorState {
  currentFileId: string | null;
  content: string;
  hasUnsavedChanges: boolean;
  cursorPosition: { line: number; column: number } | null;
  compilationStatus: 'idle' | 'compiling' | 'success' | 'error';
  compilationError: string | null;
  compiledPdfUrl: string | null;
}

// UI types
export interface UIState {
  isSidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  editorWidth: number; // Percentage
  previewWidth: number; // Percentage
  showQuickAccess: boolean;
}

// Compilation types
export interface CompilationRequest {
  content: string;
  filename: string;
}

export interface CompilationResponse {
  success: boolean;
  pdfUrl?: string;
  pdfBlob?: Blob;
  error?: string;
  logs?: string;
}

// Store action types
export interface FileSystemActions {
  createFile: (name: string, parentId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => void;
  updateFile: (id: string, content: string) => void;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  moveNode: (id: string, newParentId: string | null) => void;
  toggleFolder: (id: string) => void;
  togglePin: (id: string) => void;
  updateFileCompany: (id: string, companyId: string | undefined, companyName: string | undefined) => void;
  getFile: (id: string) => FileNode | undefined;
  getNode: (id: string) => FileSystemNode | undefined;
  getAllFiles: () => FileNode[];
  getPinnedFiles: () => FileNode[];
  getFilesByCompany: (companyId: string) => FileNode[];
  getUngroupedFiles: () => FileNode[];
  initializeFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

export interface EditorActions {
  setCurrentFile: (fileId: string | null) => void;
  setContent: (content: string) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setCursorPosition: (position: { line: number; column: number }) => void;
  setCompilationStatus: (status: EditorState['compilationStatus']) => void;
  setCompilationError: (error: string | null) => void;
  setCompiledPdfUrl: (url: string | null) => void;
  resetEditor: () => void;
}

export interface UIActions {
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setEditorWidth: (width: number) => void;
  setPreviewWidth: (width: number) => void;
  toggleQuickAccess: () => void;
}

// Combined store types
export type FileSystemStore = {
  nodes: Record<string, FileSystemNode>;
  rootIds: string[]; // Top-level file/folder IDs
} & FileSystemActions;

export type EditorStore = EditorState & EditorActions;

export type UIStore = UIState & UIActions;

// Utility types
export type NodePath = string[];

export interface TreeNode {
  node: FileSystemNode;
  depth: number;
  hasChildren: boolean;
}

// Keyword Analysis types
export type KeywordCategory =
  | 'hard_skill'
  | 'soft_skill'
  | 'action_verb'
  | 'industry_term'
  | 'metric'
  | 'technology';

export interface ExtractedKeyword {
  word: string;
  category: KeywordCategory;
  count: number;
  positions: number[];
  context?: string;
  isNew?: boolean;
}

export interface KeywordExtractionResult {
  keywords: ExtractedKeyword[];
  totalCount: number;
  byCategory: Record<KeywordCategory, ExtractedKeyword[]>;
  metrics: {
    actionVerbCount: number;
    hardSkillCount: number;
    softSkillCount: number;
    metricCount: number;
    industryTermCount: number;
  };
}

export interface ATSScoreBreakdown {
  hardSkills: number;
  softSkills: number;
  actionVerbs: number;
  metrics: number;
  industryTerms: number;
}

export interface ATSScore {
  overall: number;
  breakdown: ATSScoreBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  passingScore: boolean;
}
