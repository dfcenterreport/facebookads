---
name: Luminous Precision
colors:
  surface: '#fff8ef'
  surface-dim: '#e2d9c7'
  surface-bright: '#fff8ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf3e0'
  surface-container: '#f6eddb'
  surface-container-high: '#f0e7d5'
  surface-container-highest: '#eae2d0'
  on-surface: '#1f1b10'
  on-surface-variant: '#4d4632'
  inverse-surface: '#343024'
  inverse-on-surface: '#f9f0dd'
  outline: '#7f775f'
  outline-variant: '#d0c6ab'
  surface-tint: '#715d00'
  primary: '#715d00'
  on-primary: '#ffffff'
  primary-container: '#fdd205'
  on-primary-container: '#6f5b00'
  inverse-primary: '#ebc300'
  secondary: '#5b5f63'
  on-secondary: '#ffffff'
  secondary-container: '#dfe3e7'
  on-secondary-container: '#616569'
  tertiary: '#006972'
  on-tertiary: '#ffffff'
  tertiary-container: '#00ecff'
  on-tertiary-container: '#006770'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe178'
  primary-fixed-dim: '#ebc300'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#554500'
  secondary-fixed: '#dfe3e7'
  secondary-fixed-dim: '#c3c7cb'
  on-secondary-fixed: '#181c1f'
  on-secondary-fixed-variant: '#43474b'
  tertiary-fixed: '#8bf2ff'
  tertiary-fixed-dim: '#00dbed'
  on-tertiary-fixed: '#001f23'
  on-tertiary-fixed-variant: '#004f56'
  background: '#fff8ef'
  on-background: '#1f1b10'
  surface-variant: '#eae2d0'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for the **Windsor Media Dashboard**, a high-utility environment for data analysis and media management. The brand personality is **authoritative, efficient, and illuminating**. It moves away from generic corporate blues toward a high-energy, high-contrast palette that signals action and clarity.

The aesthetic follows **Modern Minimalism** with a focus on information density. By utilizing a "Clean White" foundation, the UI prioritizes legibility and reduces cognitive load. The emotional response is one of confidence and speed; the user should feel they are operating a precision instrument where important metrics are instantly surfaced through strategic use of the primary brand yellow.

## Colors

This design system utilizes a high-contrast palette optimized for a white-surface architecture. 

- **Primary (CI Yellow - #FDD205):** Reserved for primary calls-to-action, active state indicators, and critical data highlights. To ensure accessibility, text on primary yellow backgrounds must use the high-contrast dark neutral (#1A1A1B).
- **Secondary (Gray - #969A9E):** Used for secondary actions, borders, icons, and non-critical UI scaffolding.
- **Surface (#FFFFFF):** The dashboard remains predominantly white to maximize the "breathability" of dense data tables and charts.
- **Neutrals:** A range of grays derived from the secondary color are used for text hierarchies, ensuring that body copy and labels maintain a high contrast ratio against the white background.

## Typography

The typography strategy balances modern professionalism with technical precision. 

**Hanken Grotesk** is used for headlines to provide a sharp, contemporary feel that matches the dashboard's efficiency. **Work Sans** is selected for body text due to its exceptional legibility in data-heavy environments. **JetBrains Mono** is introduced specifically for labels and numerical data to ensure that digits align perfectly in tables and technical readouts.

Maintain a strict vertical rhythm. Large headlines should scale down for mobile devices to prevent awkward line breaks in narrow data columns.

## Layout & Spacing

This design system employs a **Fluid Grid** model with fixed gutter widths. 

- **Desktop:** 12-column grid with 20px gutters and 32px outer margins.
- **Tablet:** 8-column grid with 16px gutters and 24px outer margins.
- **Mobile:** 4-column grid with 16px gutters and 16px outer margins.

The spacing scale is built on a **4px base unit**. Component internal padding should generally follow the `md` (16px) or `sm` (8px) tokens to maintain a compact, professional density. Use `xl` (40px) spacing only to separate major sections or distinct data modules.

## Elevation & Depth

To maintain a "Clean White" professional look, depth is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Level 0 (Background):** Pure White (#FFFFFF).
- **Level 1 (Cards/Modules):** Pure White with a 1px border using a lightened version of the Secondary Gray (#E2E4E6).
- **Level 2 (Dropdowns/Modals):** Pure White with a subtle ambient shadow (0px 4px 20px rgba(0, 0, 0, 0.05)) to distinguish overlay elements from the base grid.

Avoid using yellow for elevation; yellow is strictly for interactive states or directional highlights. Use a subtle gray wash (#F8F9F9) for "well" or "container" backgrounds where data needs to be nested.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a professional, "tooled" look that feels modern without the playfulness of fully rounded corners. 

- **Small elements (Checkboxes, Tags):** 2px radius.
- **Standard elements (Buttons, Inputs):** 4px radius.
- **Large elements (Cards, Modals):** 8px radius.

All data visualization bars or segments should remain sharp or use a minimal 2px radius to maintain the integrity of the data points.

## Components

### Buttons
- **Primary:** CI Yellow (#FDD205) background with Dark Neutral (#1A1A1B) text. No border.
- **Secondary:** White background with a 1px Gray (#969A9E) border.
- **Ghost:** Transparent background with Gray text; Yellow text only for "active" filtering actions.

### Inputs & Forms
- Use 4px rounded corners. Borders should be 1px Gray (#969A9E). 
- **Focus state:** 2px border using CI Yellow.
- Labels must use the `body-sm` or `label-caps` typography for clarity.

### Data Cards
- Cards should use a 1px light gray border instead of shadows. 
- Headers within cards should use a 4px left-border accent of CI Yellow to indicate the "active" or "primary" metric in a dashboard view.

### Chips & Tags
- **Status Tags:** Use a light tint of the secondary gray for neutral states. 
- **Action Chips:** Use the CI Yellow as a background only when the chip represents a selected filter or a high-priority category.

### Data Tables
- Use `data-tabular` (JetBrains Mono) for numerical values.
- Row hover states should use a very faint yellow tint (#FFFBE6) to provide a clear visual track without obscuring the white background.