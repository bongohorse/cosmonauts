# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Local Game Knowledge Wiki (`/docs/wiki/`)**: Initialized a new local wiki to keep all game knowledge inside the repository, ensuring easy access for development and AI context.
- **Automated Fandom Wiki Scraper (`scratch/wiki_scraper/`)**: Developed a Node.js/Cheerio scraper to parse raw HTML and MHTML exports from the Fandom wiki.
- **Complete Hero Documentation (`/docs/wiki/heroes/`)**: 
  - Generated fully structured Markdown files for all 34 heroes.
  - Successfully extracted Hero Base Stats, Backstories/Lore, and Ability details.
  - Parsed MHTML files to extract detailed Upgrade information (including stats, effects, and flavor text).
- **Hero Assets and Icons (`/docs/wiki/heroes/images/`)**: 
  - Automatically fetched and saved over 750 local images, icons, and skill art directly from Fandom servers.
  - Embedded local images natively within the Hero Markdown files.
- **Hero Index**: Created a centralized `index.md` to link and navigate between all 34 heroes seamlessly.

### Removed
- **`nautsheros/` Raw Data Folder**: Cleaned up the raw HTML and MHTML Fandom export folder from the workspace after the successful extraction and generation of the local Markdown wiki.
