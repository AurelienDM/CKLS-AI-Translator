import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Zap, TrendingDown, TextQuote } from 'lucide-react';
import { SubtitleSplitTool } from './SubtitleSplitTool';
import type { SubtitleFileData, TimingIssue } from '@/types/subtitle';
import { getTimingIssueSummary } from '@/modules/SubtitleTimingAnalyzer';

interface SubtitleTimingIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtitleFiles: SubtitleFileData[];
}

export function SubtitleTimingIssuesModal({
  isOpen,
  onClose,
  subtitleFiles
}: SubtitleTimingIssuesModalProps) {
  const [showSplitTool, setShowSplitTool] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<TimingIssue | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);

  // Collect all timing issues across all files
  const fileIssues = subtitleFiles.map((file, fileIndex) => ({
    fileIndex,
    fileName: file.fileName,
    issues: file.timingIssues || []
  })).filter(f => f.issues.length > 0);

  const allIssues = fileIssues.flatMap(f => f.issues);
  const summary = getTimingIssueSummary(allIssues);

  const handleOpenSplitTool = (issue: TimingIssue, fileIndex: number) => {
    setSelectedIssue(issue);
    setSelectedFileIndex(fileIndex);
    setShowSplitTool(true);
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'overlap':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'too-fast':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'too-slow':
        return <TrendingDown className="w-4 h-4 text-blue-500" />;
      case 'gap-too-small':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'length-overflow':
        return <TextQuote className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getIssueColor = (type: string) => {
    switch (type) {
      case 'overlap':
        return 'border-destructive bg-destructive/10';
      case 'too-fast':
        return 'border-amber-500 bg-amber-500/10';
      case 'too-slow':
        return 'border-blue-500 bg-blue-500/10';
      case 'gap-too-small':
        return 'border-orange-500 bg-orange-500/10';
      case 'length-overflow':
        return 'border-red-500 bg-red-500/10';
      default:
        return 'border-muted';
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showSplitTool} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Subtitle Timing Issues
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {summary.overlapCount > 0 && (
                <Badge variant="destructive" className="justify-center py-2">
                  {summary.overlapCount} Overlaps
                </Badge>
              )}
              {summary.tooFastCount > 0 && (
                <Badge variant="outline" className="justify-center py-2 border-amber-500 text-amber-600">
                  {summary.tooFastCount} Too Fast
                </Badge>
              )}
              {summary.tooSlowCount > 0 && (
                <Badge variant="outline" className="justify-center py-2 border-blue-500 text-blue-600">
                  {summary.tooSlowCount} Too Slow
                </Badge>
              )}
              {summary.gapTooSmallCount > 0 && (
                <Badge variant="outline" className="justify-center py-2 border-orange-500 text-orange-600">
                  {summary.gapTooSmallCount} Small Gaps
                </Badge>
              )}
              {summary.lengthOverflowCount > 0 && (
                <Badge variant="outline" className="justify-center py-2 border-red-500 text-red-600">
                  {summary.lengthOverflowCount} Too Long
                </Badge>
              )}
            </div>

            {/* Issues by File */}
            {fileIssues.map((fileData) => (
              <div key={fileData.fileIndex} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{fileData.fileName}</h4>
                  <Badge variant="secondary">{fileData.issues.length} issues</Badge>
                </div>

                <div className="space-y-2">
                  {fileData.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`border rounded-md p-3 ${getIssueColor(issue.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getIssueIcon(issue.type)}
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Subtitle #{issue.subtitleIndex}
                              {issue.nextSubtitleIndex && ` → #${issue.nextSubtitleIndex}`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {issue.type.replace('-', ' ')}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {issue.details}
                          </p>
                          
                          {issue.suggestedFix && (
                            <p className="text-sm text-primary">
                              💡 {issue.suggestedFix}
                            </p>
                          )}
                          
                          {issue.type === 'length-overflow' && issue.translatedText && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSplitTool(issue, fileData.fileIndex)}
                              >
                                Split Manually
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Tool Modal */}
      {selectedIssue && (
        <SubtitleSplitTool
          isOpen={showSplitTool}
          onClose={() => {
            setShowSplitTool(false);
            setSelectedIssue(null);
          }}
          issue={selectedIssue}
          fileIndex={selectedFileIndex}
        />
      )}
    </>
  );
}

