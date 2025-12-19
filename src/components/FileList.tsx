/**
 * FileList Component
 * Displays list of uploaded files with metadata and actions
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { File, X, CheckCircle2, Upload } from 'lucide-react';
import type { FileData } from '@/types/multiFile';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface FileListProps {
  filesData: FileData[];
  onRemove: (index: number) => void;
  onClearAll?: () => void;
  onFilesSelect?: (files: File[]) => void;
  multiple?: boolean;
}

export function FileList({ filesData, onRemove, onClearAll, onFilesSelect, multiple = true }: FileListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!filesData || filesData.length === 0) {
    return null;
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFilesSelect) {
      onFilesSelect(Array.from(files));
    }
    e.target.value = '';
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Uploaded Files</h3>
            <Badge variant="secondary" className="text-xs">
              {filesData.length} file{filesData.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {onClearAll && filesData.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-7 px-2 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {filesData.map((fileData, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm font-medium truncate">
                    {fileData.fileName}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {/* Source and Strings on same line */}
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Source:</span>
                    <Badge variant="outline" className="text-xs">
                      {fileData.sourceCKLS}
                    </Badge>
                  </div>
                  
                  {fileData.stringCount !== undefined && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Strings:</span>
                        <span>{fileData.stringCount}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Existing languages on separate line */}
                {fileData.existingLanguages && fileData.existingLanguages.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-medium">Existing:</span>
                    <span className="text-xs">
                      {fileData.existingLanguages.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Integrated Dropzone - Harmonized with main dropzone */}
        {onFilesSelect && (
          <div className="mt-3 pt-3 border-t">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer",
                "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/20"
              )}
              onClick={handleButtonClick}
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              
              <div className="text-center space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Drop more files to add
                </p>
                <p className="text-xs text-muted-foreground">
                  {filesData.length} file{filesData.length !== 1 ? 's' : ''} uploaded
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xml,.json,.srt,.vtt"
                multiple={multiple}
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
            
            {/* Supported formats hint */}
            <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
              Supported: .xlsx, .xml, .json, .srt, .vtt
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

