import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, Sparkles, Info } from 'lucide-react';

type CopilotOptions = {
  formal: boolean;
  informal: boolean;
  contextAware: boolean;
  custom: boolean;
};

interface ExcelCopilotSettingsProps {
  targetLanguages: string[];
  languageNames: Record<string, string>;
  useCopilot: boolean;
  copilotOptions: Record<string, CopilotOptions>;
  copilotCustomInstructions: Record<string, string>;
  useCopilotInstructions: boolean;
  onFormulaTypeChange: (useCopilot: boolean) => void;
  onToggle: (enabled: boolean) => void;
  onOptionChange: (lang: string, option: keyof CopilotOptions, value: boolean) => void;
  onCustomChange: (lang: string, text: string) => void;
}

export const INSTRUCTION_TEXTS = {
  formal: "Use a formal, professional tone appropriate for business communications. Maintain respectful language.",
  informal: "Use a casual, conversational tone that feels natural and friendly. Use everyday language.",
  contextAware: "Keep the same character length as the original text to maintain formatting and layout.",
};

function buildInstructionPreview(
  options: CopilotOptions,
  customText: string
): string {
  const parts: string[] = [];
  if (options.formal) parts.push(INSTRUCTION_TEXTS.formal);
  if (options.informal) parts.push(INSTRUCTION_TEXTS.informal);
  if (options.contextAware) parts.push(INSTRUCTION_TEXTS.contextAware);
  if (options.custom && customText) parts.push(customText);
  return parts.join(" ") || "No instructions selected";
}

export function ExcelCopilotSettings({
  targetLanguages,
  languageNames,
  useCopilot,
  copilotOptions,
  copilotCustomInstructions,
  useCopilotInstructions,
  onFormulaTypeChange,
  onToggle,
  onOptionChange,
  onCustomChange,
}: ExcelCopilotSettingsProps) {
  const getLanguageName = (ckls: string): string => {
    const baseCode = ckls.split('-')[0];
    const langName = languageNames[baseCode];
    
    if (langName) {
      return `${langName} (${ckls})`;
    }
    
    return ckls;
  };

  const handleOptionToggle = (lang: string, option: keyof CopilotOptions, checked: boolean) => {
    // Mutual exclusivity: formal and informal
    if (option === 'formal' && checked) {
      onOptionChange(lang, 'informal', false);
    }
    if (option === 'informal' && checked) {
      onOptionChange(lang, 'formal', false);
    }
    
    onOptionChange(lang, option, checked);
  };

  if (!targetLanguages.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground italic">
          Select target languages first to configure Excel settings
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-800 dark:text-purple-200">
            <strong>Excel Builder:</strong> Generate Excel with translation formulas. 
            Use TRANSLATE() for basic or COPILOT() for AI-powered with customizable instructions.
          </div>
        </div>
      </div>

      {/* Formula Type Selection */}
      <Card className="p-4">
        <Label className="text-sm font-medium mb-3 block">Formula Type</Label>
        <RadioGroup
          value={useCopilot ? 'copilot' : 'translate'}
          onValueChange={(value) => onFormulaTypeChange(value === 'copilot')}
        >
          <div className="flex items-start space-x-2 mb-3">
            <RadioGroupItem value="translate" id="translate" />
            <div className="space-y-1">
              <Label htmlFor="translate" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                <Table className="w-4 h-4" />
                TRANSLATE()
              </Label>
              <p className="text-xs text-muted-foreground">
                Standard Excel translation (no customization)
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="copilot" id="copilot" />
            <div className="space-y-1">
              <Label htmlFor="copilot" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                COPILOT()
              </Label>
              <p className="text-xs text-muted-foreground">
                AI-powered with customizable instructions
              </p>
            </div>
          </div>
        </RadioGroup>
      </Card>

      {/* COPILOT Instructions */}
      {useCopilot && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="copilot-toggle" className="text-sm font-medium">
                COPILOT Instructions (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Combine multiple options per language
              </p>
            </div>
            <Switch
              id="copilot-toggle"
              checked={useCopilotInstructions}
              onCheckedChange={onToggle}
            />
          </div>

          {useCopilotInstructions && (
            <div className="space-y-3">
              {targetLanguages.map(lang => {
                const options = copilotOptions[lang] || { formal: false, informal: false, contextAware: false, custom: false };
                const customText = copilotCustomInstructions[lang] || '';
                const preview = buildInstructionPreview(options, customText);
                
                return (
                  <Card key={lang} className="p-4">
                    <Label className="text-sm font-medium mb-3 block">
                      {getLanguageName(lang)}
                    </Label>
                    
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
                            />
                            <Label
                              htmlFor={`${lang}-informal`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Informal - Casual, friendly tone
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${lang}-formal`}
                              checked={options.formal}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(lang, 'formal', checked)}
                            />
                            <Label
                              htmlFor={`${lang}-formal`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Formal - Professional business tone
                            </Label>
                          </div>
                        </div>
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
                              Context Aware - Maintain character length
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
                    </div>
                  </Card>
                );
              })}
              
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Selected instructions are combined and embedded in COPILOT() formulas
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Applied When Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">📌</span>
        <span>Applied when: You choose "Excel Builder" in Step 3</span>
      </div>
    </div>
  );
}
