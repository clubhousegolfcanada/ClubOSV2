# Changelog

All notable changes to the ClubOSV1 Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.19] - 2026-03-28

### Fixed
- ClubAI incorrectly telling customers their access link is sent "10 minutes before your booking" — access links are actually sent when you book and pay
- Corrected all 6 knowledge sources: system prompt (2 places), knowledge base, import script (3 places), and training examples (5 entries)
- Note: DB system prompt in `pattern_learning_config` and DB embeddings in `clubai_knowledge` may also need updating via production SQL or re-running the import script

## [1.11.18] - 2026-03-25

### Fixed
- Receipt HST/tax not displaying — backfill migration (363) populates `hst_cents` and `tax_cents` from stored `ocr_json`
- Summary HST total now falls back to `tax_cents` when `hst_cents` is NULL
- Receipt table HST column now shows tax when HST is missing (NS: Tax = HST)
- CSV/ZIP exports now include tax fallback for HST column
- Future uploads auto-copy `taxAmount` to `hst_cents` when `hstAmount` is not extracted

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