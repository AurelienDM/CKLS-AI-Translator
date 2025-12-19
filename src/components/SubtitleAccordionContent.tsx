import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Settings as SettingsIcon, Link2, CheckCircle } from 'lucide-react';
import { SubtitleTimingIssuesModal } from './SubtitleTimingIssuesModal';
import { openOptionsPage } from '@/utils/extensionHelpers';

export function SubtitleAccordionContent() {
  const { state, setState } = useApp();
  const [showTimingIssuesModal, setShowTimingIssuesModal] = useState(false);

  // Listen for TMX changes from storage (real-time updates from Settings page)
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.appState?.newValue) {
        const newAppState = changes.appState.newValue as any;
        if (newAppState.tmxMemories) {
          setState({
            tmxMemories: newAppState.tmxMemories
          });
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [setState]);

  if (!state.subtitleFiles || state.subtitleFiles.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No subtitle files loaded
      </div>
    );
  }

  // Calculate stats
  const totalSubtitles = state.subtitleFiles.reduce((sum, file) => sum + file.subtitles.length, 0);
  const uniqueTexts = state.subtitleDeduplicationStats?.uniqueTexts || 0;
  const duplicates = state.subtitleDeduplicationStats?.duplicates || 0;
  const savingsPercentage = state.subtitleDeduplicationStats?.savingsPercentage || 0;

  // Count timing issues across all files
  const totalTimingIssues = state.subtitleFiles.reduce(
    (sum, file) => sum + (file.timingIssues?.length || 0),
    0
  );

  const handleOpenSubtitleSettings = () => {
    openOptionsPage('subtitles');
  };

  const handleLinkTmx = (tmxFileName: string) => {
    setState({
      activeTmxLink: {
        tmxFileName,
        enabled: true,
        autoApplyThreshold: 95,
        showFuzzyMatches: true,
        fuzzyMatchThreshold: 70,
      }
    });
  };

  const handleUnlinkTmx = () => {
    setState({
      activeTmxLink: null
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Settings loaded from Extension Settings → Subtitles tab
      </p>

      {/* Batch Summary Card */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-medium mb-3">Batch Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Files:</span>
            <span className="font-medium">{state.subtitleFiles.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total subtitles:</span>
            <span className="font-medium">{totalSubtitles}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Unique texts:</span>
            <span className="font-medium">{uniqueTexts}</span>
          </div>
          {duplicates > 0 && (
            <div className="flex items-center justify-between text-primary">
              <span>Duplicates (savings):</span>
              <span className="font-medium">{duplicates} ({savingsPercentage}%)</span>
            </div>
          )}
          {totalTimingIssues > 0 && (
            <div className="flex items-center justify-between text-destructive mt-3 pt-3 border-t">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Timing issues:
              </span>
              <span className="font-medium">{totalTimingIssues}</span>
            </div>
          )}
        </div>
        
        {totalTimingIssues > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTimingIssuesModal(true)}
            className="w-full mt-3"
          >
            View Issues Details
          </Button>
        )}
      </Card>

      {/* File List */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Files in batch:</Label>
        <div className="space-y-1">
          {state.subtitleFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm p-2 bg-muted/20 rounded"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-1.5 py-0.5 bg-background rounded border">
                  {file.format.toUpperCase()}
                </span>
                <span className="truncate">{file.fileName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{file.subtitles.length} subs</span>
                {file.timingIssues && file.timingIssues.length > 0 && (
                  <span className="text-destructive">{file.timingIssues.length} issues</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Override: Line Break Strategy */}
      <div className="space-y-2">
        <Label htmlFor="lineBreakStrategy">
          Line Break Strategy (Project Override)
        </Label>
        <select
          id="lineBreakStrategy"
          value={state.subtitleSettings?.lineBreakStrategy || 'preserve'}
          onChange={(e) => setState({
            subtitleSettings: {
              ...state.subtitleSettings,
              lineBreakStrategy: e.target.value as 'preserve' | 'auto' | 'single'
            }
          })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="preserve">Preserve original (default)</option>
          <option value="auto">Auto-wrap based on character limit</option>
          <option value="single">Combine into single line</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Override the default line break behavior for this batch
        </p>
      </div>

      {/* Global Settings Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Active Settings:</Label>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="w-4 h-4"
            />
            <span className="text-muted-foreground">Use overlap detection (from settings)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="w-4 h-4"
            />
            <span className="text-muted-foreground">Use reading speed checks (from settings)</span>
          </div>
        </div>
      </div>

      {/* TMX Translation Memory - Link Only */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Translation Memory (TMX)
        </h4>
        
        <div className="space-y-3">
          {(!state.tmxMemories || state.tmxMemories.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              No TMX files imported yet. Import TMX files in{' '}
              <button
                onClick={handleOpenSubtitleSettings}
                className="text-primary hover:underline font-medium"
              >
                Extension Settings → Subtitles
              </button>
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Link a TMX file to this project for translation memory matching.
              </p>
              
              {/* List loaded TMX files */}
              <div className="space-y-2">
                {state.tmxMemories.map((tmx, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between text-sm p-2 bg-background rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{tmx.fileName}</span>
                      {state.activeTmxLink?.tmxFileName === tmx.fileName && (
                        <CheckCircle className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {tmx.units.length} units
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          if (state.activeTmxLink?.tmxFileName === tmx.fileName) {
                            handleUnlinkTmx();
                          } else {
                            handleLinkTmx(tmx.fileName);
                          }
                        }}
                      >
                        {state.activeTmxLink?.tmxFileName === tmx.fileName ? 'Unlink' : 'Link'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* TMX Settings */}
              {state.activeTmxLink && (
                <div className="space-y-2 mt-3 pt-3 border-t">
                  <Label className="text-xs font-medium">TMX Settings</Label>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tmx-auto-apply"
                      checked={state.activeTmxLink.enabled}
                      onChange={(e) => setState({
                        activeTmxLink: {
                          ...state.activeTmxLink!,
                          enabled: e.target.checked
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="tmx-auto-apply" className="text-sm cursor-pointer">
                      Auto-apply exact matches (≥95%)
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tmx-fuzzy"
                      checked={state.activeTmxLink.showFuzzyMatches}
                      onChange={(e) => setState({
                        activeTmxLink: {
                          ...state.activeTmxLink!,
                          showFuzzyMatches: e.target.checked
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="tmx-fuzzy" className="text-sm cursor-pointer">
                      Show fuzzy matches (≥70%)
                    </Label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Link to Options Page */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenSubtitleSettings}
        className="w-full"
      >
        <SettingsIcon className="w-4 h-4 mr-2" />
        Open Subtitle Settings
      </Button>

      {/* Timing Issues Modal */}
      <SubtitleTimingIssuesModal
        isOpen={showTimingIssuesModal}
        onClose={() => setShowTimingIssuesModal(false)}
        subtitleFiles={state.subtitleFiles}
      />
    </div>
  );
}

