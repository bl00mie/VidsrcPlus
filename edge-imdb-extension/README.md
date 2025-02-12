# Edge IMDb Extension

This is a simple Edge browser extension that queries IMDb for show and movie information. 

## Features

- Fetches movie and show details from IMDb.
- User-friendly popup interface for input and display of results.
- Background script to manage API calls and events.

## Project Structure

```
edge-imdb-extension
├── src
│   ├── background.js       # Background script for handling events and API calls
│   ├── content.js          # Content script for interacting with web pages
│   ├── popup
│   │   ├── popup.html      # HTML structure for the popup interface
│   │   ├── popup.js        # JavaScript logic for the popup
│   │   └── popup.css       # Styles for the popup interface
├── manifest.json           # Configuration file for the Edge extension
└── README.md               # Documentation for the project
```

## Installation

1. Download or clone the repository.
2. Open Edge and navigate to `edge://extensions/`.
3. Enable "Developer mode" at the top right corner.
4. Click on "Load unpacked" and select the `edge-imdb-extension` directory.

## Usage

1. Click on the extension icon in the toolbar.
2. Enter the name of the movie or show you want to search for.
3. View the fetched information displayed in the popup.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.