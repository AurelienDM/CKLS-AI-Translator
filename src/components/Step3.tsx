import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Zap, 
  Cloud, 
  Table, 
  Check, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  RotateCcw,
  Files,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  BookOpen,
  BookCheck,
  BookPlus,
  Clock,
  TrendingUp,
  FileCheck,
  Settings,
  Type
} from 'lucide-react';
import { generatePhase1Workbook, generatePhase1WorkbookMultiFile, generateFinalWorkbook, generateFinalWorkbookMultiFile, generateGoogleOutput, generateDeepLOutput, generateMultiFileZipOutput, generatePhase1WorkbookFromText, generateFinalTextOutput, convertTranslationResultToWorkbook, generateReviewPackageZip, generateTextReviewPackageZip } from '@/modules/WorkbookGenerator';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { TranslationProgress } from '@/components/TranslationProgress';
import { openOptionsPage } from '@/utils/extensionHelpers';
import { validateDeepLApiKey, validateGoogleApiKey, fetchDeepLQuota } from '@/utils/apiValidator';
import { translateAllWithGoogle, translateTextWithGoogle } from '@/modules/GoogleTranslator';
import { translateMultipleFilesWithGoogle } from '@/modules/MultiFileTranslator';
import { translateTextWithDeepL } from '@/modules/DeepLTranslator';
import { translateMultipleFilesWithDeepL } from '@/modules/MultiFileDeepLTranslator';
import { TranslationController } from '@/utils/TranslationController';
import { downloadTextFile, formatTextForDownload, generateTextFilename } from '@/modules/TextHandler';
import { translateSubtitlesWithDeepL } from '@/modules/SubtitleTranslator';
import { generateSubtitleZip, generateSrtContent, generateVttContent, applyEncoding } from '@/modules/SubtitleOutputGenerator';
import { BBC_SUBTITLE_STANDARDS } from '@/types/subtitle';
import type { SrtSubtitle, VttSubtitle } from '@/types/subtitle';
import { exportToTmx } from '@/modules/TmxParser';

// Global XLSX object from loaded library
declare const XLSX: any;

type TranslationMethod = 'deepl' | 'google' | 'excel';
type ExcelPhase = 'initial' | 'excel-generated' | 'excel-uploaded';

interface TranslationStats {
  startTime: number;
  endTime: number | null;
  totalStrings: number;
  uniqueStrings: number;
  duplicateStrings: number;
  totalCharacters: number;
  sourceCharacters?: number; // NEW: Original characters (with DNT terms)
  translatedCharacters?: number; // NEW: Actual translated characters
  languages: number;
  apiCallsSaved: number;
  tmxMatched?: number;
  tmxSavedApiCalls?: number;
  languageResults?: Record<string, {
    successCount: number;
    failureCount: number;
    totalStrings: number;
    successRate: number; // 0-100 percentage
  }>; // NEW: Per-language success/failure tracking
  sourceCopiedRows?: number;
}

interface Step3Props {
  onResetToStep1?: () => void;
}

export function Step3({ onResetToStep1 }: Step3Props = {}) {
  const { state, setState } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<TranslationMethod>('deepl');
  const [apiStatus, setApiStatus] = useState({ deeplValidated: false, googleValidated: false });
  const [enabledTranslators, setEnabledTranslators] = useState({ deepl: true, google: false, excel: false });
  const [excelPhase, setExcelPhase] = useState<ExcelPhase>('initial');
  const [generatedExcelFile, setGeneratedExcelFile] = useState<string | null>(null);
  const [multiFileExcelStats, setMultiFileExcelStats] = useState<{ uniqueStrings: number; totalFiles: number } | null>(null);
  const [translatedWorkbook, setTranslatedWorkbook] = useState<any | null>(null);
  const [translationResult, setTranslationResult] = useState<any | null>(null); // Store for review package generation
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google translation state
  const [googleController, setGoogleController] = useState<TranslationController | null>(null);
  const [googleTranslationResult, setGoogleTranslationResult] = useState<any | null>(null);

  // DeepL translation state
  const [deeplController, setDeeplController] = useState<TranslationController | null>(null);
  const [deeplTranslationResult, setDeeplTranslationResult] = useState<any | null>(null);
  
  // Accordion state for text mode results
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [copiedLang, setCopiedLang] = useState<string | null>(null);

  // API validation state for inline inputs
  const [deeplValidationState, setDeeplValidationState] = useState({
    isValidating: false,
    validationError: null as string | null,
    validationMessage: null as string | null
  });

  const [googleValidationState, setGoogleValidationState] = useState({
    isValidating: false,
    validationError: null as string | null,
    validationMessage: null as string | null
  });

  // Subtitle translation state
  const [subtitleTranslationResults, setSubtitleTranslationResults] = useState<any[]>([]);

  // Translation statistics state
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);

  // Review file generation state
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);

  // Load API validation status, enabled translators, and use translator selection from Step 2
  useEffect(() => {
    const loadApiStatus = async () => {
      try {
        const result = await chrome.storage.local.get('apiKeys');
        const apiKeys = result.apiKeys as { 
          deepl?: string; 
          deeplValidated?: boolean;
          google?: string; 
          googleValidated?: boolean;
          enabledTranslators?: { deepl: boolean; google: boolean; excel: boolean };
        } | undefined;
        
        // Load enabled translators
        if (apiKeys?.enabledTranslators) {
          setEnabledTranslators(apiKeys.enabledTranslators);
        }
        
        // Use the translator selected in Step 2 (from state.translationMethod)
        // But only if that translator is enabled
        if (state.translationMethod) {
          const method = state.translationMethod as TranslationMethod;
          const enabled = apiKeys?.enabledTranslators || { deepl: true, google: false, excel: false };
          if (enabled[method]) {
            setSelectedMethod(method);
          } else {
            // Fall back to DeepL if selected method is not enabled
            setSelectedMethod('deepl');
          }
        }
        
        // Set validation status
        setApiStatus({
          deeplValidated: apiKeys?.deeplValidated || false,
          googleValidated: apiKeys?.googleValidated || false
        });
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
        
        // Update enabled translators
        if (updatedKeys.enabledTranslators) {
          setEnabledTranslators(updatedKeys.enabledTranslators);
        }
        
        // Clear error if API keys are now configured
        if (error && (error.includes('not configured') || error.includes('not validated'))) {
          if ((selectedMethod === 'deepl' && updatedKeys.deeplValidated) ||
              (selectedMethod === 'google' && updatedKeys.googleValidated)) {
            setError(null);
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [error, selectedMethod, state.translationMethod]);

  // DeepL API validation handler
  const handleValidateDeepLKey = async () => {
    setDeeplValidationState(prev => ({ ...prev, isValidating: true, validationError: null }));
    
    try {
      const validation = await validateDeepLApiKey(state.deeplApiKey);
      
      if (validation.valid) {
        setDeeplValidationState({
          isValidating: false,
          validationError: null,
          validationMessage: validation.message || 'API key validated'
        });
        
        // Fetch and store quota info
        const quotaInfo = await fetchDeepLQuota(state.deeplApiKey);
        if (quotaInfo) {
          await chrome.storage.local.set({ deeplQuota: quotaInfo });
        }
        
        // Save to Chrome storage
        const result = await chrome.storage.local.get('apiKeys');
        const existingKeys = result.apiKeys || {};
        await chrome.storage.local.set({
          apiKeys: {
            ...(typeof existingKeys === 'object' ? existingKeys : {}),
            deepl: state.deeplApiKey,
            deeplValidated: true
          }
        });
        
        // Update local status
        setApiStatus(prev => ({ ...prev, deeplValidated: true }));
      } else {
        setDeeplValidationState({
          isValidating: false,
          validationError: validation.error || 'Invalid API key',
          validationMessage: null
        });
      }
    } catch (error: any) {
      setDeeplValidationState({
        isValidating: false,
        validationError: error.message || 'Validation failed',
        validationMessage: null
      });
    }
  };

  // Google API validation handler
  const handleValidateGoogleKey = async () => {
    setGoogleValidationState(prev => ({ ...prev, isValidating: true, validationError: null }));
    
    try {
      const validation = await validateGoogleApiKey(state.googleApiKey);
      
      if (validation.valid) {
        setGoogleValidationState({
          isValidating: false,
          validationError: null,
          validationMessage: validation.message || 'API key validated'
        });
        
        // Save to Chrome storage
        const result = await chrome.storage.local.get('apiKeys');
        const existingKeys = result.apiKeys || {};
        await chrome.storage.local.set({
          apiKeys: {
            ...(typeof existingKeys === 'object' ? existingKeys : {}),
            google: state.googleApiKey,
            googleValidated: true
          }
        });
        
        // Update local status
        setApiStatus(prev => ({ ...prev, googleValidated: true }));
      } else {
        setGoogleValidationState({
          isValidating: false,
          validationError: validation.error || 'Invalid API key',
          validationMessage: null
        });
      }
    } catch (error: any) {
      setGoogleValidationState({
        isValidating: false,
        validationError: error.message || 'Validation failed',
        validationMessage: null
      });
    }
  };

  // Phase 1: Generate Excel with formulas
  const handleGenerateExcel = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      if (state.inputMode === 'text') {
        // Text mode: generate Excel with text content
        const result = generatePhase1WorkbookFromText(state);
        setGeneratedExcelFile(result.filename);
        setState({ targetMapping: result.targetMapping });
        setMultiFileExcelStats(null);
      } else if (state.multiFileMode && state.filesData.length > 0) {
        // Multi-file mode: generate single Excel with deduplicated strings
        const result = generatePhase1WorkbookMultiFile(state);
        setGeneratedExcelFile(result.filename);
        setMultiFileExcelStats({
          uniqueStrings: result.uniqueStrings,
          totalFiles: result.totalFiles
        });
        setState({ targetMapping: result.targetMapping });
      } else {
        // Single file mode
        const result = generatePhase1Workbook(state);
        setGeneratedExcelFile(result.filename);
        setState({ targetMapping: result.targetMapping });
        setMultiFileExcelStats(null);
      }
      setExcelPhase('excel-generated');
    } catch (err: any) {
      setError(err.message || 'Failed to generate Excel file');
      console.error('Excel generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Phase 2: Handle translated Excel upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsGenerating(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Validate workbook structure
        // For text mode, look for Text_Translation sheet, otherwise Extracted_Text
        const isTextMode = state.inputMode === 'text';
        const requiredSheet = isTextMode ? 'Text_Translation' : 'Extracted_Text';
        
        if (!workbook.Sheets[requiredSheet]) {
          throw new Error(`Invalid file: must contain "${requiredSheet}" sheet`);
        }
        
        // In single-file mode (not text mode), also require Original sheet
        if (!isTextMode && !state.multiFileMode && !workbook.Sheets['Original']) {
          throw new Error('Invalid file: must contain "Original" sheet for single-file mode');
        }

        setTranslatedWorkbook(workbook);
          setUploadedFileName(file.name);
          setExcelPhase('excel-uploaded');
          setIsGenerating(false);
        } catch (err: any) {
          setError(err.message || 'Failed to parse Excel file');
          setIsGenerating(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsGenerating(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      setIsGenerating(false);
    }
  };

  // Phase 3: Generate final output (XML or TXT)
  const handleGenerateFinalXML = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      if (state.inputMode === 'text') {
        // Text mode: generate TXT file
        const filename = generateFinalTextOutput(state, translatedWorkbook);
        setState({ lastGeneratedXmlFileName: filename });
      } else if (state.filesData.length > 1) {
        // Multiple files: generate ZIP with multiple XMLs
        console.log('📦 Excel mode: Generating ZIP for', state.filesData.length, 'files');
        const result = generateFinalWorkbookMultiFile(state, translatedWorkbook, 'xml');
        setState({ lastGeneratedXmlFileName: result.filename });
      } else {
        // Single file: generate single XML
        console.log('📄 Excel mode: Generating single XML');
        const filename = generateFinalWorkbook(state, translatedWorkbook, 'xml');
        if (filename) {
          setState({ lastGeneratedXmlFileName: filename });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate output file');
      console.error('Output generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    setExcelPhase('initial');
    setGeneratedExcelFile(null);
    setMultiFileExcelStats(null);
    setTranslatedWorkbook(null);
    setTranslationResult(null);
    setUploadedFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Google Translation Handlers
  const handleStartGoogleTranslation = async () => {
    // Proceed directly - no confirmation dialog
    await executeGoogleTranslation();
  };

  const executeGoogleTranslation = async () => {
    setError(null);

    // Load API key from storage
    try {
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = result.apiKeys as { deepl?: string; deeplValidated?: boolean; google?: string; googleValidated?: boolean; defaultService: 'deepl' | 'google' | 'excel' } | undefined;
      const apiKey = apiKeys?.google;
      
      if (!apiKey || !apiKeys?.googleValidated) {
        setError('Google API key not configured or not validated. Please set it up in Settings.');
        return;
      }

      // Validate file exists for single-file mode
      if (!state.multiFileMode && state.inputMode !== 'text' && state.filesData.length === 0) {
        setError('No file loaded. Please upload a file in Step 1 first.');
        return;
      }

      const controller = new TranslationController();
      setGoogleController(controller);
    
      // Initialize translation stats
      const stats: TranslationStats = {
        startTime: Date.now(),
        endTime: null,
        totalStrings: state.multiFileMode 
          ? (state.deduplicationStats?.totalStrings || 0)
          : (state.deduplicationStats?.totalStrings || 0),
        uniqueStrings: state.deduplicationStats?.uniqueStrings || 0,
        duplicateStrings: state.deduplicationStats?.duplicateStrings || 0,
        totalCharacters: state.deduplicationStats?.totalCharacters || 0,
        sourceCharacters: state.deduplicationStats?.sourceCharacters || 0,
        translatedCharacters: state.deduplicationStats?.translatedCharacters || 0,
        languages: state.targetLanguagesCKLS.length,
        apiCallsSaved: ((state.deduplicationStats?.duplicateStrings || 0) * state.targetLanguagesCKLS.length),
      };
      setTranslationStats(stats);
    
      setState({ 
        translationInProgress: true,
        translationPaused: false,
        translationProgress: {
          current: 0,
          total: 0,
          currentLang: '',
          phase: 'starting'
        }
      });

      try {
        // Check if multi-file mode
        if (state.multiFileMode && state.filesData.length > 0) {
          // Multi-file translation
          const results = await translateMultipleFilesWithGoogle({
            filesData: state.filesData,
            targetLanguagesCKLS: state.targetLanguagesCKLS,
            sourceISO: state.sourceLanguageISO,
            sourceCKLS: state.sourceLanguageCKLS,
            doNotTranslate: state.doNotTranslate,
            predefinedTranslations: state.predefinedTranslations,
            apiKey: apiKey,
            controller,
            onProgress: (current, total, currentLang, phase, fileIndex) => {
              setState({
                translationProgress: {
                  current,
                  total,
                  currentLang,
                  phase: fileIndex !== undefined ? `${phase} (file ${fileIndex + 1}/${state.filesData.length})` : phase || 'translating'
                }
              });
            }
          });

          setGoogleTranslationResult(results);
        } else {
          // Single file translation - use workbook from filesData
          const workbookToUse = state.filesData.length > 0 ? state.filesData[0].workbook : state.workbook;
          const result = await translateAllWithGoogle({
            workbook: workbookToUse,
            targetLanguagesCKLS: state.targetLanguagesCKLS,
            sourceISO: state.sourceLanguageISO,
            sourceCKLS: state.sourceLanguageCKLS,
            doNotTranslate: state.doNotTranslate,
            predefinedTranslations: state.predefinedTranslations,
            apiKey: apiKey,
            fileTitleSlug: state.fileTitleSlug,
            controller,
            onProgress: (current, total, currentLang, phase) => {
              setState({
                translationProgress: {
                  current,
                  total,
                  currentLang,
                  phase: phase || 'translating'
                }
              });
            }
          });

          setGoogleTranslationResult(result);
        }
        
        // Capture end time
        setTranslationStats(prev => prev ? { ...prev, endTime: Date.now() } : null);
        
        setState({ 
          translationInProgress: false,
          translationProgress: null
        });
      } catch (err: any) {
        if (err.message === 'Translation cancelled') {
          setError('Translation was cancelled');
        } else {
          setError(err.message || 'Translation failed');
        }
        
        setState({ 
          translationInProgress: false,
          translationProgress: null,
          translationPaused: false
        });
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load API key');
    }
  };

  const handlePauseGoogleTranslation = () => {
    if (googleController) {
      googleController.pause();
      setState({ translationPaused: true });
    }
  };

  const handleResumeGoogleTranslation = () => {
    if (googleController) {
      googleController.resume();
      setState({ translationPaused: false });
    }
  };

  const handleCancelGoogleTranslation = () => {
    if (googleController) {
      googleController.cancel();
      setGoogleController(null);
    }
    
    setState({ 
      translationInProgress: false,
      translationProgress: null,
      translationPaused: false
    });
  };

  const handleDownloadGoogleXml = () => {
    if (!googleTranslationResult) return;

    try {
      let result;
      
      // Check result structure and file count
      if (Array.isArray(googleTranslationResult) && googleTranslationResult.length > 1) {
        // Multiple files: generate ZIP
        console.log('📦 Generating ZIP for', googleTranslationResult.length, 'files');
        result = generateMultiFileZipOutput(state, googleTranslationResult);
      } else if (Array.isArray(googleTranslationResult) && googleTranslationResult.length === 1) {
        // Single file through multi-file path: extract and generate single XML
        console.log('📄 Generating single XML from multi-file result');
        result = generateGoogleOutput(
          state,
          googleTranslationResult[0].extracted,
          googleTranslationResult[0].rebuilt,
          googleTranslationResult[0].translations
        );
      } else {
        // Legacy single file format (not array): generate XML
        console.log('📄 Generating single XML from legacy result');
        result = generateGoogleOutput(
          state,
          googleTranslationResult.extracted,
          googleTranslationResult.rebuilt,
          googleTranslationResult.translations
        );
      }
      
      // Update translation stats with source copied info
      if (result.stats?.sourceCopiedRows) {
        setTranslationStats(prev => prev ? {
          ...prev,
          sourceCopiedRows: result.stats.sourceCopiedRows
        } : null);
      }

      setState({ lastGeneratedXmlFileName: result.filename });
    } catch (err: any) {
      setError(err.message || 'Failed to generate output');
      console.error('Output generation error:', err);
    }
  };
  
  // Google Text Translation Handler
  const handleStartGoogleTextTranslation = async () => {
    setError(null);

    // Load API key from storage
    try {
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = result.apiKeys as { deepl?: string; deeplValidated?: boolean; google?: string; googleValidated?: boolean; defaultService: 'deepl' | 'google' | 'excel' } | undefined;
      const apiKey = apiKeys?.google;
      
      if (!apiKey || !apiKeys?.googleValidated) {
        setError('Google API key not configured or not validated. Please set it up in Settings.');
        return;
      }

      // Validate text input exists
      if (!state.textInput || state.textInput.trim().length === 0) {
        setError('No text content loaded. Please enter text in Step 1 first.');
        return;
      }

      const controller = new TranslationController();
      setGoogleController(controller);
    
      // Initialize translation stats for text mode
      const textLength = state.textInput.length;
      
      // Calculate total operations based on content type
      let totalOperations = state.targetLanguagesCKLS.length; // Default: 1 text per language
      let totalStringsCount = 1;
      
      if (state.detectedContentType === 'json' && state.jsonSchema) {
        // JSON mode: extract strings from JSON schema
        try {
          const { extractJsonText } = await import('@/utils/jsonTextExtraction');
          const { extracted } = extractJsonText(state.textInput, state.jsonSchema);
          totalStringsCount = extracted.length;
          totalOperations = extracted.length * state.targetLanguagesCKLS.length;
        } catch (err) {
          console.warn('Failed to extract JSON for stats calculation:', err);
        }
      } else if (state.detectedContentType === 'html' || state.textInput.includes('<')) {
        // HTML mode: extract text blocks from HTML
        try {
          const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
          const { extracted } = extractTextAndBuildPlaceholders(
            [{ rowIndex: 1, original: state.textInput }],
            state.doNotTranslate
          );
          totalStringsCount = extracted.length;
          totalOperations = extracted.length * state.targetLanguagesCKLS.length;
        } catch (err) {
          console.warn('Failed to extract HTML for stats calculation:', err);
        }
      }
      
      const stats: TranslationStats = {
        startTime: Date.now(),
        endTime: null,
        totalStrings: totalStringsCount,
        uniqueStrings: totalStringsCount,
        duplicateStrings: 0,
        totalCharacters: textLength,
        sourceCharacters: textLength,
        translatedCharacters: Math.round(textLength * 1.1 * state.targetLanguagesCKLS.length),
        languages: state.targetLanguagesCKLS.length,
        apiCallsSaved: 0,
      };
      setTranslationStats(stats);
    
      setState({ 
        translationInProgress: true,
        translationPaused: false,
        translationProgress: {
          current: 0,
          total: totalOperations,
          currentLang: '',
          phase: 'starting'
        }
      });

      try {
        const translations = await translateTextWithGoogle(
          state.textInput,
          state.sourceLanguageISO,
          state.targetLanguagesCKLS,
          apiKey,
          state.doNotTranslate,
          controller,
          (current, total, currentLang) => {
            setState({
              translationProgress: {
                current,
                total,
                currentLang,
                phase: 'translating'
              }
            });
          },
          state.detectedContentType === 'subtitle' ? 'plain' : (state.detectedContentType || 'plain'),
          state.jsonSchema || undefined
        );

        // Capture end time
        setTranslationStats(prev => prev ? { ...prev, endTime: Date.now() } : null);

        setState({ 
          translationInProgress: false,
          translationProgress: null,
          textTranslationResult: {
            translations,
            sourceText: state.textInput
          }
        });
        
        setGoogleTranslationResult({ textMode: true });
      } catch (err: any) {
        if (err.message === 'Translation cancelled') {
          setError('Translation was cancelled');
        } else {
          setError(err.message || 'Translation failed');
        }
        
        setState({ 
          translationInProgress: false,
          translationProgress: null,
          translationPaused: false
        });
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load API key');
    }
  };
  
  const handleDownloadTextResults = () => {
    if (!state.textTranslationResult) return;
    
    // Check if JSON content
    if (state.detectedContentType === 'json' && state.jsonSchema) {
      const translations = state.textTranslationResult.translations;
      const langCodes = Object.keys(translations);
      
      // If only one language, download a single .json file
      if (langCodes.length === 1) {
        const langCode = langCodes[0];
        const jsonContent = translations[langCode];
        const filename = `${state.jsonSchema.name.replace(/\s+/g, '_')}_${langCode}.json`;
        
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        
        setState({ lastGeneratedXmlFileName: filename });
      } else {
        // Multiple languages: create ZIP
        // @ts-ignore - JSZip is loaded globally
        const jszip = new JSZip();
        
        Object.entries(translations).forEach(([langCode, jsonContent]) => {
          const filename = `${state.jsonSchema!.name.replace(/\s+/g, '_')}_${langCode}.json`;
          jszip.file(filename, jsonContent);
        });
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipFilename = `meta-skills_translated_${timestamp}.zip`;
        
        jszip.generateAsync({ type: "blob" }).then((content: Blob) => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(content);
          link.download = zipFilename;
          link.click();
          URL.revokeObjectURL(link.href);
        });
        
        setState({ lastGeneratedXmlFileName: zipFilename });
      }
    } else {
      // Existing text file download
      const content = formatTextForDownload(
        state.textTranslationResult.translations
      );
      
      const filename = generateTextFilename();
      downloadTextFile(content, filename);
      setState({ lastGeneratedXmlFileName: filename });
    }
  };

  // DeepL Translation Handlers
  const handleStartDeepLTranslation = async () => {
    // Proceed directly - no confirmation dialog
    await executeDeepLTranslation();
  };

  const executeDeepLTranslation = async () => {
    setError(null);

    // Load API key from storage
    try {
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = result.apiKeys as { deepl?: string; deeplValidated?: boolean; google?: string; googleValidated?: boolean; defaultService: 'deepl' | 'google' | 'excel' } | undefined;
      const apiKey = apiKeys?.deepl;
      
      if (!apiKey || !apiKeys?.deeplValidated) {
        setError('DeepL API key not configured or not validated. Please set it up in Settings.');
        return;
      }

      // Validate file exists for single-file mode
      if (!state.multiFileMode && state.inputMode !== 'text' && state.inputMode !== 'subtitle' && 
          state.filesData.length === 0) {
        setError('No file loaded. Please upload a file in Step 1 first.');
        return;
      }

      // Validate subtitle files exist for subtitle mode
      if (state.inputMode === 'subtitle' && (!state.subtitleFiles || state.subtitleFiles.length === 0)) {
        setError('No subtitle files loaded. Please upload subtitle files in Step 1 first.');
        return;
      }

      const controller = new TranslationController();
      setDeeplController(controller);
      
      // Extract original translations from workbook for review file tracking
      // Store in local variable to pass to convertTranslationResultToWorkbook (React state is async)
      let extractedOriginalTranslations: Record<string, Record<string, string>> = {};
      
      if (state.filesData && state.filesData.length > 0 && state.filesData[0]?.workbook) {
        const XLSX = (window as any).XLSX;
        
        try {
          const wb = state.filesData[0].workbook;
          
          // IMPORTANT: Use the FIRST sheet (same as MultiFileDeepLTranslator)
          // This handles both raw XML format and processed "Extracted_Text" format
          const firstSheetName = wb.SheetNames[0];
          const firstSheet = wb.Sheets[firstSheetName];
          
          console.log(`🔍 Extraction - Reading from sheet: "${firstSheetName}"`);
          
          if (firstSheet) {
            const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
            
            if (sheetData.length >= 2) {
              const headerRow = sheetData[0] as any[];
              console.log('🔍 Extraction - Header row:', headerRow);
              
              // Dynamically find language columns by searching for language codes (e.g., fr-FR, en-US)
              const languageColumns: Record<string, number> = {};
              for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
                const headerValue = headerRow[colIdx];
                if (headerValue && typeof headerValue === 'string') {
                  // Match language codes like fr-FR, en-US, es-ES, etc.
                  const match = headerValue.match(/\b([a-z]{2}-[A-Z]{2})\b/i);
                  if (match) {
                    const langCode = match[1].toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i, 
                      (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
                    languageColumns[langCode] = colIdx;
                  }
                }
              }
              
              console.log('🔍 Extraction - Found language columns:', languageColumns);
              
              // Find the source text column (column D, index 3)
              // This is where readColumnD reads from
              const sourceColumnIndex = 3;
              
              console.log(`🔍 Extraction - Source column at index: ${sourceColumnIndex}`);
              
              // Initialize language maps
              Object.keys(languageColumns).forEach(lang => {
                extractedOriginalTranslations[lang] = {};
              });
              
              // Extract values for each language
              // Generate T-IDs in the same order as the extraction process
              let tIdCounter = 1;
              for (let rowIdx = 1; rowIdx < sheetData.length; rowIdx++) {
                const row = sheetData[rowIdx] as any[];
                
                // Check if this row has source text (same logic as readColumnD)
                const sourceText = row[sourceColumnIndex];
                if (!sourceText || String(sourceText).trim() === '') continue;
                
                // Generate T-ID (same as extractTextAndBuildPlaceholders)
                const stringId = `T${tIdCounter++}`;
                
                // Extract pre-existing translations for this row
                for (const [langCode, colIdx] of Object.entries(languageColumns)) {
                  const cellValue = row[colIdx];
                  if (cellValue && String(cellValue).trim() !== '') {
                    extractedOriginalTranslations[langCode][stringId] = String(cellValue);
                  }
                }
              }
              
              console.log('✅ Extracted original translations:', extractedOriginalTranslations);
              console.log('📊 Sample:', Object.keys(extractedOriginalTranslations).map(lang => 
                `${lang}: ${Object.keys(extractedOriginalTranslations[lang]).length} strings`
              ));
            }
          }
        } catch (err) {
          console.warn('⚠️ Failed to extract original translations:', err);
        }
      }
      // Legacy workbook path removed - all file uploads now use filesData
    
      // Initialize translation stats
      let totalCharacters = 0;
      let apiCallsSaved = 0;
      
      if (state.inputMode === 'subtitle' && state.subtitleFiles) {
        // Calculate total characters from unique subtitle texts
        const allSubtitles = state.subtitleFiles.flatMap(f => f.subtitles);
        const uniqueTexts = new Set(allSubtitles.map(s => s.text.trim()));
        totalCharacters = Array.from(uniqueTexts).reduce((sum, text) => sum + text.length, 0);
        const duplicates = allSubtitles.length - uniqueTexts.size;
        apiCallsSaved = duplicates * state.targetLanguagesCKLS.length;
      } else {
        totalCharacters = state.deduplicationStats?.totalCharacters || 0;
        apiCallsSaved = (state.deduplicationStats?.duplicateStrings || 0) * state.targetLanguagesCKLS.length;
      }
      
      const stats: TranslationStats = {
        startTime: Date.now(),
        endTime: null,
        totalStrings: state.inputMode === 'subtitle'
          ? (state.subtitleFiles?.reduce((sum, file) => sum + file.subtitles.length, 0) || 0)
          : state.multiFileMode 
            ? (state.deduplicationStats?.totalStrings || 0)
            : (state.deduplicationStats?.totalStrings || 0),
        uniqueStrings: state.inputMode === 'subtitle'
          ? (state.subtitleDeduplicationStats?.uniqueTexts || 0)
          : (state.deduplicationStats?.uniqueStrings || 0),
        duplicateStrings: state.inputMode === 'subtitle'
          ? (state.subtitleDeduplicationStats?.duplicates || 0)
          : (state.deduplicationStats?.duplicateStrings || 0),
        totalCharacters: totalCharacters,
        sourceCharacters: state.deduplicationStats?.sourceCharacters || totalCharacters,
        translatedCharacters: state.deduplicationStats?.translatedCharacters || Math.round(totalCharacters * 1.1 * state.targetLanguagesCKLS.length),
        languages: state.targetLanguagesCKLS.length,
        apiCallsSaved: apiCallsSaved,
      };
      setTranslationStats(stats);
    
      setState({ 
        translationInProgress: true,
        translationPaused: false,
        translationProgress: {
          current: 0,
          total: 0,
          currentLang: '',
          phase: 'starting'
        }
      });

      try {
        // Check if we have filesData (single or multiple files)
        // Use multi-file translator for all file-based translations (has fill-mode filtering)
        if (state.filesData.length > 0) {
          // DEBUG: Log what we're passing to the translator
          console.log('🔍 Step3 - About to translate with these modes:', state.existingLanguagesModes);
          console.log('🔍 Step3 - Target languages:', state.targetLanguagesCKLS);
          console.log('🔍 Step3 - Detected existing:', state.detectedExisting);
          console.log('🔍 Step3 - Using multi-file translator for', state.filesData.length, 'file(s)');
          
          // Multi-file translation (also handles single files)
          const results = await translateMultipleFilesWithDeepL({
            filesData: state.filesData,
            targetLanguagesCKLS: state.targetLanguagesCKLS,
            sourceISO: state.sourceLanguageISO,
            sourceCKLS: state.sourceLanguageCKLS,
            doNotTranslate: state.doNotTranslate,
            predefinedTranslations: state.predefinedTranslations,
            apiKey: apiKey,
            formalitySettings: state.formalitySettings,
            useFormalitySettings: state.useFormalitySettings,
            deeplStyleOptions: state.deeplStyleOptions,
            useDeeplStyleRules: state.useDeeplStyleRules,
            deeplRequestDelay: state.deeplRequestDelay,
            existingLanguagesModes: state.existingLanguagesModes,
            controller,
            onProgress: (current, total, currentLang, phase) => {
              setState({
                translationProgress: {
                  current,
                  total,
                  currentLang,
                  phase
                }
              });
            }
          });

          setDeeplTranslationResult(results);
          
          // Calculate total strings from all files
          const totalStrings = results.reduce((sum: number, r: any) => sum + r.extracted.length, 0);
          
          // Extract languageResults from first result (if available)
          const languageResults = results[0]?.languageResults;
          
          // Capture end time and attach languageResults
          setTranslationStats(prev => prev ? { 
            ...prev, 
            endTime: Date.now(),
            languageResults: languageResults 
          } : null);
          
          // Create workbook structure for review file generation (use first file's result)
          if (results[0]) {
            const reviewWorkbook = convertTranslationResultToWorkbook(
              results[0],
              state.targetLanguagesCKLS,
              extractedOriginalTranslations,
              state.filesData[0]?.workbook // Pass the original workbook
            );
            setTranslatedWorkbook(reviewWorkbook);
            setTranslationResult(results[0]); // Store for review package generation
          }
          
          setState({ 
            translationInProgress: false,
            deduplicationStats: {
              totalStrings,
              uniqueStrings: state.deduplicationStats?.uniqueStrings || totalStrings
            }
          });
        } else if (state.inputMode === 'subtitle' && state.subtitleFiles && state.subtitleFiles.length > 0) {
          // Subtitle translation
          const settings = state.subtitleSettings || BBC_SUBTITLE_STANDARDS;
          
          // Get active TMX if linked
          const activeTmx = state.activeTmxLink && state.tmxMemories 
            ? state.tmxMemories.find(tmx => tmx.fileName === state.activeTmxLink?.tmxFileName)
            : undefined;
          
          const results = await translateSubtitlesWithDeepL({
            subtitleFiles: state.subtitleFiles,
            targetLanguagesCKLS: state.targetLanguagesCKLS,
            sourceISO: state.sourceLanguageISO,
            sourceCKLS: state.sourceLanguageCKLS,
            apiKey,
            doNotTranslate: state.doNotTranslate || [],
            predefinedTranslations: state.predefinedTranslations || [],
            subtitleSettings: settings,
            deeplRequestDelay: state.deeplRequestDelay,
            tmxMemory: activeTmx,
            tmxLink: state.activeTmxLink || undefined,
            controller: {
              cancelled: controller.cancelled,
              paused: state.translationPaused,
              signal: controller.signal,
              waitIfPaused: () => controller.waitIfPaused()
            },
            onProgress: (current: number, total: number, currentLang: string, phase: string) => {
              setState({
                translationProgress: {
                  current,
                  total,
                  currentLang,
                  phase
                }
              });
            }
          });

          setSubtitleTranslationResults(results);
          
          // Capture end time
          setTranslationStats(prev => prev ? { ...prev, endTime: Date.now() } : null);
          
          // Create workbook structure for review file generation (use first subtitle file's result)
          if (results[0]) {
            const reviewWorkbook = convertTranslationResultToWorkbook(
              results[0],
              state.targetLanguagesCKLS,
              extractedOriginalTranslations,
              state.filesData[0]?.workbook // Pass the original workbook
            );
            setTranslatedWorkbook(reviewWorkbook);
            setTranslationResult(results[0]); // Store for review package generation
          }
          
          setState({ 
            translationInProgress: false,
            subtitleDeduplicationStats: {
              totalStrings: results.reduce((sum: number, r: any) => sum + r.originalCount, 0),
              uniqueStrings: results.reduce((sum: number, r: any) => sum + r.uniqueCount, 0)
            }
          });
        } else {
          // No valid translation source
          throw new Error('No files available for translation. Please upload a file in Step 1.');
        }
      } catch (err: any) {
        console.error('DeepL translation error:', err);
        setError(err.message || 'DeepL translation failed');
        setState({ 
          translationInProgress: false,
          translationPaused: false,
          translationProgress: null
        });
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load API key');
    }
  };

  const handlePauseDeepLTranslation = () => {
    if (deeplController) {
      deeplController.pause();
      setState({ translationPaused: true });
    }
  };

  const handleResumeDeepLTranslation = () => {
    if (deeplController) {
      deeplController.resume();
      setState({ translationPaused: false });
    }
  };

  const handleCancelDeepLTranslation = () => {
    if (deeplController) {
      deeplController.cancel();
      setDeeplController(null);
    }
    
    setState({ 
      translationInProgress: false,
      translationProgress: null,
      translationPaused: false
    });
  };

  // Handler for generating client review file (CSV format)
  const handleGenerateReviewFile = async () => {
    if (!translatedWorkbook || !translationStats) return;

    try {
      setIsGeneratingReview(true);
      
      // Generate review package ZIP
      const zipBlob = await generateReviewPackageZip(
        state,
        translatedWorkbook,
        translationResult,
        translationStats,
        selectedMethod
      );
      
      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = Math.floor(Date.now() / 1000);
      link.download = `${state.fileTitleSlug}_Review_${timestamp}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ Review package generated and downloaded');
    } catch (error) {
      console.error('Failed to generate review package:', error);
      setError('Failed to generate review package. Please try again.');
    } finally {
      setIsGeneratingReview(false);
    }
  };

  // Handler for generating text mode review file (CSV format)
  const handleGenerateTextReviewFile = async () => {
    if (!state.textTranslationResult) return;

    try {
      setIsGeneratingReview(true);
      
      // Generate text review package ZIP
      // Map content type to supported values (json, html, text)
      const contentType = state.detectedContentType === 'json' ? 'json' 
        : state.detectedContentType === 'html' ? 'html' 
        : 'text';
      
      const zipBlob = await generateTextReviewPackageZip(
        state.textInput,
        state.textTranslationResult.translations,
        contentType,
        state.jsonSchema,
        state.sourceLanguageCKLS
      );
      
      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = Math.floor(Date.now() / 1000);
      const fileSlug = state.detectedContentType === 'json' && state.jsonSchema 
        ? state.jsonSchema.name.replace(/\s+/g, '_').toLowerCase()
        : 'text';
      link.download = `${fileSlug}_Review_${timestamp}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ Text review package generated and downloaded');
    } catch (error) {
      console.error('Failed to generate text review package:', error);
      setError('Failed to generate text review package. Please try again.');
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const handleDownloadDeepLXml = () => {
    if (!deeplTranslationResult) return;

    try {
      // Validate translation result structure
      if (Array.isArray(deeplTranslationResult)) {
        // Multi-file mode - validate array
        if (deeplTranslationResult.length === 0) {
          setError('No translation results available');
          return;
        }
      } else {
        // Single-file mode - validate structure
        if (!deeplTranslationResult.extracted || !deeplTranslationResult.rebuilt || !deeplTranslationResult.translations) {
          setError('Translation result is incomplete. Please try translating again.');
          console.error('Invalid translation result structure:', deeplTranslationResult);
          return;
        }
      }
      
      let result;
      
      // Check result structure and file count
      if (Array.isArray(deeplTranslationResult) && deeplTranslationResult.length > 1) {
        // Multiple files: generate ZIP
        console.log('📦 Generating ZIP for', deeplTranslationResult.length, 'files');
        result = generateMultiFileZipOutput(state, deeplTranslationResult);
      } else if (Array.isArray(deeplTranslationResult) && deeplTranslationResult.length === 1) {
        // Single file through multi-file path: extract and generate single XML
        console.log('📄 Generating single XML from multi-file result');
        result = generateDeepLOutput(state, deeplTranslationResult[0]);
      } else {
        // Legacy single file format (not array): generate XML
        console.log('📄 Generating single XML from legacy result');
        result = generateDeepLOutput(state, deeplTranslationResult);
      }
      
      // Update translation stats with source copied info
      if (result.stats?.sourceCopiedRows) {
        setTranslationStats(prev => prev ? {
          ...prev,
          sourceCopiedRows: result.stats.sourceCopiedRows
        } : null);
      }

      setState({ lastGeneratedXmlFileName: result.filename });
    } catch (err: any) {
      setError(err.message || 'Failed to generate output');
      console.error('Output generation error:', err);
    }
  };
  
  // DeepL Text Translation Handler
  const handleStartDeepLTextTranslation = async () => {
    setError(null);

    // Load API key from storage
    try {
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = result.apiKeys as { deepl?: string; deeplValidated?: boolean; google?: string; googleValidated?: boolean; defaultService: 'deepl' | 'google' | 'excel' } | undefined;
      const apiKey = apiKeys?.deepl;
      
      if (!apiKey || !apiKeys?.deeplValidated) {
        setError('DeepL API key not configured or not validated. Please set it up in Settings.');
        return;
      }

      // Validate text input exists
      if (!state.textInput || state.textInput.trim().length === 0) {
        setError('No text content loaded. Please enter text in Step 1 first.');
        return;
      }

      const controller = new TranslationController();
      setDeeplController(controller);
    
      // Initialize translation stats for text mode
      const textLength = state.textInput.length;
      
      // Calculate total operations based on content type
      let totalOperations = state.targetLanguagesCKLS.length; // Default: 1 text per language
      let totalStringsCount = 1;
      
      if (state.detectedContentType === 'json' && state.jsonSchema) {
        // JSON mode: extract strings from JSON schema
        try {
          const { extractJsonText } = await import('@/utils/jsonTextExtraction');
          const { extracted } = extractJsonText(state.textInput, state.jsonSchema);
          totalStringsCount = extracted.length;
          totalOperations = extracted.length * state.targetLanguagesCKLS.length;
        } catch (err) {
          console.warn('Failed to extract JSON for stats calculation:', err);
        }
      } else if (state.detectedContentType === 'html' || state.textInput.includes('<')) {
        // HTML mode: extract text blocks from HTML
        try {
          const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
          const { extracted } = extractTextAndBuildPlaceholders(
            [{ rowIndex: 1, original: state.textInput }],
            state.doNotTranslate
          );
          totalStringsCount = extracted.length;
          totalOperations = extracted.length * state.targetLanguagesCKLS.length;
        } catch (err) {
          console.warn('Failed to extract HTML for stats calculation:', err);
        }
      }
      
      const stats: TranslationStats = {
        startTime: Date.now(),
        endTime: null,
        totalStrings: totalStringsCount,
        uniqueStrings: totalStringsCount,
        duplicateStrings: 0,
        totalCharacters: textLength,
        sourceCharacters: textLength,
        translatedCharacters: Math.round(textLength * 1.1 * state.targetLanguagesCKLS.length),
        languages: state.targetLanguagesCKLS.length,
        apiCallsSaved: 0,
      };
      setTranslationStats(stats);
    
      setState({ 
        translationInProgress: true,
        translationPaused: false,
        translationProgress: {
          current: 0,
          total: totalOperations,
          currentLang: '',
          phase: 'starting'
        }
      });

      try {
        const translations = await translateTextWithDeepL(
          state.textInput,
          state.sourceLanguageISO,
          state.targetLanguagesCKLS,
          apiKey,
          state.doNotTranslate,
          state.formalitySettings,
          state.useFormalitySettings,
          state.deeplStyleOptions,
          state.deeplCustomInstructions,
          state.deeplStyleRuleIds,
          state.useDeeplStyleRules,
          state.deeplRequestDelay,
          controller,
          (current, total, currentLang) => {
            setState({
              translationProgress: {
                current,
                total,
                currentLang,
                phase: 'translating'
              }
            });
          },
          state.detectedContentType === 'subtitle' ? 'plain' : (state.detectedContentType || 'plain'),
          state.jsonSchema || undefined
        );

        // Capture end time
        setTranslationStats(prev => prev ? { ...prev, endTime: Date.now() } : null);

        setState({ 
          translationInProgress: false,
          translationProgress: null,
          textTranslationResult: {
            translations,
            sourceText: state.textInput
          }
        });
      } catch (err: any) {
        if (err.message === 'Translation cancelled') {
          setError('Translation was cancelled');
        } else {
          setError(err.message || 'Translation failed');
        }
        
        setState({ 
          translationInProgress: false,
          translationProgress: null,
          translationPaused: false
        });
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load API key');
    }
  };

  // TMX export handler
  const handleExportToTmx = () => {
    try {
      if (subtitleTranslationResults.length === 0 || !state.subtitleFiles) {
        setError('No translation results to export');
        return;
      }

      // Extract source subtitles
      const sourceSubtitles = state.subtitleFiles.flatMap(file => 
        file.subtitles.map((sub: any) => sub.text)
      );

      // Extract translated subtitles by language
      const translatedSubtitles: Record<string, string[]> = {};
      
      state.targetLanguagesCKLS.forEach(lang => {
        translatedSubtitles[lang] = subtitleTranslationResults.flatMap(result => 
          result.translatedVersions[lang]?.map((sub: any) => sub.text) || []
        );
      });

      // Generate TMX content
      const tmxContent = exportToTmx(
        sourceSubtitles,
        translatedSubtitles,
        state.sourceLanguageISO
      );

      // Create and download TMX file
      const blob = new Blob([tmxContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subtitle-translations_${new Date().toISOString().split('T')[0]}.tmx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ TMX file exported successfully');
    } catch (err: any) {
      console.error('TMX export error:', err);
      setError(err.message || 'TMX export failed');
    }
  };

  // Subtitle download handler
  const handleDownloadSubtitles = async () => {
    try {
      if (subtitleTranslationResults.length === 0) {
        setError('No translation results to download');
        return;
      }

      // Load subtitle settings
      const settings = state.subtitleSettings || BBC_SUBTITLE_STANDARDS;

      const fileCount = state.subtitleFiles?.length || 0;
      const langCount = state.targetLanguagesCKLS.length;

      // If single file and single language, download as single file
      if (fileCount === 1 && langCount === 1) {
        const result = subtitleTranslationResults[0];
        const langCode = state.targetLanguagesCKLS[0];
        const translatedSubtitles = result.translatedVersions[langCode];

        if (!translatedSubtitles) {
          setError('Translation not found');
          return;
        }

        // Determine output format
        let outputFormat = result.format;
        if (settings.outputFormat === 'srt') outputFormat = 'srt';
        else if (settings.outputFormat === 'vtt') outputFormat = 'vtt';

        // Generate filename
        let baseFileName = result.fileName.replace(/\.(srt|vtt)$/i, '');
        if (settings.addLanguageCodeToFilename) {
          baseFileName += `_${langCode}`;
        }

        // Generate content
        const content = outputFormat === 'vtt'
          ? generateVttContent(translatedSubtitles as VttSubtitle[], result.vttMetadata, settings)
          : generateSrtContent(translatedSubtitles as SrtSubtitle[], settings);

        // Apply encoding
        const encodedContent = applyEncoding(content, settings.outputEncoding);

        // Create download
        const blob = new Blob([encodedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseFileName}.${outputFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Multiple files or languages - generate ZIP
        const zipBlob = await generateSubtitleZip(
          subtitleTranslationResults,
          state.targetLanguagesCKLS,
          settings
        );

        const filename = `subtitles_${fileCount}files_${langCount}langs.zip`;
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Subtitle download error:', err);
      setError(err.message || 'Download failed');
    }
  };

  // Helper function to format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Helper function to calculate speed (characters per minute)
  const calculateCharSpeed = (characters: number, durationMs: number): string => {
    const minutes = durationMs / 60000;
    const charsPerMin = characters / minutes;
    if (charsPerMin >= 1000) {
      return `${(charsPerMin / 1000).toFixed(1)}k`;
    }
    return Math.round(charsPerMin).toString();
  };
  
  // Helper to format large numbers
  const formatLargeNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  // Helper function to generate downloadable log file
  const generateTranslationLog = () => {
    if (!translationStats || !translationStats.endTime) return;
    
    const duration = translationStats.endTime - translationStats.startTime;
    const totalCharsTranslated = translationStats.totalCharacters * translationStats.languages;
    const charSpeed = calculateCharSpeed(totalCharsTranslated, duration);
    const savedPercentage = translationStats.totalStrings > 0
      ? Math.round((translationStats.duplicateStrings / translationStats.totalStrings) * 100)
      : 0;
    
    const timestamp = new Date(translationStats.startTime).toLocaleString();
    const service = selectedMethod === 'deepl' ? 'DeepL AI' : selectedMethod === 'google' ? 'Google Cloud Translation' : 'Excel';
    
    let log = `${'='.repeat(50)}\n`;
    log += `TRANSLATION LOG\n`;
    log += `${'='.repeat(50)}\n\n`;
    log += `Date: ${timestamp}\n`;
    log += `Mode: ${state.inputMode === 'subtitle' ? 'Subtitle' : state.inputMode === 'text' ? 'Text' : 'File'}\n`;
    log += `Service: ${service}\n\n`;
    
    // Files section
    if (state.inputMode === 'file' || state.inputMode === 'subtitle') {
      log += `FILES\n`;
      log += `${'-'.repeat(50)}\n`;
      if (state.multiFileMode) {
        state.filesData.forEach((file, idx) => {
          log += `${idx + 1}. ${file.fileName} (source: ${file.sourceCKLS})\n`;
        });
      } else if (state.inputMode === 'subtitle' && state.subtitleFiles) {
        state.subtitleFiles.forEach((file, idx) => {
          log += `${idx + 1}. ${file.fileName} (${file.format.toUpperCase()}, ${file.subtitles.length} subtitles)\n`;
        });
      } else if (state.filesData.length > 0) {
        log += `1. ${state.filesData[0].fileName} (source: ${state.filesData[0].sourceCKLS})\n`;
      }
      log += `\n`;
    }
    
    // Metrics section
    log += `METRICS\n`;
    log += `${'-'.repeat(50)}\n`;
    log += `Source Characters: ${translationStats.totalCharacters.toLocaleString()}\n`;
    log += `Total Characters (× ${translationStats.languages} languages): ${totalCharsTranslated.toLocaleString()}\n`;
    log += `Items Processed: ${translationStats.totalStrings.toLocaleString()}\n`;
    log += `Duplicates Saved: ${translationStats.duplicateStrings.toLocaleString()} (${savedPercentage}%)\n`;
    log += `\n`;
    
    // Performance section
    log += `PERFORMANCE\n`;
    log += `${'-'.repeat(50)}\n`;
    log += `Duration: ${formatDuration(duration)}\n`;
    log += `Speed: ${charSpeed} chars/minute\n`;
    log += `API Calls: ${(translationStats.uniqueStrings * translationStats.languages).toLocaleString()}\n`;
    log += `API Calls Saved: ${translationStats.apiCallsSaved.toLocaleString()} (via deduplication)\n`;
    if (translationStats.sourceCopiedRows && translationStats.sourceCopiedRows > 0) {
      log += `Source Content Copied: ${translationStats.sourceCopiedRows.toLocaleString()} rows (URLs, no translatable text)\n`;
    }
    log += `\n`;
    
    // Source Content Copied section
    if (translationStats.sourceCopiedRows && translationStats.sourceCopiedRows > 0) {
      log += `SOURCE CONTENT COPIED\n`;
      log += `${'-'.repeat(50)}\n`;
      log += `Rows with no translatable text (URLs, attributes, etc.)\n`;
      log += `These rows had source content copied directly to target\n`;
      log += `languages without translation.\n`;
      log += `Total Rows: ${translationStats.sourceCopiedRows.toLocaleString()}\n`;
      log += `\n`;
    }
    
    // Languages section
    log += `LANGUAGES COMPLETED\n`;
    log += `${'-'.repeat(50)}\n`;
    state.targetLanguagesCKLS.forEach((lang) => {
      log += `✓ ${lang} - ${translationStats.totalCharacters.toLocaleString()} characters\n`;
    });
    log += `\n`;
    log += `${'='.repeat(50)}\n`;
    log += `End of Translation Log\n`;
    log += `${'='.repeat(50)}\n`;
    
    // Download the log file
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translation-log-${new Date(translationStats.startTime).toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render translation stats
  const renderTranslationStats = () => {
    if (!translationStats || !translationStats.endTime) return null;
    
    const duration = translationStats.endTime - translationStats.startTime;
    const totalCharsTranslated = translationStats.totalCharacters * translationStats.languages;
    const charSpeed = calculateCharSpeed(totalCharsTranslated, duration);
    const savedPercentage = translationStats.totalStrings > 0
      ? Math.round((translationStats.duplicateStrings / translationStats.totalStrings) * 100)
      : 0;

    return (
      <div className="space-y-3 mt-4">
        {/* Compact Stats Grid - Smaller form factor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Total Characters */}
          <Card className="border">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatLargeNumber(totalCharsTranslated)}
              </div>
              <div className="text-xs text-muted-foreground">
                characters
              </div>
            </CardContent>
          </Card>

          {/* Saved Percentage */}
          <Card className="border">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center mb-1">
                <Zap className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-lg font-bold text-green-600">
                {savedPercentage}%
              </div>
              <div className="text-xs text-muted-foreground">
                saved
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card className="border">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center mb-1">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatDuration(duration)}
              </div>
              <div className="text-xs text-muted-foreground">
                duration
              </div>
            </CardContent>
          </Card>

          {/* Speed */}
          <Card className="border">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center mb-1">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <div className="text-lg font-bold text-foreground">
                {charSpeed}
              </div>
              <div className="text-xs text-muted-foreground">
                chars/min
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expandable Detailed Stats */}
        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
              <span className="text-sm font-medium">
                View detailed statistics
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-2">
                {/* Performance Metrics */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Performance Metrics
                  </h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Deduplication:</span>
                      <span className="font-medium text-foreground">
                        {translationStats.duplicateStrings} duplicates removed ({savedPercentage}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>API calls:</span>
                      <span className="font-medium text-foreground">
                        {(translationStats.uniqueStrings * translationStats.languages).toLocaleString()}
                        <span className="text-green-600 ml-1">
                          (saved {translationStats.apiCallsSaved.toLocaleString()})
                        </span>
                      </span>
                    </div>
                    {translationStats.tmxMatched && translationStats.tmxMatched > 0 && (
                      <div className="flex justify-between">
                        <span>TMX matches:</span>
                        <span className="font-medium text-foreground">
                          {translationStats.tmxMatched} 
                          <span className="text-blue-600 ml-1">
                            (saved {translationStats.tmxSavedApiCalls?.toLocaleString() || 0} API calls)
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Translation sources:</span>
                      <span className="font-medium text-foreground text-xs">
                        📚 Glossary
                        {state.predefinedTranslations.length > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({state.predefinedTranslations.length})
                          </span>
                        )}
                        {' • '}
                        ✏️ Corrections
                        {' • '}
                        🤖 API
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Translation speed:</span>
                      <span className="font-medium text-foreground">
                        {charSpeed} chars/minute
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Characters Processed */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Characters Processed
                  </h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Source:</span>
                      <span className="font-medium text-foreground">
                        {(translationStats.sourceCharacters || translationStats.totalCharacters).toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Translated total:</span>
                      <span className="font-medium text-foreground">
                        {(translationStats.translatedCharacters || (translationStats.totalCharacters * translationStats.languages)).toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average length:</span>
                      <span className="font-medium text-foreground">
                        {translationStats.uniqueStrings > 0
                          ? Math.round(translationStats.totalCharacters / translationStats.uniqueStrings)
                          : 0} chars/string
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Languages Completed */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <BookPlus className="w-4 h-4" />
                    Languages Completed
                  </h4>
                  <div className="space-y-1">
                    {state.targetLanguagesCKLS.map((lang) => {
                      const langResult = translationStats.languageResults?.[lang];
                      const successRate = langResult?.successRate ?? 100;
                      
                      return (
                        <div key={lang} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {successRate === 100 ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : successRate >= 90 ? (
                              <AlertCircle className="w-4 h-4 text-yellow-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="font-medium">{lang}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatLargeNumber(translationStats.totalCharacters)} chars ({successRate}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Download Log Button */}
        <Button 
          onClick={generateTranslationLog}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <FileText className="w-4 h-4 mr-2" />
          Download Translation Log
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {(error.includes('not configured') || error.includes('not validated')) 
              ? 'Configuration Required' 
              : 'Error'}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            {(error.includes('not configured') || error.includes('not validated')) && (
              <Button
                onClick={() => openOptionsPage('api-keys')}
                size="sm"
                variant="default"
                className="shrink-0"
              >
                Setup
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* METHOD SELECTION - Dynamic based on enabled translators */}
      <Tabs value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as TranslationMethod)}>
        <div className="flex gap-2 mb-4">
          {/* DeepL - Always visible */}
          <button
            onClick={() => setSelectedMethod('deepl')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'deepl'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
            }`}
          >
            <Zap className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">DeepL</span>
            {apiStatus.deeplValidated ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
              </span>
            )}
          </button>

          {/* Google - Only if enabled */}
          {enabledTranslators.google && (
            <button
              onClick={() => setSelectedMethod('google')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selectedMethod === 'google'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <Cloud className="w-6 h-6 text-orange-500" />
              <span className="text-sm font-medium">Google</span>
              {apiStatus.googleValidated ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
                </span>
              )}
            </button>
          )}

          {/* Excel - Only if enabled */}
          {enabledTranslators.excel && (
            <button
              onClick={() => setSelectedMethod('excel')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selectedMethod === 'excel'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <Table className="w-6 h-6 text-green-600" />
              <span className="text-sm font-medium">Excel</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </button>
          )}

          {/* Add more translators button */}
          {(!enabledTranslators.google || !enabledTranslators.excel) && (
            <button
              onClick={() => openOptionsPage('api-keys')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30 transition-all min-w-[100px]"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add more...</span>
            </button>
          )}
        </div>

        {/* Hidden TabsList for Tabs component to work */}
        <TabsList className="hidden">
          <TabsTrigger value="deepl">DeepL</TabsTrigger>
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="excel">Excel</TabsTrigger>
        </TabsList>

        {/* DEEPL TAB */}
        <TabsContent value="deepl" className="space-y-4">
          {/* API Key Required Alert - only shown when not validated */}
          {!apiStatus.deeplValidated && (
            <>
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">
                  DeepL API Key Required
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  To use DeepL AI translation, you need to configure your API key.
                </AlertDescription>
              </Alert>

              <ApiKeyInput
                service="deepl"
                value={state.deeplApiKey}
                isValidated={apiStatus.deeplValidated}
                onChange={(value) => {
                  setState({ deeplApiKey: value });
                  setDeeplValidationState({ isValidating: false, validationError: null, validationMessage: null });
                }}
                onValidate={handleValidateDeepLKey}
                validationError={deeplValidationState.validationError}
                validationMessage={deeplValidationState.validationMessage}
              />
            </>
          )}

      {/* Google - API Key Required */}
      {selectedMethod === 'google' && !apiStatus.googleValidated && (
        <div className="space-y-4">
          <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  Google Cloud Translation API Key Required
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  To use Google Cloud Translation, you need to configure your API key.
                </p>
              </div>
            </div>
          </Card>

          <ApiKeyInput
            service="google"
            value={state.googleApiKey}
            isValidated={apiStatus.googleValidated}
            onChange={(value) => {
              setState({ googleApiKey: value });
              setGoogleValidationState({ isValidating: false, validationError: null, validationMessage: null });
            }}
            onValidate={handleValidateGoogleKey}
            validationError={googleValidationState.validationError}
            validationMessage={googleValidationState.validationMessage}
          />
        </div>
      )}

          {/* Ready to Translate - Only show if API is validated and no translation in progress */}
          {apiStatus.deeplValidated && !state.translationInProgress && !deeplTranslationResult && !state.textTranslationResult && subtitleTranslationResults.length === 0 && (() => {
            // Text mode
            if (state.inputMode === 'text') {
              const textTotalChars = state.textInput.length * state.targetLanguagesCKLS.length;
              return (
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-1 h-6 bg-blue-600 rounded-full" />
                      Ready to Translate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Text Preview */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Source Text Preview:</p>
                      <div className="p-3 bg-muted rounded-lg border max-h-24 overflow-y-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                          {state.textInput.slice(0, 300)}
                          {state.textInput.length > 300 && '...'}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Stats Grid - 2 columns for text mode */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <Type className="w-5 h-5 text-blue-600 mb-2" />
                        <span className="text-2xl font-bold">{state.textInput.length.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">source chars</span>
                      </div>
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <Type className="w-5 h-5 text-emerald-600 mb-2" />
                        <span className="text-2xl font-bold">{formatLargeNumber(textTotalChars)}</span>
                        <span className="text-xs text-muted-foreground">total chars</span>
                      </div>
                    </div>
                    
                    {/* Language Flow - Compact Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Source Language */}
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
                        <span className="text-sm font-bold font-mono">{state.sourceLanguageCKLS}</span>
                        <span className="text-xs text-muted-foreground">source</span>
                      </div>

                      {/* Target Languages */}
                      <div className="flex flex-col items-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                        <BookPlus className="w-5 h-5 text-violet-600 mb-2" />
                        <span className="text-sm font-bold font-mono text-center">
                          {state.targetLanguagesCKLS.length <= 2 
                            ? state.targetLanguagesCKLS.join(', ')
                            : `${state.targetLanguagesCKLS.length} langs`
                          }
                        </span>
                        <span className="text-xs text-violet-700 dark:text-violet-300">new</span>
                      </div>
                    </div>
                    
                    {/* Start Button */}
                    <Button 
                      onClick={handleStartDeepLTextTranslation} 
                      className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                      size="lg"
                    >
                      <Zap className="w-5 h-5 mr-2" />
                      Start Translation
                    </Button>
                  </CardContent>
                </Card>
              );
            }
            
            // File/Subtitle mode
            const totalStrings = state.inputMode === 'subtitle'
              ? (state.subtitleFiles?.reduce((sum, file) => sum + file.subtitles.length, 0) || 0)
              : state.multiFileMode 
                ? ((state.deduplicationStats?.actualStringsToTranslate ?? state.deduplicationStats?.uniqueStrings) || 0)
                : ((state.deduplicationStats?.actualStringsToTranslate ?? state.deduplicationStats?.totalStrings) || 0);

            const fileCount = state.inputMode === 'subtitle'
              ? (state.subtitleFiles?.length || 0)
              : state.multiFileMode 
                ? state.filesData.length 
                : 1;

            const totalCharacters = (state.deduplicationStats?.totalCharacters || 0) * state.targetLanguagesCKLS.length;

            return (
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    Ready to Translate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats Grid - 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Files */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <Files className="w-5 h-5 text-blue-600 mb-2" />
                      <span className="text-2xl font-bold">{fileCount}</span>
                      <span className="text-xs text-muted-foreground">
                          {state.inputMode === 'subtitle' 
                          ? (fileCount !== 1 ? 'files' : 'file')
                            : (fileCount !== 1 ? 'files' : 'file')
                          }
                      </span>
                        </div>

                    {/* Strings */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <FileText className="w-5 h-5 text-purple-600 mb-2" />
                      <span className="text-2xl font-bold">{totalStrings.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                          {state.inputMode === 'subtitle' ? 'subtitles' : 'strings'}
                      </span>
                        </div>

                    {/* Characters */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <Type className="w-5 h-5 text-emerald-600 mb-2" />
                      <span className="text-2xl font-bold">{formatLargeNumber(totalCharacters)}</span>
                      <span className="text-xs text-muted-foreground">characters</span>
                    </div>
                  </div>

                  {/* Language Flow - Compact Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Source Language */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
                      <span className="text-sm font-bold font-mono">{state.sourceLanguageCKLS || '?'}</span>
                      <span className="text-xs text-muted-foreground">source</span>
                    </div>

                    {/* Existing Languages */}
                    {state.detectedExisting.length > 0 ? (
                      <div className="flex flex-col items-center p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <BookCheck className="w-5 h-5 text-green-600 mb-2" />
                        <span className="text-sm font-bold font-mono text-center">
                          {state.detectedExisting.length <= 2 
                            ? state.detectedExisting.join(', ')
                            : `${state.detectedExisting.length} langs`
                          }
                        </span>
                        <span className="text-xs text-green-700 dark:text-green-300">
                          {state.overwriteMode === 'keep-all' ? 'kept' : 'update'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/30 border border-dashed">
                        <BookCheck className="w-5 h-5 text-muted-foreground mb-2" />
                        <span className="text-sm font-bold text-muted-foreground">—</span>
                        <span className="text-xs text-muted-foreground">existing</span>
                      </div>
                    )}

                    {/* Target Languages */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                      <BookPlus className="w-5 h-5 text-violet-600 mb-2" />
                      <span className="text-sm font-bold font-mono text-center">
                        {state.targetLanguagesCKLS.length <= 2 
                          ? state.targetLanguagesCKLS.join(', ')
                          : `${state.targetLanguagesCKLS.length} langs`
                        }
                      </span>
                      <span className="text-xs text-violet-700 dark:text-violet-300">new</span>
                    </div>
                  </div>

                  {/* Start Button */}
                  <Button 
                    onClick={handleStartDeepLTranslation} 
                    className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Start Translation
                  </Button>
                </CardContent>
              </Card>
            );
          })()}

          {/* Translation Progress - shared with Google */}
          {state.translationInProgress && state.translationProgress && (() => {
            // Extract current file information for multi-file mode
            const match = state.translationProgress.phase.match(/file (\d+)\//);
            const fileIndex = match ? parseInt(match[1], 10) - 1 : 0;
            const currentFileData = state.filesData[fileIndex];
            
            // Calculate current file progress
            let currentFileProgress = 0;
            if (state.multiFileMode && fileIndex >= 0) {
              // Sum strings from all previous files
              const previousFilesTotal = state.filesData
                .slice(0, fileIndex)
                .reduce((sum, f) => sum + (f.stringCount || 0), 0);
              
              // Current file progress = overall current - all previous files
              currentFileProgress = Math.max(0, state.translationProgress.current - previousFilesTotal);
              
              // Clamp to current file's max
              if (currentFileData?.stringCount) {
                currentFileProgress = Math.min(currentFileProgress, currentFileData.stringCount);
              }
            }
            
            return (
              <TranslationProgress
                current={state.translationProgress.current}
                total={state.translationProgress.total}
                currentLanguage={state.translationProgress.currentLang}
                phase={state.translationProgress.phase}
                isPaused={state.translationPaused}
                onPause={handlePauseDeepLTranslation}
                onResume={handleResumeDeepLTranslation}
                onCancel={handleCancelDeepLTranslation}
                fileCount={state.multiFileMode ? state.filesData.length : undefined}
                currentFile={state.multiFileMode && match ? parseInt(match[1], 10) : undefined}
                currentFileName={state.multiFileMode && currentFileData ? currentFileData.fileName : undefined}
                currentFileStrings={state.multiFileMode && currentFileData ? currentFileData.stringCount : undefined}
                totalStringsAcrossFiles={state.multiFileMode ? 
                  state.filesData.reduce((sum, fileData) => sum + (fileData.stringCount || 0), 0) 
                  : undefined}
                currentFileProgress={state.multiFileMode ? currentFileProgress : undefined}
              />
            );
          })()}

          {/* Text Translation Complete */}
          {state.textTranslationResult && !state.translationInProgress && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Translation Complete!
              </AlertTitle>
              <AlertDescription className="space-y-4 mt-3">
                <p className="text-green-800 dark:text-green-200">
                  Your text has been translated into {state.targetLanguagesCKLS.length}{' '}
                  {state.targetLanguagesCKLS.length === 1 ? 'language' : 'languages'}.
                </p>

                {/* Translation Stats */}
                {renderTranslationStats()}

                <Separator className="bg-green-200 dark:bg-green-900" />

                {/* Accordion Results */}
                <div className="space-y-2">
                  {Object.entries(state.textTranslationResult.translations).map(([lang, text]) => {
                    const isExpanded = expandedLang === lang;
                    const isCopied = copiedLang === lang;
                    
                    return (
                      <div key={lang} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                        <button
                          onClick={() => setExpandedLang(isExpanded ? null : lang)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{lang}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {(text as string).length} characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(text as string);
                                setCopiedLang(lang);
                                setTimeout(() => setCopiedLang(null), 2000);
                              }}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t">
                            <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-muted p-3 rounded max-h-64 overflow-y-auto">
                              {text as string}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button 
                  onClick={handleDownloadTextResults}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {state.detectedContentType === 'json' && state.jsonSchema 
                    ? (state.textTranslationResult && Object.keys(state.textTranslationResult.translations).length === 1
                        ? 'Download JSON File'
                        : 'Download All as ZIP (JSON Files)')
                    : 'Download All as TXT File'
                  }
                </Button>

                <Button
                  onClick={handleGenerateTextReviewFile}
                  disabled={isGeneratingReview}
                  className="w-full"
                  variant="outline"
                  size="lg"
                >
                  {isGeneratingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Export for Review
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => {
                    setTranslationStats(null);
                    setState({ 
                      textTranslationResult: null,
                      textInput: '',
                      translationInProgress: false
                    });
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start New Translation
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {/* File/Subtitle Translation Complete (DeepL) */}
          {(deeplTranslationResult || subtitleTranslationResults.length > 0) && !state.translationInProgress && !state.textTranslationResult && (
            <Card className="overflow-hidden border-green-200 dark:border-green-800">
              <CardHeader className="pb-4 bg-green-50 dark:bg-green-950/20">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Translation Complete!
                </CardTitle>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {state.inputMode === 'subtitle' && subtitleTranslationResults.length > 0 ? (
                    <>
                      Successfully translated {state.subtitleFiles?.length || 0} file
                      {(state.subtitleFiles?.length || 0) !== 1 ? 's' : ''} into{' '}
                      {state.targetLanguagesCKLS.length} language{state.targetLanguagesCKLS.length !== 1 ? 's' : ''}.
                    </>
                  ) : (
                    <>
                      Successfully translated {state.multiFileMode ? state.filesData.length : 1} file
                      {(state.multiFileMode ? state.filesData.length : 1) !== 1 ? 's' : ''} into{' '}
                      {state.targetLanguagesCKLS.length} language{state.targetLanguagesCKLS.length !== 1 ? 's' : ''}.
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Stats Grid - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Strings */}
                  <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                    <FileText className="w-5 h-5 text-blue-600 mb-2" />
                    <span className="text-2xl font-bold">
                      {(translationStats?.totalStrings || state.deduplicationStats?.totalStrings || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">strings</span>
                  </div>

                  {/* API Efficiency */}
                  <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                    <Zap className="w-5 h-5 text-green-600 mb-2" />
                    <span className="text-2xl font-bold text-green-600">
                      {translationStats?.apiCallsSaved && translationStats?.totalStrings
                        ? `${Math.round((translationStats.apiCallsSaved / (translationStats.totalStrings * state.targetLanguagesCKLS.length)) * 100)}%`
                        : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">saved</span>
                  </div>
                </div>

                {/* Generated File */}
                {state.lastGeneratedXmlFileName && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm truncate font-medium">
                      {state.lastGeneratedXmlFileName}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                {state.inputMode === 'subtitle' && subtitleTranslationResults.length > 0 ? (
                  <>
                    <Button 
                      onClick={handleDownloadSubtitles}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {(state.subtitleFiles?.length === 1 && state.targetLanguagesCKLS.length === 1)
                        ? `Download Translated Subtitle (.${state.subtitleFiles[0].format})`
                        : 'Download Translated Subtitles (ZIP)'
                      }
                    </Button>

                    <Button 
                      onClick={handleExportToTmx}
                      className="w-full"
                      variant="outline"
                      size="lg"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Export as TMX
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        setTranslationStats(null);
                        setSubtitleTranslationResults([]);
                        setState({
                          subtitleFiles: undefined,
                          subtitleDeduplicationStats: undefined,
                          inputMode: 'file',
                          filesData: [],
                          workbook: null,
                          sourceLanguageISO: '',
                          sourceLanguageCKLS: '',
                          targetLanguagesCKLS: [],
                          detectedExisting: []
                        });
                        if (onResetToStep1) {
                          onResetToStep1();
                        }
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Start New Translation
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={handleDownloadDeepLXml}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {Array.isArray(deeplTranslationResult) && deeplTranslationResult.length > 1 
                        ? 'Download ZIP File' 
                        : 'Download XML File'}
                    </Button>

                    <Button
                      onClick={handleGenerateReviewFile}
                      disabled={!translatedWorkbook || !translationStats || isGeneratingReview}
                      className="w-full"
                      variant="outline"
                      size="lg"
                    >
                      {isGeneratingReview ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4 mr-2" />
                          Export for Review
                        </>
                      )}
                    </Button>

                    {/* Translation Stats - compact cards, accordion, and log grouped together */}
                    {renderTranslationStats()}

                    <Button 
                      onClick={() => {
                        setTranslationStats(null);
                        setDeeplTranslationResult(null);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Start New Translation
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GOOGLE TAB */}
        <TabsContent value="google" className="space-y-4">
          {/* API Status Alert */}
          {apiStatus.googleValidated ? (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-900 dark:text-green-100">Google Cloud Translation Connected</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                API key validated and ready to use
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">
                  Google Cloud Translation API Key Required
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  To use Google Cloud Translation, you need to configure your API key.
                </AlertDescription>
              </Alert>

              <ApiKeyInput
                service="google"
                value={state.googleApiKey}
                isValidated={apiStatus.googleValidated}
                onChange={(value) => {
                  setState({ googleApiKey: value });
                  setGoogleValidationState({ isValidating: false, validationError: null, validationMessage: null });
                }}
                onValidate={handleValidateGoogleKey}
                validationError={googleValidationState.validationError}
                validationMessage={googleValidationState.validationMessage}
              />
            </>
          )}

          {/* Ready to Translate */}
          {apiStatus.googleValidated && !state.translationInProgress && !googleTranslationResult && !state.textTranslationResult && subtitleTranslationResults.length === 0 && (() => {
            // Text mode
            if (state.inputMode === 'text') {
              const textTotalChars = state.textInput.length * state.targetLanguagesCKLS.length;
              return (
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-1 h-6 bg-orange-600 rounded-full" />
                      Ready to Translate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Text Preview */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Source Text Preview:</p>
                      <div className="p-3 bg-muted rounded-lg border max-h-24 overflow-y-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                          {state.textInput.slice(0, 300)}
                          {state.textInput.length > 300 && '...'}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Stats Grid - 2 columns for text mode */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <Type className="w-5 h-5 text-orange-600 mb-2" />
                        <span className="text-2xl font-bold">{state.textInput.length.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">source chars</span>
                      </div>
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <Type className="w-5 h-5 text-emerald-600 mb-2" />
                        <span className="text-2xl font-bold">{formatLargeNumber(textTotalChars)}</span>
                        <span className="text-xs text-muted-foreground">total chars</span>
                      </div>
                    </div>
                    
                    {/* Language Flow - Compact Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Source Language */}
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                        <BookOpen className="w-5 h-5 text-orange-600 mb-2" />
                        <span className="text-sm font-bold font-mono">{state.sourceLanguageCKLS}</span>
                        <span className="text-xs text-muted-foreground">source</span>
                      </div>

                      {/* Target Languages */}
                      <div className="flex flex-col items-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                        <BookPlus className="w-5 h-5 text-violet-600 mb-2" />
                        <span className="text-sm font-bold font-mono text-center">
                          {state.targetLanguagesCKLS.length <= 2 
                            ? state.targetLanguagesCKLS.join(', ')
                            : `${state.targetLanguagesCKLS.length} langs`
                          }
                        </span>
                        <span className="text-xs text-violet-700 dark:text-violet-300">new</span>
                      </div>
                    </div>
                    
                    {/* Start Button */}
                    <Button 
                      onClick={handleStartGoogleTextTranslation} 
                      className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                      size="lg"
                    >
                      <Cloud className="w-5 h-5 mr-2" />
                      Start Translation
                    </Button>
                  </CardContent>
                </Card>
              );
            }
            
            // File/Subtitle mode
            const totalStrings = state.inputMode === 'subtitle'
              ? (state.subtitleFiles?.reduce((sum, file) => sum + file.subtitles.length, 0) || 0)
              : state.multiFileMode 
                ? ((state.deduplicationStats?.actualStringsToTranslate ?? state.deduplicationStats?.uniqueStrings) || 0)
                : ((state.deduplicationStats?.actualStringsToTranslate ?? state.deduplicationStats?.totalStrings) || 0);

            const fileCount = state.inputMode === 'subtitle'
              ? (state.subtitleFiles?.length || 0)
              : state.multiFileMode 
                ? state.filesData.length 
                : 1;

            const totalCharacters = (state.deduplicationStats?.totalCharacters || 0) * state.targetLanguagesCKLS.length;

            return (
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-1 h-6 bg-orange-600 rounded-full" />
                    Ready to Translate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats Grid - 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Files */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <Files className="w-5 h-5 text-orange-600 mb-2" />
                      <span className="text-2xl font-bold">{fileCount}</span>
                      <span className="text-xs text-muted-foreground">
                          {state.inputMode === 'subtitle' 
                          ? (fileCount !== 1 ? 'files' : 'file')
                            : (fileCount !== 1 ? 'files' : 'file')
                          }
                      </span>
                        </div>

                    {/* Strings */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <FileText className="w-5 h-5 text-purple-600 mb-2" />
                      <span className="text-2xl font-bold">{totalStrings.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                          {state.inputMode === 'subtitle' ? 'subtitles' : 'strings'}
                      </span>
                        </div>

                    {/* Characters */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <Type className="w-5 h-5 text-emerald-600 mb-2" />
                      <span className="text-2xl font-bold">{formatLargeNumber(totalCharacters)}</span>
                      <span className="text-xs text-muted-foreground">characters</span>
                    </div>
                  </div>

                  {/* Language Flow - Compact Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Source Language */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                      <BookOpen className="w-5 h-5 text-orange-600 mb-2" />
                      <span className="text-sm font-bold font-mono">{state.sourceLanguageCKLS || '?'}</span>
                      <span className="text-xs text-muted-foreground">source</span>
                    </div>

                    {/* Existing Languages */}
                    {state.detectedExisting.length > 0 ? (
                      <div className="flex flex-col items-center p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <BookCheck className="w-5 h-5 text-green-600 mb-2" />
                        <span className="text-sm font-bold font-mono text-center">
                          {state.detectedExisting.length <= 2 
                            ? state.detectedExisting.join(', ')
                            : `${state.detectedExisting.length} langs`
                          }
                        </span>
                        <span className="text-xs text-green-700 dark:text-green-300">
                          {state.overwriteMode === 'keep-all' ? 'kept' : 'update'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center p-4 rounded-xl bg-muted/30 border border-dashed">
                        <BookCheck className="w-5 h-5 text-muted-foreground mb-2" />
                        <span className="text-sm font-bold text-muted-foreground">—</span>
                        <span className="text-xs text-muted-foreground">existing</span>
                      </div>
                    )}

                    {/* Target Languages */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                      <BookPlus className="w-5 h-5 text-violet-600 mb-2" />
                      <span className="text-sm font-bold font-mono text-center">
                        {state.targetLanguagesCKLS.length <= 2 
                          ? state.targetLanguagesCKLS.join(', ')
                          : `${state.targetLanguagesCKLS.length} langs`
                        }
                      </span>
                      <span className="text-xs text-violet-700 dark:text-violet-300">new</span>
                    </div>
                  </div>

                  {/* Start Button */}
                  <Button 
                    onClick={handleStartGoogleTranslation} 
                    className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    <Cloud className="w-5 h-5 mr-2" />
                    Start Translation
                  </Button>
                </CardContent>
              </Card>
            );
          })()}

          {/* Translation Progress */}
          {state.translationInProgress && state.translationProgress && (() => {
            // Extract current file information for multi-file mode
            const match = state.translationProgress.phase.match(/file (\d+)\//);
            const fileIndex = match ? parseInt(match[1], 10) - 1 : 0;
            const currentFileData = state.filesData[fileIndex];
            
            // Calculate current file progress
            let currentFileProgress = 0;
            if (state.multiFileMode && fileIndex >= 0) {
              // Sum strings from all previous files
              const previousFilesTotal = state.filesData
                .slice(0, fileIndex)
                .reduce((sum, f) => sum + (f.stringCount || 0), 0);
              
              // Current file progress = overall current - all previous files
              currentFileProgress = Math.max(0, state.translationProgress.current - previousFilesTotal);
              
              // Clamp to current file's max
              if (currentFileData?.stringCount) {
                currentFileProgress = Math.min(currentFileProgress, currentFileData.stringCount);
              }
            }
            
            return (
              <TranslationProgress
                current={state.translationProgress.current}
                total={state.translationProgress.total}
                currentLanguage={state.translationProgress.currentLang}
                phase={state.translationProgress.phase}
                isPaused={state.translationPaused}
                onPause={handlePauseGoogleTranslation}
                onResume={handleResumeGoogleTranslation}
                onCancel={handleCancelGoogleTranslation}
                fileCount={state.multiFileMode ? state.filesData.length : undefined}
                currentFile={state.multiFileMode && match ? parseInt(match[1], 10) : undefined}
                currentFileName={state.multiFileMode && currentFileData ? currentFileData.fileName : undefined}
                currentFileStrings={state.multiFileMode && currentFileData ? currentFileData.stringCount : undefined}
                totalStringsAcrossFiles={state.multiFileMode ? 
                  state.filesData.reduce((sum, fileData) => sum + (fileData.stringCount || 0), 0) 
                  : undefined}
                currentFileProgress={state.multiFileMode ? currentFileProgress : undefined}
              />
            );
          })()}

          {/* Text Translation Complete (Google) */}
          {state.textTranslationResult && !state.translationInProgress && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Translation Complete!
              </AlertTitle>
              <AlertDescription className="space-y-4 mt-3">
                <p className="text-green-800 dark:text-green-200">
                  Your text has been translated into {state.targetLanguagesCKLS.length}{' '}
                  {state.targetLanguagesCKLS.length === 1 ? 'language' : 'languages'}.
                </p>

                {/* Translation Stats */}
                {renderTranslationStats()}

                <Separator className="bg-green-200 dark:bg-green-900" />

                {/* Accordion Results */}
                <div className="space-y-2">
                  {Object.entries(state.textTranslationResult.translations).map(([lang, text]) => {
                    const isExpanded = expandedLang === lang;
                    const isCopied = copiedLang === lang;
                    
                    return (
                      <div key={lang} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                        <button
                          onClick={() => setExpandedLang(isExpanded ? null : lang)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{lang}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {(text as string).length} characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(text as string);
                                setCopiedLang(lang);
                                setTimeout(() => setCopiedLang(null), 2000);
                              }}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t">
                            <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-muted p-3 rounded max-h-64 overflow-y-auto">
                              {text as string}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button 
                  onClick={handleDownloadTextResults}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {state.detectedContentType === 'json' && state.jsonSchema 
                    ? (state.textTranslationResult && Object.keys(state.textTranslationResult.translations).length === 1
                        ? 'Download JSON File'
                        : 'Download All as ZIP (JSON Files)')
                    : 'Download All as TXT File'
                  }
                </Button>

                <Button
                  onClick={handleGenerateTextReviewFile}
                  disabled={isGeneratingReview}
                  className="w-full"
                  variant="outline"
                  size="lg"
                >
                  {isGeneratingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Export for Review
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => {
                    setTranslationStats(null);
                    setState({ 
                      textTranslationResult: null,
                      textInput: '',
                      translationInProgress: false
                    });
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start New Translation
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {/* File Translation Complete (Google) */}
          {googleTranslationResult && !state.translationInProgress && !state.textTranslationResult && (
            <Card className="overflow-hidden border-green-200 dark:border-green-800">
              <CardHeader className="pb-4 bg-green-50 dark:bg-green-950/20">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Translation Complete!
                </CardTitle>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {Array.isArray(googleTranslationResult) ? (
                    <>
                      Successfully translated {state.filesData.length} file{state.filesData.length !== 1 ? 's' : ''} into{' '}
                      {state.targetLanguagesCKLS.length} language{state.targetLanguagesCKLS.length !== 1 ? 's' : ''}.
                    </>
                  ) : (
                    <>
                      Successfully translated {googleTranslationResult.translatedCount} strings 
                      into {state.targetLanguagesCKLS.length} language{state.targetLanguagesCKLS.length !== 1 ? 's' : ''}.
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Stats Grid - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Strings */}
                  <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                    <FileText className="w-5 h-5 text-orange-600 mb-2" />
                    <span className="text-2xl font-bold">
                      {(translationStats?.totalStrings || state.deduplicationStats?.totalStrings || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">strings</span>
                  </div>

                  {/* API Efficiency */}
                  <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border">
                    <Zap className="w-5 h-5 text-green-600 mb-2" />
                    <span className="text-2xl font-bold text-green-600">
                      {translationStats?.apiCallsSaved && translationStats?.totalStrings
                        ? `${Math.round((translationStats.apiCallsSaved / (translationStats.totalStrings * state.targetLanguagesCKLS.length)) * 100)}%`
                        : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">saved</span>
                  </div>
                </div>

                {/* Generated File */}
                {state.lastGeneratedXmlFileName && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm truncate font-medium">
                      {state.lastGeneratedXmlFileName}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <Button 
                  onClick={handleDownloadGoogleXml}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {Array.isArray(googleTranslationResult) && googleTranslationResult.length > 1 
                    ? 'Download ZIP File' 
                    : 'Download XML File'}
                </Button>

                <Button
                  onClick={handleGenerateReviewFile}
                  disabled={!translatedWorkbook || !translationStats || isGeneratingReview}
                  className="w-full"
                  variant="outline"
                  size="lg"
                >
                  {isGeneratingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Export for Review
                    </>
                  )}
                </Button>

                {/* Translation Stats - compact cards, accordion, and log grouped together */}
                {renderTranslationStats()}

                <Button 
                  onClick={() => {
                    setTranslationStats(null);
                    setGoogleTranslationResult(null);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start New Translation
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EXCEL TAB */}
        <TabsContent value="excel" className="space-y-4">
          <div>
            <h4 className="text-base font-semibold mb-1">Excel Builder Workflow</h4>
            <p className="text-sm text-muted-foreground">
              Generate Excel with formulas → Translate in Excel → Generate final XML
            </p>
          </div>

          {/* Phase: Initial - Generate Excel */}
          {excelPhase === 'initial' && (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-1">Generate Excel with Formulas</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Create an Excel file with TRANSLATE() or COPILOT() formulas based on your configuration
                    </p>
                    <Button 
                      onClick={handleGenerateExcel} 
                      disabled={isGenerating}
                      className="w-full"
                      size="default"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Generate Excel File
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Phase: Excel Generated - Instructions & Upload */}
          {excelPhase === 'excel-generated' && (
            <>
              <Card className="p-4 bg-success/10 border-success/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-success-foreground mb-1">
                      Excel File Generated!
                    </h4>
                    <p className="text-xs text-success-foreground/80 mb-2">
                      <span className="font-mono font-medium">{generatedExcelFile}</span>
                    </p>
                    {multiFileExcelStats && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-success-foreground">
                          <FileText className="w-3 h-3" />
                          <span className="font-semibold">{multiFileExcelStats.uniqueStrings.toLocaleString()}</span>
                          <span>unique strings</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-success-foreground">
                          <Files className="w-3 h-3" />
                          <span className="font-semibold">{multiFileExcelStats.totalFiles}</span>
                          <span>{multiFileExcelStats.totalFiles === 1 ? 'file' : 'files'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-2">Open in Excel & Translate</h4>
                      {multiFileExcelStats && (
                        <p className="text-xs text-muted-foreground mb-2">
                          This Excel contains deduplicated unique strings from all {multiFileExcelStats.totalFiles} files. 
                          Translations will be distributed to each file automatically.
                        </p>
                      )}
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Open the downloaded file in Excel (Desktop or Excel Online)</li>
                        <li>Wait for formulas to auto-translate (may take a few minutes)</li>
                        <li>Review and edit translations if needed</li>
                        <li>Save the file</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-2">Upload Translated Excel</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload the Excel file after formulas have calculated
                      </p>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="excel-upload"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGenerating}
                        className="w-full"
                        size="default"
                        variant="outline"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Translated Excel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Phase: Excel Uploaded - Generate Final XML */}
          {excelPhase === 'excel-uploaded' && (
            <>
              <Card className="p-4 bg-success/10 border-success/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-success-foreground mb-1">
                      Translated Excel Uploaded!
                    </h4>
                    <p className="text-xs text-success-foreground/80">
                      <FileSpreadsheet className="w-3 h-3 inline mr-1" />
                      <span className="font-mono font-medium">{uploadedFileName}</span>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">4</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-2">
                        {state.inputMode === 'text' 
                          ? 'Generate Final TXT' 
                          : multiFileExcelStats ? 'Generate Final XMLs' : 'Generate Final XML'}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {state.inputMode === 'text' ? (
                          'Create the final TXT file with all translations'
                        ) : multiFileExcelStats ? (
                          <>
                            Create a ZIP file containing {multiFileExcelStats.totalFiles} XML files, 
                            one for each original source file, ready to upload to CKLS
                          </>
                        ) : (
                          'Create the final XML file ready to upload to CKLS'
                        )}
                      </p>
                      <Button 
                        onClick={handleGenerateFinalXML} 
                        disabled={isGenerating}
                        className="w-full"
                        size="default"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {state.inputMode === 'text' 
                              ? 'Generating TXT...'
                              : multiFileExcelStats ? 'Generating ZIP...' : 'Generating XML...'}
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            {state.inputMode === 'text'
                              ? 'Generate Final TXT'
                              : multiFileExcelStats ? 'Generate ZIP with XMLs' : 'Generate Final XML'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {state.lastGeneratedXmlFileName && (
                <Card className="p-4 bg-info/10 border-info/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-info-foreground mb-1">
                        {state.inputMode === 'text' ? (
                          <>Success! TXT File Generated</>
                        ) : multiFileExcelStats ? (
                          <>Success! ZIP File Generated with {multiFileExcelStats.totalFiles} XMLs</>
                        ) : (
                          <>Success! XML File Generated</>
                        )}
                      </h4>
                      <p className="text-xs text-info-foreground/80 mb-2">
                        <span className="font-mono font-medium">{state.lastGeneratedXmlFileName}</span>
                      </p>
                      <p className="text-xs text-info-foreground/80">
                        {state.inputMode === 'text' ? (
                          <>Your TXT file contains all translations. You can now save it or start over with a new text.</>
                        ) : multiFileExcelStats ? (
                          <>
                            Your ZIP file contains {multiFileExcelStats.totalFiles} XML files ready to upload to CKLS. 
                            Extract the ZIP and upload each XML file to its corresponding CKLS content.
                          </>
                        ) : (
                          <>Your file is ready to upload to CKLS. You can now upload it or start over with a new file.</>
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <Button 
                onClick={handleStartOver} 
                variant="outline"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}

