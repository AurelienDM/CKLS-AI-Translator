import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileX } from 'lucide-react';
import type { ValidationIssue } from '@/types/subtitle';

interface SubtitleValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationErrors: Map<string, ValidationIssue[]>;
}

export function SubtitleValidationModal({
  isOpen,
  onClose,
  validationErrors
}: SubtitleValidationModalProps) {
  const errorFiles = Array.from(validationErrors.entries()).filter(([_, issues]) =>
    issues.some(issue => issue.severity === 'error')
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Subtitle File Validation Errors
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The following files have validation errors and cannot be processed. Please fix the issues and try again.
          </p>

          {errorFiles.map(([fileName, issues]) => {
            const errorIssues = issues.filter(issue => issue.severity === 'error');
            
            return (
              <div key={fileName} className="border rounded-md p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <FileX className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">{fileName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {errorIssues.length} error{errorIssues.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </div>

                <div className="ml-7 space-y-2">
                  {errorIssues.map((issue, index) => (
                    <div
                      key={index}
                      className="text-sm p-3 bg-destructive/10 rounded border-l-2 border-destructive space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-medium">
                          {issue.subtitleIndex > 0 ? `Subtitle #${issue.subtitleIndex}:` : 'File:'}
                        </span>
                        <span>{issue.message}</span>
                      </div>
                      
                      {/* Show HTML snippet for malformed-html errors */}
                      {issue.type === 'malformed-html' && issue.htmlSnippet && (
                        <div className="mt-2 space-y-2">
                          <div className="p-2 bg-muted/50 rounded font-mono text-xs border overflow-x-auto">
                            {issue.htmlSnippet}
                          </div>
                          {issue.suggestedFix && (
                            <div className="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400">
                              <span className="font-semibold">💡 Fix:</span>
                              <span>{issue.suggestedFix}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Batch-level errors */}
          {validationErrors.has('__batch__') && (
            <div className="border rounded-md p-4 space-y-3 bg-destructive/5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Batch Errors</h4>
                  <div className="mt-2 space-y-2">
                    {validationErrors.get('__batch__')!.map((issue, index) => (
                      <div key={index} className="text-sm">
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

