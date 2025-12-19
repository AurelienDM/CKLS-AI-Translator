import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { saveToStorage, getFromStorage } from '@/utils/extensionStorage';
import { GlossaryEntry, FileData, TextTranslationResult } from '@/types';
import { fetchLanguageNames } from '@/modules/LanguageAPI';
import { JsonSchema } from '@/utils/jsonSchemas';
import { LanguageCompletionStats } from '@/utils/languageAnalysis';
import { TmxMemory, SubtitleTmxLink } from '@/types/tmx';

type OverwriteMode = 'keep-all' | 'overwrite-empty' | 'overwrite-all';
export type PerLanguageOverwriteMode = 'keep' | 'fill-empty' | 'overwrite-all';

export interface AppState {
  // File data
  filesData: FileData[];
  workbook: any | null;
  multiFileMode: boolean;
  deduplicationStats: any | null;
  
  // Text mode
  inputMode: 'file' | 'text' | 'subtitle';
  textInput: string;
  textTranslationResult: TextTranslationResult | null;
  detectedContentType: 'html' | 'json' | 'plain' | 'subtitle' | null;
  jsonSchema: JsonSchema | null;
  
  // Subtitle mode
  subtitleFiles?: any[]; // SubtitleFileData[]
  subtitleSettings?: any; // SubtitleSettings
  subtitleDeduplicationStats?: any; // SubtitleDeduplicationStats
  
  // TMX (Translation Memory Exchange)
  tmxMemories: TmxMemory[];
  activeTmxLink: SubtitleTmxLink | null;
  
  // Language data
  sourceLanguageISO: string;
  sourceLanguageCKLS: string;
  sourceCKLS: string | null;
  existingLanguages: string[];
  detectedExisting: string[];
  targetLanguagesCKLS: string[];
  targetMapping: Record<string, string>;
  languageNames: Record<string, string>;
  allLanguageOptions: any[];
  existingLanguagesModes: Record<string, PerLanguageOverwriteMode>;
  languageCompletionStats: Record<string, LanguageCompletionStats>;
  
  // File metadata
  fileTitleRaw: string;
  fileTitleSlug: string;
  normalizedTitle: string;
  isHomePage: boolean;
  
  // Translation rules
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  overwriteMode: OverwriteMode;
  
  // DeepL formality settings (legacy - kept for backward compatibility)
  formalitySettings: Record<string, 'less' | 'more' | null>;
  useFormalitySettings: boolean;
  
  // DeepL Style Rules (Pro feature)
  deeplStyleOptions: Record<string, {
    formal: boolean;
    informal: boolean;
    contextAware: boolean;
    technical: boolean;
    custom: boolean;
  }>;
  deeplCustomInstructions: Record<string, string>;
  deeplStyleRuleIds: Record<string, string>;  // Maps language to style rule ID
  useDeeplStyleRules: boolean;
  
  // Excel COPILOT settings
  useCopilot: boolean;
  copilotOptions: Record<string, {
    formal: boolean;
    informal: boolean;
    contextAware: boolean;
    custom: boolean;
  }>;
  copilotCustomInstructions: Record<string, string>;
  useCopilotInstructions: boolean;
  
  // API keys
  deeplApiKey: string;
  googleApiKey: string;
  deeplRequestDelay: number; // milliseconds between requests (100, 300, or 500)
  
  // API validation
  deeplApiKeyValidated: boolean;
  googleApiKeyValidated: boolean;
  apiValidationError: string | null;
  apiValidationMessage: string | null;
  
  // Translation method
  translationMethod: string;
  
  // Translated workbook (for Excel method)
  translatedWorkbook: any | null;
  
  // Translation progress
  translationInProgress: boolean;
  translationProgress: {
    current: number;
    total: number;
    currentLang: string;
    phase: string;
  } | null;
  translationPaused: boolean;
  
  // Progress tracking (legacy)
  deeplProgress: any | null;
  googleProgress: any | null;
  
  // Last generated file name
  lastGeneratedXmlFileName: string;
}

interface AppContextType {
  state: AppState;
  setState: (updates: Partial<AppState>) => void;
  resetState: () => void;
  // Helper methods
  addDntTerm: (term: string) => void;
  removeDntTerm: (index: number) => void;
  setDntList: (list: string[]) => void;
  addPredefinedSet: (entry: GlossaryEntry) => void;
  removePredefinedSet: (index: number) => void;
  setTargetMapping: (msCode: string, cklsCode: string) => void;
}

const initialState: AppState = {
  filesData: [],
  workbook: null,
  multiFileMode: false,
  deduplicationStats: null,
  inputMode: 'file',
  textInput: '',
  textTranslationResult: null,
  detectedContentType: null,
  jsonSchema: null,
  subtitleFiles: [],
  subtitleSettings: undefined,
  subtitleDeduplicationStats: undefined,
  tmxMemories: [],
  activeTmxLink: null,
  sourceLanguageISO: '',
  sourceLanguageCKLS: '',
  sourceCKLS: null,
  existingLanguages: [],
  detectedExisting: [],
  targetLanguagesCKLS: [],
  targetMapping: {},
  languageNames: {},
  allLanguageOptions: [],
  existingLanguagesModes: {},
  languageCompletionStats: {},
  fileTitleRaw: '',
  fileTitleSlug: '',
  normalizedTitle: '',
  isHomePage: false,
  doNotTranslate: [],
  predefinedTranslations: [],
  overwriteMode: 'overwrite-empty',
  formalitySettings: {},
  useFormalitySettings: false,
  deeplStyleOptions: {},
  deeplCustomInstructions: {},
  deeplStyleRuleIds: {},
  useDeeplStyleRules: false,
  useCopilot: false,
  copilotOptions: {},
  copilotCustomInstructions: {},
  useCopilotInstructions: false,
  deeplApiKey: '',
  googleApiKey: '',
  deeplRequestDelay: 300,
  deeplApiKeyValidated: false,
  googleApiKeyValidated: false,
  apiValidationError: null,
  apiValidationMessage: null,
  translationMethod: 'deepl',
  translationInProgress: false,
  translationProgress: null,
  translationPaused: false,
  translatedWorkbook: null,
  deeplProgress: null,
  googleProgress: null,
  lastGeneratedXmlFileName: '',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<AppState>(initialState);

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      const persisted = await getFromStorage('appState');
      
      // Also load API keys from their separate storage location
      const apiKeysResult = await chrome.storage.local.get('apiKeys');
      const apiKeys = apiKeysResult.apiKeys as { 
        deepl?: string; 
        deeplValidated?: boolean;
        google?: string; 
        googleValidated?: boolean;
      } | undefined;
      
      if (persisted) {
        const {
          doNotTranslate,
          predefinedTranslations,
          deeplApiKey,
          googleApiKey,
          deeplRequestDelay,
          deeplApiKeyValidated,
          googleApiKeyValidated,
          formalitySettings,
          useFormalitySettings,
          deeplStyleOptions,
          deeplCustomInstructions,
          deeplStyleRuleIds,
          useDeeplStyleRules,
          useCopilot,
          copilotOptions,
          copilotCustomInstructions,
          useCopilotInstructions,
          overwriteMode,
          filesData,
          multiFileMode,
          sourceLanguageISO,
          sourceLanguageCKLS,
          targetLanguagesCKLS,
          detectedExisting,
          existingLanguagesModes,
          textInput,
          inputMode,
          detectedContentType,
          jsonSchema,
          subtitleFiles,
          subtitleSettings,
          subtitleDeduplicationStats,
          tmxMemories,
          activeTmxLink,
        } = persisted;
        
        console.log('📦 Restoring persisted state:', {
          filesCount: filesData?.length || 0,
          multiFileMode: multiFileMode || false,
          textInput: textInput ? `${textInput.length} chars` : 'none',
          inputMode: inputMode || 'file',
        });
        
        // Migration: Convert old formalitySettings to new deeplStyleOptions
        let migratedDeeplStyleOptions = deeplStyleOptions;
        if (formalitySettings && !deeplStyleOptions) {
          migratedDeeplStyleOptions = {};
          Object.entries(formalitySettings).forEach(([lang, formality]) => {
            if (formality) {
              migratedDeeplStyleOptions[lang] = {
                formal: formality === 'more',
                informal: formality === 'less',
                contextAware: false,
                technical: false,
                custom: false
              };
            }
          });
          console.log('✅ Migrated old formality settings to style options');
        }
        
        setStateInternal(prev => ({
          ...prev,
          doNotTranslate: doNotTranslate || [],
          predefinedTranslations: predefinedTranslations || [],
          // Prioritize API keys from separate storage location
          deeplApiKey: apiKeys?.deepl || deeplApiKey || '',
          googleApiKey: apiKeys?.google || googleApiKey || '',
          deeplRequestDelay: deeplRequestDelay ?? 300,
          deeplApiKeyValidated: apiKeys?.deeplValidated ?? deeplApiKeyValidated ?? false,
          googleApiKeyValidated: apiKeys?.googleValidated ?? googleApiKeyValidated ?? false,
          formalitySettings: formalitySettings || {},
          useFormalitySettings: useFormalitySettings || false,
          deeplStyleOptions: migratedDeeplStyleOptions || {},
          deeplCustomInstructions: deeplCustomInstructions || {},
          deeplStyleRuleIds: deeplStyleRuleIds || {},
          useDeeplStyleRules: useDeeplStyleRules || false,
          useCopilot: useCopilot || false,
          copilotOptions: copilotOptions || {},
          copilotCustomInstructions: copilotCustomInstructions || {},
          useCopilotInstructions: useCopilotInstructions || false,
          overwriteMode: overwriteMode || 'overwrite-empty',
          // Restore file session
          filesData: filesData || [],
          multiFileMode: multiFileMode || false,
          sourceLanguageISO: sourceLanguageISO || '',
          sourceLanguageCKLS: sourceLanguageCKLS || '',
          targetLanguagesCKLS: targetLanguagesCKLS || [],
          detectedExisting: detectedExisting || [],
          existingLanguagesModes: existingLanguagesModes || {},
          languageCompletionStats: {},
          // Restore text input session
          textInput: textInput || '',
          inputMode: inputMode || 'file',
          detectedContentType: detectedContentType || null,
          jsonSchema: jsonSchema || null,
          // Restore subtitle session
          subtitleFiles: subtitleFiles || [],
          subtitleSettings: subtitleSettings || undefined,
          subtitleDeduplicationStats: subtitleDeduplicationStats || undefined,
          // Restore TMX
          tmxMemories: tmxMemories || [],
          activeTmxLink: activeTmxLink || null,
        }));
      } else if (apiKeys) {
        // No persisted state, but load API keys if they exist
        setStateInternal(prev => ({
          ...prev,
          deeplApiKey: apiKeys.deepl || '',
          googleApiKey: apiKeys.google || '',
          deeplRequestDelay: 300,
          deeplApiKeyValidated: apiKeys.deeplValidated || false,
          googleApiKeyValidated: apiKeys.googleValidated || false,
        }));
      }
    };
    
    loadPersistedState();
  }, []);

  // Fetch language names from Microsoft Translator API on mount
  useEffect(() => {
    const loadLanguageNames = async () => {
      const { languageNames, allLanguageOptions } = await fetchLanguageNames();
      setStateInternal(prev => ({
        ...prev,
        languageNames,
        allLanguageOptions,
      }));
    };
    
    loadLanguageNames();
  }, []);

  // Listen for storage changes from options page
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      // Listen for API key changes from Settings page
      if (changes.apiKeys?.newValue) {
        const updatedApiKeys = changes.apiKeys.newValue as {
          deepl?: string;
          deeplValidated?: boolean;
          google?: string;
          googleValidated?: boolean;
        };
        
        console.log('🔑 API keys updated from Settings page');
        
        setStateInternal(prev => ({
          ...prev,
          deeplApiKey: updatedApiKeys.deepl || '',
          googleApiKey: updatedApiKeys.google || '',
          deeplApiKeyValidated: updatedApiKeys.deeplValidated || false,
          googleApiKeyValidated: updatedApiKeys.googleValidated || false,
        }));
      }
      
      if (changes.appState?.newValue) {
        const updatedAppState = changes.appState.newValue as Partial<AppState>;
        
        // Update fields that can be changed in options page
        setStateInternal(prev => ({
          ...prev,
          predefinedTranslations: updatedAppState.predefinedTranslations || prev.predefinedTranslations,
          doNotTranslate: updatedAppState.doNotTranslate || prev.doNotTranslate,
          formalitySettings: updatedAppState.formalitySettings || prev.formalitySettings,
          useFormalitySettings: updatedAppState.useFormalitySettings ?? prev.useFormalitySettings,
          deeplStyleOptions: updatedAppState.deeplStyleOptions || prev.deeplStyleOptions,
          deeplCustomInstructions: updatedAppState.deeplCustomInstructions || prev.deeplCustomInstructions,
          deeplStyleRuleIds: updatedAppState.deeplStyleRuleIds || prev.deeplStyleRuleIds,
          useDeeplStyleRules: updatedAppState.useDeeplStyleRules ?? prev.useDeeplStyleRules,
          deeplRequestDelay: updatedAppState.deeplRequestDelay ?? prev.deeplRequestDelay,
          copilotOptions: updatedAppState.copilotOptions || prev.copilotOptions,
          copilotCustomInstructions: updatedAppState.copilotCustomInstructions || prev.copilotCustomInstructions,
          useCopilotInstructions: updatedAppState.useCopilotInstructions ?? prev.useCopilotInstructions,
          overwriteMode: updatedAppState.overwriteMode || prev.overwriteMode,
          existingLanguagesModes: updatedAppState.existingLanguagesModes || prev.existingLanguagesModes,
        }));
        
        console.log('✅ Settings updated from options page:', {
          glossaryCount: updatedAppState.predefinedTranslations?.length || 0,
          dntCount: updatedAppState.doNotTranslate?.length || 0,
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setState = (updates: Partial<AppState>) => {
    setStateInternal(prev => {
      const newState = { ...prev, ...updates };
      
      // Check if switching from Pro to Free API
      if (updates.deeplApiKey !== undefined && updates.deeplApiKey !== prev.deeplApiKey) {
        const wasProKey = prev.deeplApiKey.length > 0 && !prev.deeplApiKey.endsWith(':fx');
        const isProKey = updates.deeplApiKey.length > 0 && !updates.deeplApiKey.endsWith(':fx');
        
        if (wasProKey && !isProKey && prev.useDeeplStyleRules) {
          console.warn('⚠️ Switched to DeepL Free API - Style Rules disabled');
          newState.useDeeplStyleRules = false;
        }
      }
      
      // Persist certain state properties
      const toPersist = {
        doNotTranslate: newState.doNotTranslate,
        predefinedTranslations: newState.predefinedTranslations,
        deeplApiKey: newState.deeplApiKey,
        googleApiKey: newState.googleApiKey,
        deeplRequestDelay: newState.deeplRequestDelay,
        deeplApiKeyValidated: newState.deeplApiKeyValidated,
        googleApiKeyValidated: newState.googleApiKeyValidated,
        formalitySettings: newState.formalitySettings,
        useFormalitySettings: newState.useFormalitySettings,
        deeplStyleOptions: newState.deeplStyleOptions,
        deeplCustomInstructions: newState.deeplCustomInstructions,
        deeplStyleRuleIds: newState.deeplStyleRuleIds,
        useDeeplStyleRules: newState.useDeeplStyleRules,
        useCopilot: newState.useCopilot,
        copilotOptions: newState.copilotOptions,
        copilotCustomInstructions: newState.copilotCustomInstructions,
        useCopilotInstructions: newState.useCopilotInstructions,
        overwriteMode: newState.overwriteMode,
        // File session persistence
        filesData: newState.filesData,
        multiFileMode: newState.multiFileMode,
        sourceLanguageISO: newState.sourceLanguageISO,
        sourceLanguageCKLS: newState.sourceLanguageCKLS,
        targetLanguagesCKLS: newState.targetLanguagesCKLS,
        detectedExisting: newState.detectedExisting,
        existingLanguagesModes: newState.existingLanguagesModes,
        languageCompletionStats: newState.languageCompletionStats,
        // Text input session persistence
        textInput: newState.textInput,
        inputMode: newState.inputMode,
        detectedContentType: newState.detectedContentType,
        jsonSchema: newState.jsonSchema,
        // Subtitle session persistence
        subtitleFiles: newState.subtitleFiles,
        subtitleSettings: newState.subtitleSettings,
        subtitleDeduplicationStats: newState.subtitleDeduplicationStats,
        // TMX persistence
        tmxMemories: newState.tmxMemories,
        activeTmxLink: newState.activeTmxLink,
      };
      
      saveToStorage('appState', toPersist);
      
      return newState;
    });
  };

  const resetState = () => {
    setStateInternal(initialState);
    saveToStorage('appState', {});
  };

  // Helper methods from original StateManager
  const addDntTerm = (term: string) => {
    if (!term.trim()) return;
    setState({ doNotTranslate: [...state.doNotTranslate, term.trim()] });
  };

  const removeDntTerm = (index: number) => {
    const newList = state.doNotTranslate.filter((_, i) => i !== index);
    setState({ doNotTranslate: newList });
  };

  const setDntList = (list: string[]) => {
    setState({ doNotTranslate: list });
  };

  const addPredefinedSet = (entry: GlossaryEntry) => {
    setState({ predefinedTranslations: [...state.predefinedTranslations, entry] });
  };

  const removePredefinedSet = (index: number) => {
    const newEntries = state.predefinedTranslations.filter((_, i) => i !== index);
    setState({ predefinedTranslations: newEntries });
  };

  const setTargetMapping = (msCode: string, cklsCode: string) => {
    setState({
      targetMapping: {
        ...state.targetMapping,
        [msCode]: cklsCode,
      },
    });
  };

  const value: AppContextType = {
    state,
    setState,
    resetState,
    addDntTerm,
    removeDntTerm,
    setDntList,
    addPredefinedSet,
    removePredefinedSet,
    setTargetMapping,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

