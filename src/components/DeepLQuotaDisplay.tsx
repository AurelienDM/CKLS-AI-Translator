/**
 * DeepL Quota Display Component
 * Shows DeepL API usage quota with progress bar for the Options page
 */

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchDeepLQuota, DeepLQuotaInfo } from '@/utils/apiValidator';

interface DeepLQuotaDisplayProps {
  apiKey: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return num.toLocaleString();
}

export function DeepLQuotaDisplay({ apiKey }: DeepLQuotaDisplayProps) {
  const [quota, setQuota] = useState<DeepLQuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuota = async () => {
    if (!apiKey) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchDeepLQuota(apiKey);
      if (data) {
        setQuota(data);
        // Store in chrome.storage for persistence
        await chrome.storage.local.set({ deeplQuota: data });
      } else {
        setError('Failed to fetch quota');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load cached quota on mount, then refresh
  useEffect(() => {
    const loadAndRefresh = async () => {
      // Load cached first for instant display
      try {
        const cached = await chrome.storage.local.get('deeplQuota');
        if (cached.deeplQuota) {
          setQuota(cached.deeplQuota as DeepLQuotaInfo);
        }
      } catch {
        // Ignore cache errors
      }
      // Then refresh with live data
      if (apiKey) {
        refreshQuota();
      }
    };
    loadAndRefresh();
  }, [apiKey]);

  if (!apiKey) return null;

  const isLow = quota && quota.percentageUsed > 80;
  const isCritical = quota && quota.percentageUsed > 95;

  // Determine progress bar color class
  const getProgressColorClass = () => {
    if (isCritical) return '[&>div]:bg-destructive';
    if (isLow) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-primary';
  };

  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          📊 Monthly Quota
          {quota?.isFreeKey && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Free Tier
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshQuota}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : quota ? (
        <>
          <Progress 
            value={quota.percentageUsed} 
            className={`h-2.5 ${getProgressColorClass()}`}
          />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {quota.characterCount.toLocaleString()} used
            </span>
            <span className={
              isCritical 
                ? 'text-destructive font-medium' 
                : isLow 
                ? 'text-amber-500 font-medium' 
                : 'text-success font-medium'
            }>
              {quota.remaining.toLocaleString()} remaining
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {quota.percentageUsed.toFixed(1)}% of {formatNumber(quota.characterLimit)} characters
            </span>
            <span>
              Updated: {new Date(quota.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {isCritical && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Quota almost exhausted! Consider upgrading or wait for monthly reset.</span>
            </div>
          )}
          {isLow && !isCritical && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Running low on quota this month.</span>
            </div>
          )}
        </>
      ) : isLoading ? (
        <div className="space-y-2">
          <div className="h-2.5 bg-muted animate-pulse rounded" />
          <div className="flex justify-between">
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

