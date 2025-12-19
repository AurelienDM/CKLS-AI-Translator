/**
 * DeepL Style Rules API Service
 * Manages style rule lists for Pro accounts
 */

export interface CustomInstruction {
  label: string;
  prompt: string;
  source_language?: string;
}

export interface StyleRuleConfig {
  name: string;
  language: string;
  formality?: 'use_formal_tone' | 'use_casual_tone';
  custom_instructions?: CustomInstruction[];
}

export interface StyleRule {
  style_id: string;
  name: string;
  language: string;
  creation_time: string;
  updated_time: string;
  version: number;
  configured_rules?: any;
  custom_instructions?: CustomInstruction[];
}

/**
 * Get base URL for Style Rules API
 */
function getStyleRulesBaseUrl(apiKey: string): string {
  const isFreeKey = apiKey.endsWith(':fx');
  return isFreeKey 
    ? 'https://api-free.deepl.com/v3/style_rules'
    : 'https://api.deepl.com/v3/style_rules';
}

/**
 * Create a new style rule list
 */
export async function createStyleRule(
  apiKey: string,
  config: StyleRuleConfig
): Promise<StyleRule> {
  const url = getStyleRulesBaseUrl(apiKey);
  
  const body: any = {
    name: config.name,
    language: config.language,
  };
  
  if (config.formality) {
    body.configured_rules = {
      style_and_tone: {
        formality: config.formality
      }
    };
  }
  
  if (config.custom_instructions && config.custom_instructions.length > 0) {
    body.custom_instructions = config.custom_instructions;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to create style rule: ${(errorData as any).message || response.statusText}`);
  }
  
  return response.json();
}

/**
 * List all style rules
 */
export async function listStyleRules(apiKey: string): Promise<StyleRule[]> {
  const url = getStyleRulesBaseUrl(apiKey);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to list style rules: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.style_rules || [];
}

/**
 * Update an existing style rule
 */
export async function updateStyleRule(
  apiKey: string,
  styleId: string,
  config: StyleRuleConfig
): Promise<StyleRule> {
  const url = `${getStyleRulesBaseUrl(apiKey)}/${styleId}`;
  
  const body: any = {
    name: config.name,
    language: config.language,
  };
  
  if (config.formality) {
    body.configured_rules = {
      style_and_tone: {
        formality: config.formality
      }
    };
  }
  
  if (config.custom_instructions && config.custom_instructions.length > 0) {
    body.custom_instructions = config.custom_instructions;
  }
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to update style rule: ${(errorData as any).message || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete a style rule
 */
export async function deleteStyleRule(apiKey: string, styleId: string): Promise<void> {
  const url = `${getStyleRulesBaseUrl(apiKey)}/${styleId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete style rule: ${response.statusText}`);
  }
}

