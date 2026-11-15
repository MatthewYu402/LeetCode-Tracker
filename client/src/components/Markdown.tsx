// Keep the `katex` package on the same version rehype-katex renders with: the stylesheet
// and the generated markup must match, or sub/superscripts and fractions are mis-sized.
import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/**
 * Renders note text as Markdown with LaTeX math: `$...$` inline and `$$...$$`
 * for a centred block. Raw HTML in notes is not rendered.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="notes">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
