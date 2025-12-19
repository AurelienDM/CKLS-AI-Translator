import { TrendingDown, FileText, Type, ChevronDown, BookOpen, BookCheck, BookPlus, Files, Layers, BookMarked, Ban, Zap } from 'lucide-react';
import type { DeduplicationStats } from '@/types/multiFile';
import { useState } from 'react';

interface TranslationMetrics {
  totalStrings: number;
  uniqueStrings: number;
  duplicateStrings: number;
  deduplicationPercentage: number;
  totalCharacters: number;
  totalRawCharacters: number;
  characterSavings: number;
  totalApiCalls: number;
  actualApiCalls?: number;
  savedApiCalls?: number;
  stringsAlreadyFilled?: number;
  glossaryMatches?: number;
  tmxMatches?: number;
  actualStringsToTranslate?: number;
  totalSavedCalls?: number;
  sourceCopiedRows?: number;
  dntMatches?: number;
}

interface LanguageBreakdown {
  source?: string;
  existing?: string[];
  targets?: string[];
}

interface TmxStats {
  matched: number;
  savedCalls: number;
}

interface TranslationSummaryProps {
  metrics: TranslationMetrics | null;
  targetLanguageCount: number;
  deduplicationStats?: DeduplicationStats | null;
  languageBreakdown?: LanguageBreakdown;
  tmxStats?: TmxStats;
  glossaryCount?: number;
  dntCount?: number;
}

// Helper to format large numbers
const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toLocaleString();
};

export function TranslationSummary({ 
  metrics, 
  targetLanguageCount, 
  deduplicationStats, 
  languageBreakdown, 
  tmxStats,
  glossaryCount = 0,
  dntCount = 0
}: TranslationSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!metrics) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Upload a file or enter text to see translation metrics</p>
      </div>
    );
  }

  const hasDuplicates = metrics.duplicateStrings > 0;
  const hasMultipleFiles = deduplicationStats && deduplicationStats.totalFiles > 1;
  const hasTmx = (metrics.tmxMatches ?? 0) > 0 || (tmxStats && tmxStats.matched > 0);
  
  // Calculate total savings
  const totalSaved = (metrics.duplicateStrings || 0) + 
                     (metrics.glossaryMatches ?? 0) + 
                     (metrics.tmxMatches ?? tmxStats?.matched ?? 0) +
                     (metrics.stringsAlreadyFilled ?? 0);
  
  const hasSavings = totalSaved > 0 || (metrics.totalSavedCalls ?? 0) > 0;

  // API calls calculation
  const apiCalls = metrics.actualApiCalls ?? metrics.totalApiCalls;

  return (
    <div className="space-y-6">
      {/* Stats Grid - 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        {/* Found */}
        <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
          <Files className="w-5 h-5 text-blue-600 mb-2" />
          <span className="text-2xl font-bold">{metrics.totalStrings.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">found</span>
        </div>

        {/* To Translate */}
        <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
          <FileText className="w-5 h-5 text-purple-600 mb-2" />
          <span className="text-2xl font-bold text-purple-600">
            {metrics.actualStringsToTranslate !== undefined 
              ? metrics.actualStringsToTranslate.toLocaleString()
              : metrics.uniqueStrings.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">to translate</span>
        </div>

        {/* Characters */}
        <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
          <Type className="w-5 h-5 text-emerald-600 mb-2" />
          <span className="text-2xl font-bold">{formatLargeNumber(metrics.totalCharacters)}</span>
          <span className="text-xs text-muted-foreground">characters</span>
        </div>
      </div>

      {/* Optimization Grid - 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        {/* Duplicates */}
        <div className={`flex flex-col items-center p-4 rounded-xl border ${
          hasDuplicates 
            ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' 
            : 'border-dashed text-muted-foreground'
        }`}>
          <Layers className={`w-5 h-5 mb-2 ${hasDuplicates ? 'text-orange-600' : 'opacity-50'}`} />
          <span className={`text-2xl font-bold ${hasDuplicates ? 'text-orange-600' : ''}`}>
            {metrics.duplicateStrings.toLocaleString()}
          </span>
          <span className={`text-xs ${hasDuplicates ? 'text-orange-700 dark:text-orange-300' : ''}`}>
            duplicates
          </span>
        </div>

        {/* Glossary - uses passed count */}
        <div className={`flex flex-col items-center p-4 rounded-xl border ${
          glossaryCount > 0 
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' 
            : 'border-dashed text-muted-foreground'
        }`}>
          <BookMarked className={`w-5 h-5 mb-2 ${glossaryCount > 0 ? 'text-amber-600' : 'opacity-50'}`} />
          <span className={`text-2xl font-bold ${glossaryCount > 0 ? 'text-amber-600' : ''}`}>
            {glossaryCount.toLocaleString()}
          </span>
          <span className={`text-xs ${glossaryCount > 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
            glossary
          </span>
        </div>

        {/* DNT - uses passed count */}
        <div className={`flex flex-col items-center p-4 rounded-xl border ${
          dntCount > 0 
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
            : 'border-dashed text-muted-foreground'
        }`}>
          <Ban className={`w-5 h-5 mb-2 ${dntCount > 0 ? 'text-red-600' : 'opacity-50'}`} />
          <span className={`text-2xl font-bold ${dntCount > 0 ? 'text-red-600' : ''}`}>
            {dntCount.toLocaleString()}
          </span>
          <span className={`text-xs ${dntCount > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>
            DNT
          </span>
        </div>
      </div>

      {/* Language Grid - 3 columns */}
      {languageBreakdown && (
        <div className="grid grid-cols-3 gap-3">
          {/* Source Language */}
          {languageBreakdown.source ? (
            <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
              <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
              <span className="text-sm font-bold font-mono">{languageBreakdown.source}</span>
              <span className="text-xs text-muted-foreground">source</span>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 rounded-xl border border-dashed text-muted-foreground">
              <BookOpen className="w-5 h-5 mb-2 opacity-50" />
              <span className="text-sm font-medium">—</span>
              <span className="text-xs">source</span>
            </div>
          )}

          {/* Existing Languages */}
          {languageBreakdown.existing && languageBreakdown.existing.length > 0 ? (
            <div className="flex flex-col items-center p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <BookCheck className="w-5 h-5 text-green-600 mb-2" />
              <span className="text-sm font-bold font-mono text-center">
                {languageBreakdown.existing.length <= 2 
                  ? languageBreakdown.existing.join(', ')
                  : `${languageBreakdown.existing.length} langs`
                }
              </span>
              <span className="text-xs text-green-700 dark:text-green-300">update</span>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 rounded-xl border border-dashed text-muted-foreground">
              <BookCheck className="w-5 h-5 mb-2 opacity-50" />
              <span className="text-sm font-medium">—</span>
              <span className="text-xs">no existing</span>
            </div>
          )}

          {/* Target Languages */}
          {languageBreakdown.targets && languageBreakdown.targets.length > 0 ? (
            <div className="flex flex-col items-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
              <BookPlus className="w-5 h-5 text-violet-600 mb-2" />
              <span className="text-sm font-bold font-mono text-center">
                {languageBreakdown.targets.length <= 2 
                  ? languageBreakdown.targets.join(', ')
                  : `${languageBreakdown.targets.length} langs`
                }
              </span>
              <span className="text-xs text-violet-700 dark:text-violet-300">new</span>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 rounded-xl border border-dashed text-muted-foreground">
              <BookPlus className="w-5 h-5 mb-2 opacity-50" />
              <span className="text-sm font-medium">—</span>
              <span className="text-xs">no targets</span>
            </div>
          )}
        </div>
      )}

      {/* API Calls Card - Full width */}
      <div className="flex flex-col items-center p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Zap className="w-5 h-5 text-blue-600 mb-2" />
        <span className="text-2xl font-bold text-blue-600">{apiCalls.toLocaleString()}</span>
        <span className="text-xs text-blue-700 dark:text-blue-300">API calls</span>
      </div>

      {/* Savings Banner */}
      {hasSavings && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50">
          <TrendingDown className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-300">
            <span className="font-semibold">
              {metrics.totalSavedCalls ?? totalSaved} API calls saved
            </span>
            <span className="mx-1">·</span>
            <span className="text-green-600/80 dark:text-green-400/80">
              deduplication, glossary, fill mode
            </span>
          </span>
        </div>
      )}

      {/* Show Details Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
      >
        <span>{showDetails ? 'Hide' : 'Show'} details</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {/* Detailed Breakdown (Collapsible) */}
      {showDetails && (
        <div className="pt-4 border-t space-y-4 text-xs animate-in slide-in-from-top-2">
          {/* Deduplication Details */}
          {hasDuplicates && (
            <div>
              <p className="text-muted-foreground font-medium mb-2">Deduplication</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{metrics.totalStrings.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground">Duplicates</p>
                  <p className="font-medium text-orange-600">{metrics.duplicateStrings.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground">Unique</p>
                  <p className="font-medium text-primary">{metrics.uniqueStrings.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Translation Scope */}
          {targetLanguageCount > 0 && (
            <div>
              <p className="text-muted-foreground font-medium mb-2">Translation Scope</p>
              <div className="space-y-1.5">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Target Languages</span>
                  <span className="font-medium">{targetLanguageCount}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Strings per Language</span>
                  <span className="font-medium">{metrics.uniqueStrings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Total API Calls</span>
                  <span className="font-medium">{metrics.totalApiCalls.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Multi-File Analysis */}
          {hasMultipleFiles && (
            <div>
              <p className="text-muted-foreground font-medium mb-2">Multi-File Analysis</p>
              <div className="space-y-1.5">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Files Analyzed</span>
                  <span className="font-medium">{deduplicationStats.totalFiles}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Cross-File Duplicates</span>
                  <span className="font-medium">{deduplicationStats.totalStrings - deduplicationStats.uniqueStrings}</span>
                </div>
              </div>
            </div>
          )}

          {/* Optimization Details */}
          {((metrics.stringsAlreadyFilled ?? 0) > 0 || (metrics.glossaryMatches ?? 0) > 0 || hasTmx) && (
            <div>
              <p className="text-muted-foreground font-medium mb-2">Optimization Breakdown</p>
              <div className="space-y-1.5">
                {(metrics.stringsAlreadyFilled ?? 0) > 0 && (
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Pre-filled (skipped)</span>
                    <span className="font-medium">{metrics.stringsAlreadyFilled} strings</span>
                  </div>
                )}
                {(metrics.glossaryMatches ?? 0) > 0 && (
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Glossary matches</span>
                    <span className="font-medium">{metrics.glossaryMatches} strings</span>
                  </div>
                )}
                {hasTmx && (
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">TMX matches</span>
                    <span className="font-medium">{metrics.tmxMatches ?? tmxStats?.matched} strings</span>
                  </div>
                )}
                {(metrics.sourceCopiedRows ?? 0) > 0 && (
                  <div className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Source copied (URLs)</span>
                    <span className="font-medium">{metrics.sourceCopiedRows} rows</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
