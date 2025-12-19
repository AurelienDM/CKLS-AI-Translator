import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Download, Trash2, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFromStorage, saveToStorage } from '@/utils/extensionStorage';
import { importDoNotTranslateFromFile, exportDoNotTranslateToTXT } from '@/utils/fileImport';
import { toast } from 'sonner';

export function DoNotTranslateManager() {
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load terms from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const appState = await getFromStorage('appState');
      const dntTerms = appState?.doNotTranslate || [];
      
      setTerms(dntTerms);
    } catch (error) {
      console.error('Failed to load do-not-translate terms:', error);
      toast.error('Failed to load terms');
    } finally {
      setLoading(false);
    }
  };

  const saveTerms = async (newTerms: string[]) => {
    try {
      const appState = await getFromStorage('appState');
      await saveToStorage('appState', {
        ...appState,
        doNotTranslate: newTerms
      });
      setTerms(newTerms);
      toast.success('Terms saved successfully');
    } catch (error) {
      console.error('Failed to save terms:', error);
      toast.error('Failed to save terms');
    }
  };

  // Filter terms based on search
  const filteredTerms = terms.filter(term => {
    if (!searchQuery) return true;
    return term.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAdd = async () => {
    const trimmedTerm = newTerm.trim();
    if (!trimmedTerm) {
      toast.error('Term cannot be empty');
      return;
    }

    if (terms.includes(trimmedTerm)) {
      toast.error('Term already exists');
      return;
    }

    const newTerms = [...terms, trimmedTerm].sort();
    await saveTerms(newTerms);
    setNewTerm('');
  };

  const handleDelete = async (index: number) => {
    if (!confirm(`Delete term "${terms[index]}"?`)) return;
    
    const newTerms = terms.filter((_, i) => i !== index);
    await saveTerms(newTerms);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { terms: importedTerms, warnings } = await importDoNotTranslateFromFile(file);

      if (importedTerms.length === 0) {
        toast.error('No terms found in file');
        return;
      }

      // Merge with existing terms (remove duplicates and sort)
      const mergedTerms = Array.from(new Set([...terms, ...importedTerms])).sort();
      const newTermsCount = mergedTerms.length - terms.length;

      await saveTerms(mergedTerms);
      
      if (warnings.length > 0) {
        toast.warning(warnings.join('. '));
      }
      
      toast.success(`Imported ${newTermsCount} new terms`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    try {
      if (terms.length === 0) {
        toast.error('No terms to export');
        return;
      }

      const blob = exportDoNotTranslateToTXT(terms);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `do-not-translate-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Terms exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Loading terms...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Do-Not-Translate Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage terms that should not be translated (brand names, technical terms, etc.)
        </p>
      </div>

      {/* Action Bar */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Add new term */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Add a new term..."
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Search and import/export */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search terms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm" disabled={terms.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      {filteredTerms.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTerms.map((term, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{term}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(terms.indexOf(term))}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            <h3 className="text-lg font-medium mb-1">No terms yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'No terms match your search' : 'Add terms manually or import from a file'}
            </p>
            {!searchQuery && (
              <Button onClick={handleImport} variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import from File
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}

