import { create } from 'zustand';
import { FileSystemStore, FileSystemNode, FileNode, FolderNode } from '@/types';
import { generateId, buildPath } from '@/lib/utils';
import { saveFileSystem, loadFileSystem } from '@/lib/indexeddb';
import { DEFAULT_RESUME_TEMPLATE } from '@/lib/latex-utils';

export const useFileSystemStore = create<FileSystemStore>((set, get) => ({
  nodes: {},
  rootIds: [],

  createFile: (name: string, parentId: string | null) => {
    const id = generateId();
    const now = Date.now();

    const newFile: FileNode = {
      id,
      name: name.endsWith('.tex') ? name : `${name}.tex`,
      type: 'file',
      content: DEFAULT_RESUME_TEMPLATE,
      parentId,
      path: '',
      createdAt: now,
      modifiedAt: now,
      isPinned: false,
    };

    set((state) => {
      const nodes = { ...state.nodes, [id]: newFile };
      newFile.path = buildPath(nodes, id);

      // Update parent's children if it has a parent
      if (parentId && state.nodes[parentId]) {
        const parent = state.nodes[parentId] as FolderNode;
        nodes[parentId] = {
          ...parent,
          children: [...parent.children, id],
        };
      }

      const rootIds = parentId ? state.rootIds : [...state.rootIds, id];

      // Save to IndexedDB
      saveFileSystem(nodes, rootIds);

      return { nodes, rootIds };
    });
  },

  createFolder: (name: string, parentId: string | null) => {
    const id = generateId();
    const now = Date.now();

    const newFolder: FolderNode = {
      id,
      name,
      type: 'folder',
      parentId,
      path: '',
      createdAt: now,
      modifiedAt: now,
      children: [],
      isExpanded: true,
    };

    set((state) => {
      const nodes = { ...state.nodes, [id]: newFolder };
      newFolder.path = buildPath(nodes, id);

      // Update parent's children if it has a parent
      if (parentId && state.nodes[parentId]) {
        const parent = state.nodes[parentId] as FolderNode;
        nodes[parentId] = {
          ...parent,
          children: [...parent.children, id],
        };
      }

      const rootIds = parentId ? state.rootIds : [...state.rootIds, id];

      // Save to IndexedDB
      saveFileSystem(nodes, rootIds);

      return { nodes, rootIds };
    });
  },

  updateFile: (id: string, content: string) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== 'file') return state;

      const updatedNode: FileNode = {
        ...(node as FileNode),
        content,
        modifiedAt: Date.now(),
      };

      const nodes = { ...state.nodes, [id]: updatedNode };

      // Save to IndexedDB
      saveFileSystem(nodes, state.rootIds);

      return { nodes };
    });
  },

  deleteNode: (id: string) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;

      const nodes = { ...state.nodes };
      const nodesToDelete = [id];

      // If it's a folder, collect all children
      if (node.type === 'folder') {
        const collectChildren = (folderId: string) => {
          const folder = nodes[folderId] as FolderNode;
          if (folder && folder.children) {
            folder.children.forEach((childId) => {
              nodesToDelete.push(childId);
              if (nodes[childId]?.type === 'folder') {
                collectChildren(childId);
              }
            });
          }
        };
        collectChildren(id);
      }

      // Delete all collected nodes
      nodesToDelete.forEach((nodeId) => delete nodes[nodeId]);

      // Update parent's children array
      if (node.parentId && nodes[node.parentId]) {
        const parent = nodes[node.parentId] as FolderNode;
        nodes[node.parentId] = {
          ...parent,
          children: parent.children.filter((childId) => childId !== id),
        };
      }

      // Update rootIds
      const rootIds = state.rootIds.filter((rootId) => rootId !== id);

      // Save to IndexedDB
      saveFileSystem(nodes, rootIds);

      return { nodes, rootIds };
    });
  },

  renameNode: (id: string, newName: string) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;

      const nodes = { ...state.nodes };
      nodes[id] = {
        ...node,
        name: newName,
        modifiedAt: Date.now(),
      };

      // Rebuild paths for this node and its children
      const rebuildPaths = (nodeId: string) => {
        const currentNode = nodes[nodeId];
        currentNode.path = buildPath(nodes, nodeId);

        if (currentNode.type === 'folder') {
          (currentNode as FolderNode).children.forEach(rebuildPaths);
        }
      };

      rebuildPaths(id);

      // Save to IndexedDB
      saveFileSystem(nodes, state.rootIds);

      return { nodes };
    });
  },

  moveNode: (id: string, newParentId: string | null) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;

      const nodes = { ...state.nodes };

      // Remove from old parent
      if (node.parentId && nodes[node.parentId]) {
        const oldParent = nodes[node.parentId] as FolderNode;
        nodes[node.parentId] = {
          ...oldParent,
          children: oldParent.children.filter((childId) => childId !== id),
        };
      }

      // Add to new parent
      if (newParentId && nodes[newParentId]) {
        const newParent = nodes[newParentId] as FolderNode;
        nodes[newParentId] = {
          ...newParent,
          children: [...newParent.children, id],
        };
      }

      // Update node's parentId
      nodes[id] = {
        ...node,
        parentId: newParentId,
        modifiedAt: Date.now(),
      };

      // Rebuild paths
      const rebuildPaths = (nodeId: string) => {
        const currentNode = nodes[nodeId];
        currentNode.path = buildPath(nodes, nodeId);

        if (currentNode.type === 'folder') {
          (currentNode as FolderNode).children.forEach(rebuildPaths);
        }
      };

      rebuildPaths(id);

      // Update rootIds
      let rootIds = state.rootIds.filter((rootId) => rootId !== id);
      if (!newParentId) {
        rootIds = [...rootIds, id];
      }

      // Save to IndexedDB
      saveFileSystem(nodes, rootIds);

      return { nodes, rootIds };
    });
  },

  toggleFolder: (id: string) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== 'folder') return state;

      const nodes = {
        ...state.nodes,
        [id]: {
          ...node,
          isExpanded: !(node as FolderNode).isExpanded,
        },
      };

      return { nodes };
    });
  },

  togglePin: (id: string) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== 'file') return state;

      const nodes = {
        ...state.nodes,
        [id]: {
          ...node,
          isPinned: !(node as FileNode).isPinned,
        },
      };

      // Save to IndexedDB
      saveFileSystem(nodes, state.rootIds);

      return { nodes };
    });
  },

  updateFileCompany: (id: string, companyId: string | undefined, companyName: string | undefined) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== 'file') return state;

      const updatedNode: FileNode = {
        ...(node as FileNode),
        companyId,
        companyName,
        modifiedAt: Date.now(),
      };

      const nodes = { ...state.nodes, [id]: updatedNode };

      // Save to IndexedDB
      saveFileSystem(nodes, state.rootIds);

      return { nodes };
    });
  },

  getFile: (id: string) => {
    const node = get().nodes[id];
    return node?.type === 'file' ? (node as FileNode) : undefined;
  },

  getNode: (id: string) => {
    return get().nodes[id];
  },

  getAllFiles: () => {
    const nodes = get().nodes;
    return Object.values(nodes).filter((node): node is FileNode => node.type === 'file');
  },

  getPinnedFiles: () => {
    return get()
      .getAllFiles()
      .filter((file) => file.isPinned);
  },

  getFilesByCompany: (companyId: string) => {
    return get()
      .getAllFiles()
      .filter((file) => file.companyId === companyId);
  },

  getUngroupedFiles: () => {
    return get()
      .getAllFiles()
      .filter((file) => !file.companyId);
  },

  initializeFromStorage: async () => {
    const { nodes, rootIds } = await loadFileSystem();

    // If no data, create a sample file
    if (Object.keys(nodes).length === 0) {
      const id = generateId();
      const now = Date.now();

      const sampleFile: FileNode = {
        id,
        name: 'resume.tex',
        type: 'file',
        content: DEFAULT_RESUME_TEMPLATE,
        parentId: null,
        path: '/resume.tex',
        createdAt: now,
        modifiedAt: now,
        isPinned: true,
      };

      set({ nodes: { [id]: sampleFile }, rootIds: [id] });
      saveFileSystem({ [id]: sampleFile }, [id]);
    } else {
      set({ nodes, rootIds });
    }
  },

  saveToStorage: async () => {
    const { nodes, rootIds } = get();
    await saveFileSystem(nodes, rootIds);
  },
}));
