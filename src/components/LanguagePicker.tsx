import { useEffect, useState, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ChevronDown, ChevronUp, BookOpen, BookCheck, BookPlus, Search } from 'lucide-react';
import { CKLS_CODES } from '@/utils/constants';
import { LanguageCompletionStats } from '@/utils/languageAnalysis';

// Initial number of languages to display before "Show more"
const INITIAL_DISPLAY_COUNT = 10;

export type OverwriteMode = 'keep' | 'fill-empty' | 'overwrite-all';

interface LanguagePickerProps {
  detectedSourceISO: string;
  detectedSourceCKLS: string;
  detectedExisting: string[];
  languageNames: Record<string, string>;
  selectedTargets: string[];
  existingLanguagesModes?: Record<string, OverwriteMode>;
  languageCompletionStats?: Record<string, LanguageCompletionStats>;
  onLanguageSelect: (
    sourceCKLS: string, 
    targetCKLS: string[], 
    existingModes: Record<string, OverwriteMode>
  ) => void;
}

// Progress bar color helper
function getProgressColor(percentage: number): 'green' | 'amber' | 'red' {
  if (percentage >= 80) return 'green';
  if (percentage >= 40) return 'amber';
  return 'red';
}

export function LanguagePicker({
  detectedSourceCKLS,
  detectedExisting,
  languageNames,
  selectedTargets,
  existingLanguagesModes,
  languageCompletionStats,
  onLanguageSelect
}: LanguagePickerProps) {
  const [sourceCKLS, setSourceCKLS] = useState(detectedSourceCKLS);
  const [targetLanguages, setTargetLanguages] = useState<string[]>(selectedTargets || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [hasManuallyChangedSource, setHasManuallyChangedSource] = useState(false);
  const [updateExistingOnly, setUpdateExistingOnly] = useState(false);
  const [isExistingExpanded, setIsExistingExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isTargetsExpanded, setIsTargetsExpanded] = useState(false);
  
  // Initialize existing languages modes with 'keep' as default (most conservative)
  const [existingModes, setExistingModes] = useState<Record<string, OverwriteMode>>(() => {
    if (existingLanguagesModes) return existingLanguagesModes;
    const modes: Record<string, OverwriteMode> = {};
    detectedExisting.forEach(code => {
      modes[code] = 'keep';
    });
    return modes;
  });
  
  // Memoize existingModes key to prevent unnecessary re-renders
  const existingModesKey = useMemo(
    () => JSON.stringify(existingModes),
    [existingModes]
  );
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only sync from props if user hasn't manually changed it
    if (detectedSourceCKLS && !hasManuallyChangedSource && detectedSourceCKLS !== sourceCKLS) {
      console.log('LanguagePicker: Updating source from props:', detectedSourceCKLS);
      setSourceCKLS(detectedSourceCKLS);
    }
  }, [detectedSourceCKLS, hasManuallyChangedSource, sourceCKLS]);

  useEffect(() => {
    if (selectedTargets && selectedTargets.length > 0) {
      setTargetLanguages(prev => {
        // Only update if different
        if (JSON.stringify(prev) !== JSON.stringify(selectedTargets)) {
          return selectedTargets;
        }
        return prev;
      });
    }
  }, [selectedTargets]);

  useEffect(() => {
    // Sync existing modes when detected existing changes
    if (detectedExisting.length > 0) {
      setExistingModes(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        detectedExisting.forEach(code => {
          if (!updated[code]) {
            updated[code] = 'keep';
            hasChanges = true;
          }
        });
        // Only return new object if there were actual changes
        return hasChanges ? updated : prev;
      });
    }
  }, [detectedExisting]);

  useEffect(() => {
    // Build final list: new languages + existing languages that need updates
    const updatableExisting = detectedExisting.filter(code => {
      const mode = existingModes[code];
      return mode === 'fill-empty' || mode === 'overwrite-all';
    });
    
    const languagesToTranslate = updateExistingOnly
      ? updatableExisting  // Only existing languages
      : [...new Set([...targetLanguages, ...updatableExisting])];  // Deduplicate!
    
    console.log('🔍 LanguagePicker - Calling onLanguageSelect with modes:', existingModes);
    console.log('🔍 LanguagePicker - Languages to translate:', languagesToTranslate);
    onLanguageSelect(sourceCKLS, languagesToTranslate, existingModes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCKLS, targetLanguages, existingModesKey, detectedExisting, updateExistingOnly]);

  // Close source dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
        setSourceSearchQuery('');
      }
    };

    if (showSourceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSourceDropdown]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSourceDropdown) {
        setShowSourceDropdown(false);
        setSourceSearchQuery('');
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSourceDropdown]);

  const toggleTargetLanguage = (ckls: string) => {
    setTargetLanguages(prev =>
      prev.includes(ckls)
        ? prev.filter(l => l !== ckls)
        : [...prev, ckls]
    );
  };

  const removeTargetLanguage = (ckls: string) => {
    setTargetLanguages(prev => prev.filter(l => l !== ckls));
  };

  const selectSourceLanguage = (ckls: string) => {
    setSourceCKLS(ckls);
    setHasManuallyChangedSource(true);
    setShowSourceDropdown(false);
    setSourceSearchQuery('');
  };

  const handleModeChange = (languageCode: string, mode: OverwriteMode) => {
    setExistingModes(prev => ({
      ...prev,
      [languageCode]: mode
    }));
  };

  const getModeLabel = (mode: OverwriteMode): string => {
    switch (mode) {
      case 'keep':
        return 'Keep';
      case 'fill-empty':
        return 'Fill';
      case 'overwrite-all':
        return 'Replace';
    }
  };

  const getDropdownClassName = (mode: OverwriteMode): string => {
    const baseClasses = "border-2 transition-all text-xs font-medium h-9";
    switch (mode) {
      case 'keep':
        return `${baseClasses} bg-green-50 border-green-300 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700`;
      case 'fill-empty':
        return `${baseClasses} bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-700`;
      case 'overwrite-all':
        return `${baseClasses} bg-red-50 border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-700`;
    }
  };

  const getLanguageName = (ckls: string): string => {
    const baseCode = ckls.split('-')[0];
    const langName = languageNames[baseCode];
    
    if (langName) {
      // Extract region for cleaner display
      const region = ckls.split('-')[1];
      const regionMap: Record<string, string> = {
        'GB': 'UK', 'US': 'US', 'FR': 'France', 'DE': 'Germany',
        'ES': 'Spain', 'IT': 'Italy', 'PT': 'Portugal', 'BR': 'Brazil',
        'CN': 'China', 'CHS': 'Simplified', 'JP': 'Japan', 'KR': 'Korea',
        'SA': 'Saudi Arabia', 'EG': 'Egypt', 'KW': 'Kuwait',
        'CA': 'Canada', 'CO': 'Colombia', 'BG': 'Bulgaria', 'CZ': 'Czech Republic',
        'DK': 'Denmark', 'EE': 'Estonia', 'FI': 'Finland', 'HU': 'Hungary',
        'ID': 'Indonesia', 'LT': 'Lithuania', 'LV': 'Latvia', 'MY': 'Malaysia',
        'NO': 'Norway', 'NL': 'Netherlands', 'PL': 'Poland', 'RO': 'Romania',
        'RU': 'Russia', 'SK': 'Slovakia', 'SI': 'Slovenia', 'SE': 'Sweden',
        'TH': 'Thailand', 'TR': 'Turkey', 'UA': 'Ukraine', 'VN': 'Vietnam'
      };
      const regionName = regionMap[region] || region;
      
      return `${langName} - ${regionName}`;
    }
    
    return ckls;
  };

  const availableTargets = CKLS_CODES.filter(
    ckls => ckls !== sourceCKLS && !detectedExisting.includes(ckls)
  );

  const filteredTargets = availableTargets.filter(ckls => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const langName = getLanguageName(ckls).toLowerCase();
    const code = ckls.toLowerCase();
    
    return code.includes(query) || langName.includes(query);
  });

  // Filter source options (exclude current source, existing, and targets)
  const filteredSourceOptions = CKLS_CODES.filter(ckls =>
    ckls !== sourceCKLS &&
    !detectedExisting.includes(ckls) &&
    !targetLanguages.includes(ckls) &&
    getLanguageName(ckls).toLowerCase().includes(sourceSearchQuery.toLowerCase())
  );

  // Show all languages when searching, otherwise limit display
  const displayedLanguages = showAll || searchQuery 
    ? filteredTargets 
    : filteredTargets.slice(0, INITIAL_DISPLAY_COUNT);

  const displayedTargets = displayedLanguages;
  const hiddenCount = filteredTargets.length - INITIAL_DISPLAY_COUNT;

  return (
    <div className="space-y-4">
      {/* SOURCE LANGUAGE CARD - Collapsible */}
      <Card className="overflow-hidden bg-white dark:bg-gray-900 border shadow-sm">
        {/* Header - Always visible, clickable to toggle */}
        <button
          onClick={() => setIsSourceExpanded(!isSourceExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer shrink-0">
              Source
            </Label>
            <ChevronDown 
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                isSourceExpanded ? 'rotate-180' : ''
              }`}
            />
            
            {/* Badge with value - always visible */}
            {sourceCKLS && (
              <Badge variant="secondary" className="ml-auto text-xs font-mono">
                {sourceCKLS}
              </Badge>
            )}
          </div>
        </button>

        {/* Collapsible Content */}
        {isSourceExpanded && (
          <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
            {sourceCKLS ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-sm px-2.5 py-1 border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400">
                    {sourceCKLS}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {getLanguageName(sourceCKLS)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSourceDropdown(true)}
                  className="h-8 px-3 text-xs"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed bg-muted/30">
                <p className="text-sm text-muted-foreground text-center mb-2">No source language detected</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSourceDropdown(true)}
                  className="w-full"
                >
                  Select Source Language
                </Button>
              </div>
            )}

        {/* Source Language Dropdown */}
        {showSourceDropdown && (
          <div ref={sourceDropdownRef} className="mt-3 p-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 shadow-md">
            <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block">
              Select Source Language
            </Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search languages..."
                value={sourceSearchQuery}
                onChange={(e) => setSourceSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {filteredSourceOptions.slice(0, 20).map(ckls => (
                <button
                  key={ckls}
                  onClick={() => selectSourceLanguage(ckls)}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-accent text-xs transition-colors flex items-center gap-2"
                >
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 min-w-[55px]">{ckls}</span>
                  <span className="text-gray-700 dark:text-gray-300 flex-1">
                    {getLanguageName(ckls)}
                  </span>
                </button>
              ))}
              {filteredSourceOptions.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                  No languages found
                </p>
              )}
            </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* EXISTING LANGUAGES CARD - Collapsible */}
      {detectedExisting.length > 0 && (
        <Card className="overflow-hidden bg-white dark:bg-gray-900 border shadow-sm">
          {/* Header - Always visible, clickable to toggle */}
          <button
            onClick={() => setIsExistingExpanded(!isExistingExpanded)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 shrink-0">
                <BookCheck className="w-4 h-4" />
              </div>
              <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer shrink-0">
                Detected
              </Label>
              <ChevronDown 
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                  isExistingExpanded ? 'rotate-180' : ''
                }`}
              />
              
              {/* Badge with count - always visible */}
              <Badge variant="secondary" className="ml-auto text-xs">
                {detectedExisting.length} {detectedExisting.length === 1 ? 'language' : 'languages'}
              </Badge>
            </div>
          </button>
          
          {/* Collapsible Content */}
          {isExistingExpanded && (
            <div className="px-3 pb-3 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              {detectedExisting.map(ckls => {
                const stats = languageCompletionStats?.[ckls];
                const percentage = stats?.percentage ?? 0;
                const progressColor = getProgressColor(percentage);
                
                return (
                  <div
                    key={ckls}
                    className="px-2 py-1.5 bg-white dark:bg-gray-900 rounded border transition-colors"
                  >
                    {/* Single Row Layout */}
                    <div className="flex items-center gap-2">
                      {/* Language Badge */}
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0.5 border-green-300 text-green-600 dark:border-green-600 dark:text-green-400 shrink-0">
                        {ckls}
                      </Badge>
                      
                      {/* Progress Bar + Percentage */}
                      <div className="flex-1 flex items-center gap-1.5 min-w-[60px]">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progressColor === 'green' ? 'bg-green-500' : 
                              progressColor === 'amber' ? 'bg-amber-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 w-8 text-right shrink-0">
                          {percentage}%
                        </span>
                      </div>
                      
                      {/* Action Dropdown - Compact */}
                      <Select
                        value={existingModes[ckls] || 'keep'}
                        onValueChange={(value: string) => handleModeChange(ckls, value as OverwriteMode)}
                      >
                        <SelectTrigger 
                          className={`w-[80px] h-7 text-[11px] ${getDropdownClassName(existingModes[ckls] || 'keep')} shrink-0`}
                        >
                          <SelectValue>
                            {getModeLabel(existingModes[ckls] || 'keep')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keep" className="text-xs cursor-pointer">
                            <div className="flex items-start gap-2">
                              <span>🟢</span>
                              <div>
                                <div className="font-medium">Don't modify</div>
                                <div className="text-xs text-muted-foreground">Keep as-is</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="fill-empty" className="text-xs cursor-pointer">
                            <div className="flex items-start gap-2">
                              <span>🟡</span>
                              <div>
                                <div className="font-medium">Fill empty</div>
                                <div className="text-xs text-muted-foreground">Only blanks</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="overwrite-all" className="text-xs cursor-pointer">
                            <div className="flex items-start gap-2">
                              <span>🔴</span>
                              <div>
                                <div className="font-medium">Overwrite</div>
                                <div className="text-xs text-muted-foreground">Replace all</div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* NEW TARGET LANGUAGES CARD - Collapsible */}
      <Card className="overflow-hidden bg-white dark:bg-gray-900 border shadow-sm">
        {/* Header - Always visible, clickable to toggle */}
        <button
          onClick={() => setIsTargetsExpanded(!isTargetsExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 shrink-0">
              <BookPlus className="w-4 h-4" />
            </div>
            <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer shrink-0">
              New
            </Label>
            <ChevronDown 
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                isTargetsExpanded ? 'rotate-180' : ''
              }`}
            />
            
            {/* Badge with selection - always visible */}
            <Badge variant="secondary" className="ml-auto text-xs font-mono">
              {targetLanguages.length > 0 
                ? (targetLanguages.length === 1 ? targetLanguages[0] : `${targetLanguages.length} selected`)
                : 'None'
              }
            </Badge>
          </div>
        </button>

        {/* Collapsible Content */}
        {isTargetsExpanded && (
          <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Update Existing Only Toggle - cleaner shadcn style */}
            {detectedExisting.length > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={updateExistingOnly}
                  onChange={(e) => setUpdateExistingOnly(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    Update detected languages only
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skip adding new languages
                  </p>
                </div>
              </label>
            )}

            {!updateExistingOnly && (
              <div className="space-y-3">
                {/* Selected Target Languages - direct badges without wrapper */}
                {targetLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {targetLanguages.map(ckls => (
                      <Badge
                        variant="secondary"
                        key={ckls}
                        className="font-mono text-xs pl-2.5 pr-1.5 py-1 flex items-center gap-1.5"
                      >
                        {ckls}
                        <button
                          onClick={() => removeTargetLanguage(ckls)}
                          className="hover:bg-destructive/20 hover:text-destructive rounded-sm p-0.5 transition-colors"
                          aria-label={`Remove ${ckls}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search languages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Available Languages - cleaner list with dividers */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y">
                    {displayedTargets.map(ckls => {
                      const isSelected = targetLanguages.includes(ckls);
                      return (
                        <button
                          key={ckls}
                          onClick={() => toggleTargetLanguage(ckls)}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                            isSelected
                              ? 'bg-violet-50 dark:bg-violet-950/30'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <span className={`font-mono text-xs font-semibold w-14 ${
                            isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'
                          }`}>
                            {ckls}
                          </span>
                          <span className="flex-1 text-foreground">
                            {getLanguageName(ckls)}
                          </span>
                          {isSelected && (
                            <span className="text-violet-600 dark:text-violet-400">✓</span>
                          )}
                        </button>
                      );
                    })}

                    {filteredTargets.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No languages found</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show More/Less Button */}
                {!searchQuery && hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll(!showAll)}
                    className="w-full"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Show {hiddenCount} more
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
            
            {/* Info message when update existing only is enabled */}
            {updateExistingOnly && (
              <div className="p-4 rounded-lg border border-dashed text-center">
                <p className="text-sm text-muted-foreground">
                  Only detected languages will be processed
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
