# AI Resume Editor Components

A comprehensive set of UI components for building an AI-powered resume editor with side-by-side diff visualization, synchronized scrolling, and intelligent change tracking.

## Components

### 1. EditorLayout

The main layout component that orchestrates the entire editor interface.

**Features:**
- Full-screen 3-section layout (Header / Main Content / Footer)
- View mode switching (Source / Preview / Diff)
- Suggestion header with AI confidence score
- Action bar with Accept/Reject/Reset buttons
- Responsive sidebar for change details

**Usage:**

```tsx
import { EditorLayout } from '@/components/editor';

<EditorLayout
  suggestion={{
    id: 'sugg-1',
    title: 'Enhance Job Title',
    description: 'Updated to senior level',
    confidence: 92,
  }}
  originalLines={originalLines}
  suggestedLines={suggestedLines}
  sidebarContent={<YourSidebar />}
  onAccept={handleAccept}
  onReject={handleReject}
/>
```

### 2. DiffPanel (Monaco-based)

Monaco editor-based diff viewer for LaTeX code comparison.

**Features:**
- Side-by-side LaTeX diff using Monaco editor
- Syntax highlighting for LaTeX
- Built-in diff algorithm
- Minimap and overview ruler

**Usage:**

```tsx
import { DiffPanel } from '@/components/editor';

<DiffPanel
  originalLatex={originalCode}
  modifiedLatex={modifiedCode}
  highlightedLine={10}
/>
```

### 3. CustomDiffPanel

Custom-built diff panel with granular control over line-by-line changes.

**Features:**
- Synchronized scrolling between original and suggested versions
- Character-level highlighting within modified lines
- Color-coded change indicators (added/modified/deleted)
- Interactive line selection
- Custom styling with Tailwind CSS

**Usage:**

```tsx
import { CustomDiffPanel } from '@/components/editor';

<CustomDiffPanel
  originalLines={originalLines}
  suggestedLines={suggestedLines}
  onLineClick={(lineId) => console.log('Clicked:', lineId)}
/>
```

### 4. DiffLine

Individual line component with change visualization.

**Props:**
- `line: DiffLineData` - Line data with type, content, and diffs
- `isHovered?: boolean` - Hover state
- `isSelected?: boolean` - Selection state
- `onHover?: (lineId: string | null) => void` - Hover callback
- `onClick?: (lineId: string) => void` - Click callback

**Line Types:**
- `unchanged` - Default gray text
- `added` - Green background (`bg-emerald-50`)
- `deleted` - Red background with strikethrough (`bg-red-50`)
- `modified` - Amber background with character highlights (`bg-amber-50`)

### 5. SyncScrollContainer

Container that synchronizes scroll position between two panels.

**Features:**
- Prevents infinite scroll loops
- Smooth scroll behavior
- Percentage-based synchronization
- Scroll-to-element method

### 6. ViewToggle

Toggle buttons for switching between Source/Preview/Diff views.

**Features:**
- Three-way toggle with icons (Code2, Eye, GitCompare)
- Active state styling with gradient
- Smooth animations with Framer Motion

## Data Types

### DiffLineData

```typescript
interface DiffLineData {
  id: string;
  lineNumber: number;
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: string;
  charDiffs?: Array<{
    start: number;
    end: number;
    type: 'added' | 'deleted';
  }>;
  changeId?: string;
}
```

## Hooks

### useSyncScroll

Custom hook for synchronized scrolling between two panels.

**Returns:**
- `leftRef: RefObject<HTMLDivElement>` - Ref for left panel
- `rightRef: RefObject<HTMLDivElement>` - Ref for right panel
- `handleScroll: (source: 'left' | 'right') => void` - Scroll handler
- `scrollToChange: (changeId: string) => void` - Scroll to specific change

**Usage:**

```tsx
import { useSyncScroll } from '@/hooks/useSyncScroll';

function MyComponent() {
  const { leftRef, rightRef, handleScroll } = useSyncScroll();

  return (
    <div className="grid grid-cols-2">
      <div ref={leftRef} onScroll={() => handleScroll('left')}>
        {/* Left content */}
      </div>
      <div ref={rightRef} onScroll={() => handleScroll('right')}>
        {/* Right content */}
      </div>
    </div>
  );
}
```

## Color Scheme

All components use consistent Tailwind CSS color classes:

| Change Type | Background | Text | Border |
|------------|-----------|------|--------|
| **Added** | `bg-emerald-50 dark:bg-emerald-900/30` | `text-emerald-700 dark:text-emerald-300` | `border-emerald-300 dark:border-emerald-700` |
| **Modified** | `bg-amber-50 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-300` | `border-amber-300 dark:border-amber-700` |
| **Deleted** | `bg-red-50 dark:bg-red-900/30` | `text-red-700 dark:text-red-300` | `border-red-300 dark:border-red-700` |

## Example Implementation

See `EditorExample.tsx` for a complete working example with:
- Sample diff data with character-level changes
- Sidebar with change summary and AI reasoning
- Accept/Reject/Reset action handlers
- View mode switching
- Match analysis visualization

## Integration Guide

### 1. Install Dependencies

Ensure these packages are installed:

```bash
npm install framer-motion lucide-react
```

### 2. Import Components

```tsx
import {
  EditorLayout,
  CustomDiffPanel,
  DiffLine,
  ViewToggle,
} from '@/components/editor';
import { useSyncScroll } from '@/hooks/useSyncScroll';
```

### 3. Prepare Data

Convert your LaTeX diff into `DiffLineData[]` format:

```tsx
const originalLines: DiffLineData[] = [
  {
    id: 'line-1',
    lineNumber: 1,
    type: 'modified',
    content: '\\resumeSubheading{Software Engineer}{ABC Corp}',
    charDiffs: [
      { start: 18, end: 25, type: 'added' }, // "Senior "
    ],
    changeId: 'change-1',
  },
  // ... more lines
];
```

### 4. Implement Actions

```tsx
const handleAccept = () => {
  // Apply all suggested changes
  applyChanges(suggestedLines);
};

const handleReject = () => {
  // Discard all suggestions
  resetToOriginal();
};
```

## Performance Considerations

- **Virtual scrolling**: Consider implementing virtual scrolling for large files (1000+ lines)
- **Memoization**: Use `React.memo` for DiffLine components to prevent unnecessary re-renders
- **Debouncing**: Debounce scroll events if experiencing performance issues
- **Lazy loading**: Load sidebar content only when needed

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires support for:
- CSS Grid
- CSS Custom Properties
- Intersection Observer (for virtual scrolling)

## Accessibility

All components include:
- Proper ARIA labels
- Keyboard navigation support
- Focus indicators
- Screen reader-friendly content
- High contrast mode support

## License

Part of the AI Resume Editor platform. See project root for license details.
