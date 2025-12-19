import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import type { TimingIssue } from '@/types/subtitle';
import { countCharsWithoutTags } from '@/utils/subtitleHelpers';

interface SubtitleSplitToolProps {
  isOpen: boolean;
  onClose: () => void;
  issue: TimingIssue;
  fileIndex: number;
}

export function SubtitleSplitTool({
  isOpen,
  onClose,
  issue,
  fileIndex
}: SubtitleSplitToolProps) {
  const { state, setState } = useApp();
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');

  // Get max chars from settings (default to BBC standard 37)
  const maxCharsPerLine = state.subtitleSettings?.maxCharsPerLine || 37;

  // Initialize lines when opened
  useState(() => {
    if (issue.translatedText && isOpen) {
      // Try to split intelligently at midpoint or punctuation
      const text = issue.translatedText;
      const midPoint = Math.floor(text.length / 2);
      
      // Look for punctuation near midpoint
      const punctuation = ['. ', ', ', '; ', ': ', '! ', '? '];
      let splitIndex = -1;
      
      for (const punct of punctuation) {
        const index = text.lastIndexOf(punct, midPoint + 10);
        if (index > midPoint - 10 && index < midPoint + 10) {
          splitIndex = index + punct.length;
          break;
        }
      }
      
      // If no punctuation found, split at nearest space
      if (splitIndex === -1) {
        splitIndex = text.lastIndexOf(' ', midPoint + 5);
        if (splitIndex === -1) splitIndex = midPoint;
      }
      
      setLine1(text.substring(0, splitIndex).trim());
      setLine2(text.substring(splitIndex).trim());
    }
  });

  const line1Chars = countCharsWithoutTags(line1);
  const line2Chars = countCharsWithoutTags(line2);
  const line1Valid = line1Chars <= maxCharsPerLine;
  const line2Valid = line2Chars <= maxCharsPerLine;

  const handleApplySplit = () => {
    if (!line1Valid || !line2Valid) {
      return;
    }

    // Update the subtitle in the file
    const newSubtitleFiles = [...(state.subtitleFiles || [])];
    const file = newSubtitleFiles[fileIndex];
    
    if (file) {
      const subtitle = file.subtitles.find((s: any) => s.index === issue.subtitleIndex);
      if (subtitle) {
        subtitle.text = `${line1}\n${line2}`;
        subtitle.originalLines = [line1, line2];
      }
      
      setState({ subtitleFiles: newSubtitleFiles });
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split Subtitle #{issue.subtitleIndex}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/30 p-3 rounded-md">
            <p className="text-sm text-muted-foreground mb-1">Original (too long):</p>
            <p className="text-sm font-medium">
              {issue.translatedText}
            </p>
            <p className="text-xs text-destructive mt-1">
              {issue.charCount} characters
            </p>
          </div>

          {/* Line 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="line1">Line 1</Label>
              <span className={`text-sm ${line1Valid ? 'text-success' : 'text-destructive'}`}>
                {line1Chars} / {maxCharsPerLine} chars
              </span>
            </div>
            <Textarea
              id="line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className={`font-mono ${!line1Valid ? 'border-destructive' : ''}`}
              rows={2}
            />
          </div>

          {/* Line 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="line2">Line 2</Label>
              <span className={`text-sm ${line2Valid ? 'text-success' : 'text-destructive'}`}>
                {line2Chars} / {maxCharsPerLine} chars
              </span>
            </div>
            <Textarea
              id="line2"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className={`font-mono ${!line2Valid ? 'border-destructive' : ''}`}
              rows={2}
            />
          </div>

          {/* Preview */}
          <div className="bg-muted/30 p-3 rounded-md">
            <p className="text-sm text-muted-foreground mb-1">Preview:</p>
            <div className="text-sm font-medium">
              <div>{line1}</div>
              <div>{line2}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApplySplit}
            disabled={!line1Valid || !line2Valid}
          >
            Apply Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

