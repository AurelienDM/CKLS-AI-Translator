import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Download, Upload } from 'lucide-react';
import { exportSettings, importSettings } from '@/utils/settingsExport';
import { toast } from 'sonner';

export function SettingsMenu() {
  const { state, setState } = useApp();
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportSettings(state, includeApiKeys);
      toast.success('Settings exported successfully', {
        description: `Settings ${includeApiKeys ? 'with API keys' : 'without API keys'} downloaded`,
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const settings = await importSettings(file);
      
      // Apply imported settings to state
      setState({
        doNotTranslate: settings.doNotTranslate,
        predefinedTranslations: settings.predefinedTranslations,
        formalitySettings: settings.formalitySettings || {},
        useFormalitySettings: settings.useFormalitySettings || false,
        copilotOptions: settings.copilotOptions || {},
        copilotCustomInstructions: settings.copilotCustomInstructions || {},
        useCopilotInstructions: settings.useCopilotInstructions || false,
        overwriteMode: settings.overwriteMode as any,
        ...(settings.deeplApiKey && { deeplApiKey: settings.deeplApiKey }),
        ...(settings.googleApiKey && { googleApiKey: settings.googleApiKey }),
      });

      const hasApiKeys = !!(settings.deeplApiKey || settings.googleApiKey);
      toast.success('Settings imported successfully', {
        description: hasApiKeys 
          ? 'Settings and API keys restored' 
          : 'Settings restored (no API keys included)',
      });
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Invalid settings file',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Settings menu"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={includeApiKeys}
            onCheckedChange={setIncludeApiKeys}
          >
            Include API Keys
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </>
  );
}

