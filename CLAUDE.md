## Deployment Workflow
- Commit to github, railway, and vercel when complete tasks
- ALWAYS commit housecleaning/cleanup work immediately
- Check git status before starting new work

## User Preferences & Working Style

### Testing & Deployment
- ALWAYS test locally before committing to avoid long deployment times
- Create comprehensive test scripts for new features
- Verify database migrations and setup before deployment

### UI/UX Preferences
- Simple on/off switches preferred over percentage-based controls
- Clear visual feedback for system states
- Mobile-first responsive design is critical

### Code Organization
- Keep feature flags simple and clear
- Document all environment variables with examples
- Create verification scripts for complex systems

### Communication Style
- Be concise and direct
- Show clear progress with todo lists
- Explain what's happening but avoid over-explaining
- Create .md files for plans/fixes BEFORE implementing

## System Architecture Notes

### SOP Migration Strategy
- Shadow mode first for safe testing
- Simple on/off switch (no percentage rollout)
- Clear monitoring and metrics
- Zero-downtime migration approach

### Database Considerations
- Always verify tables exist before using
- Create comprehensive migrations
- Include rollback strategies
- Test database operations locally first

### Integration Patterns
- Mock external services for local testing
- Provide clear setup documentation
- Include connection verification endpoints
- Build import tools for historical data