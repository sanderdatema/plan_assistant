# Add Dark Mode Support

## Overview

Implement a dark mode toggle across the application using CSS custom properties and a theme store.

## Theme System Setup

### Overview

Create the theming infrastructure with CSS variables and a Svelte store.

### Modifications

#### 1. Theme Variables

File: `src/styles/theme.css`

Define light and dark theme CSS custom properties.

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #1a1a1a;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --text-primary: #ffffff;
}
```

#### 2. Theme Store

File: `src/stores/theme.ts`

Svelte store managing theme state with localStorage persistence.

### Success Criteria:

#### Automated Verification:

- [ ] Theme toggle works: `npm test -- theme`

## Component Updates

### Overview

Update all components to use theme CSS variables instead of hardcoded colors.

### Changes:

- **`src/components/Header.svelte`**: Replace hardcoded colors
- **`src/components/Sidebar.svelte`**: Replace hardcoded colors
- **`src/components/Card.svelte`**: Replace hardcoded colors

### Success Criteria:

#### Manual Verification:

- [ ] All components render correctly in both themes
