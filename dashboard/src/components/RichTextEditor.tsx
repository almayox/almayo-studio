"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", bg: "#fef08a" },
  { label: "Green", bg: "#bbf7d0" },
  { label: "Blue", bg: "#bfdbfe" },
  { label: "Red", bg: "#fecaca" },
  { label: "Purple", bg: "#e9d5ff" },
  { label: "Orange", bg: "#fed7aa" },
];

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Navy", value: "#0a1f44" },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Gray", value: "#6b7280" },
];

const FONT_SIZES = [
  { label: "S", css: "13px" },
  { label: "M", css: "16px" },
  { label: "L", css: "19px" },
  { label: "XL", css: "22px" },
];

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        active
          ? "bg-fg text-canvas"
          : "text-fg/55 hover:bg-surface hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write content…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] flex-1 px-3 py-2.5 text-sm leading-relaxed text-fg outline-none paper prose prose-sm max-w-none",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
      style={{ resize: "vertical", minHeight: 220 }}
    >
      <div className="flex flex-shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-subtle/80 px-2 py-1.5 select-none">
        <ToolBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <Heading1 size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        {FONT_SIZES.map((fs) => (
          <ToolBtn
            key={fs.label}
            onClick={() => editor.chain().focus().setFontSize(fs.css).run()}
            title={`Size ${fs.label}`}
          >
            <span className="inline-block w-4 text-center text-[11px] font-semibold">
              {fs.label}
            </span>
          </ToolBtn>
        ))}
        <ToolBtn
          onClick={() => editor.chain().focus().unsetMark("textStyle").run()}
          title="Clear size"
        >
          <span className="text-[10px]">Aa</span>
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <span className="mr-0.5 text-[10px] font-medium text-fg/45">A</span>
        {TEXT_COLORS.map((c) => (
          <button
            key={c.value || "default"}
            type="button"
            title={`Color: ${c.label}`}
            onClick={() =>
              c.value
                ? editor.chain().focus().setColor(c.value).run()
                : editor.chain().focus().unsetColor().run()
            }
            className="h-4 w-4 rounded-full border border-line transition-transform hover:scale-110"
            style={{ background: c.value || "#374151" }}
          />
        ))}

        <div className="mx-1 h-4 w-px bg-muted" />

        <span className="mr-0.5 text-[10px] font-medium text-fg/45">H</span>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.bg}
            type="button"
            title={`Highlight: ${c.label}`}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c.bg }).run()}
            className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 ${
              editor.isActive("highlight", { color: c.bg })
                ? "scale-110 border-fg"
                : "border-line"
            }`}
            style={{ background: c.bg }}
          />
        ))}
        <ToolBtn
          onClick={() => editor.chain().focus().unsetHighlight().run()}
          title="Remove highlight"
        >
          <span className="text-[10px]">✕</span>
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <ToolBtn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align left"
        >
          <AlignLeft size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align center"
        >
          <AlignCenter size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align right"
        >
          <AlignRight size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          title="Justify"
        >
          <AlignJustify size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List size={13} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          <ListOrdered size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <ToolBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <Minus size={13} />
        </ToolBtn>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="Insert table"
        >
          <TableIcon size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-muted" />

        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo size={13} />
        </ToolBtn>
      </div>

      {editor.isActive("table") ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-blue-50/70 px-2 py-1 text-[10px] text-blue-800 select-none">
          <span className="mr-1 font-semibold">Table:</span>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="rounded px-1.5 py-0.5 hover:bg-blue-100"
          >
            + Col ←
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="rounded px-1.5 py-0.5 hover:bg-blue-100"
          >
            + Col →
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="rounded px-1.5 py-0.5 text-red-700 hover:bg-blue-100"
          >
            − Col
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="rounded px-1.5 py-0.5 hover:bg-blue-100"
          >
            + Row ↑
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="rounded px-1.5 py-0.5 hover:bg-blue-100"
          >
            + Row ↓
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="rounded px-1.5 py-0.5 text-red-700 hover:bg-blue-100"
          >
            − Row
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="rounded px-1.5 py-0.5 text-red-700 hover:bg-blue-100"
          >
            Delete
          </button>
        </div>
      ) : null}

      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
}
