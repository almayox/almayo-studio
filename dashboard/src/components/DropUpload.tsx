"use client";

import { useRef, useState, type ReactNode } from "react";

type DropUploadProps = {
  onFiles: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function DropUpload({
  onFiles,
  accept,
  multiple,
  disabled,
  className = "",
  children,
}: DropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const stop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <label
      className={`${className} ${
        isDragging ? "border-fg bg-fg/5 ring-2 ring-fg/30" : ""
      } ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
      onDragEnter={(e) => {
        stop(e);
        if (disabled) return;
        dragCounter.current += 1;
        if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
      }}
      onDragOver={(e) => {
        stop(e);
        if (!disabled && e.dataTransfer.types.includes("Files")) {
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(e) => {
        stop(e);
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) setIsDragging(false);
      }}
      onDrop={(e) => {
        stop(e);
        dragCounter.current = 0;
        setIsDragging(false);
        if (disabled) return;
        const files = e.dataTransfer.files;
        if (files?.length) onFiles(files);
      }}
    >
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
