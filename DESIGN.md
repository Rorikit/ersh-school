---
name: Academic Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  mono-num:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an operational cockpit engineered for private academy directors, headmasters, and administrative staff. The design movement marries Linear-inspired information density with the calm, focused structure of modern document-first workspaces like Notion.

### Personality & Tone
- **Precision & Reliability:** Unambiguous, data-first hierarchy where vital student KPIs, attendance statuses, and tuition balances are scannable at a glance.
- **Academic Restraint:** An intentional absence of decorative clutter, replacing ornamental visuals with clean typographic rhythm and strict alignment.
- **Calm Velocity:** Fast, frictionless task execution for repetitive school workflows: bulk student enrollment, schedule generation, and billing processing.

### Visual Style
- **Light-First Modern Productivity:** Crisp white surfaces layered against a soft slate canvas, sharp 1px structural framing, and deliberate use of saturation reserved exclusively for interactive states and operational status tags.
- **High-Density Utility:** Compact control heights (32px–36px default) and tabular numeric alignment tailored to 1440x900 desktop displays.

## Colors

The palette establishes structural clarity through crisp slate neutrals, a confident royal blue primary for critical actions, and an assertive system of status indicators tailored to school monitoring.

### Role & Functional Mapping
- **Canvas & Surfaces:**
  - Base Application Canvas: `#F8FAFC` (Slate-50) — eliminates screen glare during 8-hour administrative shifts.
  - Active Card & Row Panels: `#FFFFFF` (Pure White) — provides immediate visual contrast against the canvas.
  - Muted Inactive/Table Header Fill: `#F1F5F9` (Slate-100).
- **Text & Hierarchy:**
  - Primary Headlines & Core Data: `#0F172A` (Slate-900) — high contrast, strict legibility.
  - Secondary Body & Column Headers: `#334155` (Slate-700) — balanced text for dense tables.
  - Tertiary Meta & Inactive Labels: `#64748B` (Slate-500) — timestamps, micro-counters, empty states.
- **Primary Brand Interactive:**
  - Default Action: `#2563EB` (Royal Blue) — primary buttons, active row indicators, selected navigation.
  - Hover Action: `#1D4ED8` (Blue-700).
  - Subtle Selected Surface: `#EFF6FF` (Blue-50).
- **Administrative Status Roles:**
  - Success / Attended («Присутствует»): Surface `#ECFDF5`, Border `#A7F3D0`, Text `#047857`.
  - Warning / Unmarked Attendance («Не отмечено»): Surface `#FFFBEB`, Border `#FDE68A`, Text `#B45309`.
  - Critical / Absent («Отсутствует» / «Задолженность»): Surface `#FEF2F2`, Border `#FECACA`, Text `#B91C1C`.
- **Structural Outlines:**
  - Standard Dividing Lines: `#E2E8F0` (Slate-200).
  - Input Borders & Inactive Chips: `#CBD5E1` (Slate-300).

## Typography

Typography relies on a singular typeface: **Inter**, configured for optimal Cyrillic rendering and high-density numeric scanning.

### Typographic Rules
- **Tabular Figures:** Always apply `font-feature-settings: "tnum" 1, "cv05" 1, "cv08" 1` across all numerical columns, financial balances (₽), dates, and grades to prevent visual jitter when sorting datasets.
- **Cyrillic Case & Kerning:** Headers in Russian must avoid aggressive all-caps transformations unless applied to micro-badges (`label-sm`).
- **Hierarchy Anchors:**
  - `headline-xl` (28px): Used strictly for major module views (e.g., «Журнал успеваемости», «Финансовый реестр»).
  - `title-sm` (15px): Dedicated card titles, modal headings, and student profile banner headers.
  - `body-md` (14px) and `body-sm` (13px): Standard administrative grids, student dossiers, parent notes, and schedule slots.
  - `label-sm` (11px, 600 weight, uppercase): Column sort tags, badge indicators, and form field grouping captions.

## Layout & Spacing

This design system utilizes an **8px base grid** with a sub-grid of **4px** for micro-alignments, buttons, and status labels.

### Grid & Structure
- **Desktop Primary Target (1440x900):**
  - Left Global Sidebar: Fixed width at `240px` (collapsible to `64px` icon-only state for intense data views).
  - Main Canvas Area: Fluid multi-panel arrangement with `24px` outer canvas margins.
  - Multi-Column Grids: 12-column layout with `20px` gutters for summary cards; full fluid width for data grids and schedules.
  - Auxiliary Detail Drawer: Fixed `420px` right-side overlay for immediate editing of student profiles or lesson attendance without leaving the current view.
- **Rhythm & Density:**
  - Table Row Density: Standard row height is fixed at `40px` (dense) or `48px` (default) with `8px` vertical cell padding.
  - Form Fields & Button Heights: Unified strictly at `36px` default, with `28px` micro-buttons for in-row table actions.

## Elevation & Depth

Visual hierarchy is maintained via **low-contrast structural borders and ultra-diffused, ambient drop shadows**. Heavy elevation and dramatic blurs are intentionally avoided to sustain a clean, professional software tool aesthetic.

### Surface Elevation Levels
- **Level 0 (App Canvas):** `#F8FAFC`, flat, 0px offset.
- **Level 1 (Card & Primary Containers):**
  - Background: `#FFFFFF`
  - Border: 1px solid `#E2E8F0`
  - Shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`
- **Level 2 (Dropdown Menus, Popovers, Date Pickers):**
  - Background: `#FFFFFF`
  - Border: 1px solid `#CBD5E1`
  - Shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)`
- **Level 3 (Modal Dialogs & Slide-over Drawers):**
  - Background: `#FFFFFF`
  - Border: 1px solid `#CBD5E1`
  - Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`
  - Overlay: Backdrop tint using `#0F172A` at `25%` opacity.

## Shapes

The design system maintains a modern, disciplined corner curvature balanced between technical rigor and contemporary SaaS software ergonomics.

### Corner Radius Mapping
- **Control Radius (8px / `rounded-md`):** Buttons, text input boxes, dropdown selectors, and small search bars.
- **Card & Panel Radius (10px–12px / `rounded-lg`):** Main module cards, attendance tables, student detail panels, and metric summary tiles.
- **Modal & Slide-over Radius (12px–16px / `rounded-xl`):** Flyout drawers and modal dialogs.
- **Status Badges & Avatar Cells (Full Pill / `9999px`):** Status pills («Оплачено», «Пропуск») and student avatars use full rounded curves to contrast with rectangular layout containers.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, border none, 8px radius, height 36px, padding 0 14px. Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#334155`, border 1px solid `#E2E8F0`, 8px radius. Hover: `#F8FAFC`, text `#0F172A`, border `#CBD5E1`.
- **Danger:** Background `#FEF2F2`, text `#B91C1C`, border 1px solid `#FECACA`. Hover: background `#FEE2E2`.
- **Icon / Table Utility Button:** 28px square, background transparent, border 1px solid transparent, 6px radius. Hover: background `#F1F5F9`, border `#E2E8F0`.

### Status Badges & Chips
- Compact pill height: 22px, font size 11px, font weight 600, padding 2px 8px.
- **Присутствует (Present):** Background `#ECFDF5`, border 1px solid `#A7F3D0`, text `#047857`. Dot indicator: 6px solid `#10B981`.
- **Не отмечено (Unmarked):** Background `#FFFBEB`, border 1px solid `#FDE68A`, text `#B45309`. Dot indicator: 6px solid `#F59E0B`.
- **Отсутствует (Absent):** Background `#FEF2F2`, border 1px solid `#FECACA`, text `#B91C1C`. Dot indicator: 6px solid `#EF4444`.
- **Болеет (Excused/Sick):** Background `#EFF6FF`, border 1px solid `#BFDBFE`, text `#1D4ED8`. Dot indicator: 6px solid `#3B82F6`.

### Data Tables & Attendance Grids
- **Header:** Height 36px, background `#F8FAFC`, border-bottom 1px solid `#E2E8F0`, text 11px uppercase `#64748B`, weight 600.
- **Row:** Height 44px, background `#FFFFFF`, border-bottom 1px solid `#F1F5F9`. Hover state: `#F8FAFC`.
- **Selection State:** Active row highlighted with `#EFF6FF` background and a 2px solid `#2563EB` left accent border.
- **Numbers & Dates:** Right-aligned, rendered using `mono-num` styling (`font-feature-settings: "tnum"`).

### Form Input Fields
- Height 36px, background `#FFFFFF`, border 1px solid `#CBD5E1`, radius 8px, padding 0 12px, font 13px `#0F172A`.
- Placeholder text: `#94A3B8`.
- Focus ring: Border `#2563EB`, outer box-shadow `0 0 0 3px rgba(37, 99, 235, 0.15)`.

### Cards & Metrics Tiles
- Background `#FFFFFF`, border 1px solid `#E2E8F0`, radius 10px, padding 16px.
- Metric display: Value in 22px bold `#0F172A`, comparative delta pill directly adjacent (e.g., `+4.2%` with `#ECFDF5` background).

### Checkboxes & Segmented Controls
- **Checkbox:** 16px square, radius 4px, border 1.5px solid `#CBD5E1`. Checked state: background `#2563EB`, checkmark `#FFFFFF`.
- **Segmented Control:** Height 32px, background `#F1F5F9`, padding 2px, radius 8px. Active tab: background `#FFFFFF`, shadow `0 1px 2px rgba(0,0,0,0.06)`, text `#0F172A`, weight 500.