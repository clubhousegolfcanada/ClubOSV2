# Operations Page Refactor - Complete Implementation Plan

## Project Overview
Consolidate the complex multi-level operations page into 5 clean, focused tabs with no sub-navigation.

## Pre-Implementation Tasks

### Phase 0: Preparation & Cleanup
- [ ] Archive old documentation files to `/archive` folder
- [ ] Create backup of current operations.tsx
- [ ] Document current component dependencies
- [ ] Update CHANGELOG.md with refactor start
- [ ] Create feature flag for new layout

### Files to Archive
- [ ] Move old plan files to `/archive/old-plans/`
  - COMPLETE-IMPLEMENTATION-PLAN.md
  - IMPLEMENTATION-STATUS.md
  - REFACTORING-PLAN.md
  - PHASE1-IMPLEMENTATION-LOG.md
  - PHASE2-IMPLEMENTATION-LOG.md
  - All other old planning docs
- [ ] Clean up root directory
- [ ] Create clear folder structure

## Implementation Phases

### Phase 1: Dashboard Tab
**Goal**: Create unified system overview

#### Todo List:
- [ ] Create new component: `OperationsDashboard.tsx`
- [ ] Implement Live Status Panel component
  - [ ] System health indicators (API, DB, LLM)
  - [ ] Active users counter
  - [ ] Messages processed today
  - [ ] AI responses counter
- [ ] Implement Recent Activity Feed
  - [ ] Connect to OpenPhone messages
  - [ ] Show AI automation triggers
  - [ ] Display system alerts
- [ ] Add Quick Actions section
  - [ ] Export today's data button
  - [ ] View reports button
  - [ ] System restart button (admin only)
- [ ] Remove duplicate status displays from other tabs
- [ ] Add real-time data updates (WebSocket/polling)
- [ ] Mobile responsive layout
- [ ] Test dashboard performance

### Phase 2: Users Tab
**Goal**: Consolidate all user management

#### Todo List:
- [ ] Create new component: `OperationsUsers.tsx`
- [ ] Move User Management section
  - [ ] Keep existing user table
  - [ ] Preserve inline editing
  - [ ] Maintain add/edit/delete functions
- [ ] Add Access Control section
  - [ ] Create role permissions matrix UI
  - [ ] Add session management view
  - [ ] Implement login history table
- [ ] Move Backup/Restore buttons to this tab
- [ ] Integrate UserDebugCheck component
- [ ] Add user search/filter
- [ ] Add bulk user operations
- [ ] Implement user import/export
- [ ] Add password policy settings
- [ ] Test all user CRUD operations

### Phase 3: AI Center Tab
**Goal**: Merge Knowledge + AI Automations + Prompts

#### Todo List:
- [ ] Create new component: `OperationsAICenter.tsx`
- [ ] Create main layout (2/3 + 1/3 columns)
- [ ] Migrate AI Automations section
  - [ ] Move all automation cards
  - [ ] Keep category filters
  - [ ] Preserve toggle functionality
  - [ ] Add inline configuration (no popups)
- [ ] Migrate Knowledge Management
  - [ ] Move KnowledgeRouterPanel
  - [ ] Move feedback analysis
  - [ ] Keep collapsible sections
- [ ] Integrate AI Prompt Templates
  - [ ] Move from separate page to inline
  - [ ] Create inline editor component
  - [ ] Add template versioning
- [ ] Move Recent Messages sidebar
- [ ] Move System Metrics panel
- [ ] Add Knowledge Export button
- [ ] Implement search across all AI features
- [ ] Add AI usage analytics
- [ ] Test all AI feature toggles

### Phase 4: Integrations Tab
**Goal**: Centralize all external service configs

#### Todo List:
- [ ] Create new component: `OperationsIntegrations.tsx`
- [ ] Create Communication section
  - [ ] Move Slack settings card
  - [ ] Move OpenPhone debug tools
  - [ ] Move Push notifications settings
  - [ ] Unify notification preferences
- [ ] Create CRM & Support section
  - [ ] Add HubSpot configuration
  - [ ] Add NinjaOne settings
  - [ ] Add UniFi door access config
- [ ] Move System Features toggles
  - [ ] Smart Assist toggle
  - [ ] Bookings toggle
  - [ ] Tickets toggle
  - [ ] Customer Kiosk toggle
- [ ] Add integration health checks
- [ ] Add API key management
- [ ] Create test connection buttons
- [ ] Add webhook configuration
- [ ] Implement OAuth flow UIs
- [ ] Test all integration connections

### Phase 5: Analytics Tab
**Goal**: Unified reporting and insights

#### Todo List:
- [ ] Create new component: `OperationsAnalytics.tsx`
- [ ] Move Routing Analytics
  - [ ] Keep existing charts
  - [ ] Add date range selector
- [ ] Add AI Performance section
  - [ ] Automation success rates
  - [ ] Response time metrics
  - [ ] Cost per automation
- [ ] Add Usage Reports
  - [ ] User activity charts
  - [ ] Feature adoption graphs
  - [ ] Peak usage times
- [ ] Create Export Tools section
  - [ ] PDF report generation
  - [ ] CSV data export
  - [ ] Scheduled reports setup
- [ ] Add custom dashboard builder
- [ ] Implement data visualization library
- [ ] Add comparison tools (week/month/year)
- [ ] Test all data exports

### Phase 6: Component Cleanup
**Goal**: Remove old code and optimize

#### Todo List:
- [ ] Remove old sub-tab navigation code
- [ ] Delete redundant state variables
- [ ] Remove sample cleaning checklists
- [ ] Consolidate duplicate API calls
- [ ] Optimize component re-renders
- [ ] Remove unused imports
- [ ] Update component props/types
- [ ] Add proper TypeScript types
- [ ] Implement error boundaries
- [ ] Add loading states

### Phase 7: Navigation & UX
**Goal**: Improve navigation and user experience

#### Todo List:
- [ ] Create new tab navigation component
- [ ] Add tab icons
- [ ] Implement tab badges (counts/alerts)
- [ ] Add keyboard navigation (Alt+1-5)
- [ ] Create breadcrumbs where needed
- [ ] Add tab persistence (remember last tab)
- [ ] Implement smooth transitions
- [ ] Add mobile hamburger menu
- [ ] Create tablet-optimized layout
- [ ] Add accessibility features (ARIA)

### Phase 8: Testing & Documentation
**Goal**: Ensure quality and maintainability

#### Todo List:
- [ ] Write unit tests for new components
- [ ] Add integration tests for workflows
- [ ] Test with different user roles
- [ ] Test on mobile devices
- [ ] Test on tablets
- [ ] Performance testing
- [ ] Update user documentation
- [ ] Create admin guide
- [ ] Document API changes
- [ ] Add inline code comments

### Phase 9: Deployment
**Goal**: Safe rollout to production

#### Todo List:
- [ ] Create feature flag in backend
- [ ] Deploy with flag disabled
- [ ] Test in production environment
- [ ] Enable for admin users first
- [ ] Gather feedback (1 week)
- [ ] Fix reported issues
- [ ] Enable for all users
- [ ] Monitor error logs
- [ ] Track usage analytics
- [ ] Remove old code (after 30 days)

## Component Structure

```
/src/pages/
  operations.tsx (main container)
  
/src/components/operations/
  OperationsDashboard.tsx
  OperationsUsers.tsx
  OperationsAICenter.tsx
  OperationsIntegrations.tsx
  OperationsAnalytics.tsx
  
  /dashboard/
    LiveStatusPanel.tsx
    RecentActivityFeed.tsx
    QuickActions.tsx
    
  /users/
    UserTable.tsx
    UserForm.tsx
    AccessControl.tsx
    BackupRestore.tsx
    
  /ai/
    AIAutomations.tsx
    KnowledgeManager.tsx
    PromptEditor.tsx
    AIMetrics.tsx
    
  /integrations/
    SlackConfig.tsx
    OpenPhoneConfig.tsx
    PushNotifications.tsx
    SystemFeatures.tsx
    
  /analytics/
    RoutingAnalytics.tsx
    AIPerformance.tsx
    UsageReports.tsx
    ExportTools.tsx
```

## State Management Updates

```typescript
// New store structure
interface OperationsStore {
  activeTab: 'dashboard' | 'users' | 'ai' | 'integrations' | 'analytics'
  setActiveTab: (tab: string) => void
  
  // Dashboard state
  dashboardMetrics: DashboardMetrics
  recentActivity: ActivityItem[]
  
  // Users state  
  users: User[]
  selectedUser: User | null
  
  // AI state
  aiFeatures: AIFeature[]
  knowledgeItems: KnowledgeItem[]
  promptTemplates: PromptTemplate[]
  
  // Integrations state
  integrationConfigs: IntegrationConfig[]
  systemFeatures: SystemFeature[]
  
  // Analytics state
  analyticsData: AnalyticsData
  dateRange: DateRange
}
```

## Success Metrics
- [ ] Reduce average clicks to features by 50%
- [ ] Improve page load time by 30%
- [ ] Increase feature discovery by 40%
- [ ] Reduce support tickets about navigation
- [ ] Achieve 90% user satisfaction score

## Timeline
- **Week 1**: Phase 0-2 (Prep, Dashboard, Users)
- **Week 2**: Phase 3-4 (AI Center, Integrations)
- **Week 3**: Phase 5-6 (Analytics, Cleanup)
- **Week 4**: Phase 7-8 (Navigation, Testing)
- **Week 5**: Phase 9 (Deployment)

## Rollback Plan
1. Keep feature flag in code
2. Maintain old operations.tsx as operations-legacy.tsx
3. Can switch back via flag instantly
4. Database changes are backward compatible
5. No API breaking changes

## Risk Mitigation
- **Risk**: Users confused by new layout
  - **Mitigation**: Gradual rollout, training videos
- **Risk**: Features break during refactor
  - **Mitigation**: Comprehensive testing, feature flags
- **Risk**: Performance degradation
  - **Mitigation**: Performance testing, code splitting