import { Settings, ExternalLink, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GlossaryEntry } from '@/types';
import { openOptionsPage } from '@/utils/extensionHelpers';

interface GlossaryCompactViewProps {
  entries: GlossaryEntry[];
  languageNames?: Record<string, string>;
  sourceLanguage?: string; // Source language from Step 1
}

function CompactEntryRow({ entry, sourceLanguage }: { entry: GlossaryEntry; sourceLanguage?: string }) {
  // Use source language translation as the main text, or first available translation
  const sourceText = sourceLanguage && entry.translations[sourceLanguage] 
    ? entry.translations[sourceLanguage]
    : Object.values(entry.translations)[0] || '';
  
  // Get other translations
  const otherTranslations = Object.entries(entry.translations)
    .filter(([lang]) => !sourceLanguage || lang !== sourceLanguage)
    .map(([_, trans]) => trans)
    .filter(trans => trans.trim())
    .join(', ');
  
  return (
    <div className="text-sm py-1.5 border-b last:border-0">
      <span className="font-medium">{sourceText}</span>
      {otherTranslations && (
        <>
          <span className="text-muted-foreground mx-2">→</span>
          <span className="text-muted-foreground">{otherTranslations}</span>
        </>
      )}
    </div>
  );
}

export function GlossaryCompactView({ entries, sourceLanguage }: GlossaryCompactViewProps) {
  const displayEntries = entries.slice(0, 5);
  const hasMore = entries.length > 5;
  
  const handleManage = () => {
    openOptionsPage('glossary');
  };
  
  if (entries.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-medium mb-1">No glossary entries yet</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Define translations for specific terms in Settings
          </p>
          <Button variant="outline" size="sm" onClick={handleManage}>
            <Settings className="w-4 h-4 mr-2" />
            Open Settings
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Compact list */}
      <Card className="p-4">
        <div className="space-y-0.5">
          {displayEntries.map((entry, idx) => (
            <CompactEntryRow key={idx} entry={entry} sourceLanguage={sourceLanguage} />
          ))}
        </div>
        
        {hasMore && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
            Showing 5 of {entries.length} entries
          </p>
        )}
      </Card>
      
      {/* Manage button */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleManage}
        className="w-full"
      >
        <Settings className="w-4 h-4 mr-2" />
        Manage in Settings
        <ExternalLink className="w-3 h-3 ml-auto" />
      </Button>
    </div>
  );
}

