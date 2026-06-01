import {
  Archive,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileImage,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Info,
  ListFilter,
  MoreHorizontal,
  PanelRight,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type FolderItem = {
  name: string;
  count: number;
  active?: boolean;
  depth?: number;
};

type FileItem = {
  name: string;
  type: "jpg" | "png" | "webp" | "pdf" | "txt" | "md";
  folder: string;
  modified: string;
  size: string;
  status: "Indexed" | "Needs review" | "Private";
};

const folders: FolderItem[] = [
  { name: "Archive", count: 128, active: true },
  { name: "Personal", count: 42, depth: 1 },
  { name: "Receipts", count: 18, depth: 2 },
  { name: "Medical", count: 9, depth: 2 },
  { name: "Research", count: 31, depth: 1 },
  { name: "Scans", count: 24, depth: 1 },
  { name: "Shared Notes", count: 7 },
];

const files: FileItem[] = [
  {
    name: "passport-renewal.pdf",
    type: "pdf",
    folder: "Personal",
    modified: "Today, 9:42 AM",
    size: "1.8 MB",
    status: "Indexed",
  },
  {
    name: "home-inventory.webp",
    type: "webp",
    folder: "Scans",
    modified: "Yesterday",
    size: "842 KB",
    status: "Indexed",
  },
  {
    name: "insurance-summary.md",
    type: "md",
    folder: "Medical",
    modified: "May 28",
    size: "24 KB",
    status: "Needs review",
  },
  {
    name: "tax-receipt-2025.png",
    type: "png",
    folder: "Receipts",
    modified: "May 24",
    size: "612 KB",
    status: "Private",
  },
  {
    name: "reading-list.txt",
    type: "txt",
    folder: "Research",
    modified: "May 18",
    size: "9 KB",
    status: "Indexed",
  },
  {
    name: "apartment-photo.jpg",
    type: "jpg",
    folder: "Scans",
    modified: "May 12",
    size: "2.4 MB",
    status: "Indexed",
  },
];

const folderTiles = [
  { name: "Personal", count: "42 files", updated: "Updated today" },
  { name: "Receipts", count: "18 files", updated: "Updated May 24" },
  { name: "Research", count: "31 files", updated: "Updated May 18" },
];

const fileIcon = {
  jpg: FileImage,
  png: FileImage,
  webp: FileImage,
  pdf: FileType,
  txt: FileText,
  md: FileText,
};

const fileTone = {
  jpg: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  png: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  webp: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  pdf: "bg-rose-50 text-rose-700 ring-rose-200",
  txt: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  md: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function ArchiveShell() {
  const selected = files[0];
  const SelectedIcon = fileIcon[selected.type];

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Archive className="size-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-5">
                  Document Archive
                </h1>
                <p className="text-xs text-muted-foreground">
                  128 files across 7 folders
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" className="md:hidden">
              <PanelRight className="size-4" />
            </Button>
          </div>

          <div className="relative md:ml-auto md:w-[min(44vw,520px)]">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search documents"
              placeholder="Search files, tags, dates"
              className="h-10 bg-muted/40 pl-9 shadow-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 md:flex-none">
              <Upload className="size-4" />
              Upload
            </Button>
            <Button size="sm" className="flex-1 md:flex-none">
              <Plus className="size-4" />
              New folder
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="border-b bg-background lg:border-b-0 lg:border-r">
          <ScrollArea className="lg:h-[calc(100vh-65px)]">
            <div className="space-y-5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                  Folders
                </h2>
                <Button variant="ghost" size="icon-xs">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </div>

              <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                {folders.map((folder) => {
                  const Icon = folder.active ? FolderOpen : Folder;

                  return (
                    <button
                      key={folder.name}
                      className={cn(
                        "flex h-10 min-w-36 items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors lg:w-full lg:min-w-0",
                        folder.active
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      style={{
                        paddingLeft:
                          folder.depth && !folder.active
                            ? `${10 + folder.depth * 12}px`
                            : undefined,
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {folder.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {folder.count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <Separator className="hidden lg:block" />

              <div className="hidden space-y-3 lg:block">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HardDrive className="size-4 text-muted-foreground" />
                  Storage
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[42%] bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">
                  4.2 GB of 10 GB used
                </p>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <section className="min-w-0 bg-background">
          <ScrollArea className="lg:h-[calc(100vh-65px)]">
            <div className="space-y-6 p-4 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    Archive
                    <ChevronRight className="size-3.5" />
                    Personal
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                    Personal documents
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <ListFilter className="size-4" />
                    Filter
                  </Button>
                  <Button variant="outline" size="icon-sm">
                    <Grid2X2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {folderTiles.map((folder) => (
                  <button
                    key={folder.name}
                    className="rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="size-4 text-amber-600" />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {folder.name}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{folder.count}</span>
                      <span className="truncate">{folder.updated}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-md border bg-card">
                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px]">
                  <span>Name</span>
                  <span className="hidden md:block">Modified</span>
                  <span className="hidden md:block">Size</span>
                  <span>Status</span>
                </div>

                <div className="divide-y">
                  {files.map((file, index) => {
                    const Icon = fileIcon[file.type];

                    return (
                      <button
                        key={file.name}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px]",
                          index === 0 && "bg-primary/10",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-md ring-1",
                              fileTone[file.type],
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {file.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground md:hidden">
                              {file.modified} · {file.size}
                            </span>
                            <span className="hidden truncate text-xs text-muted-foreground md:block">
                              {file.folder}
                            </span>
                          </span>
                        </span>
                        <span className="hidden text-sm text-muted-foreground md:block">
                          {file.modified}
                        </span>
                        <span className="hidden text-sm text-muted-foreground md:block">
                          {file.size}
                        </span>
                        <span>
                          <Badge
                            variant={
                              file.status === "Needs review"
                                ? "destructive"
                                : "outline"
                            }
                            className="max-w-full"
                          >
                            {file.status}
                          </Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </section>

        <aside className="border-t bg-background lg:border-l lg:border-t-0">
          <ScrollArea className="lg:h-[calc(100vh-65px)]">
            <div className="space-y-6 p-4 md:p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-md ring-1",
                        fileTone[selected.type],
                      )}
                    >
                      <SelectedIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {selected.name}
                      </h2>
                      <p className="text-xs uppercase text-muted-foreground">
                        {selected.type} file
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">
                    <Info className="size-4" />
                    Details
                  </Button>
                  <Button variant="outline" size="sm">
                    <ShieldCheck className="size-4" />
                    Access
                  </Button>
                </div>
              </div>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Metadata
                </h3>
                <dl className="space-y-3 text-sm">
                  <MetaRow icon={Folder} label="Folder" value="Personal" />
                  <MetaRow
                    icon={CalendarDays}
                    label="Created"
                    value="Jan 14, 2026"
                  />
                  <MetaRow icon={Clock3} label="Modified" value="Today" />
                  <MetaRow icon={Tag} label="Tags" value="ID, renewal" />
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    AI actions
                  </h3>
                </div>

                <div className="space-y-2">
                  {[
                    "Summarize document",
                    "Extract key dates",
                    "Suggest tags",
                    "Find related files",
                  ].map((action) => (
                    <Button
                      key={action}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Sparkles className="size-4" />
                      {action}
                    </Button>
                  ))}
                </div>

                <p className="rounded-md border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  AI actions are placeholders for the next phase. No document
                  content is sent anywhere in this UI skeleton.
                </p>
              </section>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </main>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <dt className="min-w-20 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium">{value}</dd>
    </div>
  );
}
