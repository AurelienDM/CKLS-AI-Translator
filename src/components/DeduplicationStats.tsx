/**
 * DeduplicationStats Component
 * Displays savings from cross-file string deduplication
 */

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, Zap, ArrowRight } from 'lucide-react';
import type { DeduplicationStats } from '@/types/multiFile';

interface DeduplicationStatsProps {
  stats: DeduplicationStats;
}

export function DeduplicationStats({ stats }: DeduplicationStatsProps) {
  if (!stats) {
    return null;
  }

  // Show info message for single files
  if (stats.totalFiles < 2) {
    return (
      <Card className="p-4 bg-info/10 border-info/30">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-info-foreground mb-1">
              Smart Deduplication
            </h4>
            <p className="text-sm text-info-foreground/80">
              Processing a single file. Upload multiple files together to benefit from cross-file deduplication and save API costs.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const efficiencyPercentage = 100 - stats.deduplicationPercentage;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">Smart Deduplication</h3>
        </div>

        {/* Total → Unique Flow */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Found</p>
            <p className="text-3xl font-bold">{stats.totalStrings.toLocaleString()}</p>
          </div>
          
          <ArrowRight className="w-6 h-6 text-primary flex-shrink-0" />
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Unique After Dedup</p>
            <p className="text-3xl font-bold text-primary">{stats.uniqueStrings.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Deduplication</span>
            <span className="font-semibold text-primary">{stats.deduplicationPercentage}%</span>
          </div>
          <Progress value={stats.deduplicationPercentage} className="h-2" />
        </div>

        {/* Savings */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2 p-3 rounded-md bg-success/10">
            <TrendingDown className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-success-foreground">
                {stats.savedApiCalls.toLocaleString()}
              </p>
              <p className="text-xs text-success-foreground/80">API calls saved</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-success/10">
            <span className="text-lg mt-0.5">💰</span>
            <div>
              <p className="font-semibold text-success-foreground">
                {stats.characterSavings.toLocaleString()}
              </p>
              <p className="text-xs text-success-foreground/80">characters saved</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-center text-muted-foreground pt-2 border-t">
          Translating {stats.uniqueStrings.toLocaleString()} unique strings instead of {stats.totalStrings.toLocaleString()} = {efficiencyPercentage}% efficiency
        </div>
      </div>
    </Card>
  );
}

