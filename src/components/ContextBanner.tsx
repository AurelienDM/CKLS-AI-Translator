import { FileData } from '@/types';
import { Button } from '@/components/ui/button';
import { FileText, RotateCcw } from 'lucide-react';

interface ContextBannerProps {
  filesData: FileData[];
  fileCount: number;
  onClearSession: () => void;
}

export function ContextBanner({ filesData, fileCount, onClearSession }: ContextBannerProps) {
  // Show file session info when files are loaded
  if (fileCount > 0 && filesData.length > 0) {
    const firstFile = filesData[0];
    const stringCount = firstFile?.stringCount || 0;
    
    // Display logic: Option 1B for single file, Option 1D for multiple files
    const displayText = fileCount === 1 
      ? firstFile?.fileName 
      : `${fileCount} files loaded (${firstFile?.fileName} +${fileCount - 1})`;
    
    return (
      <div className="bg-primary/10 border-b border-primary/30 px-3 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary-foreground">
              {displayText}
            </span>
            {fileCount === 1 && stringCount > 0 && (
              <>
                <span className="text-primary/40">·</span>
                <span className="text-[10px] text-primary-foreground/80">
                  {stringCount} strings
                </span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSession}
            className="h-6 text-xs text-primary hover:text-primary-foreground hover:bg-primary/20"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // Hide banner completely when no files loaded
  return null;
}

