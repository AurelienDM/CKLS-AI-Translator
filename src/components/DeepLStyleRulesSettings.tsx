import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Info, AlertTriangle } from 'lucide-react';
import { isDeepLProKey } from '@/modules/DeepLTranslator';
import { validateDeepLApiKey, fetchDeepLQuota } from '@/utils/apiValidator';
import { ApiKeyInput } from './ApiKeyInput';
import { DeepLMiniQuota } from './DeepLMiniQuota';
import { cn } from '@/lib/utils';

type DeepLStyleOptions = {
  formal: boolean;
  informal: boolean;
  contextAware: boolean;
  technical: boolean;
  custom: boolean;
};

interface DeepLStyleRulesSettingsProps {
  targetLanguages: string[];
  languageNames: Record<string, string>;
  apiKey: string;
  deeplStyleOptions: Record<string, DeepLStyleOptions>;
  deeplCustomInstructions: Record<string, string>;
  deeplStyleRuleIds: Record<string, string>;
  useDeeplStyleRules: boolean;
  onToggle: (enabled: boolean) => void;
  onOptionChange: (lang: string, updates: Partial<DeepLStyleOptions>) => void;
  onCustomChange: (lang: string, text: string) => void;
}

export const DEEPL_INSTRUCTION_TEXTS = {
  formal: "Use a formal, professional tone appropriate for business communications. Maintain respectful language and proper address forms.",
  informal: "Use a casual, conversational tone that feels natural and friendly. Use everyday language.",
  contextAware: "Maintain the structure, formatting, and approximate length of the original text. Preserve line breaks and text flow.",
  technical: "Preserve technical terminology and specialized vocabulary. Do not simplify technical terms.",
};

const FORMALITY_SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ru', 'ja', 'vi'];

function isFormalitySupported(langCode: string): boolean {
  const base = langCode.toLowerCase().split('-')[0];
  return FORMALITY_SUPPORTED_LANGUAGES.includes(base);
}

function buildInstructionPreview(
  options: DeepLStyleOptions,
  customText: string
): string {
  const parts: string[] = [];
  
  // Tone (mutually exclusive)
  if (options.formal) parts.push(DEEPL_INSTRUCTION_TEXTS.formal);
  if (options.informal) parts.push(DEEPL_INSTRUCTION_TEXTS.informal);
  
  // Additional options
  if (options.contextAware) parts.push(DEEPL_INSTRUCTION_TEXTS.contextAware);
  if (options.technical) parts.push(DEEPL_INSTRUCTION_TEXTS.technical);
  if (options.custom && customText) parts.push(customText);
  
  return parts.join(" ") || "No instructions selected";
}

export function DeepLStyleRulesSettings({
  targetLanguages,
  languageNames,
  apiKey,
  deeplStyleOptions,
  deeplCustomInstructions,
  deeplStyleRuleIds,
  useDeeplStyleRules,
  onToggle,
  onOptionChange,
  onCustomChange,
}: DeepLStyleRulesSettingsProps) {
  const { setState } = useApp();
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Auto-validate existing API key on mount
  useEffect(() => {
    const autoValidate = async () => {
      if (apiKey && apiKey.length > 0) {
        // Check if already validated in storage
        try {
          const result = await chrome.storage.local.get('apiKeys');
          const apiKeys = result.apiKeys as { deeplValidated?: boolean } | undefined;
          
          if (apiKeys?.deeplValidated) {
            setIsValidated(true);
            setValidationMessage('API key validated');
            
            // Fetch quota if not already cached
            const quotaInfo = await fetchDeepLQuota(apiKey);
            if (quotaInfo) {
              await chrome.storage.local.set({ deeplQuota: quotaInfo });
            }
            return;
          }
          
          // Not validated in storage, validate now
          const validation = await validateDeepLApiKey(apiKey);
          
          if (validation.valid) {
            setIsValidated(true);
            setValidationMessage(validation.message || 'API key validated');
            
            // Fetch and store quota info
            const quotaInfo = await fetchDeepLQuota(apiKey);
            if (quotaInfo) {
              await chrome.storage.local.set({ deeplQuota: quotaInfo });
            }
            
            // Save validation status to storage
            const existingKeys = result.apiKeys || {};
            await chrome.storage.local.set({
              apiKeys: {
                ...(typeof existingKeys === 'object' ? existingKeys : {}),
                deepl: apiKey,
                deeplValidated: true
              }
            });
          } else {
            setValidationError(validation.error || 'Invalid API key');
          }
        } catch (error) {
          console.error('Auto-validation failed:', error);
        }
      }
    };
    
    autoValidate();
  }, [apiKey]);

  const handleApiKeyChange = (value: string) => {
    setState({ deeplApiKey: value });
    setIsValidated(false);
    setValidationError(null);
    setValidationMessage(null);
  };

  const handleValidate = async () => {
    setValidationError(null);
    
    try {
      const validation = await validateDeepLApiKey(apiKey);
      
      if (validation.valid) {
        setIsValidated(true);
        setValidationMessage(validation.message || 'API key validated');
        
        // Fetch and store quota info
        const quotaInfo = await fetchDeepLQuota(apiKey);
        if (quotaInfo) {
          await chrome.storage.local.set({ deeplQuota: quotaInfo });
        }
        
        // Save to Chrome storage
        const result = await chrome.storage.local.get('apiKeys');
        const existingKeys = result.apiKeys || {};
        await chrome.storage.local.set({
          apiKeys: {
            ...(typeof existingKeys === 'object' ? existingKeys : {}),
            deepl: apiKey,
            deeplValidated: true
          }
        });
      } else {
        setValidationError(validation.error || 'Invalid API key');
      }
    } catch (error: any) {
      setValidationError(error.message || 'Validation failed');
    }
  };

  // Show API key input if no key or not validated
  if (!apiKey || apiKey.length === 0 || !isValidated) {
    return (
      <div className="space-y-4">
        <ApiKeyInput
          service="deepl"
          value={apiKey}
          isValidated={isValidated}
          onChange={handleApiKeyChange}
          onValidate={handleValidate}
          validationError={validationError}
          validationMessage={validationMessage}
        />
        {/* Show mini quota after successful validation */}
        {isValidated && <DeepLMiniQuota />}
      </div>
    );
  }
  
  const isProAccount = isDeepLProKey(apiKey);
  
  const getLanguageName = (ckls: string): string => {
    const baseCode = ckls.split('-')[0];
    const langName = languageNames[baseCode];
    
    if (langName) {
      return `${langName} (${ckls})`;
    }
    
    return ckls;
  };

  const handleOptionToggle = (lang: string, option: keyof DeepLStyleOptions, checked: boolean) => {
    // Mutual exclusivity: formal and informal
    const updates: Partial<DeepLStyleOptions> = { [option]: checked };
    
    if (option === 'formal' && checked) {
      updates.informal = false;
    }
    if (option === 'informal' && checked) {
      updates.formal = false;
    }
    
    onOptionChange(lang, updates);
  };

  if (!targetLanguages.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground italic">
          Select target languages first to configure DeepL settings
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>DeepL Translation:</strong> Control formality and add custom instructions 
            {isProAccount ? ' with Style Rules API (Pro)' : ' using formality parameter (Free)'}.
          </div>
        </div>
      </div>

      {/* Pro Account: Full Style Rules UI */}
      {isProAccount ? (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="style-rules-toggle" className="text-sm font-medium">
                Custom Style Rules (Pro)
              </Label>
              <p className="text-xs text-muted-foreground">
                Combine multiple options per language with Style Rules API
              </p>
            </div>
            <Switch
              id="style-rules-toggle"
              checked={useDeeplStyleRules}
              onCheckedChange={onToggle}
            />
          </div>

          {useDeeplStyleRules && (
            <div className="space-y-3">
              {targetLanguages.map(lang => {
                const options = deeplStyleOptions[lang] || { formal: false, informal: false, contextAware: false, technical: false, custom: false };
                const customText = deeplCustomInstructions[lang] || '';
                const styleRuleId = deeplStyleRuleIds[lang];
                const preview = buildInstructionPreview(options, customText);
                const supported = isFormalitySupported(lang);
                
                return (
                  <Card key={lang} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium">
                        {getLanguageName(lang)}
                      </Label>
                      {styleRuleId && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          Style Rule Created
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {/* Tone Group - Mutually Exclusive */}
                      <div className="p-3 rounded-md border bg-muted/30">
                        <Label className="text-xs font-semibold mb-2 block text-muted-foreground">
                          Tone (choose one)
                        </Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-informal`}
                              checked={options.informal}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'informal', checked)}
                              disabled={!supported}
                            />
                            <Label
                              htmlFor={`${lang}-informal`}
                              className={cn(
                                "text-sm font-normal cursor-pointer",
                                !supported && "opacity-50"
                              )}
                            >
                              Informal - Casual, friendly tone
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-formal`}
                              checked={options.formal}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'formal', checked)}
                              disabled={!supported}
                            />
                            <Label
                              htmlFor={`${lang}-formal`}
                              className={cn(
                                "text-sm font-normal cursor-pointer",
                                !supported && "opacity-50"
                              )}
                            >
                              Formal - Professional business tone
                            </Label>
                          </div>
                        </div>
                        {!supported && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            ⚠️ Formality not available for this language
                          </p>
                        )}
                      </div>
                      
                      {/* Additional Options */}
                      <div className="p-3 rounded-md border bg-muted/30">
                        <Label className="text-xs font-semibold mb-2 block text-muted-foreground">
                          Additional Options
                        </Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-contextAware`}
                              checked={options.contextAware}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'contextAware', checked)}
                            />
                            <Label
                              htmlFor={`${lang}-contextAware`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Context Aware - Maintain text structure
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-technical`}
                              checked={options.technical}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'technical', checked)}
                            />
                            <Label
                              htmlFor={`${lang}-technical`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Technical - Preserve technical terms
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-custom`}
                              checked={options.custom}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'custom', checked)}
                            />
                            <Label
                              htmlFor={`${lang}-custom`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Custom Instructions - Add your own text
                            </Label>
                          </div>
                        </div>
                      </div>
                      
                      {/* Preview */}
                      <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                        <Label className="text-xs font-semibold mb-1 block text-blue-800 dark:text-blue-200">
                          Preview:
                        </Label>
                        <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                          "{preview}"
                        </p>
                      </div>
                      
                      {/* Custom Text Area */}
                      {options.custom && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Custom Instructions
                          </Label>
                          <Textarea
                            placeholder={`Additional instructions for ${getLanguageName(lang)}...`}
                            value={customText}
                            onChange={(e) => onCustomChange(lang, e.target.value)}
                            className="min-h-[80px] resize-none text-sm"
                          />
                        </div>
                      )}
                      
                      {/* Style Rule Status */}
                      {styleRuleId && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <span className="font-mono">✓</span>
                          <span>Style Rule ID: {styleRuleId.substring(0, 12)}...</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Style rules are created automatically during translation and applied via DeepL's Style Rules API
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Free Account: Clean Design like Pro */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="formality-toggle" className="text-sm font-medium">
                Formality Settings
              </Label>
              <p className="text-xs text-muted-foreground">
                Control the level of formality for supported languages
              </p>
            </div>
            <Switch
              id="formality-toggle"
              checked={useDeeplStyleRules}
              onCheckedChange={onToggle}
            />
          </div>

          {useDeeplStyleRules && (
            <div className="space-y-3">
              {targetLanguages.map(lang => {
                const options = deeplStyleOptions[lang] || { formal: false, informal: false, contextAware: false, technical: false, custom: false };
                const supported = isFormalitySupported(lang);
                
                // For Free tier, formal/informal are treated as radio-style
                const currentFormality = options.formal ? 'more' : options.informal ? 'less' : null;
                
                return (
                  <Card key={lang} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium">
                        {getLanguageName(lang)}
                      </Label>
                    </div>
                    
                    {/* Simple 3-button formality control */}
                    <div className="inline-flex rounded-lg border border-input bg-background overflow-hidden">
                      <button
                        onClick={() => {
                          onOptionChange(lang, { informal: true, formal: false });
                        }}
                        disabled={!supported}
                        className={cn(
                          "px-4 py-2 text-sm font-medium transition-colors border-r",
                          currentFormality === 'less'
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          !supported && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Informal
                      </button>
                      <button
                        onClick={() => {
                          onOptionChange(lang, { formal: false, informal: false });
                        }}
                        disabled={!supported}
                        className={cn(
                          "px-4 py-2 text-sm font-medium transition-colors border-r",
                          currentFormality === null
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          !supported && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Default
                      </button>
                      <button
                        onClick={() => {
                          onOptionChange(lang, { formal: true, informal: false });
                        }}
                        disabled={!supported}
                        className={cn(
                          "px-4 py-2 text-sm font-medium transition-colors",
                          currentFormality === 'more'
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          !supported && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Formal
                      </button>
                    </div>
                    
                    {!supported && (
                      <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Formality control not available for this language
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}
              
              {/* Info boxes at the bottom */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Default:</strong> DeepL auto-detects the appropriate tone based on context
                </p>
              </div>
              
              {/* Subtle Pro upgrade hint */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Want more options like custom instructions and technical terms?{' '}
                  <a 
                    href="https://www.deepl.com/pro-api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Upgrade to DeepL Pro →
                  </a>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

