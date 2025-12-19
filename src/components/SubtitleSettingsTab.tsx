import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Info, CheckCircle, Upload, Trash2 } from 'lucide-react';
import { BBC_SUBTITLE_STANDARDS, PERFORMANCE_LIMITS } from '@/types/subtitle';
import type { SubtitleSettings } from '@/types/subtitle';
import { parseTmxFile } from '@/modules/TmxParser';
import type { TmxMemory } from '@/types/tmx';

export function SubtitleSettingsTab() {
  const [settings, setSettings] = useState<SubtitleSettings>(BBC_SUBTITLE_STANDARDS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tmxMemories, setTmxMemories] = useState<TmxMemory[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadTmxMemories();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get('subtitleSettings');
      if (result.subtitleSettings && typeof result.subtitleSettings === 'object') {
        setSettings({ ...BBC_SUBTITLE_STANDARDS, ...result.subtitleSettings });
      }
    } catch (error) {
      console.error('Failed to load subtitle settings:', error);
    }
  };

  const loadTmxMemories = async () => {
    try {
      const result = await chrome.storage.local.get('appState');
      const appState = result.appState as any;
      if (appState && appState.tmxMemories && Array.isArray(appState.tmxMemories)) {
        setTmxMemories(appState.tmxMemories);
      }
    } catch (error) {
      console.error('Failed to load TMX memories:', error);
    }
  };

  const saveSettings = async () => {
    setSaveStatus('saving');
    try {
      await chrome.storage.local.set({ subtitleSettings: settings });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save subtitle settings:', error);
      setSaveStatus('idle');
    }
  };

  const handleTmxImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const tmxMemory = await parseTmxFile(file);
      const newTmxMemories = [...tmxMemories, tmxMemory];
      setTmxMemories(newTmxMemories);
      
      // Save to storage
      const result = await chrome.storage.local.get('appState');
      await chrome.storage.local.set({
        appState: {
          ...(result.appState || {}),
          tmxMemories: newTmxMemories
        }
      });
      
      alert(`✅ Imported TMX: ${tmxMemory.units.length} translation units`);
    } catch (error) {
      alert('Error importing TMX: ' + (error as Error).message);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleTmxDelete = async (index: number) => {
    if (!confirm('Delete this TMX file?')) return;
    
    const newTmxMemories = tmxMemories.filter((_, i) => i !== index);
    setTmxMemories(newTmxMemories);
    
    // Save to storage
    const result = await chrome.storage.local.get('appState');
    await chrome.storage.local.set({
      appState: {
        ...(result.appState || {}),
        tmxMemories: newTmxMemories
      }
    });
  };

  const resetToDefaults = () => {
    setSettings(BBC_SUBTITLE_STANDARDS);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Subtitle Translation Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure default settings for .srt and .vtt subtitle file translation
          </p>
        </div>

        <Separator />

        {/* BASIC SETTINGS */}
        <div className="space-y-4">
          <div>
            <Label className="text-lg font-semibold">Basic Settings</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Essential settings for most subtitle translation projects
            </p>
          </div>

          {/* Format Standards */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Format Standards (BBC Guidelines)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCharsPerLine">Maximum Characters per Line</Label>
                <input
                  id="maxCharsPerLine"
                  type="number"
                  min="20"
                  max="60"
                  value={settings.maxCharsPerLine}
                  onChange={(e) => setSettings({ ...settings, maxCharsPerLine: parseInt(e.target.value) || 37 })}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-muted-foreground">
                  BBC: 37 chars, Netflix: 42 chars
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxLinesPerSubtitle">Maximum Lines per Subtitle</Label>
                <input
                  id="maxLinesPerSubtitle"
                  type="number"
                  min="1"
                  max="3"
                  value={settings.maxLinesPerSubtitle}
                  onChange={(e) => setSettings({ ...settings, maxLinesPerSubtitle: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-muted-foreground">
                  Most players support 2 lines
                </p>
              </div>
            </div>
          </div>

          {/* Output Preferences */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Output Preferences</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outputFormat">Output Format</Label>
                <select
                  id="outputFormat"
                  value={settings.outputFormat}
                  onChange={(e) => setSettings({ ...settings, outputFormat: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="match-input">Match input format</option>
                  <option value="srt">Always SRT</option>
                  <option value="vtt">Always VTT</option>
                  <option value="both">Both formats</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outputEncoding">Encoding</Label>
                <select
                  id="outputEncoding"
                  value={settings.outputEncoding}
                  onChange={(e) => setSettings({ ...settings, outputEncoding: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="UTF-8">UTF-8 (recommended)</option>
                  <option value="UTF-8-BOM">UTF-8 with BOM</option>
                  <option value="ISO-8859-1">ISO-8859-1</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="addLanguageCodeToFilename"
                type="checkbox"
                checked={settings.addLanguageCodeToFilename}
                onChange={(e) => setSettings({ ...settings, addLanguageCodeToFilename: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="addLanguageCodeToFilename">Add language code to filename</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="preserveHtmlTags"
                type="checkbox"
                checked={settings.preserveHtmlTags}
                onChange={(e) => setSettings({ ...settings, preserveHtmlTags: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="preserveHtmlTags">Preserve HTML formatting tags (&lt;i&gt;, &lt;b&gt;, &lt;u&gt;)</Label>
            </div>
          </div>

          {/* TMX Translation Memory Section - AT END OF BASIC SETTINGS */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Translation Memory (TMX)</Label>
            <p className="text-sm text-muted-foreground">
              Import TMX files to reuse previous translations and save API costs
            </p>

            <div className="space-y-3">
              <Label htmlFor="tmx-import" className="cursor-pointer">
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import TMX File
                  </span>
                </Button>
              </Label>
              <input
                id="tmx-import"
                type="file"
                accept=".tmx"
                className="hidden"
                onChange={handleTmxImport}
              />

              {tmxMemories.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Imported TMX files:</Label>
                  {tmxMemories.map((tmx, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between text-sm p-2 bg-muted/20 rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{tmx.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {tmx.units.length} translation units • {tmx.targetLangs.join(', ')}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleTmxDelete(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* ADVANCED SETTINGS */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between"
          >
            <span className="text-lg font-semibold">Advanced Settings</span>
            <span>{showAdvanced ? '▲' : '▼'}</span>
          </Button>

          {showAdvanced && (
            <div className="space-y-6 pt-2">
              {/* Reading Speed Validation */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Reading Speed Validation</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="enableReadingSpeedCheck"
                    type="checkbox"
                    checked={settings.enableReadingSpeedCheck}
                    onChange={(e) => setSettings({ ...settings, enableReadingSpeedCheck: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="enableReadingSpeedCheck">Enable reading speed checks</Label>
                </div>

                {settings.enableReadingSpeedCheck && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label htmlFor="minCharsPerSecond">Min chars/second</Label>
                      <input
                        id="minCharsPerSecond"
                        type="number"
                        min="10"
                        max="25"
                        value={settings.minCharsPerSecond}
                        onChange={(e) => setSettings({ ...settings, minCharsPerSecond: parseInt(e.target.value) || 15 })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxCharsPerSecond">Max chars/second</Label>
                      <input
                        id="maxCharsPerSecond"
                        type="number"
                        min="10"
                        max="30"
                        value={settings.maxCharsPerSecond}
                        onChange={(e) => setSettings({ ...settings, maxCharsPerSecond: parseInt(e.target.value) || 21 })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground col-span-2">
                      BBC comfortable: 15-21 cps
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Timing & Overlap Detection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Timing & Overlap Detection</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="enableOverlapDetection"
                    type="checkbox"
                    checked={settings.enableOverlapDetection}
                    onChange={(e) => setSettings({ ...settings, enableOverlapDetection: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="enableOverlapDetection">Enable overlap detection</Label>
                </div>

                {settings.enableOverlapDetection && (
                  <div className="ml-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="minGapBetweenCues">Minimum Gap Between Cues (ms)</Label>
                      <input
                        id="minGapBetweenCues"
                        type="number"
                        min="0"
                        max="500"
                        value={settings.minGapBetweenCues}
                        onChange={(e) => setSettings({ ...settings, minGapBetweenCues: parseInt(e.target.value) || 100 })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: 100-200ms
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="overlapResolution">Overlap Resolution Strategy</Label>
                      <select
                        id="overlapResolution"
                        value={settings.overlapResolution}
                        onChange={(e) => setSettings({ ...settings, overlapResolution: e.target.value as 'warn' | 'shorten-prev' | 'delay-next' })}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="warn">Warn only (no auto-fix)</option>
                        <option value="shorten-prev">Shorten previous subtitle</option>
                        <option value="delay-next">Delay next subtitle</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* VTT-Specific Options */}
              <div className="space-y-4">
                <Label className="text-base font-medium">WebVTT Options</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      id="preserveVttNoteBlocks"
                      type="checkbox"
                      checked={settings.preserveVttNoteBlocks}
                      onChange={(e) => setSettings({ ...settings, preserveVttNoteBlocks: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="preserveVttNoteBlocks">Preserve NOTE blocks</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="preserveVttStyleBlocks"
                      type="checkbox"
                      checked={settings.preserveVttStyleBlocks}
                      onChange={(e) => setSettings({ ...settings, preserveVttStyleBlocks: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="preserveVttStyleBlocks">Preserve STYLE blocks</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="preserveVttCueSettings"
                      type="checkbox"
                      checked={settings.preserveVttCueSettings}
                      onChange={(e) => setSettings({ ...settings, preserveVttCueSettings: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="preserveVttCueSettings">Preserve cue position settings</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="treatVoiceTagsAsDNT"
                      type="checkbox"
                      checked={settings.treatVoiceTagsAsDNT}
                      onChange={(e) => setSettings({ ...settings, treatVoiceTagsAsDNT: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="treatVoiceTagsAsDNT">Treat voice tags as Do-Not-Translate</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Limits */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Performance Limits</Label>
                <div className="bg-muted/30 p-4 rounded-md space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-sm space-y-1">
                      <p>• Max file size: <strong>{PERFORMANCE_LIMITS.maxFileSizeMB}MB</strong></p>
                      <p>• Max subtitles/file: <strong>{PERFORMANCE_LIMITS.maxSubtitlesPerFile}</strong></p>
                      <p>• Max files/batch: <strong>{PERFORMANCE_LIMITS.maxFilesInBatch}</strong></p>
                      <p>• Max total subtitles: <strong>{PERFORMANCE_LIMITS.maxTotalSubtitles}</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={resetToDefaults}>
            Reset to BBC Defaults
          </Button>

          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Settings saved</span>
              </div>
            )}
            <Button
              onClick={saveSettings}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
