import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, BookCheck, BookPlus, ArrowRight } from 'lucide-react';

interface LanguageSummaryProps {
  sourceLanguage: string;
  existingLanguages: string[];
  targetLanguages: string[];
  languageNames: Record<string, string>;
}

export function LanguageSummary({
  sourceLanguage,
  existingLanguages,
  targetLanguages,
  languageNames
}: LanguageSummaryProps) {
  const getLanguageName = (ckls: string): string =>
    languageNames[ckls] ||
    languageNames[ckls.split('-')[0]] ||
    ckls;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-primary" />
          Translation Plan
        </h3>

        {/* Source */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-info" />
            <span className="text-xs font-medium text-muted-foreground">From:</span>
          </div>
          <Badge variant="secondary" className="font-mono bg-info/20 text-info-foreground">
            {sourceLanguage}
          </Badge>
          <span className="text-xs text-muted-foreground ml-2">
            {getLanguageName(sourceLanguage)}
          </span>
        </div>

        {/* New Targets */}
        {targetLanguages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookPlus className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                To (new): {targetLanguages.length} language{targetLanguages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {targetLanguages.map(lang => (
                <Badge key={lang} variant="default" className="font-mono">
                  {lang}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Existing (Skip) */}
        {existingLanguages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookCheck className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-medium text-muted-foreground">
                Skip: {existingLanguages.length} language{existingLanguages.length !== 1 ? 's' : ''} (existing)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {existingLanguages.map(lang => (
                <Badge
                  key={lang}
                  variant="secondary"
                  className="font-mono bg-success/20 text-success-foreground"
                >
                  {lang}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {targetLanguages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2 border-t">
            ⚠️ No new target languages selected
          </p>
        )}
      </div>
    </Card>
  );
}

