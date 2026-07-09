---
name: next-themes requires explicit attribute="class"
description: Dark mode silently never applies with next-themes unless attribute="class" is passed, when CSS uses class-based dark selectors
---

`next-themes`'s `ThemeProvider` defaults to `attribute="data-theme"` when the
prop isn't passed. If the app's CSS defines dark mode via a `.dark` class
selector (e.g. Tailwind v4's `@custom-variant dark (&:is(.dark *))`),
`setTheme('dark')` updates React state and localStorage correctly, but the
DOM never gets a `dark` class — only `data-theme="dark"` — so no dark styles
ever actually render. The bug is invisible in code review of the toggle
logic itself; it only shows up by checking `<ThemeProvider>`'s props against
what the CSS actually selects on.

**Why:** the toggle UI and `useTheme()` hook all work and report the
"correct" theme value, which makes it easy to assume theming works.

**How to apply:** whenever wiring up `next-themes` with Tailwind, pass
`attribute="class"` explicitly, and verify by checking
`document.documentElement.classList` in the browser after toggling — not just
by reading the toggle's onClick handler.
