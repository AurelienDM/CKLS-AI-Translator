import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Settings, Download, Upload, CheckCircle2, FileJson, BookOpen, Ban, Languages, AlertTriangle, Copy, AlertCircle, Settings2, CheckCircle, Subtitles, ClipboardCheck } from 'lucide-react';
import { exportSettings, importSettings } from '@/utils/settingsExport';
import { getFromStorage } from '@/utils/extensionStorage';
import { GlossaryManager } from './GlossaryManager';
import { DoNotTranslateManager } from './DoNotTranslateManager';
import { ApiKeyManager } from './ApiKeyManager';
import { SubtitleSettingsTab } from './SubtitleSettingsTab';
import { ImportCorrectionsSimple } from './ImportCorrectionsSimple';

export function SettingsPage() {
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'success'>('idle');
  const [activeTab, setActiveTab] = useState('api-keys'); // Default to Translator tab
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for tab preference from localStorage on mount
  useEffect(() => {
    const tabToOpen = localStorage.getItem('optionsTabToOpen');
    if (tabToOpen) {
      setActiveTab(tabToOpen);
      localStorage.removeItem('optionsTabToOpen');
    }
  }, []);

  // Listen for navigation messages (when page is already open)
  useEffect(() => {
    const handleMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === 'NAVIGATE_TO_TAB' && message.tab) {
        setActiveTab(message.tab);
        // Clear localStorage to prevent confusion
        localStorage.removeItem('optionsTabToOpen');
        sendResponse({ success: true });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleExport = async () => {
    try {
      const appState = await getFromStorage('appState');
      exportSettings(appState, includeApiKeys);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importSettings(file);
      // Settings imported successfully
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch (error) {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Extension Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your AI Translate Extension preferences and data
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Translator
            </TabsTrigger>
            <TabsTrigger value="glossary" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Glossary
            </TabsTrigger>
            <TabsTrigger value="dnt" className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Do-Not-Translate
            </TabsTrigger>
            <TabsTrigger value="subtitles" className="flex items-center gap-2">
              <Subtitles className="w-4 h-4" />
              Subtitles
            </TabsTrigger>
            <TabsTrigger value="corrections" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Review Import
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Settings Management</h2>
                  <p className="text-sm text-muted-foreground">
                    Export your settings to back them up or import previously saved settings
                  </p>
                </div>

                <Separator />

                {/* Export Section */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Export Settings</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Download your current settings as a JSON file
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="include-api-keys"
                      checked={includeApiKeys}
                      onChange={(e) => setIncludeApiKeys(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Label htmlFor="include-api-keys" className="text-sm font-normal cursor-pointer">
                      Include API keys in export (keep secure!)
                    </Label>
                  </div>

                  <Button onClick={handleExport} className="w-full sm:w-auto">
                    <Download className="w-4 h-4 mr-2" />
                    Export Settings
                  </Button>

                  {exportStatus === 'success' && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Settings exported successfully!
                    </div>
                  )}
                </div>

                <Separator />

                {/* Import Section */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Import Settings</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Restore settings from a previously exported JSON file
                    </p>
                  </div>

                  <Button onClick={handleImportClick} variant="outline" className="w-full sm:w-auto">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Settings
                  </Button>

                  {importStatus === 'success' && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Settings imported successfully!
                    </div>
                  )}

                  {importStatus === 'error' && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <FileJson className="w-4 h-4" />
                      Failed to import settings. Invalid file format.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Disclaimer Section - Accordion */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="disclaimer" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold">Disclaimer & Best Practices</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-5 pt-2">
                        {/* Regional Variants */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Copy className="w-3.5 h-3.5" />
                            Regional Language Variants
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            When translating between <strong>regional variants of the same language</strong> 
                            (e.g., <code className="px-1.5 py-0.5 bg-muted rounded text-xs">en-US → en-GB</code>, 
                            <code className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">pt-PT → pt-BR</code>), 
                            the source text is <strong>copied directly</strong> without translation to avoid API errors.
                          </p>
                        </div>

                        {/* AI Review Required */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5" />
                            AI Translations Require Review
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            All AI-powered translations (Google, DeepL, Excel COPILOT) are <strong>machine-generated</strong> and 
                            may contain errors, inaccuracies, or cultural inappropriateness.
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                            <li>Always have translations <strong>reviewed by native speakers</strong></li>
                            <li>Check for context, tone, and cultural appropriateness</li>
                            <li>Verify technical terminology and brand names</li>
                          </ul>
                        </div>

                        {/* Per-Language Settings */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Settings2 className="w-3.5 h-3.5" />
                            Per-Language Overwrite Options
                          </h4>
                          <div className="space-y-1.5 ml-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-base">🟢</span>
                              <span><strong>Don't modify:</strong> <span className="text-muted-foreground">Existing translations preserved</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-base">🟡</span>
                              <span><strong>Fill empty:</strong> <span className="text-muted-foreground">Only empty cells are translated</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-base">🔴</span>
                              <span><strong>Overwrite all:</strong> <span className="text-muted-foreground">All cells are replaced</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Best Practices */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Best Practices
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                            <li>Use <strong>Glossary</strong> for consistent terminology</li>
                            <li>Set <strong>Do-Not-Translate</strong> for brand names and technical terms</li>
                            <li>Use <strong>Custom Instructions</strong> to guide translation style</li>
                            <li>Enable <strong>deduplication</strong> for consistency across files</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>

          {/* Glossary Tab */}
          <TabsContent value="glossary">
            <GlossaryManager />
          </TabsContent>

          {/* Do-Not-Translate Tab */}
          <TabsContent value="dnt">
            <DoNotTranslateManager />
          </TabsContent>

          {/* Subtitles Tab */}
          <TabsContent value="subtitles">
            <SubtitleSettingsTab />
          </TabsContent>

          {/* Import Corrections Tab */}
          <TabsContent value="corrections">
            <ImportCorrectionsSimple />
          </TabsContent>
        </Tabs>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

