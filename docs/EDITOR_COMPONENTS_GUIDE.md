# AI Resume Editor Components - Usage Guide

Complete guide for building an AI-powered resume editor using the custom UI components.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Component Reference](#component-reference)
4. [Data Flow](#data-flow)
5. [Customization](#customization)
6. [Performance Tips](#performance-tips)
7. [Common Patterns](#common-patterns)

## Quick Start

### 1. View the Demo

Navigate to `/editor-demo` in your browser to see the complete editor in action.

### 2. Basic Implementation

```tsx
import { EditorLayout } from '@/components/editor';
import type { DiffLineData } from '@/components/editor';

function MyEditor() {
  const originalLines: DiffLineData[] = [
    // Your original resume lines
  ];

  const suggestedLines: DiffLineData[] = [
    // AI-generated suggestions
  ];

  return (
    <EditorLayout
      originalLines={originalLines}
      suggestedLines={suggestedLines}
      sidebarContent={<MySidebar />}
      onAccept={() => applyChanges()}
    />
  );
}
```

## Architecture Overview

### Component Hierarchy

```
EditorLayout (Root Container)
├── Header
│   ├── SuggestionHeader (AI info + confidence)
│   └── ViewToggle (Source/Preview/Diff)
├── Main Content (2/3 width)
│   ├── DiffPanel (Monaco-based) OR
│   └── CustomDiffPanel
│       ├── SyncScrollContainer
│       │   ├── Left Panel (Original)
│       │   │   └── DiffLine[]
│       │   └── Right Panel (Suggested)
│       │       └── DiffLine[]
│       └── Legend
└── Sidebar (1/3 width)
    └── Your Custom Content
```

### Data Flow

```
User Action → EditorLayout → CustomDiffPanel → DiffLine → User
     ↓              ↓              ↓              ↓
  Callbacks    View Mode     Scroll Sync    Line Events
```

## Component Reference

### EditorLayout

**Purpose**: Main container orchestrating the entire editor UI.

**Props**:

```typescript
interface EditorLayoutProps {
  suggestion?: {
    id: string;
    title: string;
    description: string;
    confidence: number;
  };
  originalLines: DiffLineData[];
  suggestedLines: DiffLineData[];
  sidebarContent: React.ReactNode;
  sourceContent?: React.ReactNode;
  previewContent?: React.ReactNode;
  onAccept?: () => void;
  onReject?: () => void;
  onReset?: () => void;
}
```

**Example**:

```tsx
<EditorLayout
  suggestion={{
    id: 'sugg-1',
    title: 'Quantify Achievements',
    description: 'Added metrics to demonstrate impact',
    confidence: 94,
  }}
  originalLines={parseLatexToLines(originalLatex)}
  suggestedLines={parseLatexToLines(optimizedLatex)}
  sidebarContent={
    <ChangeSummary changes={changes} reasoning={aiReasoning} />
  }
  onAccept={handleApplyChanges}
  onReject={handleRejectAll}
  onReset={handleResetToOriginal}
/>
```

### CustomDiffPanel

**Purpose**: Custom side-by-side diff visualization with granular control.

**Props**:

```typescript
interface CustomDiffPanelProps {
  originalLines: DiffLineData[];
  suggestedLines: DiffLineData[];
  onLineClick?: (lineId: string) => void;
}
```

**When to use**:
- Need custom styling for diff lines
- Want character-level highlighting
- Require interactive line selection
- Building custom change acceptance UI

**Example**:

```tsx
<CustomDiffPanel
  originalLines={originalLines}
  suggestedLines={suggestedLines}
  onLineClick={(lineId) => {
    // Highlight change in sidebar
    scrollToChange(lineId);
  }}
/>
```

### DiffPanel (Monaco)

**Purpose**: Monaco editor-based diff for LaTeX code.

**Props**:

```typescript
interface DiffPanelProps {
  originalLatex: string;
  modifiedLatex: string;
  highlightedLine?: number;
}
```

**When to use**:
- Need syntax highlighting for LaTeX
- Users expect familiar editor experience
- Want built-in diff algorithm
- Don't need custom change tracking

**Example**:

```tsx
<DiffPanel
  originalLatex={originalResumeCode}
  modifiedLatex={optimizedResumeCode}
  highlightedLine={currentLine}
/>
```

### DiffLine

**Purpose**: Individual line with change visualization.

**Props**:

```typescript
interface DiffLineProps {
  line: DiffLineData;
  isHovered?: boolean;
  isSelected?: boolean;
  onHover?: (lineId: string | null) => void;
  onClick?: (lineId: string) => void;
}
```

**Line Types**:

| Type | Visual | Use Case |
|------|--------|----------|
| `unchanged` | Gray text | Lines that stayed the same |
| `added` | Green bg | New content from AI |
| `deleted` | Red bg + strikethrough | Removed content |
| `modified` | Amber bg | Changed content |

**Character Diffs**:

```typescript
{
  id: 'line-1',
  type: 'modified',
  content: '\\resumeSubheading{Senior Software Engineer}{ABC Corp}',
  charDiffs: [
    { start: 18, end: 25, type: 'added' }, // "Senior "
  ],
}
```

This highlights "Senior " within the line.

### ViewToggle

**Purpose**: Switch between Source/Preview/Diff views.

**Props**:

```typescript
interface ViewToggleProps {
  viewMode: 'source' | 'preview' | 'diff';
  onChange: (mode: ViewMode) => void;
}
```

**Example**:

```tsx
const [viewMode, setViewMode] = useState<ViewMode>('diff');

<ViewToggle viewMode={viewMode} onChange={setViewMode} />
```

## Data Flow

### 1. Converting LaTeX to DiffLineData

```typescript
function parseLatexToDiffLines(
  originalLatex: string,
  modifiedLatex: string
): { originalLines: DiffLineData[]; suggestedLines: DiffLineData[] } {
  const originalArray = originalLatex.split('\n');
  const modifiedArray = modifiedLatex.split('\n');

  // Use diff algorithm (e.g., myers diff)
  const diff = computeDiff(originalArray, modifiedArray);

  const originalLines: DiffLineData[] = [];
  const suggestedLines: DiffLineData[] = [];

  diff.forEach((change, index) => {
    const baseData = {
      id: `line-${index}`,
      lineNumber: index + 1,
      content: change.value,
    };

    if (change.added) {
      suggestedLines.push({
        ...baseData,
        type: 'added',
        changeId: `change-${index}`,
      });
    } else if (change.removed) {
      originalLines.push({
        ...baseData,
        type: 'deleted',
        changeId: `change-${index}`,
      });
    } else {
      const lineData = { ...baseData, type: 'unchanged' };
      originalLines.push(lineData);
      suggestedLines.push(lineData);
    }
  });

  return { originalLines, suggestedLines };
}
```

### 2. Applying Changes

```typescript
function applyAcceptedChanges(
  originalLatex: string,
  suggestedLines: DiffLineData[],
  acceptedChangeIds: string[]
): string {
  let result = originalLatex;

  // Sort changes by line number (descending) to avoid offset issues
  const changes = suggestedLines
    .filter((line) => line.changeId && acceptedChangeIds.includes(line.changeId))
    .sort((a, b) => b.lineNumber - a.lineNumber);

  for (const change of changes) {
    const lines = result.split('\n');

    if (change.type === 'added') {
      lines.splice(change.lineNumber - 1, 0, change.content);
    } else if (change.type === 'deleted') {
      lines.splice(change.lineNumber - 1, 1);
    } else if (change.type === 'modified') {
      lines[change.lineNumber - 1] = change.content;
    }

    result = lines.join('\n');
  }

  return result;
}
```

## Customization

### Custom Sidebar

Build a custom sidebar for change details:

```tsx
function ChangeSidebar({ changes, onChangeToggle }) {
  return (
    <div className="p-6 space-y-6">
      <section>
        <h3 className="text-sm font-semibold uppercase mb-4">
          Change Summary
        </h3>
        {changes.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            onToggle={() => onChangeToggle(change.id)}
          />
        ))}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase mb-4">
          AI Reasoning
        </h3>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm">{aiReasoning}</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase mb-4">
          Match Score
        </h3>
        <MatchScoreCard before={78} after={92} />
      </section>
    </div>
  );
}
```

### Custom Color Scheme

Override Tailwind classes in your components:

```tsx
// Custom DiffLine with different colors
<DiffLine
  line={line}
  className={cn(
    line.type === 'added' && 'bg-blue-50 text-blue-700',
    line.type === 'deleted' && 'bg-purple-50 text-purple-700',
  )}
/>
```

### Custom Change Markers

Modify `DiffLine.tsx` to use custom icons:

```tsx
import { Plus, Minus, Pencil } from 'lucide-react';

const getChangeIcon = () => {
  switch (line.type) {
    case 'added':
      return <Plus className="w-4 h-4" />;
    case 'deleted':
      return <Minus className="w-4 h-4" />;
    case 'modified':
      return <Pencil className="w-4 h-4" />;
  }
};
```

## Performance Tips

### 1. Virtual Scrolling for Large Files

For files with 1000+ lines, implement virtual scrolling:

```tsx
import { FixedSizeList } from 'react-window';

function VirtualizedDiffPanel({ lines }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <DiffLine line={lines[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={800}
      itemCount={lines.length}
      itemSize={35}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 2. Memoize DiffLine Components

```tsx
const MemoizedDiffLine = React.memo(DiffLine, (prev, next) => {
  return (
    prev.line.id === next.line.id &&
    prev.isHovered === next.isHovered &&
    prev.isSelected === next.isSelected
  );
});
```

### 3. Debounce Scroll Events

```tsx
import { debounce } from 'lodash';

const debouncedScroll = debounce((source) => {
  handleScroll(source);
}, 50);
```

## Common Patterns

### Pattern 1: Granular Change Acceptance

Allow users to accept/reject individual changes:

```tsx
function GranularEditor() {
  const [acceptedChangeIds, setAcceptedChangeIds] = useState<string[]>([]);

  const toggleChange = (changeId: string) => {
    setAcceptedChangeIds((prev) =>
      prev.includes(changeId)
        ? prev.filter((id) => id !== changeId)
        : [...prev, changeId]
    );
  };

  const sidebar = (
    <div>
      {changes.map((change) => (
        <ChangeCard
          key={change.id}
          change={change}
          isAccepted={acceptedChangeIds.includes(change.id)}
          onToggle={() => toggleChange(change.id)}
        />
      ))}
    </div>
  );

  return (
    <EditorLayout
      sidebarContent={sidebar}
      onAccept={() => applyAcceptedChanges(acceptedChangeIds)}
    />
  );
}
```

### Pattern 2: Change Categories

Group changes by section:

```tsx
const changesBySection = groupBy(changes, 'section');

<div>
  {Object.entries(changesBySection).map(([section, sectionChanges]) => (
    <Accordion key={section} title={section}>
      {sectionChanges.map((change) => (
        <ChangeCard change={change} />
      ))}
    </Accordion>
  ))}
</div>
```

### Pattern 3: Live Preview with Debounce

Show live PDF preview as changes are accepted:

```tsx
const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
const [pdfData, setPdfData] = useState<string | null>(null);

const debouncedCompile = useMemo(
  () =>
    debounce(async (latex: string) => {
      const pdf = await compileLaTeX(latex);
      setPdfData(pdf);
    }, 1000),
  []
);

useEffect(() => {
  const latexWithChanges = applyAcceptedChanges(
    originalLatex,
    suggestedLines,
    acceptedIds
  );
  debouncedCompile(latexWithChanges);
}, [acceptedIds]);
```

## Testing

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { DiffLine } from '@/components/editor';

describe('DiffLine', () => {
  it('renders added line with green background', () => {
    const line: DiffLineData = {
      id: 'line-1',
      lineNumber: 1,
      type: 'added',
      content: 'New content',
    };

    render(<DiffLine line={line} />);

    const element = screen.getByText('New content');
    expect(element).toHaveClass('bg-emerald-50');
  });

  it('highlights character diffs', () => {
    const line: DiffLineData = {
      id: 'line-1',
      lineNumber: 1,
      type: 'modified',
      content: 'Senior Engineer',
      charDiffs: [{ start: 0, end: 7, type: 'added' }],
    };

    render(<DiffLine line={line} />);

    const highlighted = screen.getByText('Senior ');
    expect(highlighted).toHaveClass('bg-emerald-200');
  });
});
```

## Troubleshooting

### Issue: Scroll sync not working

**Solution**: Ensure refs are properly attached:

```tsx
const { leftRef, rightRef, handleScroll } = useSyncScroll();

// Verify refs are attached
useEffect(() => {
  console.log('Left ref:', leftRef.current);
  console.log('Right ref:', rightRef.current);
}, []);
```

### Issue: Character diffs not showing

**Solution**: Check `charDiffs` array format:

```tsx
// Correct
charDiffs: [{ start: 0, end: 5, type: 'added' }]

// Incorrect (missing type)
charDiffs: [{ start: 0, end: 5 }]
```

### Issue: Changes not applying correctly

**Solution**: Apply changes in reverse order (highest line number first):

```tsx
changes.sort((a, b) => b.lineNumber - a.lineNumber);
```

## Next Steps

1. **Implement Change Detection**: Build a diff algorithm to convert LaTeX strings to `DiffLineData[]`
2. **Add Keyboard Shortcuts**: Implement Cmd+Z for undo, Cmd+Shift+A for accept all
3. **Export Functionality**: Add export to different formats (PDF, DOCX, plain text)
4. **Analytics**: Track which AI suggestions users accept most often
5. **Versioning**: Store multiple resume versions with timestamps

## Resources

- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Window for Virtual Scrolling](https://react-window.vercel.app/)

## License

Part of the AI Resume Editor platform. See project root for license details.
