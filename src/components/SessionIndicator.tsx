import { FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileData } from '@/types';

interface SessionIndicatorProps {
  fileCount: number;
  filesData: FileData[];
  onClearSession: () => void;
}

export function SessionIndicator({ fileCount, filesData, onClearSession }: SessionIndicatorProps) {
  const firstFile = filesData[0];
  const stringCount = firstFile?.stringCount || 0;
  
  // Display logic: Option 1B for single file, Option 1D for multiple files
  const displayText = fileCount === 1 
    ? firstFile?.fileName 
    : `${fileCount} files loaded (${firstFile?.fileName} +${fileCount - 1})`;
  
  return (
    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary-foreground">
            {displayText}
          </span>
          {fileCount === 1 && stringCount > 0 && (
            <>
              <span className="text-primary/40">·</span>
              <span className="text-xs text-primary-foreground/80">
                {stringCount} strings
              </span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSession}
          className="h-8 text-primary hover:text-primary-foreground hover:bg-primary/20"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

