import { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  multiple?: boolean;
  isLoading?: boolean;
}

export function FileUpload({ 
  onFileSelect, 
  onFilesSelect,
  multiple = false,
  isLoading = false
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine local and parent loading states
  const showLoading = isLoading || isLocalLoading;

  // Reset local loading when parent loading changes (file processed or error)
  useEffect(() => {
    if (!isLoading) {
      setIsLocalLoading(false);
    }
  }, [isLoading]);

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.xlsx', '.xml', '.json', '.srt', '.vtt'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(extension)) {
      setError('Please upload .xlsx, .xml, .json, .srt, or .vtt files only');
      setIsLocalLoading(false); // Reset loading on validation error
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleFilesSelect = (files: File[]) => {
    // Set loading immediately BEFORE validation
    setIsLocalLoading(true);
    
    const validFiles = files.filter(validateFile);
    
    if (validFiles.length === 0) {
      setIsLocalLoading(false); // Reset if no valid files
      return;
    }

    if (multiple && onFilesSelect) {
      onFilesSelect(validFiles);
    } else if (!multiple && onFileSelect && validFiles.length > 0) {
      onFileSelect(validFiles[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  }, [multiple]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelect(Array.from(files));
    }
    e.target.value = '';
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Simple Dropzone */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed transition-all",
          showLoading
            ? "border-primary/50 bg-primary/5 cursor-wait"
            : isDragOver 
              ? "border-primary bg-primary/5 cursor-pointer" 
              : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30 cursor-pointer"
        )}
        onDrop={showLoading ? undefined : handleDrop}
        onDragOver={showLoading ? undefined : handleDragOver}
        onDragLeave={showLoading ? undefined : handleDragLeave}
        onClick={showLoading ? undefined : handleButtonClick}
      >
        {showLoading ? (
          // Loading state content
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-primary">Processing file...</p>
              <p className="text-xs text-muted-foreground mt-1">Please wait</p>
            </div>
          </>
        ) : (
          // Normal state content
          <>
            <Upload className={cn(
              "w-8 h-8",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )} />
            
            <p className="text-sm text-muted-foreground">
              {isDragOver ? 'Drop here' : 'Drop files here or click to browse'}
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xml,.json,.srt,.vtt"
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
          disabled={showLoading}
        />
      </div>

      {/* Error message */}
      {error && !showLoading && (
        <div className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">
          {error}
        </div>
      )}

      {/* Supported formats - very small below */}
      {!showLoading && (
        <p className="text-[10px] text-center text-muted-foreground/60">
          Supported: .xlsx, .xml, .json, .srt, .vtt
        </p>
      )}
    </div>
  );
}
