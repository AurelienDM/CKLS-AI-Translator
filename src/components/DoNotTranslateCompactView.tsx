import { useState, useEffect, useRef } from 'react';
import { Settings, ExternalLink, Ban, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { openOptionsPage } from '@/utils/extensionHelpers';
import { useApp } from '@/contexts/AppContext';
import { detectDntTerms, DntCandidate } from '@/utils/autoDetection';
import { extractUniqueWordsFromTexts, filterSuggestions, WordSuggestion } from '@/utils/extractUniqueWords';
import { readColumnD } from '@/modules/FileHandler';
import { toast } from 'sonner';

interface DoNotTranslateCompactViewProps {
  terms: string[];
}

export function DoNotTranslateCompactView({ terms }: DoNotTranslateCompactViewProps) {
  const { state, setState } = useApp();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<DntCandidate[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  
  // Prefill state
  const [inputValue, setInputValue] = useState('');
  const [prefillSuggestions, setPrefillSuggestions] = useState<WordSuggestion[]>([]);
  const [filteredPrefill, setFilteredPrefill] = useState<WordSuggestion[]>([]);
  const [showPrefillDropdown, setShowPrefillDropdown] = useState(false);
  const [selectedPrefillIndex, setSelectedPrefillIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const displayTerms = terms.slice(0, 10);
  const hasMore = terms.length > 10;

  // Extract unique words from content for prefill (using same extraction as translation pipeline)
  useEffect(() => {
    const extractWords = async () => {
      let extractedTexts: string[] = [];

      try {
        if (state.inputMode === 'text' && state.textInput) {
          // JSON mode - use extractJsonText (same as TextHandler.ts)
          if (state.detectedContentType === 'json' && state.jsonSchema) {
            const { extractJsonText } = await import('@/utils/jsonTextExtraction');
            const { extracted } = extractJsonText(state.textInput, state.jsonSchema);
            extractedTexts = extracted.map(item => item.extracted);
          } 
          // HTML/Plain text - use extractTextAndBuildPlaceholders (same as DeepLTranslator.ts)
          else {
            const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
            const { extracted } = extractTextAndBuildPlaceholders(
              [{ rowIndex: 1, original: state.textInput }],
              []  // Empty DNT to get all extractable text
            );
            extractedTexts = extracted.map(item => item.extracted);
          }
        } 
        // Subtitle mode - get text directly from parsed subtitles
        else if (state.inputMode === 'subtitle' && state.subtitleFiles) {
          state.subtitleFiles.forEach(file => {
            file.subtitles.forEach((sub: any) => {
              if (sub.text) extractedTexts.push(sub.text);
            });
          });
        } 
        // Excel file mode - use readColumnD + extractTextAndBuildPlaceholders (same as MultiFileHandler.ts)
        else if (state.filesData.length > 0) {
          const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
          
          state.filesData.forEach(fileData => {
            const rows = readColumnD(fileData.workbook);
            const { extracted } = extractTextAndBuildPlaceholders(rows, []);
            extracted.forEach(item => extractedTexts.push(item.extracted));
          });
        } 
        // Legacy single workbook
        else if (state.workbook) {
          const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
          const rows = readColumnD(state.workbook);
          const { extracted } = extractTextAndBuildPlaceholders(rows, []);
          extractedTexts = extracted.map(item => item.extracted);
        }

        // Extract unique words from the extracted texts
        if (extractedTexts.length > 0) {
          const words = extractUniqueWordsFromTexts(extractedTexts, state.doNotTranslate);
          setPrefillSuggestions(words);
        }
      } catch (error) {
        console.error('Failed to extract words for prefill:', error);
      }
    };

    extractWords();
  }, [state.inputMode, state.textInput, state.filesData, state.workbook, state.subtitleFiles, state.doNotTranslate, state.detectedContentType, state.jsonSchema]);

  // Filter suggestions as user types
  useEffect(() => {
    if (inputValue.trim().length >= 2) {
      const filtered = filterSuggestions(prefillSuggestions, inputValue, 8);
      setFilteredPrefill(filtered);
      setShowPrefillDropdown(filtered.length > 0);
      setSelectedPrefillIndex(-1);
    } else {
      setFilteredPrefill([]);
      setShowPrefillDropdown(false);
    }
  }, [inputValue, prefillSuggestions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowPrefillDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleManage = () => {
    openOptionsPage('dnt');
  };

  // Handle adding a term manually or from prefill
  const handleAddTerm = (term?: string) => {
    const termToAdd = (term || inputValue).trim();
    if (!termToAdd) return;

    if (state.doNotTranslate.some(t => t.toLowerCase() === termToAdd.toLowerCase())) {
      toast.error('Term already exists');
      return;
    }

    const mergedTerms = [...state.doNotTranslate, termToAdd].sort();
    setState({ doNotTranslate: mergedTerms });
    toast.success(`Added "${termToAdd}"`);
    setInputValue('');
    setShowPrefillDropdown(false);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showPrefillDropdown) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTerm();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedPrefillIndex(prev => 
          prev < filteredPrefill.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedPrefillIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedPrefillIndex >= 0 && filteredPrefill[selectedPrefillIndex]) {
          handleAddTerm(filteredPrefill[selectedPrefillIndex].word);
        } else {
          handleAddTerm();
        }
        break;
      case 'Escape':
        setShowPrefillDropdown(false);
        break;
    }
  };

  const handleAutoDetect = async () => {
    try {
      // Gather rows from current input mode
      let rows: any[] = [];

      // Diagnostic logging for JSON
      console.log('🔍 DNT Auto-detect Debug:', {
        inputMode: state.inputMode,
        detectedContentType: state.detectedContentType,
        hasJsonSchema: !!state.jsonSchema,
        schemaName: state.jsonSchema?.name,
        textLength: state.textInput?.length,
        textPreview: state.textInput?.substring(0, 150)
      });

      if (state.inputMode === 'text' && state.textInput) {
        // Pre-process HTML content to extract clean text
        if (state.detectedContentType === 'html' || state.textInput.includes('<')) {
          const { extractTextAndBuildPlaceholders } = await import('@/utils/textExtraction');
          const { extracted } = extractTextAndBuildPlaceholders(
            [{ rowIndex: 1, original: state.textInput }],
            []
          );
          
          // Convert extracted text to rows format (clean text only)
          rows = extracted.map(item => ({
            rowIndex: item.rowIndex,
            original: item.extracted
          }));
        }
        // Pre-process JSON content to extract clean text values
        else if (state.detectedContentType === 'json' && state.jsonSchema) {
          console.log('✅ JSON path taken - extracting translatable strings only');
          const { extractJsonText } = await import('@/utils/jsonTextExtraction');
          const { extracted } = extractJsonText(state.textInput, state.jsonSchema);
          
          console.log('📝 Extracted strings for DNT detection:', extracted.map(e => ({
            path: e.path,
            text: e.extracted.substring(0, 50) + (e.extracted.length > 50 ? '...' : '')
          })));
          
          // Convert extracted text to rows format (text values only)
          rows = extracted.map((item, idx) => ({
            rowIndex: idx + 1,
            original: item.extracted
          }));
          
          console.log('📊 Total translatable strings to analyze:', rows.length);
        }
        // Plain text mode
        else {
          console.log('⚠️ Fallback: treating as plain text (no HTML/JSON detected)');
          rows = [{ rowIndex: 1, original: state.textInput }];
        }
      } else if (state.inputMode === 'subtitle' && state.subtitleFiles) {
        // Subtitle mode
        state.subtitleFiles.forEach(file => {
          file.subtitles.forEach((sub: any, idx: number) => {
            rows.push({ rowIndex: idx + 1, original: sub.text });
          });
        });
      } else if (state.filesData.length > 0) {
        state.filesData.forEach(fileData => {
          const fileRows = readColumnD(fileData.workbook);
          rows = rows.concat(fileRows);
        });
      } else if (state.workbook) {
        rows = readColumnD(state.workbook);
      }

      if (rows.length === 0) {
        toast.error('No content to analyze');
        return;
      }

      // Run detection on clean text
      console.log('🔍 Running DNT detection on', rows.length, 'rows');
      const result = detectDntTerms(rows, state.doNotTranslate);
      
      console.log('✅ DNT detection results:', {
        totalScanned: result.totalScanned,
        candidatesFound: result.candidates.length,
        topCandidates: result.candidates.slice(0, 5).map(c => ({
          term: c.term,
          reason: c.reason,
          frequency: c.frequency
        }))
      });
      
      if (result.candidates.length === 0) {
        toast.info(`Scanned ${result.totalScanned} strings, no patterns detected`);
        return;
      }

      setSuggestions(result.candidates);
      setTotalScanned(result.totalScanned);
      
      // Don't pre-select any terms - let user choose explicitly
      setSelectedTerms(new Set());
      
      setShowSuggestions(true);
    } catch (error) {
      console.error('Auto-detection error:', error);
      toast.error('Failed to run auto-detection');
    }
  };

  const handleToggleTerm = (term: string) => {
    const newSelected = new Set(selectedTerms);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelectedTerms(newSelected);
  };

  const handleAddSelected = () => {
    if (selectedTerms.size === 0) {
      toast.error('No terms selected');
      return;
    }

    const mergedTerms = Array.from(
      new Set([...state.doNotTranslate, ...Array.from(selectedTerms)])
    ).sort();

    setState({ doNotTranslate: mergedTerms });
    
    toast.success(
      `Added ${selectedTerms.size} term${selectedTerms.size !== 1 ? 's' : ''}`
    );
    
    // Clear suggestions
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedTerms(new Set());
  };

  const handleCancel = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedTerms(new Set());
  };

  const renderCandidateRow = (candidate: DntCandidate) => (
    <div
      key={candidate.term}
      className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-sm transition-colors"
    >
      <Checkbox
        checked={selectedTerms.has(candidate.term)}
        onCheckedChange={() => handleToggleTerm(candidate.term)}
      />
      <code className="text-sm flex-1 break-all">{candidate.term}</code>
      <Badge variant="outline" className="text-xs px-2 py-0.5 font-mono tabular-nums">
        {candidate.frequency}x
      </Badge>
    </div>
  );

  // Render input with prefill dropdown
  const renderInputWithPrefill = () => (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          placeholder="Type to add..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length >= 2 && filteredPrefill.length > 0) {
              setShowPrefillDropdown(true);
            }
          }}
          className="flex-1"
        />
        <Button
          onClick={() => handleAddTerm()}
          disabled={!inputValue.trim()}
          size="icon"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Prefill dropdown */}
      {showPrefillDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="p-1">
            {filteredPrefill.map((suggestion, index) => (
              <button
                key={suggestion.word}
                onClick={() => handleAddTerm(suggestion.word)}
                className={`
                  w-full text-left px-2 py-1.5 text-sm rounded-sm
                  flex items-center justify-between gap-2
                  ${index === selectedPrefillIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                  }
                `}
              >
                <span className={suggestion.isLikelyProperNoun ? 'font-semibold' : ''}>
                  {suggestion.word}
                </span>
                <div className="flex items-center gap-1.5">
                  {suggestion.isLikelyProperNoun && (
                    <span className="text-amber-500 text-xs">◆</span>
                  )}
                  <Badge variant="secondary" className="text-xs tabular-nums h-5">
                    {suggestion.frequency}x
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Empty state (no terms configured)
  if (terms.length === 0) {
    return (
      <div className="space-y-3">
        {/* Compact empty state */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">No terms configured</p>
              <p className="text-xs text-muted-foreground">Add terms that should not be translated</p>
            </div>
          </div>
          
          {/* Input inline */}
          {renderInputWithPrefill()}
        </div>
        
        {/* Action buttons - compact row */}
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleAutoDetect} className="flex-1 h-8">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Auto-detect
          </Button>
          <Button variant="ghost" size="sm" onClick={handleManage} className="h-8 px-3">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Manage
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Auto-detect suggestions - compact */}
        {showSuggestions && (
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Suggestions</p>
              <span className="text-xs text-muted-foreground">
                {suggestions.length} found in {totalScanned} strings
              </span>
            </div>

            <div className="space-y-0.5 max-h-64 overflow-y-auto -mx-1 px-1">
              {suggestions.map(renderCandidateRow)}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleAddSelected}
                disabled={selectedTerms.size === 0}
                className="flex-1 h-8"
                size="sm"
              >
                Add {selectedTerms.size > 0 ? `${selectedTerms.size} ` : ''}Selected
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                size="sm"
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // With existing terms
  return (
    <div className="space-y-3">
      {/* Terms display - compact */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {displayTerms.map((term, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs h-6">
              {term}
            </Badge>
          ))}
          {hasMore && (
            <Badge variant="outline" className="text-xs h-6 text-muted-foreground">
              +{terms.length - 10} more
            </Badge>
          )}
        </div>
        
        {renderInputWithPrefill()}
      </div>
      
      {/* Action buttons - compact row */}
      <div className="flex gap-2">
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleAutoDetect}
          className="flex-1 h-8"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Auto-detect
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleManage}
          className="h-8 px-3"
        >
          <Settings className="w-3.5 h-3.5 mr-1.5" />
          Manage
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {/* Auto-detect suggestions - compact */}
      {showSuggestions && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Suggestions</p>
            <span className="text-xs text-muted-foreground">
              {suggestions.length} found in {totalScanned} strings
            </span>
          </div>

          <div className="space-y-0.5 max-h-64 overflow-y-auto -mx-1 px-1">
            {suggestions.map(renderCandidateRow)}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleAddSelected}
              disabled={selectedTerms.size === 0}
              className="flex-1 h-8"
              size="sm"
            >
              Add {selectedTerms.size > 0 ? `${selectedTerms.size} ` : ''}Selected
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              size="sm"
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
