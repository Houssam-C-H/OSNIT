# OSINT Case Vault

An air-gapped, zero-trust Intelligence and Target Profiling application built for privacy and performance. 

## 🛡️ Core Philosophy
OSINT Case Vault is designed to operate completely offline (air-gapped) with zero telemetry or tracking. All intelligence, notes, relationships, and evidence files are stored locally in an encrypted SQLCipher/SQLite vault. 

## ✨ Key Features
- **Target Dossiers**: Create and manage detailed profiles for people, companies, phones, emails, crypto wallets, and more.
- **Link Analysis Graph**: Visualize relationships and connections between entities in real-time.
- **Automated Intelligence Extractor**: Scans notes and attributes using high-performance Rust regex to automatically discover hidden IoCs (IPs, Emails, BTC/ETH Wallets) and create relationships.
- **Encrypted Storage**: Relies on a local, encrypted SQLite database for zero-trust data management.
- **Secure Export**: Package cases into AES-256 encrypted zip archives for secure sharing and transport.
- **Intelligence Ledger**: A rich Markdown-based editor for logging notes with dynamic entity linking (`[[Target Name]]`).
- **Bulk CSV Importer**: Quickly ingest hundreds of targets simultaneously.

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Backend**: Rust, Tauri
- **Database**: SQLite (via `rusqlite`) 
- **Graphing**: D3.js / Force Graph

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- Tauri CLI dependencies

### Installation

1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```

3. Build for production:
   ```bash
   npm run tauri build
   ```
