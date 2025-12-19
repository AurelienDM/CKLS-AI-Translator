import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeepLFormalitySettingsProps {
  targetLanguages: string[];
  languageNames: Record<string, string>;
  formalitySettings: Record<string, 'less' | 'more' | null>;
  useFormalitySettings: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (lang: string, formality: 'less' | 'more' | null) => void;
}

const FORMALITY_SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ru', 'ja', 'vi'];

export function DeepLFormalitySettings({
  targetLanguages,
  languageNames,
  formalitySettings,
  useFormalitySettings,
  onToggle,
  onChange,
}: DeepLFormalitySettingsProps) {
  const isFormalitySupported = (langCode: string): boolean => {
    const base = langCode.toLowerCase().split('-')[0];
    return FORMALITY_SUPPORTED_LANGUAGES.includes(base);
  };

  const getLanguageName = (ckls: string): string => {
    const baseCode = ckls.split('-')[0];
    const langName = languageNames[baseCode];
    
    if (langName) {
      return `${langName} (${ckls})`;
    }
    
    return ckls;
  };

  if (!targetLanguages.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground italic">
          Select target languages first to configure formality settings
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
            <strong>DeepL Formality Control:</strong> Adjusts politeness level in translations. 
            Supported for German, French, Italian, Spanish, Dutch, Polish, Portuguese, Russian, Japanese, and Vietnamese.
          </div>
        </div>
      </div>

      {/* Toggle to enable formality settings */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="formality-toggle" className="text-sm font-medium">
            Formality Settings (Optional)
          </Label>
          <p className="text-xs text-muted-foreground">
            Control the level of formality for supported languages
          </p>
        </div>
        <Switch
          id="formality-toggle"
          checked={useFormalitySettings}
          onCheckedChange={onToggle}
        />
      </div>

      {/* Per-language formality controls */}
      {useFormalitySettings && (
        <div className="space-y-3">
          {targetLanguages.map(lang => {
            const supported = isFormalitySupported(lang);
            const currentSetting = formalitySettings[lang] || null;
            
            return (
              <Card key={lang} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-sm font-medium">
                    {getLanguageName(lang)}
                  </Label>
                  {supported && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      Formality API ⚡
                    </Badge>
                  )}
                </div>
                
                {/* Segmented Control */}
                <div className="inline-flex rounded-lg border border-input bg-background overflow-hidden">
                  <button
                    onClick={() => onChange(lang, 'less')}
                    disabled={!supported}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors border-r",
                      currentSetting === 'less'
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      !supported && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Informal
                  </button>
                  <button
                    onClick={() => onChange(lang, null)}
                    disabled={!supported}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors border-r",
                      currentSetting === null
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      !supported && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => onChange(lang, 'more')}
                    disabled={!supported}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      currentSetting === 'more'
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
          
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Default:</strong> DeepL auto-detects the appropriate tone based on context
            </p>
          </div>
        </div>
      )}
      
      {/* Applied When Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
        <span className="font-mono">📌</span>
        <span>Applied when: You choose "DeepL AI" in Step 3</span>
      </div>
    </div>
  );
}

