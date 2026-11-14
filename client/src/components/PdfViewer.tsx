import { useEffect, useRef } from 'react'
import { api, type Attachment } from '../api.ts'

/** Full-window viewer that shows an uploaded PDF using the browser's built-in reader. */
export default function PdfViewer({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const url = api.attachmentUrl(attachment.id)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={attachment.filename}
      className="m-auto h-[94vh] w-[min(96vw,1100px)] max-w-none overflow-hidden rounded-lg bg-surface p-0 text-ink"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <p className="min-w-0 truncate font-semibold">{attachment.filename}</p>
          <div className="flex shrink-0 gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="btn">
              Open in new tab
            </a>
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
        </div>
        <iframe src={url} title={attachment.filename} className="min-h-0 w-full flex-1 bg-paper" />
      </div>
    </dialog>
  )
}
