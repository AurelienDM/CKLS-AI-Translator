import { GlossaryEntry } from '@/types';
import { AppState } from '@/contexts/AppContext';

export interface ExportableSettings {
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  formalitySettings: Record<string, 'less' | 'more' | null>;
  useFormalitySettings: boolean;
  deeplStyleOptions: Record<string, {
    formal: boolean;
    informal: boolean;
    contextAware: boolean;
    technical: boolean;
    custom: boolean;
  }>;
  deeplCustomInstructions: Record<string, string>;
  deeplStyleRuleIds: Record<string, string>;
  useDeeplStyleRules: boolean;
  useCopilot: boolean;
  copilotOptions: Record<string, {
    formal: boolean;
    informal: boolean;
    contextAware: boolean;
    custom: boolean;
  }>;
  copilotCustomInstructions: Record<string, string>;
  useCopilotInstructions: boolean;
  overwriteMode: string;
  deeplApiKey?: string;
  googleApiKey?: string;
  exportedAt: string;
  version: string;
}

/**
 * Export settings to a JSON file
 */
export function exportSettings(state: AppState, includeApiKeys = false): void {
  const settings: ExportableSettings = {
    doNotTranslate: state.doNotTranslate,
    predefinedTranslations: state.predefinedTranslations,
    formalitySettings: state.formalitySettings,
    useFormalitySettings: state.useFormalitySettings,
    deeplStyleOptions: state.deeplStyleOptions,
    deeplCustomInstructions: state.deeplCustomInstructions,
    deeplStyleRuleIds: state.deeplStyleRuleIds,
    useDeeplStyleRules: state.useDeeplStyleRules,
    useCopilot: state.useCopilot,
    copilotOptions: state.copilotOptions,
    copilotCustomInstructions: state.copilotCustomInstructions,
    useCopilotInstructions: state.useCopilotInstructions,
    overwriteMode: state.overwriteMode,
    exportedAt: new Date().toISOString(),
    version: '2.1',
  };

  if (includeApiKeys) {
    settings.deeplApiKey = state.deeplApiKey;
    settings.googleApiKey = state.googleApiKey;
  }

  const jsonString = JSON.stringify(settings, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-translate-settings-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import settings from a JSON file
 */
export async function importSettings(file: File): Promise<ExportableSettings> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        
        // Validate required fields
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid settings file format');
        }

        // Create settings object with defaults for missing fields
        const settings: ExportableSettings = {
          doNotTranslate: Array.isArray(parsed.doNotTranslate) ? parsed.doNotTranslate : [],
          predefinedTranslations: Array.isArray(parsed.predefinedTranslations) 
            ? parsed.predefinedTranslations 
            : [],
          formalitySettings: parsed.formalitySettings || {},
          useFormalitySettings: parsed.useFormalitySettings || false,
          deeplStyleOptions: parsed.deeplStyleOptions || {},
          deeplCustomInstructions: parsed.deeplCustomInstructions || {},
          deeplStyleRuleIds: parsed.deeplStyleRuleIds || {},
          useDeeplStyleRules: parsed.useDeeplStyleRules || false,
          useCopilot: parsed.useCopilot || false,
          copilotOptions: parsed.copilotOptions || {},
          copilotCustomInstructions: parsed.copilotCustomInstructions || {},
          useCopilotInstructions: parsed.useCopilotInstructions || false,
          overwriteMode: parsed.overwriteMode || 'overwrite-empty',
          deeplApiKey: parsed.deeplApiKey || undefined,
          googleApiKey: parsed.googleApiKey || undefined,
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          version: parsed.version || '2.1',
        };

        resolve(settings);
      } catch (error) {
        reject(new Error(`Failed to parse settings file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate imported settings structure
 */
export function validateSettings(settings: ExportableSettings): boolean {
  // Check required fields exist and have correct types
  if (!Array.isArray(settings.doNotTranslate)) return false;
  if (!Array.isArray(settings.predefinedTranslations)) return false;
  if (typeof settings.formalitySettings !== 'object') return false;
  if (typeof settings.useFormalitySettings !== 'boolean') return false;
  if (typeof settings.deeplStyleOptions !== 'object') return false;
  if (typeof settings.deeplCustomInstructions !== 'object') return false;
  if (typeof settings.deeplStyleRuleIds !== 'object') return false;
  if (typeof settings.useDeeplStyleRules !== 'boolean') return false;
  if (typeof settings.useCopilot !== 'boolean') return false;
  if (typeof settings.copilotOptions !== 'object') return false;
  if (typeof settings.copilotCustomInstructions !== 'object') return false;
  if (typeof settings.useCopilotInstructions !== 'boolean') return false;
  if (typeof settings.overwriteMode !== 'string') return false;
  
  return true;
}

