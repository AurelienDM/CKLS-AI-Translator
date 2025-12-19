/**
 * Translation Progress Component
 * Displays real-time progress during translation with pause/cancel controls
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Play, X, Languages, FileText } from 'lucide-react';

interface TranslationProgressProps {
  current: number;
  total: number;
  currentLanguage: string;
  phase: string;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  // Character counts for display
  currentCharacters?: number;
  totalCharacters?: number;
  // Multi-file support
  fileCount?: number;
  currentFile?: number;
  currentFileName?: string;
  currentFileStrings?: number;
  totalStringsAcrossFiles?: number;
  currentFileProgress?: number;
}

export function TranslationProgress({
  current,
  total,
  currentLanguage,
  phase,
  isPaused,
  onPause,
  onResume,
  onCancel,
  currentCharacters,
  totalCharacters,
  fileCount,
  currentFile,
  currentFileName,
  currentFileStrings,
  currentFileProgress
}: TranslationProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  // Use character counts if available, otherwise estimate from strings
  const displayCurrentChars = currentCharacters ?? Math.round(current * 50); // Avg 50 chars/string
  const displayTotalChars = totalCharacters ?? Math.round(total * 50);
  
  // Estimate time remaining based on characters (rough estimate: 100 chars/second)
  const remainingChars = displayTotalChars - displayCurrentChars;
  const estimatedSecondsRemaining = Math.ceil(remainingChars / 100);
  const estimatedMinutes = Math.ceil(estimatedSecondsRemaining / 60);

  // Format large numbers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  // Multi-file mode detection
  const isMultiFile = fileCount !== undefined && fileCount > 1;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Translating...</h3>
          </div>
          <div className="text-sm font-medium text-primary">
            {percentage}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {formatNumber(displayCurrentChars)} / {formatNumber(displayTotalChars)} characters
            </span>
            {estimatedMinutes > 0 && !isPaused && (
              <span>
                ~{estimatedMinutes} min remaining
              </span>
            )}
          </div>
        </div>

        {/* Multi-File Info - Two Progress Bars */}
        {isMultiFile && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-900/30 border-2 border-blue-200 dark:border-blue-800 space-y-3">
            {/* File Header */}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              <FileText className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold">File {currentFile} of {fileCount}:</span>
              <span className="truncate text-gray-700 dark:text-gray-300">
                {currentFileName || 'Unknown file'}
              </span>
            </div>
            
            {/* Current File Progress Bar */}
            {currentFileStrings && currentFileProgress !== undefined && (
              <div className="space-y-1">
                <Progress 
                  value={(currentFileProgress / currentFileStrings) * 100} 
                  className="h-2"
                />
                <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
                  <span>{currentFileProgress} / {currentFileStrings} items in this file</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {Math.round((currentFileProgress / currentFileStrings) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Language */}
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
          <div className="flex-1">
            <p className="text-sm font-medium">Current Language</p>
            <p className="text-sm text-muted-foreground">{currentLanguage}</p>
          </div>
          {phase && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Phase</p>
              <p className="text-sm font-medium capitalize">{phase}</p>
            </div>
          )}
        </div>

        {/* Pause State */}
        {isPaused && (
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Translation Paused
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Click Resume to continue or Cancel to stop.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isPaused ? (
            <Button onClick={onPause} variant="outline" className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button onClick={onResume} variant="default" className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          <Button onClick={onCancel} variant="outline" className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

