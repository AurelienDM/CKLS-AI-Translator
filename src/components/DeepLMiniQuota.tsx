/**
 * DeepL Mini Quota Component
 * Minimal quota display designed to fit inside the DeepL button in Step 2
 */

import { useState, useEffect } from 'react';
import { DeepLQuotaInfo } from '@/utils/apiValidator';

function formatCompact(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return num.toString();
}

export function DeepLMiniQuota() {
  const [quota, setQuota] = useState<DeepLQuotaInfo | null>(null);

  // Load quota from cache on mount and listen for changes
  useEffect(() => {
    const loadQuota = async () => {
      try {
        const cached = await chrome.storage.local.get('deeplQuota');
        if (cached.deeplQuota) {
          setQuota(cached.deeplQuota as DeepLQuotaInfo);
        }
      } catch {
        // Ignore errors
      }
    };
    
    loadQuota();

    // Listen for storage changes to update quota in real-time
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.deeplQuota?.newValue) {
        setQuota(changes.deeplQuota.newValue as DeepLQuotaInfo);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  if (!quota) return null;

  const isLow = quota.percentageUsed > 80;
  const isCritical = quota.percentageUsed > 95;

  // Determine colors based on quota level
  const getBarColor = () => {
    if (isCritical) return 'bg-destructive';
    if (isLow) return 'bg-amber-500';
    return 'bg-primary';
  };

  const getTextColor = () => {
    if (isCritical) return 'text-destructive';
    if (isLow) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="mt-1.5 w-full px-1">
      {/* Mini progress bar */}
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: `${Math.min(100 - quota.percentageUsed, 100)}%` }}
        />
      </div>
      {/* Compact text */}
      <p className={`text-[9px] mt-0.5 ${getTextColor()}`}>
        {formatCompact(quota.remaining)} left
      </p>
    </div>
  );
}

