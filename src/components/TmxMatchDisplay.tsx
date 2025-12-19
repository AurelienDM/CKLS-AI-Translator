import { TmxMatch } from '@/types/tmx';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TmxMatchDisplayProps {
  matches: TmxMatch[];
  onSelect: (translation: string) => void;
}

export function TmxMatchDisplay({ matches, onSelect }: TmxMatchDisplayProps) {
  if (matches.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No TMX matches found
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">TMX Matches ({matches.length})</h4>
      {matches.map((match, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={match.matchType === 'exact' ? 'default' : 'secondary'}>
                  {match.matchScore}% {match.matchType}
                </Badge>
                {match.unit.quality && (
                  <Badge variant="outline">Q: {match.unit.quality}</Badge>
                )}
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Source:</div>
                <div className="font-mono text-xs bg-muted p-1 rounded">{match.sourceText}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Translation:</div>
                <div className="font-mono text-xs bg-primary/10 p-1 rounded">{match.targetText}</div>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => onSelect(match.targetText)}
            >
              Use
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

