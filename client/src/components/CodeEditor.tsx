import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import type { Extension } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

function highlighting(language: string): Extension[] {
  switch (language) {
    case 'python':
      return [python()]
    case 'javascript':
      return [javascript()]
    case 'typescript':
      return [javascript({ typescript: true })]
    case 'java':
    case 'kotlin':
    case 'csharp':
      // Close enough for C-family syntax without shipping more grammars.
      return [java()]
    case 'cpp':
    case 'c':
      return [cpp()]
    case 'go':
      return [go()]
    case 'rust':
      return [rust()]
    default:
      return []
  }
}

interface Props {
  value: string
  language: string
  onChange?: (value: string) => void
  /** Read-only display, sized to its content. */
  readOnly?: boolean
  ariaLabel?: string
}

export default function CodeEditor({ value, language, onChange, readOnly = false, ariaLabel }: Props) {
  const extensions = useMemo(() => highlighting(language), [language])
  return (
    <div className="overflow-hidden rounded-md border border-line font-mono text-[0.82rem]">
      <CodeMirror
        value={value}
        extensions={extensions}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        minHeight={readOnly ? undefined : '220px'}
        maxHeight={readOnly ? undefined : '560px'}
        aria-label={ariaLabel}
        basicSetup={{ foldGutter: false, highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly }}
      />
    </div>
  )
}
