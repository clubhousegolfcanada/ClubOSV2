# Changelog

All notable changes to the ClubOSV1 Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.17] - 2025-01-09

### Added
- UniFi Access integration for remote door control
- Setup script for configuring UniFi Access (`npm run setup:unifi`)
- API endpoints for door management:
  - GET `/api/unifi/doors` - List configured doors
  - POST `/api/unifi/doors/:doorId/unlock` - Unlock specific door
  - GET `/api/unifi/doors/:doorId/status` - Get door status
  - GET `/api/unifi/access-logs` - View door access history
- Database migration for door access logging
- Support for multiple location-based door configurations (Bedford, Dartmouth)
- Configurable unlock durations (default, maximum, emergency)
- Demo mode fallback when UniFi controller is unavailable

### Changed
- Updated environment configuration to support UniFi Access credentials
- Enhanced access control system with physical door integration

### Fixed
- SQL migration runner to properly handle complex statements
- Door access log migration conflicts

## [Previous Versions]

Previous changelog entries to be migrated from git history.