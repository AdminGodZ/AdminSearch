# Theme implementation status

AdminSearch keeps appearance mode (`light`, `dark`, or `system`) separate from
the named color theme. GitHub remains the default named theme.

The catalog below was verified against OpenAI desktop app `26.715.72359` on
July 24, 2026. The same theme assets are used by the macOS and Windows desktop
apps.

| Theme | Official modes | AdminSearch status |
| --- | --- | --- |
| Absolutely | Light, Dark | Planned |
| Ayu | Dark | Planned |
| Catppuccin | Light, Dark | Planned |
| Codex | Light, Dark | Implemented |
| Dracula | Dark | Planned |
| Everforest | Light, Dark | Planned |
| GitHub | Light, Dark | Implemented, default |
| Gruvbox | Light, Dark | Planned |
| Linear | Light, Dark | Planned |
| Lobster | Dark | Planned |
| Material | Dark | Planned |
| Matrix | Dark | Planned |
| Monokai | Dark | Planned |
| Night Owl | Dark | Planned |
| Nord | Dark | Planned |
| Notion | Light, Dark | Planned |
| One | Light, Dark | Planned |
| Oscurange | Dark | Planned |
| Proof | Light | Planned |
| Raycast | Light, Dark | Planned |
| Rose Pine | Light, Dark | Planned |
| Sentry | Dark | Planned |
| Solarized | Light, Dark | Planned |
| Temple | Dark | Planned |
| Tokyo Night | Dark | Planned |
| Vercel | Light, Dark | Implemented |
| VS Code Plus | Light, Dark | Planned |
| Xcode | Light, Dark | Planned |

The implemented theme selector is defined in
`src/features/settings/lib/themes.ts`. A theme is only marked as implemented
after both its available mode palettes are mapped to AdminSearch semantic UI
tokens and the production build passes.
