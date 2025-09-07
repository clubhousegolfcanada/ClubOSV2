import React, { useState } from 'react';
import { Palette, Copy, Check, RefreshCw } from 'lucide-react';

const PRESET_COLORS = [
  { name: 'ClubOS Green', primary: '#0B3D3A', hover: '#084a45' },
  { name: 'Corporate Blue', primary: '#1e40af', hover: '#1e3a8a' },
  { name: 'Modern Purple', primary: '#7c3aed', hover: '#6d28d9' },
  { name: 'Ocean Teal', primary: '#0891b2', hover: '#0e7490' },
  { name: 'Sunset Orange', primary: '#ea580c', hover: '#c2410c' },
  { name: 'Slate Gray', primary: '#475569', hover: '#334155' },
];

export const SimpleThemeConfig: React.FC = () => {
  const [primaryColor, setPrimaryColor] = useState('#0B3D3A');
  const [hoverColor, setHoverColor] = useState('#084a45');
  const [copied, setCopied] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const applyColors = () => {
    if (isPreview) {
      document.documentElement.style.setProperty('--accent', primaryColor);
      document.documentElement.style.setProperty('--accent-hover', hoverColor);
    } else {
      document.documentElement.style.setProperty('--accent', '#0B3D3A');
      document.documentElement.style.setProperty('--accent-hover', '#084a45');
    }
  };

  const selectPreset = (preset: typeof PRESET_COLORS[0]) => {
    setPrimaryColor(preset.primary);
    setHoverColor(preset.hover);
    if (isPreview) {
      document.documentElement.style.setProperty('--accent', preset.primary);
      document.documentElement.style.setProperty('--accent-hover', preset.hover);
    }
  };

  const togglePreview = () => {
    setIsPreview(!isPreview);
    if (!isPreview) {
      document.documentElement.style.setProperty('--accent', primaryColor);
      document.documentElement.style.setProperty('--accent-hover', hoverColor);
    } else {
      document.documentElement.style.setProperty('--accent', '#0B3D3A');
      document.documentElement.style.setProperty('--accent-hover', '#084a45');
    }
  };

  const copyConfig = () => {
    const config = `/* Add to globals.css */
--accent: ${primaryColor};
--accent-hover: ${hoverColor};`;
    
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-5 h-5 text-[var(--accent)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Theme Colors</h3>
      </div>

      {/* Color Presets */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
          Quick Presets
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => selectPreset(preset)}
              className="flex items-center gap-2 p-2 rounded border border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: preset.primary }}
              />
              <span className="text-xs text-[var(--text-primary)]">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Primary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                if (isPreview) {
                  document.documentElement.style.setProperty('--accent', e.target.value);
                }
              }}
              className="w-12 h-12 rounded cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                if (isPreview) {
                  document.documentElement.style.setProperty('--accent', e.target.value);
                }
              }}
              className="flex-1 px-3 py-2 text-sm border border-[var(--border-primary)] rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Hover Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hoverColor}
              onChange={(e) => {
                setHoverColor(e.target.value);
                if (isPreview) {
                  document.documentElement.style.setProperty('--accent-hover', e.target.value);
                }
              }}
              className="w-12 h-12 rounded cursor-pointer"
            />
            <input
              type="text"
              value={hoverColor}
              onChange={(e) => {
                setHoverColor(e.target.value);
                if (isPreview) {
                  document.documentElement.style.setProperty('--accent-hover', e.target.value);
                }
              }}
              className="flex-1 px-3 py-2 text-sm border border-[var(--border-primary)] rounded"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={togglePreview}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isPreview 
              ? 'bg-[var(--accent)] text-white' 
              : 'border border-[var(--border-primary)] text-[var(--text-primary)]'
          }`}
        >
          {isPreview ? 'Preview Active' : 'Preview Colors'}
        </button>

        <button
          onClick={copyConfig}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--border-primary)] rounded font-medium hover:bg-[var(--bg-tertiary)]"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy CSS'}
        </button>
      </div>

      {isPreview && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          Preview mode is active. The new colors are temporarily applied.
        </div>
      )}
    </div>
  );
};