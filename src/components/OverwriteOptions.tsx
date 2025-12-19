import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export type OverwriteMode = 'keep-all' | 'overwrite-empty' | 'overwrite-all';

interface OverwriteOptionsProps {
  value: OverwriteMode;
  onChange: (value: OverwriteMode) => void;
  existingLanguageCount?: number;
}

export function OverwriteOptions({ value, onChange, existingLanguageCount = 0 }: OverwriteOptionsProps) {
  if (existingLanguageCount === 0) {
    return null; // Don't show if no existing languages
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          How should we handle the {existingLanguageCount} existing language{existingLanguageCount !== 1 ? 's' : ''} in your file?
        </p>

        <RadioGroup value={value} onValueChange={(val) => onChange(val as OverwriteMode)}>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border-2 transition-colors hover:bg-accent/50"
                 style={{ borderColor: value === 'keep-all' ? 'hsl(var(--primary))' : 'transparent' }}>
              <RadioGroupItem value="keep-all" id="keep-all" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="keep-all" className="font-normal cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="font-semibold">Keep all existing</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preserve all existing translations. Only add new target languages.
                  </p>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border-2 transition-colors hover:bg-accent/50"
                 style={{ borderColor: value === 'overwrite-empty' ? 'hsl(var(--primary))' : 'transparent' }}>
              <RadioGroupItem value="overwrite-empty" id="overwrite-empty" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="overwrite-empty" className="font-normal cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="font-semibold">Fill empty cells only</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only translate empty cells or cells containing formulas in existing languages.
                  </p>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border-2 transition-colors hover:bg-accent/50"
                 style={{ borderColor: value === 'overwrite-all' ? 'hsl(var(--primary))' : 'transparent' }}>
              <RadioGroupItem value="overwrite-all" id="overwrite-all" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="overwrite-all" className="font-normal cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="font-semibold">Overwrite all</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Replace all translations in existing languages with new translations.
                  </p>
                </Label>
              </div>
            </div>
          </div>
        </RadioGroup>
      </div>
    </Card>
  );
}

