import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { FileUpload } from './FileUpload';
import { LanguagePicker } from './LanguagePicker';
import { FileList } from './FileList';
import { processMultipleFiles, calculateDeduplicationStats } from '@/modules/MultiFileHandler';
import { detectLanguageWithAI, isoToCkls } from '@/utils/languageDetection';
import { extractISOCode } from '@/utils/languageCodeConverter';
import { analyzeLanguageCompletion, aggregateCompletionStats } from '@/utils/languageAnalysis';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText, AlertCircle, CheckCircle2, X, Languages, File, Info } from 'lucide-react';
import { PageContext, getCurrentPageContext } from '@/utils/pageDetection';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from 'sonner';
import { parseSrtFileFromFile } from '@/modules/SrtParser';
import { parseVttFileFromFile } from '@/modules/VttParser';
import { validateSubtitleBatch, validateFileSize } from '@/modules/SubtitleValidator';
import { analyzeTimingIssues } from '@/modules/SubtitleTimingAnalyzer';
import { SubtitleValidationModal } from './SubtitleValidationModal';
import { BBC_SUBTITLE_STANDARDS } from '@/types/subtitle';
import type { SubtitleFileData, SubtitleSettings } from '@/types/subtitle';

interface Step1Props {
  onComplete: () => void;
  onIncomplete: () => void;
  pageContext: PageContext;
}

export function Step1({ onComplete, onIncomplete, pageContext }: Step1Props) {
  const { state, setState } = useApp();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  
  // Text mode state
  const [inputMode, setInputMode] = useState<'file' | 'text' | 'subtitle'>(state.inputMode || 'file');
  const [textInput, setTextInput] = useState(state.textInput || '');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<{
    iso: string;
    ckls: string;
    confidence: number;
  } | null>(null);

  
  // Auto-reload tracking
  const [lastLoadedTimestamp, setLastLoadedTimestamp] = useState<number | null>(null);
  const [lastTextLoadedTimestamp, setLastTextLoadedTimestamp] = useState<number | null>(null);
  
  // Load from Page button state
  const [loadFromPageStatus, setLoadFromPageStatus] = useState<'idle' | 'detecting' | 'loading' | 'success' | 'error'>('idle');
  const [loadFromPageError, setLoadFromPageError] = useState<string | null>(null);
  
  // Accordion state
  const [openAccordions, setOpenAccordions] = useState<string[]>([]); // Start with all sections collapsed
  const [showQuickLoadBanner] = useState(true);

  // Duplicate file handling
  const [duplicateFile, setDuplicateFile] = useState<{
    filename: string;
    fileData: File; // Type-safe: File object directly
  } | null>(null);
  const [duplicateFilePreference, setDuplicateFilePreference] = useState<'add' | 'replace' | null>(null);
  const [isModeSwitch, setIsModeSwitch] = useState(false);
  const [duplicateText, setDuplicateText] = useState<{
    content: string;
    sourceLanguage?: string;
  } | null>(null);

  // Subtitle validation
  const [showSubtitleValidationModal, setShowSubtitleValidationModal] = useState(false);
  const [subtitleValidationErrors, setSubtitleValidationErrors] = useState<Map<string, any[]>>(new Map());

  // Auto-loading state (for showing loading immediately when sidepanel opens with pending file)
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  // Restore UI when navigating back with existing data
  useEffect(() => {
    if (state.filesData.length > 0 || (state.subtitleFiles?.length ?? 0) > 0 || state.textInput) {
      setShowLanguagePicker(true);
    }
  }, [state.filesData.length, state.subtitleFiles?.length, state.textInput]);

  // Sync local textInput with global state
  useEffect(() => {
    if (inputMode === 'text' && textInput !== state.textInput) {
      setState({ textInput });
    }
  }, [textInput, inputMode]);

  // Load saved duplicate file preference on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['duplicateFilePreference'], (result: { duplicateFilePreference?: 'add' | 'replace' }) => {
        if (result.duplicateFilePreference) {
          setDuplicateFilePreference(result.duplicateFilePreference);
        }
      });
    }
  }, []);

  // Handle subtitle file uploads (.srt and .vtt)
  const handleSubtitleFiles = async (files: File[]) => {
    try {
      // Load subtitle settings (or use BBC defaults)
      let subtitleSettings: SubtitleSettings = BBC_SUBTITLE_STANDARDS;
      try {
        const result = await chrome.storage.local.get('subtitleSettings');
        if (result.subtitleSettings && typeof result.subtitleSettings === 'object') {
          subtitleSettings = { ...BBC_SUBTITLE_STANDARDS, ...result.subtitleSettings };
        }
      } catch (error) {
        console.log('Using default BBC subtitle settings');
      }

      // Check file size limits
      for (const file of files) {
        const sizeIssue = validateFileSize(file);
        if (sizeIssue) {
          throw new Error(`${file.name}: ${sizeIssue.message}`);
        }
      }

      // Parse subtitle files
      const parsedFiles: SubtitleFileData[] = [];
      for (const file of files) {
        const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        
        if (fileExtension === '.srt') {
          const parsed = await parseSrtFileFromFile(file);
          parsedFiles.push(parsed);
        } else if (fileExtension === '.vtt') {
          const parsed = await parseVttFileFromFile(file);
          parsedFiles.push(parsed);
        }
      }

      // Run timing analysis on each file
      for (const file of parsedFiles) {
        file.timingIssues = analyzeTimingIssues(file.subtitles, subtitleSettings);
      }

      // Validate batch
      const validation = validateSubtitleBatch(parsedFiles, subtitleSettings);

      // If there are errors, show validation modal and reject
      if (validation.hasErrors) {
        setSubtitleValidationErrors(validation.allIssues);
        setShowSubtitleValidationModal(true);
        setIsProcessing(false);
        return;
      }

      // All valid - calculate deduplication stats
      const allSubtitles = parsedFiles.flatMap(f => f.subtitles);
      const uniqueTexts = new Set(allSubtitles.map(s => s.text.trim()));
      const totalSubtitles = allSubtitles.length;
      const duplicates = totalSubtitles - uniqueTexts.size;
      const savingsPercentage = totalSubtitles > 0 ? Math.round((duplicates / totalSubtitles) * 100) : 0;

      // Store in state (force manual language selection - no auto-detection)
      setState({
        inputMode: 'subtitle',
        detectedContentType: 'subtitle',
        subtitleFiles: parsedFiles,
        sourceLanguageISO: '', // Force manual selection
        sourceLanguageCKLS: '',
        subtitleDeduplicationStats: {
          totalFiles: parsedFiles.length,
          totalSubtitles,
          uniqueTexts: uniqueTexts.size,
          duplicates,
          savingsPercentage
        }
      });

      setInputMode('subtitle'); // Sync local state with global state
      setShowLanguagePicker(true);

      // Show success toast
      toast.success(
        parsedFiles.length === 1 ? 'Subtitle file loaded' : `${parsedFiles.length} subtitle files loaded`,
        {
          description: `${totalSubtitles} total subtitles, ${uniqueTexts.size} unique (${savingsPercentage}% savings)`
        }
      );
      
      setIsProcessing(false);
    } catch (error: any) {
      setError(error.message || 'Failed to load subtitle files');
      setIsProcessing(false);
    }
  };

  // Define handleFilesSelect first (before checkAutoLoadedFile uses it)
  const handleFilesSelect = async (files: File[], isUserInitiated = true) => {
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    setIsProcessing(true);
    setError(null);

    try {
      // Detect file types
      const subtitleFiles = files.filter(f => f.name.match(/\.(srt|vtt)$/i));
      const excelFiles = files.filter(f => f.name.match(/\.(xlsx|xml)$/i));
      const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
      
      // Prevent mixing Excel + Subtitle files
      if (subtitleFiles.length > 0 && excelFiles.length > 0) {
        throw new Error('Cannot mix Excel files and subtitle files in the same batch');
      }
      
      // Prevent mixing JSON + Subtitle files
      if (subtitleFiles.length > 0 && jsonFiles.length > 0) {
        throw new Error('Cannot mix JSON files and subtitle files in the same batch');
      }
      
      // Handle subtitle files
      if (subtitleFiles.length > 0) {
        await handleSubtitleFiles(subtitleFiles);
        setIsProcessing(false);
        return;
      }
      
      // Check if any file is JSON - handle specially
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.json')) {
          // Read JSON file as text
          const text = await file.text();
          
          // Validate it's valid JSON
          try {
            JSON.parse(text);
          } catch (e) {
            throw new Error(`Invalid JSON file: ${file.name}`);
          }
          
          // Process through text handler for schema detection
          const { processTextInput } = await import('@/modules/TextHandler');
          const processed = processTextInput(text, state.doNotTranslate);
          
          // Validate that JSON matches Meta-Skills schema
          if (processed.contentType !== 'json' || !processed.jsonSchema) {
            throw new Error(
              `${file.name} does not match Meta-Skills Avatar AI format. ` +
              `Only Meta-Skills JSON files are currently supported for translation.`
            );
          }
          
          // Load into text mode (schema confirmed)
          const { extractSourceLocaleFromJson, localeToISO } = await import('@/utils/jsonTextExtraction');
          const sourceLocale = extractSourceLocaleFromJson(text);
          
          if (sourceLocale) {
            const sourceISO = localeToISO(sourceLocale);
            setState({
              textInput: text,
              inputMode: 'text',
              detectedContentType: 'json',
              jsonSchema: processed.jsonSchema,  // May be null if no schema match
              sourceLanguageISO: sourceISO,
              sourceLanguageCKLS: sourceLocale,
              detectedExisting: []
            });
          } else {
            setState({
              textInput: text,
              inputMode: 'text',
              detectedContentType: 'json',
              jsonSchema: processed.jsonSchema,  // May be null
              detectedExisting: []
            });
          }
          
          setTextInput(text);
          setShowLanguagePicker(true);
          setIsProcessing(false);
          
          // Show success toast
          toast.success('JSON file loaded', {
            description: `${file.name} loaded into Text Mode`
          });
          
          return; // Stop processing, JSON handled
        }
      }
      
      // Check for duplicates ONLY if this is a user-initiated upload
      // and NOT during mode switch or state restoration
      if (isUserInitiated && !isModeSwitch) {
        for (const newFile of files) {
          const isDuplicate = state.filesData.some(f => 
            f.fileName === newFile.name
          );
          
          if (isDuplicate) {
            console.log('🔄 Duplicate file detected:', newFile.name);
            setDuplicateFile({ filename: newFile.name, fileData: newFile });
            setIsProcessing(false);
            return; // Stop processing, wait for user decision
          }
        }
      }

      // Process NEW files only (Excel/XML files)
      const newFilesData = await processMultipleFiles(files, state.languageNames);
      
      // Merge with existing files (accumulation)
      const allFilesData = [...state.filesData, ...newFilesData];
      
      // Calculate deduplication stats for ALL files
      const dedupStats = calculateDeduplicationStats(allFilesData, state.doNotTranslate);
      
      // Merge existing languages from ALL files
      const allExistingLanguages = [...new Set(allFilesData.flatMap(f => f.existingLanguages))];
      
      // Use first file's metadata (or keep existing if adding more files)
      const primaryFile = state.filesData[0] || newFilesData[0];
      
      // Calculate language completion stats and initialize modes
      let completionStats = {};
      const initializedModes: Record<string, any> = { ...state.existingLanguagesModes };
      
      if (allExistingLanguages.length > 0) {
        if (allFilesData.length === 1) {
          // Single file: analyze directly
          completionStats = analyzeLanguageCompletion(primaryFile.workbook, allExistingLanguages);
        } else {
          // Multiple files: aggregate stats
          completionStats = aggregateCompletionStats(allFilesData, allExistingLanguages);
        }
        
        // Initialize modes for all existing languages with 'keep' as default (if not already set)
        allExistingLanguages.forEach(code => {
          if (!initializedModes[code]) {
            initializedModes[code] = 'keep';
          }
        });
        
        console.log('Calculated completion stats:', completionStats);
        console.log('Initialized existing modes:', initializedModes);
      }
      
      // Update state with accumulated files
      setState({
        inputMode: 'file',
        filesData: allFilesData,
        multiFileMode: allFilesData.length > 1,
        deduplicationStats: dedupStats,
        workbook: primaryFile.workbook,
        sourceLanguageISO: primaryFile.sourceISO,
        sourceLanguageCKLS: primaryFile.sourceCKLS,
        detectedExisting: allExistingLanguages,
        languageCompletionStats: completionStats,
        existingLanguagesModes: initializedModes,
        fileTitleRaw: primaryFile.fileTitleRaw,
        fileTitleSlug: primaryFile.fileTitleSlug,
        normalizedTitle: primaryFile.normalizedTitle,
        isHomePage: primaryFile.isHomePage
      });

      // Show success toast
      toast.success(
        newFilesData.length === 1 ? 'File loaded' : `${newFilesData.length} files loaded`,
        {
          description: newFilesData.map(f => f.fileName).join(', ')
        }
      );

      // Clear selectedFiles after successful processing
      setSelectedFiles([]);
      setShowLanguagePicker(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process files');
      setSelectedFiles([]);
    } finally {
      setIsProcessing(false);
      setIsAutoLoading(false); // Clear auto-loading state after processing
      // Clear pending load flag from storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['pendingFileLoad']);
      }
    }
  };

  // Helper function to convert base64 file data to File object
  const convertStorageToFile = useCallback((fileData: any): File => {
    const base64Data = fileData.content;
    const isXML = fileData.filename.toLowerCase().endsWith('.xml');
    
    let file: File;
    
    if (isXML) {
      // For XML: decode base64 using TextDecoder (modern UTF-8 safe method)
      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(uint8Array);
      
      const blob = new Blob([text], { type: 'text/xml;charset=utf-8' });
      file = new window.File([blob], fileData.filename, { type: 'text/xml;charset=utf-8' });
    } else {
      // For XLSX: keep as binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      file = new window.File([blob], fileData.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    
    return file;
  }, []);

  // Extract checkAutoLoadedFile as useCallback so it can be reused
  const checkAutoLoadedFile = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    // Wait for languageNames to be loaded before processing
    if (!state.languageNames || Object.keys(state.languageNames).length === 0) {
      console.log('Waiting for languageNames to load before processing auto-loaded file...');
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_FILE' });
      
      if (response?.hasFile && response?.file) {
        const fileData = response.file;
        const file = convertStorageToFile(fileData);
        
        // Check for duplicate before auto-loading
        const isDuplicate = state.filesData.some(f => 
          f.fileName === fileData.filename
        );
        
        if (isDuplicate) {
          console.log('🔄 File already loaded (skipping duplicate dialog):', fileData.filename);
          // Clear the auto-loaded file from storage to stop polling
          await chrome.runtime.sendMessage({ type: 'CLEAR_AUTO_LOADED_FILE' });
          setIsAutoLoading(false); // Clear loading state for duplicate
          chrome.storage.local.remove(['pendingFileLoad']); // Clear pending flag
          return; // Don't show dialog, just skip
        }
        
        // Auto-load the file - mark as NOT user-initiated to skip duplicate check
        await handleFilesSelect([file], false);
        // Timestamp tracking prevents re-loading, no need to clear storage here
      } else {
        // No file found - clear auto-loading state
        setIsAutoLoading(false);
        chrome.storage.local.remove(['pendingFileLoad']); // Clear pending flag
      }
    } catch (error) {
      console.error('Failed to check auto-loaded file:', error);
      setIsAutoLoading(false); // Clear loading state on error
      chrome.storage.local.remove(['pendingFileLoad']); // Clear pending flag on error
    }
  }, [state.languageNames, handleFilesSelect, state.filesData, convertStorageToFile]);

  // Extract checkAutoLoadedText as useCallback for text content
  const checkAutoLoadedText = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_TEXT' });
      
      if (response?.hasText && response?.text) {
        const textData = response.text;
        const extractedContent = textData.content;
        
        // Check for duplicate before auto-loading
        if (textInput.trim().length > 0) {
          console.log('🔄 Text content already exists (auto-load)');
          setDuplicateText({ 
            content: extractedContent, 
            sourceLanguage: textData.sourceLanguage 
          });
          return;
        }
        
        console.log('📧 Auto-loading text content from storage');
        
        // Switch to text mode if needed
        if (inputMode !== 'text') {
          setInputMode('text');
          setState({ inputMode: 'text' });
        }
        
        // Load content
        setTextInput(extractedContent);
        setShowLanguagePicker(true);
        
        setState({ 
          inputMode: 'text',
          textInput: extractedContent,
          sourceLanguageCKLS: textData.sourceLanguage || '',
          sourceLanguageISO: textData.sourceLanguage ? extractISOCode(textData.sourceLanguage) : '',
          detectedExisting: []
        });
        
        // Show success toast
        toast.success('Text content loaded', {
          description: `${extractedContent.length} characters from page`
        });
        
        setLoadFromPageStatus('success');
        setTimeout(() => setLoadFromPageStatus('idle'), 2000);
        
        // Clear from storage after successful load
        await chrome.runtime.sendMessage({ type: 'CLEAR_AUTO_LOADED_TEXT' });
      }
    } catch (error) {
      console.error('Error checking auto-loaded text:', error);
    }
  }, [inputMode, textInput, setState]);

  // Check for pending auto-load file IMMEDIATELY on mount (show loading early, before languageNames)
  // Uses direct storage access for fastest possible detection
  useEffect(() => {
    const checkForPendingLoad = async () => {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      
      // Skip if we already have files loaded
      if (state.filesData.length > 0) return;
      
      try {
        // Check DIRECTLY from storage (faster than message passing to background script)
        const result = await chrome.storage.local.get(['pendingFileLoad', 'autoLoadedFile']);
        
        if (result.pendingFileLoad || result.autoLoadedFile) {
          // File is pending or ready - show loading state immediately
          console.log('📦 Pending file load detected on mount, showing loading immediately');
          setIsAutoLoading(true);
        }
      } catch (error) {
        console.error('Error checking for pending file load:', error);
      }
    };
    
    checkForPendingLoad();
  }, []); // Run once on mount

  // Check for auto-loaded files on mount with retry logic
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const tryLoadFile = async () => {
      if (!state.languageNames || Object.keys(state.languageNames).length === 0) {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`⏳ Waiting for languageNames (${retryCount}/${maxRetries})...`);
          timeoutId = setTimeout(tryLoadFile, 500);
        } else {
          console.error('❌ Timed out waiting for languageNames');
        }
        return;
      }
      
      // languageNames loaded, check for file BUT respect timestamps
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_FILE' });
          
          if (response?.hasFile && response?.file) {
            const fileTimestamp = response.file.timestamp;
            
            // Only load if it's a new file we haven't loaded yet
            if (lastLoadedTimestamp === null || fileTimestamp > lastLoadedTimestamp) {
              console.log('📥 LanguageNames effect: Loading new file');
              setLastLoadedTimestamp(fileTimestamp);
              checkAutoLoadedFile();
            } else {
              console.log('⏭️ LanguageNames effect: File already loaded, skipping');
            }
          }
          
          // Also check for text content
          const textResponse = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_TEXT' });
          if (textResponse?.hasText && textResponse?.text) {
            const textTimestamp = textResponse.text.timestamp;
            if (lastTextLoadedTimestamp === null || textTimestamp > lastTextLoadedTimestamp) {
              console.log('📧 LanguageNames effect: Loading new text');
              setLastTextLoadedTimestamp(textTimestamp);
              checkAutoLoadedText();
            }
          }
        } catch (error) {
          console.error('Error checking auto-loaded file:', error);
        }
      }
    };
    
    tryLoadFile();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.languageNames, lastLoadedTimestamp, lastTextLoadedTimestamp]);

  // Poll for new auto-loaded files every 500ms
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    // Don't poll if we're already processing or if we don't have language names yet
    if (isProcessing || !state.languageNames || Object.keys(state.languageNames).length === 0) {
      return;
    }
    
    const pollForNewFiles = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_FILE' });
        
        if (response?.hasFile && response?.file) {
          const currentTimestamp = response.file.timestamp;
          
          // Skip reload if files already exist and timestamp is null (sidepanel just reopened)
          if (state.filesData.length > 0 && lastLoadedTimestamp === null) {
            console.log('📦 Sidepanel reopened with existing files, setting timestamp without reload');
            setLastLoadedTimestamp(currentTimestamp);
            return;
          }
          
          // Only reload if it's a NEW file (different timestamp than last loaded)
          if (lastLoadedTimestamp === null || currentTimestamp > lastLoadedTimestamp) {
            console.log('🔄 New file detected, auto-reloading...', response.file.filename);
            setLastLoadedTimestamp(currentTimestamp);
            checkAutoLoadedFile();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    // Poll every 500ms
    const pollInterval = setInterval(pollForNewFiles, 500);
    
    return () => clearInterval(pollInterval);
  }, [lastLoadedTimestamp, state.languageNames, state.filesData.length, checkAutoLoadedFile, isProcessing]);

  // Listen for FILE_READY_SIDEPANEL messages for instant file loading
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    const handleFileReady = (message: any) => {
      if (message.type === 'FILE_READY_SIDEPANEL') {
        console.log('📥 FILE_READY received in sidepanel, loading immediately:', message.filename);
        // Trigger immediate file check instead of waiting for polling
        checkAutoLoadedFile();
      }
    };
    
    chrome.runtime.onMessage.addListener(handleFileReady);
    return () => chrome.runtime.onMessage.removeListener(handleFileReady);
  }, [checkAutoLoadedFile]);

  // Poll for new auto-loaded text every 500ms
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    // Don't poll if we're already processing
    if (isProcessing) {
      return;
    }
    
    const pollForNewText = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_TEXT' });
        
        if (response?.hasText && response?.text) {
          const currentTimestamp = response.text.timestamp;
          
          // Skip reload if text already exists and timestamp is null (sidepanel just reopened)
          if (textInput.trim().length > 0 && lastTextLoadedTimestamp === null) {
            console.log('📧 Sidepanel reopened with existing text, setting timestamp without reload');
            setLastTextLoadedTimestamp(currentTimestamp);
            return;
          }
          
          // Only reload if it's a NEW text (different timestamp than last loaded)
          if (lastTextLoadedTimestamp === null || currentTimestamp > lastTextLoadedTimestamp) {
            console.log('🔄 New text content detected, auto-loading...');
            setLastTextLoadedTimestamp(currentTimestamp);
            checkAutoLoadedText();
          }
        }
      } catch (error) {
        console.error('Text polling error:', error);
      }
    };
    
    // Poll every 500ms
    const pollInterval = setInterval(pollForNewText, 500);
    
    return () => clearInterval(pollInterval);
  }, [lastTextLoadedTimestamp, checkAutoLoadedText, isProcessing, textInput]);

  // Auto-transition load from page status on successful file load
  useEffect(() => {
    if (loadFromPageStatus === 'loading' && state.filesData.length > 0) {
      setLoadFromPageStatus('success');
      setTimeout(() => {
        setLoadFromPageStatus('idle');
      }, 2000);
    }
  }, [loadFromPageStatus, state.filesData.length]);


  const handleRemoveFile = (index: number) => {
    const updatedFiles = state.filesData.filter((_, i) => i !== index);
    
    if (updatedFiles.length === 0) {
      handleClear();
      return;
    }

    // Recalculate stats
    const dedupStats = calculateDeduplicationStats(updatedFiles, state.doNotTranslate);
    const allExistingLanguages = [...new Set(updatedFiles.flatMap(f => f.existingLanguages))];

    setState({
      filesData: updatedFiles,
      deduplicationStats: dedupStats,
      workbook: updatedFiles[0].workbook,
      sourceLanguageISO: updatedFiles[0].sourceISO,
      sourceLanguageCKLS: updatedFiles[0].sourceCKLS,
      detectedExisting: allExistingLanguages,
      multiFileMode: updatedFiles.length > 1
    });

    // Clear selectedFiles to prevent re-adding removed files
    setSelectedFiles([]);
    
    // Fix: Reset the file input element to clear browser cache
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDuplicateResponse = async (action: 'skip' | 'replace' | 'add') => {
    if (!duplicateFile) return;

    // File is now directly accessible (not nested)
    const file = duplicateFile.fileData;

    try {
      switch (action) {
        case 'skip':
          console.log('⏭️ Skipping duplicate file');
          // Just close dialog
          break;

        case 'replace':
          console.log('🔄 Replacing existing file');
          // Remove old file with same name
          const updatedFiles = state.filesData.filter(f => f.fileName !== duplicateFile.filename);
          setState({ filesData: updatedFiles });
          // Load new file - mark as NOT user-initiated to skip duplicate check
          await handleFilesSelect([file], false);
          break;

        case 'add':
          console.log('➕ Adding duplicate file anyway');
          // Add as new file - mark as NOT user-initiated to skip duplicate check
          await handleFilesSelect([file], false);
          break;
      }
    } catch (error) {
      console.error('Error handling duplicate:', error);
    } finally {
      setDuplicateFile(null);
    }
  };

  const handleDuplicateTextResponse = async (action: 'replace' | 'append') => {
    if (!duplicateText) return;
    
    try {
      switch (action) {
        case 'replace':
          console.log('🔄 Replacing existing text');
          setTextInput(duplicateText.content);
          setState({ 
            inputMode: 'text',
            textInput: duplicateText.content,
            sourceLanguageCKLS: duplicateText.sourceLanguage || '',
            sourceLanguageISO: duplicateText.sourceLanguage ? extractISOCode(duplicateText.sourceLanguage) : '',
            detectedExisting: []
          });
          break;
          
        case 'append':
          console.log('➕ Appending to existing text');
          const combined = textInput + '\n\n' + duplicateText.content;
          setTextInput(combined);
          setState({ 
            inputMode: 'text',
            textInput: combined,
            detectedExisting: []
          });
          break;
      }
      setShowLanguagePicker(true);
    } finally {
      setDuplicateText(null);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setShowLanguagePicker(false);
    setError(null);
    setTextInput('');
    setDetectedLanguage(null);
    setState({
      workbook: null,
      sourceLanguageISO: '',
      sourceLanguageCKLS: '',
      targetLanguagesCKLS: [],
      detectedExisting: [],
      fileTitleRaw: '',
      fileTitleSlug: '',
      normalizedTitle: '',
      isHomePage: false,
      multiFileMode: false,
      filesData: [],
      subtitleFiles: [],
      subtitleDeduplicationStats: null,
      deduplicationStats: null,
      inputMode: 'file',
      textInput: '',
      detectedContentType: null,
      jsonSchema: null
    });
    
    // Clear the file input element
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Clear any auto-loaded content from storage
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'CLEAR_AUTO_LOADED_FILE' });
      chrome.runtime.sendMessage({ type: 'CLEAR_AUTO_LOADED_TEXT' });
    }
  };

  const handleLanguageSelect = (
    sourceCKLS: string, 
    targetCKLS: string[], 
    existingModes: Record<string, any>
  ) => {
    // Convert CKLS to ISO for API calls (e.g., "en-GB" -> "en")
    const sourceISO = extractISOCode(sourceCKLS);
    
    console.log('🔍 Step1 - handleLanguageSelect received modes:', existingModes);
    console.log('🔍 Step1 - Setting state with existingLanguagesModes');
    
    setState({
      sourceLanguageCKLS: sourceCKLS,
      sourceLanguageISO: sourceISO,
      targetLanguagesCKLS: targetCKLS,
      existingLanguagesModes: existingModes
    });
  };
  
  // Text mode handlers
  const handleModeChange = (mode: 'file' | 'text', preserveContent = false) => {
    setIsModeSwitch(true); // Set flag before switch
    setInputMode(mode);
    
    // Handle detectedExisting based on mode
    const updates: any = { inputMode: mode };
    
    if (mode === 'text') {
      // Text mode: clear existing languages
      updates.detectedExisting = [];
    } else if (mode === 'file') {
      // File mode: restore existing languages from filesData if available
      if (state.filesData.length > 0) {
        const allExistingLanguages = [...new Set(state.filesData.flatMap(f => f.existingLanguages))];
        updates.detectedExisting = allExistingLanguages;
      } else {
        updates.detectedExisting = [];
      }
    }
    
    setState(updates);
    setShowLanguagePicker(false);
    setError(null);
    setDetectedLanguage(null);
    
    // Clear duplicate dialog when switching modes
    setDuplicateFile(null);
    setDuplicateText(null);
    
    // Clear UI state when switching modes UNLESS preserveContent is true
    if (!preserveContent) {
      if (mode === 'text') {
        setSelectedFiles([]);
      } else {
        setTextInput('');
      }
    }
    
    // Reset flag after a short delay
    setTimeout(() => {
      setIsModeSwitch(false);
    }, 500);
  };
  
  const handleTextContinue = async () => {
    if (!textInput.trim()) return;
    
    setIsDetecting(true);
    setError(null);
    
    try {
      // Process text input to detect content type
      const { processTextInput } = await import('@/modules/TextHandler');
      const processed = processTextInput(textInput, state.doNotTranslate);
      
      // Check if Google API key exists
      const apiKey = state.googleApiKey;
      
      if (!apiKey) {
        // No API key - skip detection, show language picker for manual selection
        setDetectedLanguage(null);
        setShowLanguagePicker(true);
        setState({
          textInput,
          inputMode: 'text',
          detectedContentType: processed.contentType,
          jsonSchema: processed.jsonSchema || null,
          detectedExisting: [],
        });
        setIsDetecting(false);
        return;
      }
      
      // API key exists - auto-detect language
      const { language, confidence } = await detectLanguageWithAI(textInput, apiKey);
      const cklsCode = isoToCkls(language);
      
      setDetectedLanguage({
        iso: language,
        ckls: cklsCode,
        confidence
      });
      
      setState({
        textInput,
        inputMode: 'text',
        sourceLanguageISO: language,
        sourceLanguageCKLS: cklsCode,
        detectedContentType: processed.contentType,
        jsonSchema: processed.jsonSchema || null,
        detectedExisting: [],
      });
      
      setShowLanguagePicker(true);
      setIsDetecting(false);
    } catch (err: any) {
      console.error('Language detection failed:', err);
      setError('Failed to detect language. Please try again or select manually.');
      setIsDetecting(false);
    }
  };

  // Handle Load from Page button click - File Mode
  const handleLoadFileFromPage = async () => {
    try {
      // Get current tab to send message to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Send message to content script to trigger Quick Translate
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'TRIGGER_QUICK_TRANSLATE' 
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to communicate with page:', chrome.runtime.lastError);
              setLoadFromPageStatus('error');
              setLoadFromPageError('Unable to load file. Make sure you\'re on a CKLS translation page.');
              return;
            }
            
            if (response?.success === false) {
              setLoadFromPageStatus('error');
              setLoadFromPageError(response.message || 'No translatable content found on this page.');
              return;
            }
            
            // Success will be handled by the auto-load system
            setLoadFromPageStatus('loading');
            
            // Auto-clear loading state after file loads (handled by existing auto-load)
            // The checkAutoLoadedFile effect will pick it up
          });
        } else {
          setLoadFromPageStatus('error');
          setLoadFromPageError('Cannot access current tab.');
        }
      });
    } catch (error: any) {
      console.error('Error loading file from page:', error);
      setLoadFromPageStatus('error');
      setLoadFromPageError(error.message || 'Failed to load file from page');
    }
  };

  // Handle Load from Page button click - Text Mode
  const handleLoadTextFromPage = async () => {
    setLoadFromPageStatus('loading');
    setLoadFromPageError(null);
    
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs[0]?.id) {
        throw new Error('Cannot access current tab');
      }
      
      // Send message to content script to extract email content
      const response = await chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'EXTRACT_EMAIL_CONTENT' 
      });
      
      if (!response?.success || !response?.content) {
        setLoadFromPageStatus('error');
        setLoadFromPageError('No text content found on this page.');
        return;
      }
      
      const htmlContent = response.content;
      
      // CHECK: If text already exists, show duplicate notification
      if (textInput.trim().length > 0) {
        console.log('🔄 Text content already exists');
        setDuplicateText({ content: htmlContent, sourceLanguage: response.sourceLanguage });
        setLoadFromPageStatus('idle');
        return;
      }
      
      // Load content
      setTextInput(htmlContent);
      setShowLanguagePicker(true);
      
      setState({ 
        inputMode: 'text',
        textInput: htmlContent,
        sourceLanguageCKLS: response.sourceLanguage || '',
        sourceLanguageISO: response.sourceLanguage ? extractISOCode(response.sourceLanguage) : '',
        detectedExisting: []
      });
      
      // Show success toast
      toast.success('Text content loaded', {
        description: `${htmlContent.length} characters`
      });
      
      setLoadFromPageStatus('success');
      setTimeout(() => setLoadFromPageStatus('idle'), 2000);
      
    } catch (error: any) {
      console.error('Error extracting text from page:', error);
      setLoadFromPageStatus('error');
      setLoadFromPageError('Failed to extract text.');
    }
  };

  // Handle Load from Page button click - Main handler with smart auto-switch
  const handleLoadFromPage = async () => {
    setLoadFromPageStatus('loading');
    setLoadFromPageError(null);
    
    try {
      // Check if we're in extension context
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        throw new Error('Extension context not available');
      }
      
      const currentPageContext = await getCurrentPageContext();
      
      // Check if it's a supported page
      if (currentPageContext.type === 'unknown') {
        setLoadFromPageStatus('error');
        setLoadFromPageError('Not a CKLS translation page.');
        return;
      }
      
      // Switch to correct mode FIRST (with preserveContent flag)
      if (currentPageContext.mode !== inputMode) {
        console.log(`🔄 Switching to ${currentPageContext.mode} mode`);
        handleModeChange(currentPageContext.mode, true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Then load content
      if (currentPageContext.mode === 'text') {
        await handleLoadTextFromPage();
      } else {
        await handleLoadFileFromPage();
      }
    } catch (error: any) {
      console.error('Error in smart load:', error);
      setLoadFromPageStatus('error');
      setLoadFromPageError('Failed to load from page.');
    }
  };

  // Auto-detect content type when text changes
  useEffect(() => {
    if (!textInput.trim()) {
      // Clear detection when text is empty
      setState({ 
        detectedContentType: null, 
        jsonSchema: null 
      });
      return;
    }
    
    // Auto-detect content type whenever text changes
    const detectContent = async () => {
      const { processTextInput } = await import('@/modules/TextHandler');
      try {
        const processed = processTextInput(textInput, state.doNotTranslate);
        
        // Check if JSON was detected but doesn't match Meta-Skills schema
        if (processed.contentType === 'json' && !processed.jsonSchema) {
          setError(
            'Pasted JSON does not match Meta-Skills Avatar AI format. ' +
            'Only Meta-Skills JSON is currently supported for translation.'
          );
          setState({
            detectedContentType: null,
            jsonSchema: null,
          });
          return;
        }
        
        // If JSON detected with schema, try to extract source language from locale field
        if (processed.contentType === 'json' && processed.jsonSchema) {
          const { extractSourceLocaleFromJson, localeToISO } = await import('@/utils/jsonTextExtraction');
          const sourceLocale = extractSourceLocaleFromJson(textInput);
          
          if (sourceLocale) {
            const sourceISO = localeToISO(sourceLocale);
            setState({
              detectedContentType: processed.contentType,
              jsonSchema: processed.jsonSchema,
              sourceLanguageISO: sourceISO,
              sourceLanguageCKLS: sourceLocale
            });
          } else {
            setState({
              detectedContentType: processed.contentType,
              jsonSchema: processed.jsonSchema
            });
          }
        } else {
          setState({
            detectedContentType: processed.contentType,
            jsonSchema: processed.jsonSchema || null
          });
        }
      } catch (err) {
        // Ignore errors during auto-detection
        console.log('Auto-detection skipped:', err);
      }
    };
    
    // Debounce to avoid excessive processing
    const timeoutId = setTimeout(detectContent, 500);
    return () => clearTimeout(timeoutId);
  }, [textInput, state.doNotTranslate]);

  // Re-detect content type on mount if we have persisted text but no detected type
  useEffect(() => {
    console.log('🔄 Checking for persisted state on mount');
    console.log('inputMode:', inputMode);
    console.log('textInput length:', textInput.length);
    console.log('detectedContentType:', state.detectedContentType);
    console.log('showLanguagePicker:', showLanguagePicker);
    
    if (inputMode === 'text' && textInput.trim().length > 0 && !state.detectedContentType) {
      console.log('🔄 Persisted text detected without content type - re-running detection');
      
      const detectPersistedContent = async () => {
        const { processTextInput } = await import('@/modules/TextHandler');
        try {
          const processed = processTextInput(textInput, state.doNotTranslate);
          
          // Check if JSON was detected but doesn't match Meta-Skills schema
          if (processed.contentType === 'json' && !processed.jsonSchema) {
            setError(
              'Pasted JSON does not match Meta-Skills Avatar AI format. ' +
              'Only Meta-Skills JSON is currently supported for translation.'
            );
            setState({
              detectedContentType: null,
              jsonSchema: null,
            });
            return;
          }
          
          // If JSON detected with schema, try to extract source language from locale field
          if (processed.contentType === 'json' && processed.jsonSchema) {
            const { extractSourceLocaleFromJson, localeToISO } = await import('@/utils/jsonTextExtraction');
            const sourceLocale = extractSourceLocaleFromJson(textInput);
            
            if (sourceLocale) {
              const sourceISO = localeToISO(sourceLocale);
              setState({
                detectedContentType: processed.contentType,
                jsonSchema: processed.jsonSchema,
                sourceLanguageISO: sourceISO,
                sourceLanguageCKLS: sourceLocale
              });
            } else {
              setState({
                detectedContentType: processed.contentType,
                jsonSchema: processed.jsonSchema
              });
            }
          } else {
            setState({
              detectedContentType: processed.contentType,
              jsonSchema: processed.jsonSchema || null
            });
          }
          
          console.log('✅ Content type re-detected on mount:', processed.contentType);
        } catch (err) {
          console.error('❌ Persisted content detection failed:', err);
        }
      };
      
      detectPersistedContent();
    }
  }, []); // Run once on mount

  // Auto-expand languages accordion when content is loaded (but keep upload open too)
  useEffect(() => {
    const hasContent = inputMode === 'file' 
      ? state.filesData.length > 0 
      : inputMode === 'subtitle'
        ? (state.subtitleFiles?.length ?? 0) > 0
        : textInput.trim().length > 0;
    
    if (hasContent && showLanguagePicker) {
      // Expand languages section while keeping upload visible
      setOpenAccordions(['upload', 'languages']);
    }
  }, [state.filesData.length, state.subtitleFiles?.length, textInput, showLanguagePicker, inputMode]);

  // Auto-detect language when text is entered (debounced)
  useEffect(() => {
    if (inputMode !== 'text' || !textInput.trim() || showLanguagePicker || isDetecting) {
      return;
    }

    const timer = setTimeout(() => {
      // Trigger language detection automatically
      handleTextContinue();
    }, 800);

    return () => clearTimeout(timer);
  }, [textInput, inputMode, showLanguagePicker, isDetecting]);

  // Check if we can proceed to next step
  const canProceed = inputMode === 'file'
    ? ((state.workbook || state.filesData.length > 0) && state.targetLanguagesCKLS.length > 0)
    : inputMode === 'subtitle'
      ? ((state.subtitleFiles?.length ?? 0) > 0 && state.sourceLanguageCKLS && state.targetLanguagesCKLS.length > 0)
      : (textInput.trim() && state.targetLanguagesCKLS.length > 0);

  // Call onComplete when conditions are met (but don't auto-navigate)
  useEffect(() => {
    if (canProceed) {
      onComplete();
    }
  }, [canProceed]);

  // Call onIncomplete when conditions are no longer met
  useEffect(() => {
    if (!canProceed) {
      onIncomplete();
    }
  }, [canProceed, onIncomplete]);

  return (
    <div className="space-y-6">
      {/* Quick Load Banner - Only show when NO content loaded */}
      {pageContext.type !== 'unknown' && showQuickLoadBanner && 
       !((inputMode === 'file' && state.filesData.length > 0) || (inputMode === 'subtitle' && (state.subtitleFiles?.length ?? 0) > 0) || (inputMode === 'text' && textInput.trim())) && (
        <div className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
          (inputMode === 'file' && state.filesData.length > 0) || (inputMode === 'subtitle' && (state.subtitleFiles?.length ?? 0) > 0) || (inputMode === 'text' && textInput.trim())
            ? 'bg-success/10 border-success/30'
            : 'bg-background/50 border-border/50'
        }`}>
          {/* Icon Box */}
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-base flex-shrink-0">
            {pageContext.icon}
          </div>
          
          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-tight">
              {pageContext.label}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {(inputMode === 'file' && state.filesData.length > 0) || (inputMode === 'subtitle' && (state.subtitleFiles?.length ?? 0) > 0) || (inputMode === 'text' && textInput.trim()) ? (
                <>
                  {inputMode === 'file' && state.filesData.length > 0
                    ? `${state.filesData.length} file${state.filesData.length !== 1 ? 's' : ''} loaded`
                    : inputMode === 'subtitle' && (state.subtitleFiles?.length ?? 0) > 0
                      ? `${state.subtitleFiles?.length ?? 0} subtitle file${(state.subtitleFiles?.length ?? 0) !== 1 ? 's' : ''} loaded`
                      : 'Text loaded'
                  }
                </>
              ) : (
                <>Add</>
              )}
            </p>
          </div>
          
          {/* Action Button/Icon */}
          {!((inputMode === 'file' && state.filesData.length > 0) || (inputMode === 'subtitle' && (state.subtitleFiles?.length ?? 0) > 0) || (inputMode === 'text' && textInput.trim())) ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 flex-shrink-0"
              onClick={handleLoadFromPage}
              disabled={loadFromPageStatus === 'loading' || loadFromPageStatus === 'detecting'}
            >
              {loadFromPageStatus === 'loading' || loadFromPageStatus === 'detecting' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : loadFromPageStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </Button>
          ) : (
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          )}
        </div>
      )}

      {/* Error message below banner if needed */}
      {loadFromPageError && loadFromPageStatus === 'error' && (
        <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {loadFromPageError}
        </div>
      )}

      {/* Accordion Structure */}
      <Accordion 
        type="multiple" 
        value={openAccordions} 
        onValueChange={setOpenAccordions}
        className="w-full space-y-4"
      >
        {/* Accordion 1: Upload Content */}
        <AccordionItem value="upload" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Upload className="w-4 h-4" />
                  Source
                  {(state.filesData.length > 0 || (state.subtitleFiles?.length ?? 0) > 0) && (
                    <CheckCircle2 className="w-4 h-4 text-success ml-auto" />
                  )}
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                {/* Mode Tabs */}
                <Tabs 
                  value={inputMode === 'subtitle' ? 'file' : inputMode} 
                  onValueChange={(value) => handleModeChange(value as 'file' | 'text')}
                  className="mb-4"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file" className="text-xs">
                      <File className="w-3.5 h-3.5 mr-1.5" />
                      File Mode
                      {pageContext.mode === 'file' && pageContext.type !== 'unknown' && (
                        <span className="ml-1 text-xs">✨</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="text" className="text-xs">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Text Mode
                      {pageContext.mode === 'text' && pageContext.type !== 'unknown' && (
                        <span className="ml-1 text-xs">✨</span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="file" className="mt-4">
                    {/* File upload content - handles all file types including subtitles */}
                    {inputMode === 'file' || inputMode === 'subtitle' ? (
              <>
          {/* File List with integrated dropzone */}
          {state.filesData.length > 0 ? (
            <FileList 
              filesData={state.filesData}
              onRemove={handleRemoveFile}
              onClearAll={handleClear}
              onFilesSelect={handleFilesSelect}
              multiple={true}
            />
          ) : (state.subtitleFiles?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {state.subtitleFiles?.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.subtitles.length} subtitles • {file.format.toUpperCase()}
                        {file.timingIssues && file.timingIssues.length > 0 && (
                          <span className="ml-2 text-yellow-600">• {file.timingIssues.length} timing issues</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClear} 
                className="w-full"
              >
                Clear All
              </Button>
            </div>
          ) : (
            /* Show standalone dropzone only when no files */
            <FileUpload
              multiple
              onFilesSelect={handleFilesSelect}
              isLoading={isProcessing || isAutoLoading}
            />
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Processing file...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
        </>
      ) : null}
                  </TabsContent>
                  
                  <TabsContent value="text" className="mt-4">
                    {/* Text Input Mode */}
                    <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-input" className="text-sm font-medium">
                Paste your content (email, text, or HTML)
              </Label>
              <Textarea
                id="text-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="<p>Dear Team,</p>&#10;<p>I hope this email finds you well...</p>"
                className="min-h-[200px] font-mono text-sm resize-y"
              />
              {textInput && (
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {textInput.length} characters
                    </span>
                    {state.detectedContentType && (
                      <div className="flex items-center gap-1.5">
                        {state.detectedContentType === 'json' && state.jsonSchema && (
                          <Badge variant="secondary" className="text-xs">
                            🔧 JSON ({state.jsonSchema.name})
                          </Badge>
                        )}
                        {state.detectedContentType === 'html' && (
                          <Badge variant="secondary" className="text-xs">
                            📧 HTML
                          </Badge>
                        )}
                        {state.detectedContentType === 'plain' && (
                          <Badge variant="secondary" className="text-xs">
                            📝 Plain Text
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="h-7 px-2 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
            
            {!showLanguagePicker && textInput.trim() && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border bg-muted/50">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  HTML tags will be preserved during translation
                </span>
              </div>
            )}
            
            {/* Show detected language with confidence */}
            {detectedLanguage && showLanguagePicker && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-sm text-green-900 dark:text-green-100">
                  Detected Language: <strong>{detectedLanguage.ckls}</strong>
                  {detectedLanguage.confidence > 0 && (
                    <span className="text-xs ml-2 opacity-75">
                      ({Math.round(detectedLanguage.confidence * 100)}% confidence)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Accordion 2: Configure Languages */}
        <AccordionItem value="languages" className="border rounded-lg">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardHeader className="p-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Languages className="w-4 h-4" />
                  Configure Languages
                  {state.targetLanguagesCKLS.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {state.targetLanguagesCKLS.length} selected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            
            <AccordionContent>
              <CardContent className="px-6 pb-6 pt-2">
                {/* Language Picker */}
                {showLanguagePicker && !isProcessing && !isDetecting && (
                  <LanguagePicker
                    detectedSourceISO={state.sourceLanguageISO}
                    detectedSourceCKLS={state.sourceLanguageCKLS}
                    detectedExisting={state.detectedExisting}
                    languageNames={state.languageNames}
                    selectedTargets={state.targetLanguagesCKLS}
                    existingLanguagesModes={state.existingLanguagesModes}
                    languageCompletionStats={state.languageCompletionStats}
                    onLanguageSelect={handleLanguageSelect}
                  />
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* Service Badges at Bottom */}
      <div className="flex items-center gap-2 flex-wrap justify-center pt-4 border-t">
        <span className="text-xs text-muted-foreground">Compatible with:</span>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          Home Pages
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          Learning Channels
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          BlendedX
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          Emails
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          Subtitles
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          Meta-Skills
        </Badge>
        
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center justify-center">
                <Info className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="text-xs">Browse to the translation page on CKLS and/or upload translation files to get started.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Duplicate File Toast Notification */}
      {duplicateFile && !duplicateFilePreference && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">File already loaded</p>
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {duplicateFile.filename}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => handleDuplicateResponse('replace')}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                    >
                      Replace
                    </Button>
                    <Button 
                      onClick={() => handleDuplicateResponse('add')}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                    >
                      Add New
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      onChange={(e) => {
                        if (e.target.checked && typeof chrome !== 'undefined' && chrome.storage) {
                          // Save preference for future (default to replace)
                          const defaultAction = 'replace';
                          chrome.storage.local.set({ duplicateFilePreference: defaultAction });
                          setDuplicateFilePreference(defaultAction);
                        }
                      }}
                    />
                    Remember my choice (Replace)
                  </label>
                </div>
              </div>
              <Button
                onClick={() => setDuplicateFile(null)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-apply preference if set */}
      {duplicateFile && duplicateFilePreference && (() => {
        setTimeout(() => {
          handleDuplicateResponse(duplicateFilePreference);
        }, 0);
        return null;
      })()}

      {/* Duplicate Text Toast Notification */}
      {duplicateText && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">Text content already exists</p>
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {textInput.substring(0, 50)}...
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => handleDuplicateTextResponse('replace')}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    Replace
                  </Button>
                  <Button 
                    onClick={() => handleDuplicateTextResponse('append')}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    Append
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => setDuplicateText(null)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Validation Modal */}
      <SubtitleValidationModal
        isOpen={showSubtitleValidationModal}
        onClose={() => setShowSubtitleValidationModal(false)}
        validationErrors={subtitleValidationErrors}
      />
    </div>
  );
}

