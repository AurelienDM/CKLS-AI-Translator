import { useState } from 'react';
import { Download, FileUp, Plus, X, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DoNotTranslateProps {
  terms: string[];
  onAdd: (term: string) => void;
  onRemove: (index: number) => void;
  onImport: (terms: string[]) => void;
}

export function DoNotTranslate({ terms, onAdd, onRemove, onImport }: DoNotTranslateProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
    }
  };

  const handleDownloadTemplate = () => {
    const content = `# Do-Not-Translate List Template
# Add one term per line. Lines starting with # are comments.

# Brand names
CrossKnowledge
CKLS
API
URL

# Common CKLS placeholders (auto-detected, but can be added for reference)
{training_name}
{training_code}
{training_start_date}
{training_cartridge}
{url}
{ckconnect_url}
{learner_fullname}
{learner_manager}
{learner_lastname}
{learner_firstname}
{learner_login}

# Note: Placeholders with dynamic numbers like {00|Job Title} are automatically detected
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'do-not-translate-template.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')); // Remove comments and empty lines

        if (lines.length > 0) {
          onImport(lines);
        } else {
          alert('No valid terms found in file');
        }
      } catch (err) {
        alert('Failed to read file');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.txt')) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Ban className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Do-Not-Translate Terms
        </span>
        <Badge variant="secondary" className="text-xs">
          {terms.length}
        </Badge>
      </div>

      {/* Compact Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('dnt-import')?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 cursor-pointer
          transition-colors hover:bg-muted/50
          ${isDragging ? 'border-primary bg-muted/50' : 'border-muted-foreground/25'}
        `}
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <FileUp className="w-5 h-5 shrink-0" />
          <span>Drop TXT file or click to browse</span>
        </div>
        <input
          id="dnt-import"
          type="file"
          accept=".txt"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Template Download Link */}
      <button
        onClick={handleDownloadTemplate}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <Download className="w-4 h-4" />
        Download template (do-not-translate-template.txt)
      </button>

      {/* Separator */}
      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
          or add manually
        </span>
      </div>

      {/* Add New Term Form */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Add term to skip..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Terms that should never be translated (e.g., brand names, technical terms)
        </p>
      </div>

      {/* Terms List */}
      {terms.length > 0 ? (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {terms.map((term, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md group"
            >
              <span className="text-sm font-mono truncate">{term}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No terms added yet</p>
          <p className="text-xs mt-1">Add terms above or import a .txt file</p>
        </div>
      )}
    </div>
  );
}

