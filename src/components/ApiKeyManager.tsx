import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save,
  Zap,
  Gauge,
  ShieldCheck,
  Cloud,
  FileSpreadsheet,
  Settings2,
  Check
} from 'lucide-react';
import { validateDeepLKey, validateGoogleKey } from '@/utils/apiValidation';
import { fetchDeepLQuota } from '@/utils/apiValidator';
import { DeepLQuotaDisplay } from './DeepLQuotaDisplay';
import { toast } from 'sonner';

interface ApiKeys {
  deepl: string | null;
  deeplValidated?: boolean;
  google: string | null;
  googleValidated?: boolean;
  defaultService: 'deepl' | 'google' | 'excel';
  enabledTranslators?: {
    deepl: boolean;
    google: boolean;
    excel: boolean;
  };
}

interface ValidationState {
  status: 'idle' | 'validating' | 'success' | 'error';
  message?: string;
}

export function ApiKeyManager() {
  const [deeplKey, setDeeplKey] = useState('');
  const [deeplRequestDelay, setDeeplRequestDelay] = useState(300);
  const [googleKey, setGoogleKey] = useState('');
  const [showDeeplKey, setShowDeeplKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [deeplValidation, setDeeplValidation] = useState<ValidationState>({ status: 'idle' });
  const [googleValidation, setGoogleValidation] = useState<ValidationState>({ status: 'idle' });
  const [deeplSaveStatus, setDeeplSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [googleSaveStatus, setGoogleSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deeplHasChanges, setDeeplHasChanges] = useState(false);
  const [googleHasChanges, setGoogleHasChanges] = useState(false);
  
  // Enabled translators state
  const [enabledTranslators, setEnabledTranslators] = useState({
    deepl: true,  // Always enabled by default
    google: false,
    excel: false
  });
  
  // Collapsible section states
  const [showDeepL, setShowDeepL] = useState(true);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showEnabledTranslators, setShowEnabledTranslators] = useState(false);

  // Load API keys on mount
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const result = await chrome.storage.local.get(['apiKeys', 'appState']);
        if (result.apiKeys) {
          const keys = result.apiKeys as ApiKeys;
          setDeeplKey(keys.deepl || '');
          setGoogleKey(keys.google || '');
          
          // Load enabled translators
          if (keys.enabledTranslators) {
            setEnabledTranslators(keys.enabledTranslators);
          }
          
          // Restore validation status from storage
          if (keys.deeplValidated) {
            setDeeplValidation({ status: 'success', message: 'API key validated' });
          }
          if (keys.googleValidated) {
            setGoogleValidation({ status: 'success', message: 'API key validated' });
          }
        }
        if (result.appState && typeof result.appState === 'object') {
          const appState = result.appState as { deeplRequestDelay?: number };
          setDeeplRequestDelay(appState.deeplRequestDelay ?? 300);
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };
    loadKeys();
  }, []);

  // Track changes for DeepL
  useEffect(() => {
    const checkDeeplChanges = async () => {
      const result = await chrome.storage.local.get('apiKeys');
      const savedKeys = result.apiKeys as ApiKeys | undefined;
      
      const hasChanges = (savedKeys?.deepl || '') !== deeplKey;
      setDeeplHasChanges(hasChanges);
      
      // Reset validation when key changes
      if (hasChanges) {
        setDeeplValidation({ status: 'idle' });
      }
    };
    checkDeeplChanges();
  }, [deeplKey]);

  // Track changes for Google
  useEffect(() => {
    const checkGoogleChanges = async () => {
      const result = await chrome.storage.local.get('apiKeys');
      const savedKeys = result.apiKeys as ApiKeys | undefined;
      
      const hasChanges = (savedKeys?.google || '') !== googleKey;
      setGoogleHasChanges(hasChanges);
      
      // Reset validation when key changes
      if (hasChanges) {
        setGoogleValidation({ status: 'idle' });
      }
    };
    checkGoogleChanges();
  }, [googleKey]);

  const handleSaveDeepL = async () => {
    setDeeplSaveStatus('saving');

    try {
      const result = await chrome.storage.local.get('apiKeys');
      const existingKeys = (result.apiKeys as ApiKeys) || {};
      
      let deeplValid = false;

      if (deeplKey.trim()) {
        setDeeplValidation({ status: 'validating' });
        const validationResult = await validateDeepLKey(deeplKey);
        deeplValid = validationResult.valid;
        setDeeplValidation({
          status: validationResult.valid ? 'success' : 'error',
          message: validationResult.valid ? validationResult.message : validationResult.error
        });
        
        // Show toast notifications
        if (validationResult.valid) {
          toast.success('DeepL API key saved', {
            description: validationResult.message || 'API key validated successfully'
          });
          
          // Fetch and store quota info after successful validation
          const quotaInfo = await fetchDeepLQuota(deeplKey);
          if (quotaInfo) {
            await chrome.storage.local.set({ deeplQuota: quotaInfo });
          }
        } else {
          toast.error('DeepL API key validation failed', {
            description: validationResult.error
          });
        }
      } else {
        setDeeplValidation({ status: 'idle' });
        toast.success('DeepL API key removed');
        // Clear quota when API key is removed
        await chrome.storage.local.remove('deeplQuota');
      }

      const apiKeys = {
        ...existingKeys,
        deepl: deeplKey.trim() || null,
        deeplValidated: deeplValid,
      };

      // Also save deeplRequestDelay to appState
      const appStateResult = await chrome.storage.local.get('appState');
      const appState = appStateResult.appState || {};
      
      await chrome.storage.local.set({ 
        apiKeys,
        appState: {
          ...appState,
          deeplRequestDelay: deeplRequestDelay
        }
      });
      
      setDeeplSaveStatus('saved');
      setDeeplHasChanges(false);
      
      setTimeout(() => setDeeplSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save DeepL API key:', error);
      setDeeplSaveStatus('idle');
      toast.error('Failed to save API key', {
        description: 'An unexpected error occurred'
      });
    }
  };

  const handleSaveGoogle = async () => {
    setGoogleSaveStatus('saving');

    try {
      const result = await chrome.storage.local.get('apiKeys');
      const existingKeys = (result.apiKeys as ApiKeys) || {};
      
      let googleValid = false;

      if (googleKey.trim()) {
        setGoogleValidation({ status: 'validating' });
        const validationResult = await validateGoogleKey(googleKey);
        googleValid = validationResult.valid;
        setGoogleValidation({
          status: validationResult.valid ? 'success' : 'error',
          message: validationResult.valid ? validationResult.message : validationResult.error
        });
        
        // Show toast notifications
        if (validationResult.valid) {
          toast.success('Google API key saved', {
            description: validationResult.message || 'API key validated successfully'
          });
        } else {
          toast.error('Google API key validation failed', {
            description: validationResult.error
          });
        }
      } else {
        setGoogleValidation({ status: 'idle' });
        toast.success('Google API key removed');
      }

      const apiKeys = {
        ...existingKeys,
        google: googleKey.trim() || null,
        googleValidated: googleValid,
      };

      await chrome.storage.local.set({ apiKeys });
      
      setGoogleSaveStatus('saved');
      setGoogleHasChanges(false);
      
      setTimeout(() => setGoogleSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save Google API key:', error);
      setGoogleSaveStatus('idle');
      toast.error('Failed to save API key', {
        description: 'An unexpected error occurred'
      });
    }
  };

  const handleToggleTranslator = async (translator: 'google' | 'excel', enabled: boolean) => {
    // DeepL is always enabled, can't be toggled
    const newEnabled = {
      ...enabledTranslators,
      [translator]: enabled
    };
    
    setEnabledTranslators(newEnabled);
    
    try {
      const result = await chrome.storage.local.get('apiKeys');
      const existingKeys = (result.apiKeys as ApiKeys) || {};

      const apiKeys = {
        ...existingKeys,
        enabledTranslators: newEnabled
      };

      await chrome.storage.local.set({ apiKeys });
      
      const translatorNames = {
        google: 'Google Translate',
        excel: 'Excel Builder'
      };
      
      toast.success(enabled ? 'Translator enabled' : 'Translator disabled', {
        description: translatorNames[translator]
      });
    } catch (error) {
      console.error('Failed to save enabled translators:', error);
      // Revert on error
      setEnabledTranslators(enabledTranslators);
      toast.error('Failed to update translator');
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Translator</h2>
          <p className="text-sm text-muted-foreground">
            Configure your translation API keys. Keys are stored locally and never synced.
          </p>
        </div>

        <Separator />

        {/* DeepL Section - Collapsible */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowDeepL(!showDeepL)}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold">DeepL AI Translation</span>
              {deeplValidation.status === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
            </div>
            <span>{showDeepL ? '▲' : '▼'}</span>
          </Button>

          {showDeepL && (
            <div className="space-y-6 pt-2">
              <p className="text-sm text-muted-foreground">
                High-quality AI translation with context awareness and custom instructions
              </p>

              {/* API Key Input */}
              <div className="space-y-3">
                <Label className="text-base font-medium">API Key</Label>
                
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-sm font-medium mb-2">Features</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Best translation quality
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Custom instructions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Context awareness
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://www.deepl.com/pro-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    DeepL API
                  </a>
                </p>

                <div className="space-y-2">
                  <Input
                    id="deepl-key"
                    type={showDeeplKey ? 'text' : 'password'}
                    value={deeplKey}
                    onChange={(e) => setDeeplKey(e.target.value)}
                    placeholder="Enter your DeepL API key"
                  />
                  
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      onClick={() => setShowDeeplKey(!showDeeplKey)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                    >
                      {showDeeplKey ? (
                        <>
                          <EyeOff className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Show</span>
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleSaveDeepL}
                      disabled={deeplSaveStatus === 'saving' || !deeplHasChanges}
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                    >
                      {deeplSaveStatus === 'saving' ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          <span className="text-xs">Validating...</span>
                        </>
                      ) : deeplSaveStatus === 'saved' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1.5 text-success" />
                          <span className="text-xs">Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Save & Validate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* DeepL Validation Feedback */}
                {deeplValidation.status === 'validating' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating API key...</span>
                  </div>
                )}
                {deeplValidation.status === 'success' && (
                  <Alert className="bg-success/10 border-success/30">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <AlertDescription className="text-success">
                      {deeplValidation.message}
                    </AlertDescription>
                  </Alert>
                )}
                {deeplValidation.status === 'error' && (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                      {deeplValidation.message}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* DeepL Quota Display - shown when API key is validated */}
                {deeplValidation.status === 'success' && deeplKey && (
                  <DeepLQuotaDisplay apiKey={deeplKey} />
                )}
              </div>

              <Separator />

              {/* DeepL Request Speed Setting */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Request Speed vs Success Rate</Label>
                <p className="text-sm text-muted-foreground">
                  Control delay between requests to balance speed with reliability
                </p>
                
                <div className="space-y-2">
                  {/* Fast option */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deeplRequestDelay === 100 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setDeeplRequestDelay(100);
                      setDeeplHasChanges(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-sm">Fast (100ms)</span>
                      </div>
                      <span className="text-xs text-muted-foreground">May hit rate limits</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Fastest but higher chance of 429 errors with Free API
                    </p>
                  </div>

                  {/* Balanced option */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deeplRequestDelay === 300 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setDeeplRequestDelay(300);
                      setDeeplHasChanges(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-sm">Balanced (300ms)</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Recommended</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Good balance between speed and reliability
                    </p>
                  </div>

                  {/* Reliable option */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deeplRequestDelay === 500 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setDeeplRequestDelay(500);
                      setDeeplHasChanges(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-sm">Reliable (500ms)</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Safest</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Slowest but highest success rate, best for Free API
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Google Section - Collapsible */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowGoogle(!showGoogle)}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-500" />
              <span className="text-lg font-semibold">Google Cloud Translation</span>
              {googleValidation.status === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
            </div>
            <span>{showGoogle ? '▲' : '▼'}</span>
          </Button>

          {showGoogle && (
            <div className="space-y-6 pt-2">
              <p className="text-sm text-muted-foreground">
                Fast and reliable translation service with wide language support
              </p>

              {/* API Key Input */}
              <div className="space-y-3">
                <Label className="text-base font-medium">API Key</Label>
                
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-sm font-medium mb-2">Features</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Fast processing
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Wide language support
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-success" />
                      Reliable infrastructure
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://cloud.google.com/translate"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Cloud Console
                  </a>
                </p>

                <div className="space-y-2">
                  <Input
                    id="google-key"
                    type={showGoogleKey ? 'text' : 'password'}
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    placeholder="Enter your Google API key"
                  />
                  
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      onClick={() => setShowGoogleKey(!showGoogleKey)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                    >
                      {showGoogleKey ? (
                        <>
                          <EyeOff className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Show</span>
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleSaveGoogle}
                      disabled={googleSaveStatus === 'saving' || !googleHasChanges}
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                    >
                      {googleSaveStatus === 'saving' ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          <span className="text-xs">Validating...</span>
                        </>
                      ) : googleSaveStatus === 'saved' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1.5 text-success" />
                          <span className="text-xs">Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1.5" />
                          <span className="text-xs">Save & Validate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Google Validation Feedback */}
                {googleValidation.status === 'validating' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating API key...</span>
                  </div>
                )}
                {googleValidation.status === 'success' && (
                  <Alert className="bg-success/10 border-success/30">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <AlertDescription className="text-success">
                      {googleValidation.message}
                    </AlertDescription>
                  </Alert>
                )}
                {googleValidation.status === 'error' && (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                      {googleValidation.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Enabled Translators - Collapsible */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowEnabledTranslators(!showEnabledTranslators)}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-lg font-semibold">Enabled Translators</span>
            </div>
            <span>{showEnabledTranslators ? '▲' : '▼'}</span>
          </Button>

          {showEnabledTranslators && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Choose which translation services to show in the translator. DeepL is always available.
              </p>

              <div className="space-y-3">
                {/* DeepL - Always enabled */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">DeepL AI</p>
                      <p className="text-xs text-muted-foreground">Best translation quality</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deeplValidation.status === 'success' ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                      </span>
                    ) : (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400" />
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">Always on</span>
                  </div>
                </div>

                {/* Google - Toggleable */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium">Google Translate</p>
                      <p className="text-xs text-muted-foreground">Fast with wide language support</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {enabledTranslators.google && (
                      googleValidation.status === 'success' ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                        </span>
                      ) : (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400" />
                        </span>
                      )
                    )}
                    <Switch
                      checked={enabledTranslators.google}
                      onCheckedChange={(checked) => handleToggleTranslator('google', checked)}
                    />
                  </div>
                </div>

                {/* Excel - Toggleable */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Excel Builder</p>
                      <p className="text-xs text-muted-foreground">Generate formulas (no API needed)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {enabledTranslators.excel && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                      </span>
                    )}
                    <Switch
                      checked={enabledTranslators.excel}
                      onCheckedChange={(checked) => handleToggleTranslator('excel', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
