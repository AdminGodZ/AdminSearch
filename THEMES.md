# Theme implementation status

AdminSearch keeps appearance mode (`light`, `dark`, or `system`) separate from
the named color theme. GitHub remains the default named theme.

The catalog below was verified against OpenAI desktop app `26.715.72359` on
July 24, 2026. The same theme assets are used by the macOS and Windows desktop
apps.

| Theme | Catalog modes | AdminSearch status |
| --- | --- | --- |
| Absolutely | Light, Dark | Planned |
| Ayu | Dark | Planned |
| Catppuccin | Light, Dark | Planned |
| Codex | Light, Dark | Implemented |
| Dracula | Dark | Planned |
| Everforest | Light, Dark | Planned |
| GitHub | Light, Dark | Implemented, default |
| Gruvbox | Light, Dark | Planned |
| Linear | Light, Dark | Implemented |
| Lobster | Dark | Planned |
| Material | Dark | Implemented, with adapted light palette |
| Matrix | Dark | Planned |
| Monokai | Dark | Planned |
| Night Owl | Dark | Planned |
| Nord | Dark | Planned |
| Notion | Light, Dark | Implemented |
| One | Light, Dark | Planned |
| Oscurange | Dark | Planned |
| Proof | Light | Planned |
| Raycast | Light, Dark | Implemented |
| Rose Pine | Light, Dark | Planned |
| Sentry | Dark | Planned |
| Solarized | Light, Dark | Planned |
| Temple | Dark | Planned |
| Tokyo Night | Dark | Implemented, with adapted light palette |
| Vercel | Light, Dark | Implemented |
| VS Code Plus | Light, Dark | Planned |
| Xcode | Light, Dark | Implemented |

The implemented theme selector is defined in
`src/features/settings/lib/themes.ts`. Every implemented theme provides complete
light and dark palettes so changing appearance mode never falls back to a
different named theme. Material and Tokyo Night receive deliberate light
companions even though the verified desktop catalog only exposes their dark
variants.

The new palettes follow the upstream visual systems: [Apple semantic
colors](https://developer.apple.com/design/human-interface-guidelines/color)
for Xcode, the [Tokyo Night Night and Day
styles](https://github.com/folke/tokyonight.nvim), and [Material color
roles](https://m3.material.io/styles/color/overview) for Material.
A theme is marked as implemented only after its palettes are mapped to
AdminSearch semantic UI tokens and the production build passes.
