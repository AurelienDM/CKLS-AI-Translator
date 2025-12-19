import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Ban, Zap, Cloud, Table, Subtitles, Settings } from 'lucide-react';
import { openOptionsPage } from '@/utils/extensionHelpers';
import { TranslationSummary } from './TranslationSummary';
import { GlossaryCompactView } from './GlossaryCompactView';
import { DoNotTranslateCompactView } from './DoNotTranslateCompactView';
import { DeepLStyleRulesSettings } from './DeepLStyleRulesSettings';
import { GoogleTranslateInfo } from './GoogleTranslateInfo';
import { ExcelCopilotSettings } from './ExcelCopilotSettings';
import { SubtitleAccordionContent } from './SubtitleAccordionContent';
import { calculateTranslationMetrics } from '@/utils/metricsCalculator';
import { calculateSubtitleMetrics } from '@/utils/subtitleMetricsCalculator';
import { readColumnD } from '@/modules/FileHandler';
import { extractTextAndBuildPlaceholders } from '@/utils/textExtraction';
import { isDeepLProKey } from '@/modules/DeepLTranslator';
import { DeepLMiniQuota } from './DeepLMiniQuota';

interface Step2Props {
  onComplete: () => void;
}

export function Step2({ onComplete }: Step2Props) {
  const { state, setState } = useApp();
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedTranslator, setSelectedTranslator] = useState<'deepl' | 'google' | 'excel'>('deepl');
  const [apiStatus, setApiStatus] = useState({ deeplValidated: false, googleValidated: false });
  const [enabledTranslators, setEnabledTranslators] = useState({ deepl: true, google: false, excel: false });

  // Load API validation status, enabled translators, and set default translator on mount
  useEffect(() => {
    const loadApiStatus = async () => {
      try {
        const result = await chrome.storage.local.get('apiKeys');
        const apiKeys = result.apiKeys as { 
          deepl?: string; 
          deeplValidated?: boolean;
          google?: string; 
          googleValidated?: boolean;
          defaultService?: 'deepl' | 'google' | 'excel';
          enabledTranslators?: { deepl: boolean; google: boolean; excel: boolean };
        } | undefined;
        
        const deeplValidated = apiKeys?.deeplValidated || false;
        const googleValidated = apiKeys?.googleValidated || false;
        
        setApiStatus({ deeplValidated, googleValidated });
        
        // Load enabled translators
        const enabled = apiKeys?.enabledTranslators || { deepl: true, google: false, excel: false };
        setEnabledTranslators(enabled);
        
        // Default to DeepL (always enabled)
        let defaultTranslator: 'deepl' | 'google' | 'excel' = 'deepl';
        
        setSelectedTranslator(defaultTranslator);
        setState({ translationMethod: defaultTranslator });
      } catch (error) {
        console.error('Failed to load API status:', error);
      }
    };
    loadApiStatus();

    // Listen for storage changes to update status in real-time
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.apiKeys?.newValue) {
        const updatedKeys = changes.apiKeys.newValue as {
          deeplValidated?: boolean;
          googleValidated?: boolean;
          enabledTranslators?: { deepl: boolean; google: boolean; excel: boolean };
        };
        setApiStatus({
          deeplValidated: updatedKeys.deeplValidated || false,
          googleValidated: updatedKeys.googleValidated || false
        });
        if (updatedKeys.enabledTranslators) {
          setEnabledTranslators(updatedKeys.enabledTranslators);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Calculate metrics when workbook/files or settings change
  useEffect(() => {
    if (state.targetLanguagesCKLS.length === 0) {
      setMetrics(null);
      return;
    }

    try {
      if (state.inputMode === 'subtitle' && state.subtitleFiles && state.subtitleFiles.length > 0) {
        // SUBTITLE MODE: Calculate from subtitle files
        const activeTmx = state.activeTmxLink && state.tmxMemories 
          ? state.tmxMemories.find(tmx => tmx.fileName === state.activeTmxLink?.tmxFileName)
          : undefined;
        
        const calculatedMetrics = calculateSubtitleMetrics(
          state.subtitleFiles,
          {
            targetCount: state.targetLanguagesCKLS.length,
            tmxMemory: activeTmx,
            tmxMatchThreshold: state.activeTmxLink?.autoApplyThreshold || 95
          }
        );
        setMetrics(calculatedMetrics);
        
        // Sync to AppContext for Step3 to access
        setState({
          deduplicationStats: {
            totalFiles: state.subtitleFiles?.length || 1,
            totalStrings: calculatedMetrics.totalStrings,
            uniqueStrings: calculatedMetrics.uniqueStrings,
            duplicateStrings: calculatedMetrics.duplicateStrings,
            deduplicationPercentage: calculatedMetrics.deduplicationPercentage,
            savedApiCalls: calculatedMetrics.savedApiCalls || 0,
            characterSavings: calculatedMetrics.characterSavings || 0,
            totalCharacters: calculatedMetrics.totalCharacters,
            sourceCharacters: calculatedMetrics.sourceCharacters,
            extractedCharacters: calculatedMetrics.extractedCharacters,
            translatedCharacters: calculatedMetrics.translatedCharacters,
            stringsAlreadyFilled: calculatedMetrics.stringsAlreadyFilled,
            glossaryMatches: calculatedMetrics.glossaryMatches,
            tmxMatches: calculatedMetrics.tmxMatches,
            actualStringsToTranslate: calculatedMetrics.actualStringsToTranslate,
            actualApiCalls: calculatedMetrics.actualApiCalls,
            totalSavedCalls: calculatedMetrics.totalSavedCalls,
          }
        });
      } else if (state.inputMode === 'text' && state.textInput) {
        // TEXT MODE: Calculate metrics from text input
        const { extracted } = extractTextAndBuildPlaceholders(
          [{ rowIndex: 1, original: state.textInput }],
          state.doNotTranslate
        );

        const uniqueSet = new Set<string>();
        let totalCharacters = 0;

        extracted.forEach(item => {
          uniqueSet.add(item.extracted);
          totalCharacters += (item.extracted?.length || 0);
        });

        const uniqueStrings = uniqueSet.size;
        const totalStrings = extracted.length;
        const duplicateStrings = totalStrings - uniqueStrings;

        const calculatedMetrics = {
          totalStrings,
          uniqueStrings,
          duplicateStrings,
          totalCharacters,
          totalRawCharacters: state.textInput.length,
          sourceCharacters: state.textInput.length,
          extractedCharacters: totalCharacters,
          translatedCharacters: Math.round(state.textInput.length * 1.1 * state.targetLanguagesCKLS.length),
          totalApiCalls: uniqueStrings * state.targetLanguagesCKLS.length,
          deduplicationPercentage: totalStrings > 0
            ? Math.round((duplicateStrings / totalStrings) * 100)
            : 0,
          characterSavings: totalCharacters > 0 ? state.textInput.length - totalCharacters : 0,
          savedApiCalls: 0,
          languages: state.targetLanguagesCKLS.length,
        };

        setMetrics(calculatedMetrics);
        
        // Sync to AppContext for Step3 to access
        setState({
          deduplicationStats: {
            totalFiles: 1,
            totalStrings: calculatedMetrics.totalStrings,
            uniqueStrings: calculatedMetrics.uniqueStrings,
            duplicateStrings: calculatedMetrics.duplicateStrings,
            deduplicationPercentage: calculatedMetrics.deduplicationPercentage,
            savedApiCalls: calculatedMetrics.savedApiCalls || 0,
            characterSavings: calculatedMetrics.characterSavings || 0,
            totalCharacters: calculatedMetrics.totalCharacters,
            sourceCharacters: calculatedMetrics.sourceCharacters,
            extractedCharacters: calculatedMetrics.extractedCharacters,
            translatedCharacters: calculatedMetrics.translatedCharacters,
            stringsAlreadyFilled: 0,
            glossaryMatches: 0,
            tmxMatches: 0,
            actualStringsToTranslate: calculatedMetrics.uniqueStrings,
            actualApiCalls: calculatedMetrics.totalApiCalls,
            totalSavedCalls: 0,
          }
        });

      } else if (state.filesData.length > 0) {
        // FILE MODE: Combine rows from all files (single or multiple)
        let allRows: any[] = [];
        
        state.filesData.forEach(fileData => {
          const rows = readColumnD(fileData.workbook);
          allRows = allRows.concat(rows);
        });

        // Get active TMX if linked
        const activeTmx = state.activeTmxLink && state.tmxMemories 
          ? state.tmxMemories.find(tmx => tmx.fileName === state.activeTmxLink?.tmxFileName)
          : undefined;

        const calculatedMetrics = calculateTranslationMetrics(
          allRows,
          state.targetLanguagesCKLS.length,
          state.doNotTranslate,
          {
            workbooks: state.filesData.map(f => f.workbook),
            targetLanguages: state.targetLanguagesCKLS,
            existingLanguagesModes: state.existingLanguagesModes,
            glossary: state.predefinedTranslations,
            sourceLang: state.sourceLanguageCKLS,
            tmxMemory: activeTmx,
            tmxMatchThreshold: state.activeTmxLink?.autoApplyThreshold || 95
          }
        );
        setMetrics(calculatedMetrics);
        
        // Sync to AppContext for Step3 to access
        setState({
          deduplicationStats: {
            totalFiles: state.filesData.length || 1,
            totalStrings: calculatedMetrics.totalStrings,
            uniqueStrings: calculatedMetrics.uniqueStrings,
            duplicateStrings: calculatedMetrics.duplicateStrings,
            deduplicationPercentage: calculatedMetrics.deduplicationPercentage,
            savedApiCalls: calculatedMetrics.savedApiCalls || 0,
            characterSavings: calculatedMetrics.characterSavings || 0,
            totalCharacters: calculatedMetrics.totalCharacters,
            sourceCharacters: calculatedMetrics.sourceCharacters,
            extractedCharacters: calculatedMetrics.extractedCharacters,
            translatedCharacters: calculatedMetrics.translatedCharacters,
            stringsAlreadyFilled: calculatedMetrics.stringsAlreadyFilled,
            glossaryMatches: calculatedMetrics.glossaryMatches,
            tmxMatches: calculatedMetrics.tmxMatches,
            actualStringsToTranslate: calculatedMetrics.actualStringsToTranslate,
            actualApiCalls: calculatedMetrics.actualApiCalls,
            totalSavedCalls: calculatedMetrics.totalSavedCalls,
          }
        });

      } else if (state.workbook) {
        // LEGACY FALLBACK: Single workbook (for backwards compatibility)
        const rows = readColumnD(state.workbook);
        
        // Get active TMX if linked
        const activeTmx = state.activeTmxLink && state.tmxMemories 
          ? state.tmxMemories.find(tmx => tmx.fileName === state.activeTmxLink?.tmxFileName)
          : undefined;

        const calculatedMetrics = calculateTranslationMetrics(
          rows,
          state.targetLanguagesCKLS.length,
          state.doNotTranslate,
          {
            workbooks: [state.workbook],
            targetLanguages: state.targetLanguagesCKLS,
            existingLanguagesModes: state.existingLanguagesModes,
            glossary: state.predefinedTranslations,
            sourceLang: state.sourceLanguageCKLS,
            tmxMemory: activeTmx,
            tmxMatchThreshold: state.activeTmxLink?.autoApplyThreshold || 95
          }
        );
        setMetrics(calculatedMetrics);
        
        // Sync to AppContext for Step3 to access
        setState({
          deduplicationStats: {
            totalFiles: 1,
            totalStrings: calculatedMetrics.totalStrings,
            uniqueStrings: calculatedMetrics.uniqueStrings,
            duplicateStrings: calculatedMetrics.duplicateStrings,
            deduplicationPercentage: calculatedMetrics.deduplicationPercentage,
            savedApiCalls: calculatedMetrics.savedApiCalls || 0,
            characterSavings: calculatedMetrics.characterSavings || 0,
            totalCharacters: calculatedMetrics.totalCharacters,
            sourceCharacters: calculatedMetrics.sourceCharacters,
            extractedCharacters: calculatedMetrics.extractedCharacters,
            translatedCharacters: calculatedMetrics.translatedCharacters,
            stringsAlreadyFilled: calculatedMetrics.stringsAlreadyFilled,
            glossaryMatches: calculatedMetrics.glossaryMatches,
            tmxMatches: calculatedMetrics.tmxMatches,
            actualStringsToTranslate: calculatedMetrics.actualStringsToTranslate,
            actualApiCalls: calculatedMetrics.actualApiCalls,
            totalSavedCalls: calculatedMetrics.totalSavedCalls,
          }
        });
      }
    } catch (err) {
      console.error('Failed to calculate metrics:', err);
      setMetrics(null);
    }
  }, [
    state.inputMode,
    state.textInput,
    state.multiFileMode,
    state.filesData,
    state.workbook,
    state.subtitleFiles,
    state.tmxMemories,
    state.activeTmxLink,
    state.targetLanguagesCKLS,
    state.doNotTranslate,
    state.predefinedTranslations
  ]);

  // Signal completion (Step 2 is always complete once you enter it)
  useEffect(() => {
    onComplete();
  }, []);

  const handleTranslatorChange = (translator: 'deepl' | 'google' | 'excel') => {
    setSelectedTranslator(translator);
    setState({ translationMethod: translator });
  };

  return (
    <div className="space-y-6">
      <Accordion type="multiple" defaultValue={[]} className="w-full space-y-4">
        {/* 1. Glossary (Predefined Translations) - Compact View */}
        <AccordionItem value="glossary" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BookOpen className="w-4 h-4" />
                  Glossary
                  {state.predefinedTranslations.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {state.predefinedTranslations.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                <GlossaryCompactView
                  entries={state.predefinedTranslations}
                  languageNames={state.languageNames}
                  sourceLanguage={state.sourceLanguageCKLS}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 2. Do-Not-Translate - Compact View */}
        <AccordionItem value="dnt" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Ban className="w-4 h-4" />
                  Do-Not-Translate
                  {state.doNotTranslate.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {state.doNotTranslate.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                <DoNotTranslateCompactView terms={state.doNotTranslate} />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 2.5. Subtitle Settings - Only show when subtitle files detected */}
        {state.inputMode === 'subtitle' && state.subtitleFiles && state.subtitleFiles.length > 0 && (
          <AccordionItem value="subtitle-settings" className="border rounded-lg">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardHeader className="p-0 flex-1">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Subtitles className="w-4 h-4" />
                    Subtitle Settings
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {state.subtitleFiles.length} files • {state.subtitleFiles.reduce((sum, f) => sum + f.subtitles.length, 0)} subs
                    </Badge>
                    {state.subtitleFiles.some(f => f.timingIssues && f.timingIssues.length > 0) && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {state.subtitleFiles.reduce((sum, f) => sum + (f.timingIssues?.length || 0), 0)} issues
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="px-6 pb-6 pt-2">
                  <SubtitleAccordionContent />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}

        {/* 3. Translator Settings - Combined Accordion with ALL settings */}
        <AccordionItem value="translator" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  {selectedTranslator === 'deepl' && <Zap className="w-4 h-4 text-blue-600" />}
                  {selectedTranslator === 'google' && <Cloud className="w-4 h-4 text-orange-600" />}
                  {selectedTranslator === 'excel' && <Table className="w-4 h-4 text-green-600" />}
                  Translator
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {selectedTranslator === 'deepl' && 'DeepL'}
                    {selectedTranslator === 'google' && 'Google'}
                    {selectedTranslator === 'excel' && 'Excel'}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                <div className="space-y-6">
              {/* Translator Selector - Minimalist inline design */}
              <div className="flex items-center gap-2">
                {/* DeepL - Always visible */}
                <button
                  onClick={() => handleTranslatorChange('deepl')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    selectedTranslator === 'deepl'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">DeepL</span>
                  {apiStatus.deeplValidated && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </button>

                {/* Google - Only if enabled */}
                {enabledTranslators.google && (
                  <button
                    onClick={() => handleTranslatorChange('google')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedTranslator === 'google'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                    }`}
                  >
                    <Cloud className="w-4 h-4" />
                    <span className="text-sm font-medium">Google</span>
                    {apiStatus.googleValidated && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                  </button>
                )}

                {/* Excel - Only if enabled */}
                {enabledTranslators.excel && (
                  <button
                    onClick={() => handleTranslatorChange('excel')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedTranslator === 'excel'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-sm font-medium">Excel</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </button>
                )}

                {/* Add more button */}
                {(!enabledTranslators.google || !enabledTranslators.excel) && (
                  <button
                    onClick={() => openOptionsPage('api-keys')}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30 transition-all"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Mini quota under selector - only for DeepL when validated */}
              {selectedTranslator === 'deepl' && apiStatus.deeplValidated && (
                <div className="mt-2">
                  <DeepLMiniQuota />
                </div>
              )}

              {/* Conditional rendering of settings based on selected translator */}
              {selectedTranslator === 'deepl' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span>DeepL Settings</span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0.5 ${
                        isDeepLProKey(state.deeplApiKey) 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-muted-foreground text-muted-foreground'
                      }`}
                    >
                      {isDeepLProKey(state.deeplApiKey) ? 'Pro' : 'Free'}
                    </Badge>
                    {state.useDeeplStyleRules && (
                      <Badge variant="secondary" className="ml-2">
                        {Object.keys(state.deeplStyleOptions).filter(lang => {
                          const opts = state.deeplStyleOptions[lang];
                          return opts && (opts.formal || opts.informal || opts.contextAware || opts.technical || opts.custom);
                        }).length} configured
                      </Badge>
                    )}
                  </div>
                  <DeepLStyleRulesSettings
                    targetLanguages={state.targetLanguagesCKLS}
                    languageNames={state.languageNames}
                    apiKey={state.deeplApiKey}
                    deeplStyleOptions={state.deeplStyleOptions}
                    deeplCustomInstructions={state.deeplCustomInstructions}
                    deeplStyleRuleIds={state.deeplStyleRuleIds}
                    useDeeplStyleRules={state.useDeeplStyleRules}
                    onToggle={(enabled) => setState({ useDeeplStyleRules: enabled })}
                    onOptionChange={(lang, updates) => setState({
                      deeplStyleOptions: {
                        ...state.deeplStyleOptions,
                        [lang]: {
                          ...(state.deeplStyleOptions[lang] || { formal: false, informal: false, contextAware: false, technical: false, custom: false }),
                          ...updates
                        }
                      }
                    })}
                    onCustomChange={(lang, text) => setState({
                      deeplCustomInstructions: { ...state.deeplCustomInstructions, [lang]: text }
                    })}
                  />
                </div>
              )}

              {selectedTranslator === 'google' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Cloud className="w-4 h-4 text-orange-600" />
                    <span>Google Translate Settings</span>
                    <span className="text-xs text-muted-foreground ml-auto">No config needed</span>
                  </div>
                  <GoogleTranslateInfo />
                </div>
              )}

              {selectedTranslator === 'excel' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Table className="w-4 h-4 text-green-600" />
                    <span>Excel/COPILOT Settings</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {state.useCopilot ? 'COPILOT mode' : 'TRANSLATE mode'}
                    </span>
                    {state.useCopilotInstructions && (
                      <Badge variant="secondary" className="ml-2">
                        {Object.keys(state.copilotOptions).filter(lang => {
                          const opts = state.copilotOptions[lang];
                          return opts && (opts.formal || opts.informal || opts.contextAware || opts.custom);
                        }).length} configured
                      </Badge>
                    )}
                  </div>
                  <ExcelCopilotSettings
                    targetLanguages={state.targetLanguagesCKLS}
                    languageNames={state.languageNames}
                    useCopilot={state.useCopilot}
                    copilotOptions={state.copilotOptions}
                    copilotCustomInstructions={state.copilotCustomInstructions}
                    useCopilotInstructions={state.useCopilotInstructions}
                    onFormulaTypeChange={(useCopilot) => setState({ useCopilot })}
                    onToggle={(enabled) => setState({ useCopilotInstructions: enabled })}
                    onOptionChange={(lang, option, value) => setState({
                      copilotOptions: {
                        ...state.copilotOptions,
                        [lang]: {
                          ...(state.copilotOptions[lang] || { formal: false, informal: false, contextAware: false, custom: false }),
                          [option]: value
                        }
                      }
                    })}
                    onCustomChange={(lang, text) => setState({
                      copilotCustomInstructions: { ...state.copilotCustomInstructions, [lang]: text }
                    })}
                  />
                </div>
              )}
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 4. Translation Summary - Shows deduplication and translation scope */}
        <AccordionItem value="summary" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="w-1 h-5 bg-blue-600 rounded-full" />
                  Translation Summary
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                <TranslationSummary
                  metrics={metrics}
                  targetLanguageCount={state.targetLanguagesCKLS.length}
                  deduplicationStats={state.deduplicationStats}
                  languageBreakdown={{
                    source: state.sourceLanguageCKLS,
                    existing: state.detectedExisting,
                    targets: state.targetLanguagesCKLS
                  }}
                  glossaryCount={state.predefinedTranslations.length}
                  dntCount={state.doNotTranslate.length}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

