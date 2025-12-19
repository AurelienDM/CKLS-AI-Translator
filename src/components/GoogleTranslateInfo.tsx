import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Info, Check, X } from 'lucide-react';
import { validateGoogleApiKey } from '@/utils/apiValidator';
import { ApiKeyInput } from './ApiKeyInput';

export function GoogleTranslateInfo() {
  const { state, setState } = useApp();
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Auto-validate existing API key on mount
  useEffect(() => {
    const autoValidate = async () => {
      if (state.googleApiKey && state.googleApiKey.length > 0) {
        // Check if already validated in storage
        try {
          const result = await chrome.storage.local.get('apiKeys');
          const apiKeys = result.apiKeys as { googleValidated?: boolean } | undefined;
          
          if (apiKeys?.googleValidated) {
            setIsValidated(true);
            setValidationMessage('API key validated');
            return;
          }
          
          // Not validated in storage, validate now
          const validation = await validateGoogleApiKey(state.googleApiKey);
          
          if (validation.valid) {
            setIsValidated(true);
            setValidationMessage(validation.message || 'API key validated');
            // Save validation status to storage
            const existingKeys = result.apiKeys || {};
            await chrome.storage.local.set({
              apiKeys: {
                ...(typeof existingKeys === 'object' ? existingKeys : {}),
                google: state.googleApiKey,
                googleValidated: true
              }
            });
          } else {
            setValidationError(validation.error || 'Invalid API key');
          }
        } catch (error) {
          console.error('Auto-validation failed:', error);
        }
      }
    };
    
    autoValidate();
  }, [state.googleApiKey]);

  const handleApiKeyChange = (value: string) => {
    setState({ googleApiKey: value });
    setIsValidated(false);
    setValidationError(null);
    setValidationMessage(null);
  };

  const handleValidate = async () => {
    setValidationError(null);
    
    try {
      const validation = await validateGoogleApiKey(state.googleApiKey);
      
      if (validation.valid) {
        setIsValidated(true);
        setValidationMessage(validation.message || 'API key validated');
        
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
      } else {
        setValidationError(validation.error || 'Invalid API key');
      }
    } catch (error: any) {
      setValidationError(error.message || 'Validation failed');
    }
  };

  // Show API key input if no key or not validated
  if (!state.googleApiKey || state.googleApiKey.length === 0 || !isValidated) {
    return (
      <div className="space-y-4">
        <ApiKeyInput
          service="google"
          value={state.googleApiKey || ''}
          isValidated={isValidated}
          onChange={handleApiKeyChange}
          onValidate={handleValidate}
          validationError={validationError}
          validationMessage={validationMessage}
        />
      </div>
    );
  }

  // Show Google info when API key is validated
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">About Google Translate</p>
            <p className="text-sm text-muted-foreground">
              Google Translate uses automatic translation with no custom settings. Fast and reliable for general purpose translation.
            </p>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-600" />
            <span>130+ languages</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-600" />
            <span>Fast processing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <X className="w-3 h-3 text-red-600" />
            <span>No formality control</span>
          </div>
          <div className="flex items-center gap-1.5">
            <X className="w-3 h-3 text-red-600" />
            <span>No custom instructions</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
