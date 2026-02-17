'use client';

import { useEffect } from 'react';
import Editor from '@/components/Editor/Editor';
import Preview from '@/components/Preview/Preview';
import Sidebar from '@/components/Sidebar/Sidebar';
import { useFileSystemStore } from '@/store/fileSystemStore';

export default function Home() {
  const { initializeFromStorage } = useFileSystemStore();

  useEffect(() => {
    initializeFromStorage();
  }, [initializeFromStorage]);

  return (
    <main className="h-screen w-screen overflow-hidden flex bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex">
        <Editor />
        <div className="resizer" />
        <Preview />
      </div>
    </main>
  );
}
