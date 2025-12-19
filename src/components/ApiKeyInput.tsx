/**
 * API Key Input Component
 * Reusable component for managing translation API keys
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Key, ExternalLink } from 'lucide-react';

interface ApiKeyInputProps {
  service: 'deepl' | 'google';
  value: string;
  isValidated: boolean;
  onChange: (value: string) => void;
  onValidate: () => Promise<void>;
  validationError?: string | null;
  validationMessage?: string | null;
}

export function ApiKeyInput({
  service,
  value,
  isValidated,
  onChange,
  onValidate,
  validationError,
  validationMessage
}: ApiKeyInputProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      await onValidate();
    } finally {
      setIsValidating(false);
    }
  };

  const serviceName = service === 'deepl' ? 'DeepL' : 'Google Cloud Translation';
  const placeholder = service === 'deepl' 
    ? 'Enter your DeepL API key...'
    : 'Enter your Google Cloud API key...';

  return (
    <div className="space-y-3">
      {/* Explanation Card with embedded input */}
      <Card className="p-4 bg-muted/30 border-border">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Key className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-sm font-semibold text-foreground mb-1 block">
                {serviceName} API Key
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {service === 'google' ? (
                  <>
                    Get your API key from{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Google Cloud Console
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <br />
                    <span className="text-[11px]">Enable Cloud Translation API → Create credentials</span>
                  </>
                ) : (
                  <>
                    Get your API key from{' '}
                    <a
                      href="https://www.deepl.com/pro-api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      DeepL Pro
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <br />
                    <span className="text-[11px]">Free or paid plan available</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Input Field inside explanation */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pr-10 bg-background [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                disabled={isValidating}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-0 top-0 h-full px-3 hover:bg-accent rounded-r-md transition-colors flex items-center justify-center"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            <Button
              onClick={handleValidate}
              disabled={!value || value.length < 10 || isValidating || isValidated}
              variant="outline"
              className="min-w-[100px]"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : isValidated ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Valid
                </>
              ) : (
                'Validate'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Validation Error - Outside explanation card */}
      {validationError && (
        <Card className="p-3 bg-destructive/10 border-destructive/50">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Validation Failed</p>
              <p className="text-sm text-destructive/80 mt-1">{validationError}</p>
            </div>
          </div>
        </Card>
      )}

      {/* "Ready to Translate" Success Block - Kept separate */}
      {validationMessage && isValidated && (
        <Card className="p-3 bg-success/10 border-success/30">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-success-foreground">
                API Key Valid
              </p>
              <p className="text-sm text-success-foreground/80 mt-1">
                {validationMessage}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

