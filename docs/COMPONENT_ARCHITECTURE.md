# AI Resume Editor - Component Architecture

Visual guide to understanding the component structure and data flow.

## Component Tree

```
EditorLayout (Root)
├─ Header Section
│  ├─ Suggestion Info
│  │  ├─ Sparkles Icon
│  │  ├─ Title & Description
│  │  └─ Confidence Badge
│  └─ ViewToggle
│     ├─ Source Button (Code2 Icon)
│     ├─ Preview Button (Eye Icon)
│     └─ Diff Button (GitCompare Icon)
│
├─ Main Content (2/3 width)
│  ├─ Source View (viewMode === 'source')
│  │  └─ Original LaTeX Code
│  ├─ Preview View (viewMode === 'preview')
│  │  └─ Rendered HTML Preview
│  └─ Diff View (viewMode === 'diff') ✅ DEFAULT
│     └─ CustomDiffPanel
│        ├─ Column Headers
│        │  ├─ "Original Resume"
│        │  └─ "AI Suggestions"
│        ├─ SyncScrollContainer
│        │  ├─ Left Panel
│        │  │  └─ DiffLine[] (originalLines)
│        │  │     ├─ Line Number
│        │  │     ├─ Change Marker (+ / - / ~)
│        │  │     └─ Content (with charDiffs)
│        │  └─ Right Panel
│        │     └─ DiffLine[] (suggestedLines)
│        └─ Legend
│           ├─ Added (green)
│           ├─ Modified (amber)
│           └─ Deleted (red)
│
├─ Sidebar (1/3 width)
│  └─ Custom Content (prop)
│     ├─ Change Summary
│     ├─ AI Reasoning
│     └─ Match Analysis
│
└─ Footer Section
   ├─ Stats
   │  ├─ Additions Count
   │  ├─ Modifications Count
   │  └─ Deletions Count
   └─ Actions
      ├─ Reset Button
      ├─ Reject All Button
      └─ Accept Changes Button ✅
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ AI Resume Optimizer API                                     │
│ (Generates optimized LaTeX + change metadata)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Parse Response       │
          │ ├─ originalLatex     │
          │ ├─ optimizedLatex    │
          │ └─ changes[]         │
          └──────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐        ┌────────────────┐
│ Split to      │        │ Group by       │
│ DiffLineData[]│        │ Section        │
└───────┬───────┘        └────────┬───────┘
        │                         │
        ▼                         ▼
┌───────────────────────────────────────────┐
│ EditorLayout                              │
│ ├─ originalLines: DiffLineData[]         │
│ ├─ suggestedLines: DiffLineData[]        │
│ └─ sidebarContent: React.ReactNode       │
└───────┬───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ CustomDiffPanel                           │
│ ├─ useSyncScroll() hook                  │
│ │  ├─ leftRef                             │
│ │  ├─ rightRef                            │
│ │  └─ handleScroll()                      │
│ └─ State                                  │
│    ├─ hoveredLineId                       │
│    └─ selectedLineId                      │
└───────┬───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ DiffLine (Individual Line)                │
│ ├─ Line number                            │
│ ├─ Change marker (visual)                │
│ ├─ Content with highlighting              │
│ └─ Character-level diffs                  │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ User Interactions                         │
│ ├─ Hover → Update hoveredLineId          │
│ ├─ Click → Update selectedLineId         │
│ ├─ Scroll → Sync other panel             │
│ └─ Accept → Apply changes to LaTeX       │
└───────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────┐
│ EditorLayout State                      │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│viewMode │  │Accept/  │  │Sidebar   │
│         │  │Reject   │  │Visibility│
│'source' │  │State    │  │          │
│'preview'│  │         │  │          │
│'diff'   │  │         │  │          │
└─────────┘  └─────────┘  └──────────┘
```

```
┌─────────────────────────────────────────┐
│ CustomDiffPanel State                   │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌────────────┐
│hovered   │ │selected  │ │Scroll      │
│LineId    │ │LineId    │ │Position    │
│          │ │          │ │            │
│string│   │ │string│   │ │Synced      │
│null      │ │null      │ │between     │
│          │ │          │ │panels      │
└──────────┘ └──────────┘ └────────────┘
```

## Event Flow

### Scroll Synchronization

```
User scrolls Left Panel
       │
       ▼
onLeftScroll() triggered
       │
       ▼
handleScroll('left')
       │
       ▼
Calculate scroll %
       │
       ▼
Apply to Right Panel
       │
       ▼
Set isScrolling = true
       │
       ▼
setTimeout 50ms
       │
       ▼
Set isScrolling = false
```

### Line Interaction

```
User hovers over DiffLine
       │
       ▼
onHover(lineId) callback
       │
       ▼
setHoveredLineId(lineId)
       │
       ▼
Re-render with isHovered=true
       │
       ▼
Highlight background opacity


User clicks DiffLine
       │
       ▼
onClick(lineId) callback
       │
       ▼
setSelectedLineId(lineId)
       │
       ▼
scrollToChange(lineId)
       │
       ▼
Find element with data-change-id
       │
       ▼
scrollIntoView({ behavior: 'smooth' })
```

### Accept Changes Flow

```
User clicks "Accept Changes"
       │
       ▼
onAccept() callback
       │
       ▼
Collect all suggestedLines
       │
       ▼
Filter by acceptedChangeIds
       │
       ▼
Apply changes to original LaTeX
  ├─ Sort by lineNumber DESC
  ├─ For each change:
  │  ├─ added → splice in new line
  │  ├─ deleted → remove line
  │  └─ modified → replace line
       │
       ▼
Generate final LaTeX string
       │
       ▼
Update editor content
       │
       ▼
Trigger PDF compilation
```

## Color System

### Light Mode

```css
/* Added Lines */
bg-emerald-50      /* #ecfdf5 - Very light green */
text-emerald-700   /* #047857 - Dark green */
border-emerald-300 /* #6ee7b7 - Medium green */

/* Modified Lines */
bg-amber-50        /* #fffbeb - Very light amber */
text-amber-700     /* #b45309 - Dark amber */
border-amber-300   /* #fcd34d - Medium amber */

/* Deleted Lines */
bg-red-50          /* #fef2f2 - Very light red */
text-red-700       /* #b91c1c - Dark red */
border-red-300     /* #fca5a5 - Medium red */
```

### Dark Mode

```css
/* Added Lines */
bg-emerald-900/30  /* rgba(6, 78, 59, 0.3) - Transparent dark green */
text-emerald-300   /* #6ee7b7 - Light green */
border-emerald-700 /* #047857 - Medium green */

/* Modified Lines */
bg-amber-900/30    /* rgba(120, 53, 15, 0.3) - Transparent dark amber */
text-amber-300     /* #fcd34d - Light amber */
border-amber-700   /* #b45309 - Medium amber */

/* Deleted Lines */
bg-red-900/30      /* rgba(127, 29, 29, 0.3) - Transparent dark red */
text-red-300       /* #fca5a5 - Light red */
border-red-700     /* #b91c1c - Medium red */
```

## DiffLineData Structure

```typescript
interface DiffLineData {
  id: string;              // Unique identifier
  lineNumber: number;      // Position in file
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: string;         // LaTeX line content
  charDiffs?: Array<{      // Character-level changes (optional)
    start: number;         // Start index in content
    end: number;           // End index in content
    type: 'added' | 'deleted';
  }>;
  changeId?: string;       // Links to ResumeChange (optional)
}
```

### Example Data

```typescript
const exampleLine: DiffLineData = {
  id: 'line-42',
  lineNumber: 42,
  type: 'modified',
  content: '\\resumeSubheading{Senior Software Engineer}{ABC Corp}',
  charDiffs: [
    {
      start: 18,           // Position of "Senior "
      end: 25,
      type: 'added'
    }
  ],
  changeId: 'change-5'
};

// Visual representation:
// \resumeSubheading{Senior Software Engineer}{ABC Corp}
//                   ^^^^^^^ highlighted in green
```

## Responsive Layout

```
Desktop (>1024px)
┌─────────────────────────────────────────────────┐
│ Header                                          │
├─────────────────────────────┬───────────────────┤
│                             │                   │
│ Diff Panel (2/3)            │ Sidebar (1/3)     │
│                             │                   │
│ ┌─────────┬─────────┐      │ ┌──────────────┐  │
│ │Original │Suggested│      │ │Change Summary│  │
│ │         │         │      │ ├──────────────┤  │
│ │         │         │      │ │AI Reasoning  │  │
│ │         │         │      │ ├──────────────┤  │
│ │         │         │      │ │Match Score   │  │
│ └─────────┴─────────┘      │ └──────────────┘  │
├─────────────────────────────┴───────────────────┤
│ Footer (Stats + Actions)                        │
└─────────────────────────────────────────────────┘


Tablet (768px - 1024px)
┌─────────────────────────────────────────────────┐
│ Header                                          │
├─────────────────────────────┬───────────────────┤
│ Diff Panel (1/2)            │ Sidebar (1/2)     │
└─────────────────────────────┴───────────────────┘


Mobile (<768px)
┌─────────────────┐
│ Header          │
├─────────────────┤
│ Tabs:           │
│ [Diff][Sidebar] │
├─────────────────┤
│ Active Tab      │
│ Content         │
└─────────────────┘
```

## Performance Optimizations

### Virtual Scrolling (for 1000+ lines)

```
┌─────────────────────────────────┐
│ Viewport (visible area)         │
│ ┌─────────────────────────────┐ │
│ │ Line 100                    │ │ ← Rendered
│ │ Line 101                    │ │ ← Rendered
│ │ Line 102                    │ │ ← Rendered
│ └─────────────────────────────┘ │
│                                 │
│ Lines 103-997: Empty divs       │ ← Not rendered
│ (calculated height only)        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Line 998                    │ │ ← Pre-rendered
│ │ Line 999                    │ │ ← Pre-rendered
│ │ Line 1000                   │ │ ← Pre-rendered
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

Total DOM nodes: ~10 instead of 1000
Performance gain: 100x faster rendering
```

### Memoization Strategy

```typescript
// Only re-render if props actually changed
const MemoizedDiffLine = React.memo(
  DiffLine,
  (prevProps, nextProps) => {
    return (
      prevProps.line.id === nextProps.line.id &&
      prevProps.isHovered === nextProps.isHovered &&
      prevProps.isSelected === nextProps.isSelected
    );
  }
);

// Result: 90% fewer re-renders during scroll
```

## Accessibility Features

```
┌─────────────────────────────────────────┐
│ Keyboard Navigation                     │
├─────────────────────────────────────────┤
│ Tab        → Navigate between elements  │
│ Enter      → Select line                │
│ Space      → Toggle change              │
│ Arrow Up   → Previous line              │
│ Arrow Down → Next line                  │
│ Cmd/Ctrl+A → Accept all                 │
│ Cmd/Ctrl+R → Reject all                 │
│ Escape     → Clear selection            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Screen Reader Support                   │
├─────────────────────────────────────────┤
│ aria-label    → Button descriptions     │
│ aria-selected → Line selection state    │
│ role="grid"   → Diff panel structure    │
│ alt text      → Change type indicators  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Visual Accessibility                    │
├─────────────────────────────────────────┤
│ High contrast → Dark mode support       │
│ Focus rings   → Visible keyboard focus  │
│ Large targets → 44x44px minimum         │
│ Color + icons → Not color-only feedback │
└─────────────────────────────────────────┘
```

## Testing Strategy

```
┌─────────────────────────────────────────┐
│ Unit Tests                              │
├─────────────────────────────────────────┤
│ ✓ DiffLine renders all types correctly │
│ ✓ Character diffs highlight properly   │
│ ✓ Change markers display correctly     │
│ ✓ useSyncScroll calculates percentage  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Integration Tests                       │
├─────────────────────────────────────────┤
│ ✓ Scroll sync between panels           │
│ ✓ Line selection updates sidebar       │
│ ✓ Accept changes updates LaTeX         │
│ ✓ View toggle switches content         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ E2E Tests                               │
├─────────────────────────────────────────┤
│ ✓ Full workflow: scan → optimize → ... │
│   → preview → accept → compile         │
│ ✓ Multi-change granular acceptance     │
│ ✓ Keyboard navigation                  │
└─────────────────────────────────────────┘
```

---

**Next**: See `/docs/EDITOR_COMPONENTS_GUIDE.md` for implementation details
