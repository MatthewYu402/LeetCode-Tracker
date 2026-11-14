import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Renders note text as Markdown. Raw HTML in notes is not rendered. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="notes">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
