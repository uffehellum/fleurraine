# Fleurraine Logo Fonts

This document identifies the fonts used in the Fleurraine logo for consistent branding across the application.

## Logo Typography

### Main Title: "FLEURRAINE"
The main title uses a **classical serif font** with these characteristics:
- All caps with elegant proportions
- Strong serifs with traditional Roman styling
- Likely font matches:
  - **Trajan Pro** (Adobe) - Most likely match
  - **Cinzel** (Google Fonts) - Free alternative
  - **Cormorant Garamond** (Google Fonts) - Free alternative

**Recommended for web use:**
```css
font-family: 'Cinzel', serif;
font-weight: 400;
letter-spacing: 0.05em;
```

### Tagline: "Locally grown flowers"
The tagline uses an **elegant italic serif** with these characteristics:
- Graceful italic slant
- Classic book-style serif
- Likely font matches:
  - **Garamond Italic** (Classic)
  - **Baskerville Italic** (Classic)
  - **Cormorant Garamond Italic** (Google Fonts) - Free alternative
  - **Crimson Text Italic** (Google Fonts) - Free alternative

**Recommended for web use:**
```css
font-family: 'Cormorant Garamond', serif;
font-weight: 400;
font-style: italic;
```

## Google Fonts Implementation

Add to your HTML `<head>` or CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
```

## Usage Examples

### Header/Title
```css
.app-title {
  font-family: 'Cinzel', serif;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

### Tagline/Subtitle
```css
.app-tagline {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 400;
  font-style: italic;
  font-size: 1.1em;
}
```

### Body Text (Suggested)
For body text, consider pairing with:
- **Lato** (sans-serif, clean and modern)
- **Open Sans** (sans-serif, highly readable)
- **Cormorant Garamond** (serif, maintains brand consistency)

## Logo Files

- **Original logo with text**: `fleurraine.png`
- **Transparent flower illustration only**: `fleurraine-logo-transparent.png`

The transparent version can be used as an icon or decorative element throughout the app while using the identified fonts to recreate the text styling in HTML/CSS.
