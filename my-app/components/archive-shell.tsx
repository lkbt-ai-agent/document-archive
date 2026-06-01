"use client";

import { useState, type CSSProperties, type ElementType } from "react";
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
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type FileItem = {
  name: string;
  type: "jpg" | "png" | "webp" | "pdf" | "txt" | "md";
  folder: string;
  modified: string;
  size: string;
  status: "Indexed" | "Needs review" | "Private";
};

type FolderNode = {
  name: string;
  count: number;
  active?: boolean;
  defaultOpen?: boolean;
  children?: FolderNode[];
};

const folderTree: FolderNode[] = [
  {
    name: "My Drive",
    count: 128,
    active: true,
    defaultOpen: true,
    children: [
      {
        name: "Personal",
        count: 42,
        defaultOpen: true,
        children: [
          { name: "Identity", count: 8 },
          { name: "Medical", count: 9 },
          {
            name: "Home",
            count: 14,
            children: [
              { name: "Lease", count: 4 },
              { name: "Inventory", count: 6 },
              { name: "Utilities", count: 4 },
            ],
          },
        ],
      },
      {
        name: "Receipts",
        count: 18,
        defaultOpen: true,
        children: [
          { name: "2026", count: 7 },
          { name: "2025", count: 11 },
        ],
      },
      {
        name: "Research",
        count: 31,
        children: [
          { name: "Notes", count: 16 },
          { name: "Articles", count: 10 },
          { name: "Datasets", count: 5 },
        ],
      },
      {
        name: "Scans",
        count: 24,
        children: [
          { name: "Images", count: 13 },
          { name: "PDF imports", count: 11 },
        ],
      },
    ],
  },
  { name: "Shared with me", count: 7 },
  { name: "Starred", count: 12 },
  { name: "Archive Review", count: 5 },
];

const files: FileItem[] = [
  {
    name: "passport-renewal.pdf",
    type: "pdf",
    folder: "Personal / Identity",
    modified: "Today, 9:42 AM",
    size: "1.8 MB",
    status: "Indexed",
  },
  {
    name: "home-inventory.webp",
    type: "webp",
    folder: "Personal / Home",
    modified: "Yesterday",
    size: "842 KB",
    status: "Indexed",
  },
  {
    name: "insurance-summary.md",
    type: "md",
    folder: "Personal / Medical",
    modified: "May 28",
    size: "24 KB",
    status: "Needs review",
  },
  {
    name: "tax-receipt-2025.png",
    type: "png",
    folder: "Receipts / 2025",
    modified: "May 24",
    size: "612 KB",
    status: "Private",
  },
  {
    name: "reading-list.txt",
    type: "txt",
    folder: "Research / Notes",
    modified: "May 18",
    size: "9 KB",
    status: "Indexed",
  },
  {
    name: "apartment-photo.jpg",
    type: "jpg",
    folder: "Scans / Images",
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

  return (
    <SidebarProvider defaultOpen>
      <ArchiveSidebar />
      <ArchiveWorkspace selected={selected} />
    </SidebarProvider>
  );
}

function ArchiveWorkspace({ selected }: { selected: FileItem }) {
  const folderSidebar = useSidebar();
  const [metadataOpen, setMetadataOpen] = useState(true);

  return (
    <SidebarInset className="min-w-0 bg-[#f7f8fb]">
      <SidebarProvider
        open={metadataOpen}
        onOpenChange={setMetadataOpen}
        defaultOpen
        className="min-h-0 flex-1 bg-background"
        style={
          {
            "--sidebar-width": "20rem",
          } as CSSProperties
        }
      >
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
              <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:h-12 md:min-h-0 md:flex-row md:items-center md:px-4 md:py-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Toggle folder sidebar"
                      onClick={folderSidebar.toggleSidebar}
                    >
                      <PanelLeft className="size-4" />
                    </Button>
                  </div>
                  <MetadataSidebarTrigger className="md:hidden" />
                </div>

                <div className="relative md:ml-auto md:w-[min(42vw,520px)]">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search documents"
                    placeholder="Search files, tags, dates"
                    className="h-10 bg-muted/40 pl-9 shadow-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 md:flex-none"
                  >
                    <Upload className="size-4" />
                    Upload
                  </Button>
                  <Button size="sm" className="flex-1 md:flex-none">
                    <Plus className="size-4" />
                    New folder
                  </Button>
                  <MetadataSidebarTrigger className="hidden md:inline-flex" />
                </div>
              </div>
            </header>

            <div className="min-h-[calc(100vh-65px)] bg-background md:min-h-[calc(100vh-49px)]">
              <section className="min-w-0">
                <ScrollArea className="lg:h-[calc(100vh-49px)]">
                  <div className="space-y-6 p-4 md:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          My Drive
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
            </div>
          </div>
          <MetadataSidebar selected={selected} />
        </SidebarProvider>
      </SidebarInset>
  );
}

function MetadataSidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={className}
      aria-label="Toggle metadata sidebar"
      onClick={toggleSidebar}
    >
      <PanelRight className="size-4" />
    </Button>
  );
}

function MetadataSidebarClose() {
  const { isMobile, setOpen, setOpenMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Close metadata sidebar"
      onClick={() => {
        if (isMobile) {
          setOpenMobile(false);
          return;
        }

        setOpen(false);
      }}
    >
      <X className="size-4" />
    </Button>
  );
}

function MetadataSidebar({ selected }: { selected: FileItem }) {
  const SelectedIcon = fileIcon[selected.type];

  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="z-30 border-l bg-background text-foreground"
    >
      <SidebarHeader className="h-[49px] shrink-0 flex-row items-center justify-between border-b px-4">
        <div className="text-sm font-semibold">File metadata</div>
        <MetadataSidebarClose />
      </SidebarHeader>

      <SidebarContent className="gap-0 bg-background">
        <ScrollArea className="h-[calc(100vh-49px)]">
          <div className="space-y-6 p-6">
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
                <MetaRow icon={Folder} label="Folder" value="Identity" />
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
      </SidebarContent>
    </Sidebar>
  );
}

function ArchiveSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="mt-1 h-[49px] shrink-0 justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Document Archive"
              className="h-12 pr-9 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            >
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Archive className="size-4" />
              </div>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate font-semibold">
                  Document Archive
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/60">
                  Personal Drive
                </span>
              </span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction aria-label="Open archive menu">
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-52">
                <DropdownMenuLabel>Archive menu</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Plus />
                  New folder
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Upload />
                  Upload documents
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Search />
                  Search archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <ShieldCheck />
                  Privacy settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {folderTree.map((folder) => (
                <FolderTree key={folder.name} node={folder} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mx-2 h-px shrink-0 bg-sidebar-border group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8" />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Storage" className="h-auto py-2">
              <HardDrive className="size-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  Storage
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/60">
                  4.2 GB of 10 GB used
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function FolderTree({ node }: { node: FolderNode }) {
  const hasChildren = Boolean(node.children?.length);
  const FolderIcon =
    node.name === "My Drive" ? HardDrive : node.active ? FolderOpen : Folder;

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={node.active}
          size="sm"
          tooltip={node.name}
          className="h-7 text-xs"
        >
          <Folder className="size-3.5" />
          <span>{node.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen={node.defaultOpen}
        className="group/folder [&[data-state=open]_.folder-chevron]:rotate-90"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={node.active}
            size="sm"
            tooltip={node.name}
            className="h-7 text-xs"
          >
            <FolderIcon className="size-3.5" />
            <span>{node.name}</span>
            <ChevronRight className="folder-chevron ml-auto size-3.5 transition-transform" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 gap-0.5 py-0">
            {node.children?.map((child) => (
              <FolderTree key={child.name} node={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
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
