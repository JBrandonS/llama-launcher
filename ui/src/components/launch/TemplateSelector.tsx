import { useState, useMemo } from 'react';
import { cn } from '@utils/cn';
import { TemplateLoader, type Template } from '@utils/templateLoader';
import { Sparkles, ChevronDown, Check } from 'lucide-react';

interface TemplateSelectorProps {
  modelPath: string;
  selectedTemplateId: string;
  onTemplateSelect: (templateId: string) => void;
}

function isTemplateForModel(template: Template, modelPath: string): boolean {
  const normalized = modelPath.toLowerCase();
  const templateModel = template.model.toLowerCase();
  return (
    normalized.includes(templateModel) ||
    templateModel.includes(normalized) ||
    normalized.includes(template.id) ||
    template.id.includes(normalized)
  );
}

export function TemplateSelector({
  modelPath,
  selectedTemplateId,
  onTemplateSelect,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);

  const matchingTemplates = useMemo(() => {
    if (!modelPath) return [];
    return TemplateLoader.templates.filter((t) => isTemplateForModel(t, modelPath));
  }, [modelPath]);

  const defaultTemplate = useMemo(() => {
    if (matchingTemplates.length === 0) return null;
    // Priority: selectedTemplateId (explicit) > last used > first
    if (selectedTemplateId) {
      const found = matchingTemplates.find((t) => t.id === selectedTemplateId);
      if (found) return found;
    }
    return TemplateLoader.getDefaultTemplate(modelPath);
  }, [matchingTemplates, modelPath, selectedTemplateId]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return matchingTemplates.find((t) => t.id === selectedTemplateId) ?? null;
  }, [matchingTemplates, selectedTemplateId]);

  const displayName = selectedTemplate?.name ?? defaultTemplate?.name;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Template</span>
      </div>

      <div className="relative" data-template-dropdown>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={matchingTemplates.length === 0}
          className={cn(
            'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
            'focus:border-ring focus:ring-2 focus:ring-ring/20',
            'flex items-center justify-between text-left',
            matchingTemplates.length === 0 && 'cursor-not-allowed opacity-50',
            !displayName && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{displayName || 'No templates available'}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>

        {open && matchingTemplates.length > 0 && (
          <>
     
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-card shadow-lg">
              {matchingTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    onTemplateSelect(template.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2',
                    template.id === selectedTemplateId && 'bg-accent font-medium'
                  )}
                >
                  {template.id === selectedTemplateId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{template.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {template.model.split('/').pop() ?? template.model}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedTemplate && (
        <p className="text-xs text-muted-foreground">
          {matchingTemplates.length} template{matchingTemplates.length > 1 ? 's' : ''} available for this model
        </p>
      )}
    </div>
  );
}
