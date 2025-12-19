import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Download, Pencil, Trash2, Search, FileText, AlertCircle, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { GlossaryEntry } from '@/types';
import { getFromStorage, saveToStorage } from '@/utils/extensionStorage';
import { importGlossaryFromFile, exportGlossaryToCSV, exportGlossaryToXLSX } from '@/utils/fileImport';
import { toast } from 'sonner';

export function GlossaryManager() {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [languageNames, setLanguageNames] = useState<Record<string, string>>({});
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<{ translations: Record<string, string> }>({
    translations: {}
  });
  const [newLanguageCode, setNewLanguageCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load entries and language names from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const appState = await getFromStorage('appState');
      const glossary = appState?.predefinedTranslations || [];
      const langNames = appState?.languageNames || {};
      const sourceLang = appState?.sourceLanguageCKLS || '';
      const targetLangs = appState?.targetLanguagesCKLS || [];
      
      setEntries(glossary);
      setLanguageNames(langNames);
      setSourceLanguage(sourceLang);
      setTargetLanguages(targetLangs);
    } catch (error) {
      console.error('Failed to load glossary:', error);
      toast.error('Failed to load glossary');
    } finally {
      setLoading(false);
    }
  };

  const saveEntries = async (newEntries: GlossaryEntry[]) => {
    try {
      const appState = await getFromStorage('appState');
      await saveToStorage('appState', {
        ...appState,
        predefinedTranslations: newEntries
      });
      setEntries(newEntries);
      toast.success('Glossary saved successfully');
    } catch (error) {
      console.error('Failed to save glossary:', error);
      toast.error('Failed to save glossary');
    }
  };

  // Get all unique language codes from entries AND from Step 1 languages
  const getAllLanguageCodes = (): string[] => {
    const langCodes = new Set<string>();
    
    // Add languages from existing entries
    entries.forEach(entry => {
      Object.keys(entry.translations).forEach(lang => langCodes.add(lang));
    });
    
    // Add source language from Step 1
    if (sourceLanguage) langCodes.add(sourceLanguage);
    
    // Add target languages from Step 1
    targetLanguages.forEach(lang => langCodes.add(lang));
    
    return Array.from(langCodes).sort();
  };

  const getLanguageName = (ckls: string): string => {
    const baseCode = ckls.split('-')[0];
    const langName = languageNames[baseCode];
    return langName ? `${langName} (${ckls})` : ckls;
  };

  // Filter entries based on search
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Search in all translations
    return Object.values(entry.translations).some(trans => 
      trans.toLowerCase().includes(query)
    );
  });

  const handleAdd = () => {
    setEditingIndex(null);
    setFormData({ translations: {} });
    setNewLanguageCode('');
    setIsDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({
      translations: { ...entries[index].translations }
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (index: number) => {
    const firstTranslation = Object.values(entries[index].translations)[0] || 'this entry';
    if (!confirm(`Delete entry "${firstTranslation}"?`)) return;
    
    const newEntries = entries.filter((_, i) => i !== index);
    await saveEntries(newEntries);
  };

  const handleSaveEntry = async () => {
    const hasTranslation = Object.values(formData.translations).some(t => t.trim());
    if (!hasTranslation) {
      toast.error('At least one translation is required');
      return;
    }

    let newEntries: GlossaryEntry[];
    if (editingIndex !== null) {
      // Update existing entry
      newEntries = entries.map((entry, i) => 
        i === editingIndex ? formData : entry
      );
    } else {
      // Add new entry
      newEntries = [...entries, formData];
    }

    await saveEntries(newEntries);
    setIsDialogOpen(false);
    setFormData({ translations: {} });
    setEditingIndex(null);
  };

  const handleAddNewLanguage = () => {
    const langCode = newLanguageCode.trim();
    
    if (!langCode) {
      toast.error('Please enter a language code');
      return;
    }
    
    // Validate format (basic check for language code format)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/i.test(langCode)) {
      toast.error('Invalid language code format. Use format like: en-US, fr-FR, es');
      return;
    }
    
    if (formData.translations[langCode] !== undefined) {
      toast.warning(`Language ${langCode} already exists`);
      setNewLanguageCode('');
      return;
    }
    
    setFormData({
      ...formData,
      translations: { ...formData.translations, [langCode]: '' }
    });
    setNewLanguageCode('');
    toast.success(`Added ${langCode} - fill in the translation below`);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { entries: importedEntries, warnings } = await importGlossaryFromFile(
        file,
        languageNames
      );

      if (importedEntries.length === 0) {
        toast.error('No entries found in file');
        return;
      }

      // Merge with existing entries (avoid duplicates by comparing all translations)
      const existingEntryKeys = new Set(
        entries.map(e => JSON.stringify(e.translations))
      );
      const newEntries = importedEntries.filter(
        e => !existingEntryKeys.has(JSON.stringify(e.translations))
      );
      const mergedEntries = [...entries, ...newEntries];

      await saveEntries(mergedEntries);
      
      if (warnings.length > 0) {
        toast.warning(warnings.join('. '));
      }
      
      toast.success(`Imported ${newEntries.length} new entries`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    try {
      if (entries.length === 0) {
        toast.error('No entries to export');
        return;
      }

      const blob = exportGlossaryToCSV(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossary-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Glossary exported as CSV');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  const handleExportXLSX = () => {
    try {
      if (entries.length === 0) {
        toast.error('No entries to export');
        return;
      }

      const blob = exportGlossaryToXLSX(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossary-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Glossary exported as Excel');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  // Get all language codes that appear in at least one entry
  const languageCodes = getAllLanguageCodes();

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Loading glossary...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Glossary Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage predefined translations for specific terms
        </p>
      </div>

      {/* Action Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search glossary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
            <Button onClick={handleImport} variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={entries.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportXLSX}>
                  <Download className="w-4 h-4 mr-2" />
                  Export as Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export as CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Table */}
      {filteredEntries.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {languageCodes.map(lang => (
                  <TableHead key={lang}>
                    <Badge variant="outline" className="font-mono text-xs">
                      {lang}
                    </Badge>
                  </TableHead>
                ))}
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry, index) => (
                <TableRow key={index}>
                  {languageCodes.map(lang => (
                    <TableCell key={lang} className="text-sm">
                      {entry.translations[lang] || '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(entries.indexOf(entry))}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(entries.indexOf(entry))}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-1">No glossary entries yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'No entries match your search' : 'Add entries manually or import from a file'}
            </p>
            {!searchQuery && (
              <div className="flex gap-2 justify-center">
                <Button onClick={handleAdd} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Entry
                </Button>
                <Button onClick={handleImport} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import from File
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setNewLanguageCode('');
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingIndex !== null ? 'Edit Glossary Entry' : 'Add Glossary Entry'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4 px-1">
            {/* Translations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Translations</Label>
                <Badge variant="outline" className="text-xs">
                  {Object.keys(formData.translations).length} language{Object.keys(formData.translations).length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                {(() => {
                  // Merge languageCodes from Step 1 with any custom languages in formData
                  const allLanguagesInForm = Array.from(
                    new Set([...languageCodes, ...Object.keys(formData.translations)])
                  );
                  
                  return allLanguagesInForm.length > 0 ? (
                    <div className="grid gap-3">
                      {allLanguagesInForm.map(lang => (
                        <div key={lang} className="bg-background p-3 rounded-md border">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              {getLanguageName(lang)}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-mono">
                                {lang}
                              </Badge>
                              {/* Allow removing custom languages */}
                              {!languageCodes.includes(lang) && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    const newTranslations = { ...formData.translations };
                                    delete newTranslations[lang];
                                    setFormData({ ...formData, translations: newTranslations });
                                    toast.success(`Removed ${lang}`);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <Input
                            placeholder={`Enter translation...`}
                            value={formData.translations[lang] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              translations: { ...formData.translations, [lang]: e.target.value }
                            })}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No language codes detected. Go to Step 1 and select source and target languages first, or add a custom language below.
                      </AlertDescription>
                    </Alert>
                  );
                })()}
                
                {/* Allow adding new language */}
                <div className="pt-3 mt-3 border-t">
                  <Label className="text-sm font-medium mb-2 block">
                    Add Custom Language
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Language code (e.g., fr-FR, es-ES)"
                      className="flex-1"
                      value={newLanguageCode}
                      onChange={(e) => setNewLanguageCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewLanguage();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddNewLanguage}
                      disabled={!newLanguageCode.trim()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Custom languages will appear above. Click × to remove them.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              setNewLanguageCode('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry}>
              {editingIndex !== null ? 'Update' : 'Add'} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xml"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}

