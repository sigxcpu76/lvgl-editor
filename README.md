# ESPHome LVGL Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ESPHome](https://img.shields.io/badge/ESPHome-v2026.1.3-orange.svg)](https://esphome.io/)

A modern, desktop-based GUI editor for designing **ESPHome LVGL** interfaces. Build complex dashboards with drag-and-drop ease and export production-ready YAML in seconds.

![Editor Preview](https://raw.githubusercontent.com/sigxcpu76/lvgl-editor/refs/heads/master/screenshots/preview.png)

## ✨ Features

- **Drag-and-Drop Editor**: Intuitive canvas for placing and arranging LVGL widgets.
- **Rich Widget Palette**: Supports buttons, labels, arcs, sliders, switches, checkboxes, and more.
- **Comprehensive Properties**: Fine-tune ogni widget's behavior, layout (Flex/Grid), and style.
- **Global Styles Manager**: Define reusable CSS-like styles and apply them across multiple widgets.
- **Integrated Asset Manager**: Easily manage custom fonts and MDI icons.
- **Live Emulator**: Test your interface's interactivity (states, clicks, animations) before deploying.
- **YAML Engine**: One-click export to ESPHome-compatible YAML configuration.
- **Theme Support**: Beautiful Light and Dark modes to suit your workspace.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sigxcpu76/lvgl-editor.git
   cd lvgl-editor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the application in development mode with hot-reloading:

```bash
npm run dev
```

### Building for Distribution

Create a production-ready package for your OS (Windows, macOS, or Linux):

```bash
npm run package
```
*Note: Distribution files will be generated in the `release/` directory.*

## 🛠️ Tech Stack

- **Core**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Drag-and-Drop**: [React DnD](https://react-dnd.github.io/react-dnd/)
- **Styling**: Vanilla CSS (Theme-driven)

## 📁 Project Structure

```
.
├── src/
│   ├── components/       # UI Components (Canvas, Sidebar, Modals)
│   ├── store/            # Zustand global state
│   ├── utils/            # YAML engine and helper functions
│   ├── types/            # TypeScript definitions
│   └── App.tsx           # Entry point
├── dist-electron/        # Electron main process
└── package.json          # Project configuration and scripts
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
