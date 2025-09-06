import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronRight, Zap, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface Pattern {
  id: number;
  pattern_type: string;
  trigger_text: string;
  trigger_examples: string[];
  response_template: string;
  confidence_score: number;
  is_active: boolean;
  auto_executable: boolean;
  execution_count: number;
  success_count: number;
  created_from: string;
  created_at: string;
}

interface CategoryGroup {
  type: string;
  label: string;
  count: number;
  patterns: Pattern[];
  expanded: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  pricing: 'Pricing & Rates',
  hours: 'Hours of Operation',
  booking: 'Booking & Reservations',
  tech_issue: 'Technical Support',
  membership: 'Membership Info',
  access: 'Access & Entry',
  gift_cards: 'Gift Cards',
  faq: 'Frequently Asked',
  general: 'General Inquiries'
};

export const PatternInventory: React.FC = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const response = await apiClient.get('/patterns?limit=200');
      const allPatterns = response.data.patterns || [];
      setPatterns(allPatterns);
      organizeByCategory(allPatterns);
    } catch (error) {
      logger.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeByCategory = (patternList: Pattern[]) => {
    const grouped: Record<string, Pattern[]> = {};
    
    patternList.forEach(pattern => {
      const type = pattern.pattern_type || 'general';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(pattern);
    });

    const categoryGroups: CategoryGroup[] = Object.entries(grouped).map(([type, patterns]) => ({
      type,
      label: CATEGORY_LABELS[type] || type,
      count: patterns.length,
      patterns: patterns.sort((a, b) => b.execution_count - a.execution_count),
      expanded: false
    }));

    setCategories(categoryGroups.sort((a, b) => b.count - a.count));
  };

  const toggleCategory = (type: string) => {
    setCategories(prev => prev.map(cat => 
      cat.type === type ? { ...cat, expanded: !cat.expanded } : cat
    ));
  };

  const filteredCategories = categories.map(cat => ({
    ...cat,
    patterns: cat.patterns.filter(p => {
      const matchesSearch = searchQuery === '' || 
        p.trigger_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.response_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.trigger_examples?.some(ex => ex.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFilter = filterActive === null || p.is_active === filterActive;
      
      return matchesSearch && matchesFilter;
    })
  })).filter(cat => cat.patterns.length > 0);

  const totalPatterns = patterns.length;
  const activePatterns = patterns.filter(p => p.is_active).length;
  const autoExecutable = patterns.filter(p => p.auto_executable).length;
  const manualPatterns = patterns.filter(p => p.created_from === 'manual').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pattern Inventory</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalPatterns}</div>
            <div className="text-xs text-gray-600">Total Patterns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{activePatterns}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{autoExecutable}</div>
            <div className="text-xs text-gray-600">Auto-Execute</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{manualPatterns}</div>
            <div className="text-xs text-gray-600">Manual Created</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterActive(filterActive === true ? null : true)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                filterActive === true 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Active Only
            </button>
            <button
              onClick={() => setFilterActive(filterActive === false ? null : false)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                filterActive === false 
                  ? 'bg-gray-600 text-white border-gray-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Inactive Only
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {filteredCategories.map(category => (
          <div key={category.type} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => toggleCategory(category.type)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {category.expanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
                <span className="font-medium text-gray-900">{category.label}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {category.patterns.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {category.patterns.filter(p => p.is_active).length} active
                </span>
              </div>
            </button>

            {category.expanded && (
              <div className="border-t border-gray-200">
                <div className="p-4 space-y-2">
                  {category.patterns.map(pattern => (
                    <div
                      key={pattern.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {pattern.trigger_text}
                            </span>
                            {pattern.is_active ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-gray-400" />
                            )}
                            {pattern.auto_executable && (
                              <Zap className="h-3 w-3 text-blue-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            {pattern.trigger_examples?.slice(0, 3).join(' • ')}
                            {pattern.trigger_examples?.length > 3 && ` +${pattern.trigger_examples.length - 3} more`}
                          </div>
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {pattern.response_template}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-xs text-gray-500">
                            {pattern.execution_count} uses
                          </div>
                          <div className="text-xs text-gray-500">
                            {Math.round(pattern.confidence_score * 100)}% conf
                          </div>
                          {pattern.created_from === 'manual' && (
                            <div className="text-xs text-purple-600 mt-1">Manual</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">No patterns found matching your criteria</p>
        </div>
      )}
    </div>
  );
};