import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { openOptionsPage } from '@/utils/extensionHelpers';

export function ApiKeyStatus() {
  return (
    <div className="flex items-center justify-end py-2">
      <Button
        onClick={() => openOptionsPage('api-keys')}
        size="sm"
        variant="outline"
        className="h-8 text-xs px-3 gap-2"
      >
        <Settings className="w-3.5 h-3.5" />
        Options
      </Button>
    </div>
  );
}
