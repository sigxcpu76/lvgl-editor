# ESPHome LVGL Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ESPHome LVGL 9](https://img.shields.io/badge/LVGL-v9.5%2B-blue.svg)](https://esphome.io/components/lvgl/)
[![ESPHome](https://img.shields.io/badge/ESPHome-v2024%2B-orange.svg)](https://esphome.io/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-40-blue.svg)](https://www.electronjs.org/)

A modern, desktop-based GUI editor for designing **ESPHome LVGL** interfaces with native support for the **LVGL 9** architecture. Build complex smart home displays and touch dashboards with drag-and-drop ease, simulate interactivity in real time, and export clean, production-ready ESPHome YAML in seconds.

![Editor Preview](https://raw.githubusercontent.com/sigxcpu76/lvgl-editor/refs/heads/master/screenshots/preview.png)

---

## 🚀 LVGL 9 Architecture Updates

ESPHome migrated its core graphics pipeline to **LVGL 9** (starting in ESPHome 2026.4.0 with library v9.5.0). This editor is fully compliant with the updated LVGL 9 specifications:

- 🔄 **Native Display Rotation**: Rotation is configured natively under the `lvgl:` block (`rotation: 0 | 90 | 180 | 270`) instead of on the display driver. The editor automatically rotates your canvas and emulator, and cleans up legacy display rotations or touchscreen transforms on export.
- 📐 **New `scale` Widget**: Full support for the modern LVGL 9 scale component (`scale:`) supporting `ROUND_OUTER`, `ROUND_INNER`, `HORIZONTAL_TOP/BOTTOM`, and `VERTICAL_LEFT/RIGHT` modes alongside legacy `meter` scales.
- 🔢 **Spinbox `selected_digit`**: Uses `selected_digit` (which replaces the deprecated `step` parameter from ESPHome 2025.9+) with interactive multi-digit navigation and simulation.
- 🖼️ **Image Scaling**: Uses native `scale`, `scale_x`, `scale_y`, and `rotation` transformations on image widgets.
- 📑 **Modern TabView Syntax**: Generates clean ESPHome `tabs:` blocks with configurable tab positions (`TOP`, `BOTTOM`, `LEFT`, `RIGHT`).
- ⚡ **LVGL 9 Actions**: Built-in templates for `lvgl.display.set_rotation`, `lvgl.tabview.select`, `lvgl.spinbox.increment`, `lvgl.spinbox.decrement`, and `lvgl.indicator.update`.

---

## ✨ Features

### 🎨 Visual Drag-and-Drop Canvas
- **Intuitive Canvas**: Freely position and organize LVGL widgets or nest them inside containers, pages, and tab views.
- **Display Presets**: One-click sizing for common display resolutions:
  - **Guition** (480×480, 1:1)
  - **QVGA Landscape** (320×240)
  - **QVGA Portrait** (240×320)
  - **7" Display** (800×480)
  - **10" Display** (1024×600)
  - Custom width/height support
- **Native Rotation & Grid Tools**: Screen rotation controls (0°, 90°, 180°, 270°), zoom controls, 1:1 vs Fit view modes, and configurable snap-to-grid with visual guidelines.
- **Hierarchy Tree**: Drag-and-drop reordering, nesting management, and selection syncing with resizable sidebars.

### 🧩 Comprehensive LVGL Widget Library
The editor provides native support for ESPHome LVGL widgets across 4 functional categories:

| Category | Widgets | Description |
| :--- | :--- | :--- |
| **Basic** | Container (`obj`), Tab View (`tabview`), Tab (`tab`), Page (`page`), Label (`label`), Image (`image`) | Fundamental layout building blocks, multi-tab containers, text labels, and image components. |
| **Input** | Button (`button`), Switch (`switch`), Checkbox (`checkbox`), Slider (`slider`), Spinbox (`spinbox`) | Touch and interactive controls with checked/toggle states, digit navigation, and numeric inputs. |
| **Selection** | Dropdown (`dropdown`), Roller (`roller`), Textarea (`textarea`) | Option selectors, scrolling rollers, and multi-line text input fields. |
| **Display** | Bar (`bar`), Arc (`arc`), LED (`led`), Meter (`meter`), Scale (`scale`) | Progress indicators, status indicators, and analog/digital circular or linear gauges. |

### 🎛️ Gauges & Scale Builder (LVGL 9)
- **Scale Widget (`scale`)**:
  - Orientation modes: `ROUND_OUTER`, `ROUND_INNER`, `HORIZONTAL_TOP`, `HORIZONTAL_BOTTOM`, `VERTICAL_LEFT`, `VERTICAL_RIGHT`.
  - Configurable ranges (`range_from`, `range_to`, `angle_range`, `rotation`).
  - Customizable tick counts, minor ticks, and major tick intervals with labels.
- **Meter Widget (`meter`)**: Full support for legacy meter scale structures, needle lines, arc ranges, and custom pivots.

### 📑 TabView & Multi-Tab Layouts
- Organize complex dashboards into multi-page tabbed views.
- Flexible tab bar positioning (`TOP`, `BOTTOM`, `LEFT`, `RIGHT`).
- Dynamic tab addition/removal and interactive tab switching during design and emulation.
- Drag widgets directly into active tab views.

### ⚡ ESPHome Actions & Event Triggers
- Visually configure event automation triggers directly on widgets:
  - `on_click`, `on_press`, `on_release`, `on_value`, and more.
- Built-in templates for ESPHome LVGL actions:
  - `lvgl.display.set_rotation`
  - `lvgl.tabview.select`
  - `lvgl.spinbox.increment` / `lvgl.spinbox.decrement`
  - `lvgl.indicator.update`
  - `lvgl.page.show`
  - `lvgl.widget.update`
  - `homeassistant.service`
- Chain and manage multiple action steps per trigger, exported seamlessly to ESPHome automation syntax.

### 🖼️ Integrated Asset Manager
- **Fonts**: Load custom TTF/WOFF fonts or Google Fonts with size and glyph definitions.
- **Material Design Icons (MDI)**: Browse, preview, and embed glyph code points (e.g., `\U000F0335`).
- **Image Assets**: Import and preview image assets, specify ESPHome image IDs, sources, and automatic resize dimensions (`WIDTHxHEIGHT`). Supports LVGL 9 scaling factors (`scale`, `scale_x`, `scale_y`) and rotation.
  - `on_click`, `on_press`, `on_release`, `on_value`, and more.
- Chain and manage multiple action steps per trigger, exported seamlessly to ESPHome automation syntax.

### 🖼️ Integrated Asset Manager
- **Fonts**: Load custom TTF/WOFF fonts or Google Fonts with size and glyph definitions.
- **Material Design Icons (MDI)**: Browse, preview, and embed glyph code points (e.g., `\U000F0335`).
- **Image Assets**: Import and preview image assets, specify ESPHome image IDs, sources, and automatic resize dimensions (`WIDTHxHEIGHT`).

### 🎨 Global Styles & State Variations
- **Global Style Definitions**: Create reusable CSS-like styles (`style_definitions`) applied via style references.
- **Interactive State Styling**: Define distinct styles for different widget states: `DEFAULT`, `CHECKED`, `FOCUSED`, `PRESSED`, and `DISABLED`.
- **Granular Properties**: Adjust background colors, opacity (`bg_opa`), text formatting, border radius, border width/colors, padding, shadows, line width, and arc properties.
- **Layout Engines**: Full support for native ESPHome layout modes:
  - **Absolute**: Pixel-perfect coordinates (`x`, `y`, `width`, `height`, alignments).
  - **Flexbox**: `flex_flow`, main/cross axis alignment, and `flex_grow`.
  - **Grid**: Column and row descriptors with support for `lv.fr` units, `lv.SIZE.CONTENT`, cell positions, and spans.

### 🕹️ Live Emulator
- Test interactive behavior without flashing hardware:
  - Click buttons, toggle switches and checkboxes, drag sliders and arcs.
  - Switch tabs in tab views.
  - Preview visual states and theme styling in real-time.

### 🔄 Bi-Directional YAML & Monaco Editor
- **Import Existing YAML**: Parse your current ESPHome files (`lvgl:`, `font:`, `image:`, `substitutions:`).
- **Embedded Monaco Editor**: Review generated YAML with syntax highlighting, search, and formatting.
- **Bidirectional Sync**: Make live edits in the Monaco YAML viewer and re-apply them directly back to the visual canvas.
- **Native File Dialogs**: Save YAML directly to your local file system or download in-browser.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo last action |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> | Copy selected widget |
| <kbd>Ctrl</kbd> + <kbd>V</kbd> | Paste widget (with offset) |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete selected widget(s) |
| <kbd>Arrow Keys</kbd> | Nudge selected widget(s) by 1px (or grid size) |
| <kbd>Shift</kbd> + <kbd>Arrow Keys</kbd> | Nudge selected widget(s) by 10px |
| <kbd>Esc</kbd> | Close active modal (Asset Manager, Styles, Emulator) |

---

## 🚀 Getting Started

### Prebuilt Releases

Ready-to-use binaries for **Linux**, **Windows**, and **macOS** are automatically published with each release:
👉 **[Download Latest Release](https://github.com/sigxcpu76/lvgl-editor/releases)**

- **Linux**: `LVGL-Editor-*.AppImage`
- **Windows**: `LVGL-Editor-Setup-*.exe`
- **macOS**: `LVGL-Editor-*.dmg` (Apple Silicon arm64)

### Building from Source

#### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or v22 LTS recommended)
- `npm` (included with Node.js)

#### 1. Clone the repository
```bash
git clone https://github.com/sigxcpu76/lvgl-editor.git
cd lvgl-editor
```

#### 2. Install dependencies
```bash
npm install
```

#### 3. Run development server
Launch Electron and Vite with hot module replacement (HMR):
```bash
npm run dev
```

#### 4. Build for distribution
Compile TypeScript, bundle with Vite, and generate standalone installers:
```bash
npm run package
```
*Packaged distributions will be created under the `release/` directory.*

---

## 🐧 Linux Troubleshooting

If you encounter a FUSE permission error when running the AppImage on modern Linux distributions (e.g., `fusermount: mount failed: Operation not permitted`):

1. **Install `libfuse2`**:
   ```bash
   # Debian / Ubuntu / Mint
   sudo apt install libfuse2

   # Fedora / RHEL
   sudo dnf install fuse-libs

   # Arch Linux / Manjaro
   sudo pacman -S fuse2
   ```

2. **Or run without mounting**:
   ```bash
   chmod +x LVGL-Editor-*.AppImage
   ./LVGL-Editor-*.AppImage --appimage-extract-and-run
   ```

---

## 📁 Project Structure

```
lvgl-editor/
├── electron/               # Electron main and preload processes
│   ├── main.ts             # App lifecycle, window management, IPC handlers
│   └── preload.ts          # Safe context bridge for renderer
├── src/                    # Frontend React application
│   ├── components/
│   │   ├── assets/         # Asset Manager & Font/Icon/Image loaders
│   │   ├── canvas/         # Main interactive design canvas & grid overlay
│   │   ├── emulator/       # Interactive live LVGL simulator
│   │   ├── palette/        # Draggable widget palette toolbar
│   │   ├── preview/        # Monaco YAML editor modal & export viewer
│   │   ├── properties/     # Dynamic widget properties & action inspector
│   │   ├── sidebar/        # Component tree hierarchy
│   │   ├── toolbar/        # Canvas resolution, grid settings, theme toggles
│   │   └── widgets/        # Widget rendering implementations
│   ├── store/              # Zustand global application state & history
│   ├── types/              # TypeScript definitions for widgets, styles, assets
│   ├── utils/              # YAML CST parser and ESPHome code generator
│   ├── App.tsx             # Root layout & shortcut event listeners
│   └── main.tsx            # React application entry point
├── examples/               # Example ESPHome LVGL dashboards
│   ├── guition-dashboard.yaml   # Comprehensive 480x480 smart home dashboard
│   └── esp-display-lvgl.yaml    # ESP32 display configuration
├── screenshots/            # UI screenshots & preview images
└── package.json            # Electron & Vite build scripts and dependencies
```

---

## 🛠️ Tech Stack

- **Desktop Framework**: [Electron 40](https://www.electronjs.org/)
- **UI Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite 6](https://vite.dev/)
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) (with history/undo-redo)
- **Drag-and-Drop**: [React DnD](https://react-dnd.github.io/react-dnd/)
- **YAML Engine**: [yaml](https://eemeli.org/yaml/) (Concrete Syntax Tree parser preserving structure)
- **Code Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
- **Icons**: [Material Design Icons (MDI)](https://pictogrammers.com/library/mdi/) & [Lucide React](https://lucide.dev/)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/sigxcpu76/lvgl-editor/issues) or submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
