'use client';

import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useFileSystemStore } from '@/store/fileSystemStore';

export default function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createFile } = useFileSystemStore();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = (_e) => {
        // const content = e.target?.result as string;
        createFile(file.name, null);
        // Note: In a real implementation, you'd need to update the file content
        // after creation. This is a simplified version.
      };

      reader.readAsText(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".tex"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        onClick={triggerFileInput}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
        title="Upload .tex files"
      >
        <Upload className="w-4 h-4" />
        <span>Upload</span>
      </button>
    </div>
  );
}
