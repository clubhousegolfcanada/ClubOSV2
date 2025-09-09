import React, { useState, useEffect } from 'react';
import { Palette, Download, Save, RefreshCw, Eye, Copy, Check } from 'lucide-react';
import { StatusBadge, Button, LoadingSpinner } from '@/components/ui';

interface ThemeColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  accentHover: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

interface ThemePreset {
  name: string;
  description: string;
  colors: ThemeColors;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'ClubOS Green (Current)',
    description: 'The current ClubOS brand colors',
    colors: {
      primary: 'var(--accent)',
      primaryHover: '#084a45',
      secondary: '#f9fafb',
      accent: 'var(--accent)',
      accentHover: '#084a45',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },
  {
    name: 'Corporate Blue',
    description: 'Professional blue theme',
    colors: {
      primary: '#1e40af',
      primaryHover: '#1e3a8a',
      secondary: '#f0f9ff',
      accent: '#1e40af',
      accentHover: '#1e3a8a',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },
  {
    name: 'Modern Purple',
    description: 'Contemporary purple theme',
    colors: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      secondary: '#faf5ff',
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },
  {
    name: 'Ocean Teal',
    description: 'Calming ocean-inspired theme',
    colors: {
      primary: '#0891b2',
      primaryHover: '#0e7490',
      secondary: '#f0fdfa',
      accent: '#0891b2',
      accentHover: '#0e7490',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },
  {
    name: 'Sunset Orange',
    description: 'Warm and energetic theme',
    colors: {
      primary: '#ea580c',
      primaryHover: '#c2410c',
      secondary: '#fff7ed',
      accent: '#ea580c',
      accentHover: '#c2410c',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },
  {
    name: 'Slate Gray',
    description: 'Minimalist grayscale theme',
    colors: {
      primary: '#475569',
      primaryHover: '#334155',
      secondary: '#f8fafc',
      accent: '#475569',
      accentHover: '#334155',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  }
];

export const ThemeConfigurator: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<ThemePreset>(THEME_PRESETS[0]);
  const [customColors, setCustomColors] = useState<ThemeColors>(THEME_PRESETS[0].colors);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [originalColors, setOriginalColors] = useState<ThemeColors | null>(null);

  // Apply theme colors to CSS variables
  const applyTheme = (colors: ThemeColors) => {
    const root = document.documentElement;
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--status-success', colors.success);
    root.style.setProperty('--status-error', colors.error);
    root.style.setProperty('--status-warning', colors.warning);
    root.style.setProperty('--status-info', colors.info);
  };

  // Save original colors on mount
  useEffect(() => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const original: ThemeColors = {
      primary: computedStyle.getPropertyValue('--accent').trim() || 'var(--accent)',
      primaryHover: computedStyle.getPropertyValue('--accent-hover').trim() || '#084a45',
      secondary: '#f9fafb',
      accent: computedStyle.getPropertyValue('--accent').trim() || 'var(--accent)',
      accentHover: computedStyle.getPropertyValue('--accent-hover').trim() || '#084a45',
      success: computedStyle.getPropertyValue('--status-success').trim() || '#10b981',
      error: computedStyle.getPropertyValue('--status-error').trim() || '#ef4444',
      warning: computedStyle.getPropertyValue('--status-warning').trim() || '#f59e0b',
      info: computedStyle.getPropertyValue('--status-info').trim() || '#3b82f6',
    };
    setOriginalColors(original);
  }, []);

  const handlePresetSelect = (preset: ThemePreset) => {
    setSelectedPreset(preset);
    setCustomColors(preset.colors);
    if (isPreviewMode) {
      applyTheme(preset.colors);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...customColors, [key]: value };
    setCustomColors(newColors);
    if (isPreviewMode) {
      applyTheme(newColors);
    }
  };

  const togglePreview = () => {
    if (!isPreviewMode) {
      applyTheme(customColors);
    } else if (originalColors) {
      applyTheme(originalColors);
    }
    setIsPreviewMode(!isPreviewMode);
  };

  const resetToOriginal = () => {
    if (originalColors) {
      setCustomColors(originalColors);
      applyTheme(originalColors);
      setSelectedPreset(THEME_PRESETS[0]);
    }
  };

  const generateCSSVariables = () => {
    return `/* CSS Variables for White Label Theme */
:root {
  /* Brand Colors */
  --accent: ${customColors.accent};
  --accent-hover: ${customColors.accentHover};
  
  /* Status Colors */
  --status-success: ${customColors.success};
  --status-error: ${customColors.error};
  --status-warning: ${customColors.warning};
  --status-info: ${customColors.info};
}

/* Dark Mode */
:root[data-theme="dark"] {
  --accent: ${customColors.accent};
  --accent-hover: ${customColors.accentHover};
}

/* Light Mode */
:root[data-theme="light"] {
  --accent: ${customColors.accent};
  --accent-hover: ${customColors.accentHover};
}`;
  };

  const generateEnvVariables = () => {
    return `# Environment Variables for White Label Theme
NEXT_PUBLIC_BRAND_PRIMARY=${customColors.primary}
NEXT_PUBLIC_BRAND_PRIMARY_HOVER=${customColors.primaryHover}
NEXT_PUBLIC_BRAND_ACCENT=${customColors.accent}
NEXT_PUBLIC_BRAND_ACCENT_HOVER=${customColors.accentHover}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportConfiguration = () => {
    const config = {
      theme: {
        colors: customColors,
        cssVariables: generateCSSVariables(),
        envVariables: generateEnvVariables(),
      },
      generatedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'white-label-theme-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <Palette className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Theme Configurator</h2>
              <p className="text-sm text-[var(--text-secondary)]">Customize colors for white-label deployment</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToOriginal}
              icon={RefreshCw}
            >
              Reset
            </Button>
            <Button
              variant={isPreviewMode ? 'primary' : 'outline'}
              size="sm"
              onClick={togglePreview}
              icon={Eye}
            >
              {isPreviewMode ? 'Preview Active' : 'Preview'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={exportConfiguration}
              icon={Download}
            >
              Export Config
            </Button>
          </div>
        </div>

        {isPreviewMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Preview Mode Active:</strong> Changes are applied live. Click "Preview" again to revert.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preset Themes */}
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Preset Themes</h3>
          
          <div className="space-y-3">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedPreset.name === preset.name
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border-primary)] hover:border-[var(--border-hover)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[var(--text-primary)]">{preset.name}</span>
                  {selectedPreset.name === preset.name && (
                    <Check className="w-4 h-4 text-[var(--accent)]" />
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{preset.description}</p>
                
                {/* Color swatches */}
                <div className="flex gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: preset.colors.primary }}
                    title="Primary"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: preset.colors.accent }}
                    title="Accent"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: preset.colors.success }}
                    title="Success"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: preset.colors.warning }}
                    title="Warning"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: preset.colors.error }}
                    title="Error"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Custom Colors</h3>
          
          <div className="space-y-4">
            {/* Primary Colors */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Brand Colors</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Primary/Accent</label>
                    <input
                      type="text"
                      value={customColors.accent}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-[var(--border-primary)] rounded"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customColors.accentHover}
                    onChange={(e) => handleColorChange('accentHover', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Primary Hover</label>
                    <input
                      type="text"
                      value={customColors.accentHover}
                      onChange={(e) => handleColorChange('accentHover', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-[var(--border-primary)] rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Status Colors */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Status Colors</h4>
              <div className="grid grid-cols-2 gap-3">
                {(['success', 'error', 'warning', 'info'] as const).map((status) => (
                  <div key={status} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColors[status]}
                      onChange={(e) => handleColorChange(status, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[var(--text-primary)] capitalize">
                        {status}
                      </label>
                      <input
                        type="text"
                        value={customColors[status]}
                        onChange={(e) => handleColorChange(status, e.target.value)}
                        className="w-full mt-0.5 px-2 py-0.5 text-xs border border-[var(--border-primary)] rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Components */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Component Preview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Buttons</p>
            <div className="space-y-2">
              <Button variant="primary" size="sm" fullWidth>Primary Button</Button>
              <Button variant="outline" size="sm" fullWidth>Outline Button</Button>
              <Button variant="secondary" size="sm" fullWidth>Secondary Button</Button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Status Badges</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="success" label="Active" />
              <StatusBadge status="error" label="Failed" />
              <StatusBadge status="warning" label="Pending" />
              <StatusBadge status="info" label="Processing" />
            </div>
          </div>

          {/* Loading States */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Loading States</p>
            <div className="flex items-center gap-4">
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Export Code */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Generated Configuration</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(generateCSSVariables())}
            icon={copied ? Check : Copy}
          >
            {copied ? 'Copied!' : 'Copy CSS'}
          </Button>
        </div>
        
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{generateCSSVariables()}</code>
        </pre>
      </div>
    </div>
  );
};