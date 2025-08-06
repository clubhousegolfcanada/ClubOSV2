// Re-export everything from the consolidated database module
export * from './db-consolidated';
export { default } from './db-consolidated';

// This file now acts as a facade to maintain backward compatibility
// while using the new consolidated database connection system