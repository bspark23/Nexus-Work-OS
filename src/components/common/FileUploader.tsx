import { useRef, useState } from "react";
import { Paperclip, Trash2, Upload, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAttachment, uploadAttachment } from "@/lib/api";
import type { Attachment } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export function FileUploader({
  attachments,
  projectId,
  reportId,
  onChange,
  label = "Attachments & screenshots",
}: {
  attachments: Attachment[];
  projectId?: string | null;
  reportId?: string | null;
  onChange: () => void;
  label?: string;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment({
          file,
          userId: user.id,
          projectId: projectId ?? null,
          reportId: reportId ?? null,
        });
      }
      toast.success("Upload complete");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {attachments.length === 0 ? (
        <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-xs">
          <Paperclip className="mx-auto mb-2 size-4 opacity-60" />
          No files uploaded yet. Images, PDFs and documents are supported.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="bg-secondary/50 flex items-center gap-3 rounded-xl border p-2.5"
            >
              {a.file_type?.startsWith("image/") ? (
                <img
                  src={a.file_url}
                  alt={a.file_name}
                  className="size-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  {a.file_type?.startsWith("image/") ? (
                    <ImageIcon className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </div>
              )}
              <a
                href={a.file_url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary min-w-0 flex-1 truncate text-xs font-medium"
              >
                {a.file_name}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={async () => {
                  await deleteAttachment(a);
                  onChange();
                }}
              >
                <Trash2 className="text-destructive size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
