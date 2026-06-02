"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import {
  Archive,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileImage,
  FileText,
  FileType,
  FolderPen,
  Folder,
  FolderPlus,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { api, type ArchiveDocument, type Folder as FolderType, type Lineage, type SearchResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AIAction = "summarize" | "draft" | "report" | "rewrite-style" | "merge-documents";
type FolderDialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "rename"; folder: FolderType }
  | null;
type DeleteDialogState =
  | { type: "folder"; folder: FolderType }
  | { type: "document"; document: ArchiveDocument }
  | null;
type ContextMenuState =
  | { type: "folder"; folder: FolderType; x: number; y: number }
  | { type: "document"; document: ArchiveDocument; x: number; y: number }
  | null;

const actionLabels: Record<AIAction, string> = {
  summarize: "Summarize",
  draft: "Draft",
  report: "Write report",
  "rewrite-style": "Change style",
  "merge-documents": "Merge documents",
};

const fileIcon = {
  image: FileImage,
  pdf: FileType,
  text: FileText,
};

const fileTone = {
  image: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  pdf: "bg-rose-50 text-rose-700 ring-rose-200",
  text: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function ArchiveShell() {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<AIAction | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId],
  );

  async function refresh(folderId = selectedFolderId, preferredDocumentId?: string) {
    setError(null);
    const [nextFolders, nextDocuments] = await Promise.all([api.folders(), api.documents(folderId)]);
    setFolders(nextFolders);
    setDocuments(nextDocuments);
    if (preferredDocumentId && nextDocuments.some((item) => item.id === preferredDocumentId)) {
      setSelectedDocumentId(preferredDocumentId);
      return;
    }
    if (nextDocuments.length && !nextDocuments.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId(nextDocuments[0].id);
    }
    if (!nextDocuments.length) {
      setSelectedDocumentId(null);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const [nextFolders, nextDocuments] = await Promise.all([api.folders(), api.documents(null)]);
        if (!ignore) {
          setFolders(nextFolders);
          setSelectedFolderId(null);
          setDocuments(nextDocuments);
          setSelectedDocumentId(nextDocuments[0]?.id ?? null);
        }
      } catch (loadError) {
        if (!ignore) setError(loadError instanceof Error ? loadError.message : "Failed to load archive.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  async function selectFolder(folderId: string | null) {
    setSelectedFolderId(folderId);
    setSearchResults(null);
    setError(null);
    try {
      setBusy(true);
      const nextDocuments = await api.documents(folderId);
      setDocuments(nextDocuments);
      setSelectedDocumentId(nextDocuments[0]?.id ?? null);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Failed to load documents.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFolder(name: string) {
    if (!folderDialog) return;
    try {
      setBusy(true);
      setError(null);
      if (folderDialog.mode === "create") {
        const folder = await api.createFolder(name.trim(), folderDialog.parentId);
        await refresh(folder.id);
        setFolders((current) => mergeFolderIntoList(current, folder));
        setSelectedFolderId(folder.id);
      } else {
        const folder = await api.updateFolder(folderDialog.folder.id, { name: name.trim() });
        await refresh(selectedFolderId);
        setFolders((current) => mergeFolderIntoList(current, folder));
        setSelectedFolderId(folder.id);
      }
      setFolderDialog(null);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "Failed to save folder.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedItem() {
    if (!deleteDialog) return;
    try {
      setBusy(true);
      setError(null);
      if (deleteDialog.type === "folder") {
        await api.deleteFolder(deleteDialog.folder.id);
        const nextFolderId =
          selectedFolderId && isFolderOrDescendant(selectedFolderId, deleteDialog.folder, folders) ? null : selectedFolderId;
        setSelectedFolderId(nextFolderId);
        await refresh(nextFolderId);
        setFolders((current) => current.filter((folder) => folder.id !== deleteDialog.folder.id));
      } else {
        await api.deleteDocument(deleteDialog.document.id);
        await refresh(selectedFolderId);
        setDocuments((current) => current.filter((document) => document.id !== deleteDialog.document.id));
        if (selectedDocumentId === deleteDialog.document.id) setSelectedDocumentId(null);
      }
      setDeleteDialog(null);
      setSearchResults(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File | null | undefined) {
    if (!file) return;
    try {
      setBusy(true);
      setError(null);
      const document = await api.uploadDocument(selectedFolderId, file);
      await refresh(selectedFolderId, document.id);
      setSearchResults(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const [keywordResult, semanticResult] = await Promise.allSettled([
        api.keywordSearch(searchQuery.trim(), selectedFolderId),
        api.semanticSearch(searchQuery.trim(), selectedFolderId),
      ]);
      const keywordResults = keywordResult.status === "fulfilled" ? keywordResult.value : [];
      const semanticResults = semanticResult.status === "fulfilled" ? semanticResult.value : [];
      if (!keywordResults.length && !semanticResults.length) {
        const failure = keywordResult.status === "rejected" ? keywordResult.reason : semanticResult.status === "rejected" ? semanticResult.reason : null;
        if (failure) throw failure;
      }
      const results = mergeSearchResults(keywordResults, semanticResults);
      setSearchResults(results);
      const first = results[0]?.document_id;
      if (first) setSelectedDocumentId(first);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function afterGeneration(document: ArchiveDocument) {
    await refresh(selectedFolderId, document.id);
    setSearchResults(null);
  }

  return (
    <SidebarProvider defaultOpen>
      <ArchiveSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={selectFolder}
        onCreateFolder={(parentId) => setFolderDialog({ mode: "create", parentId })}
        onDeleteFolder={(folder) => setDeleteDialog({ type: "folder", folder })}
        onRenameFolder={(folder) => setFolderDialog({ mode: "rename", folder })}
        onShowFolderContextMenu={(folder, x, y) => setContextMenu({ type: "folder", folder, x, y })}
        onUpload={() => fileInputRef.current?.click()}
      />
      <ArchiveWorkspace
        busy={busy}
        documents={documents}
        error={error}
        folders={folders}
        loading={loading}
        searchQuery={searchQuery}
        searchResults={searchResults}
        selectedDocument={selectedDocument}
        selectedFolderId={selectedFolderId}
        onAction={setAiAction}
        onClearSearch={() => {
          setSearchQuery("");
          setSearchResults(null);
        }}
        onCreateFolder={() => setFolderDialog({ mode: "create", parentId: selectedFolderId })}
        onDeleteDocument={(document) => setDeleteDialog({ type: "document", document })}
        onRunSearch={runSearch}
        onSearchQueryChange={setSearchQuery}
        onSelectDocument={setSelectedDocumentId}
        onSelectFolder={selectFolder}
        onShowDocumentContextMenu={(document, x, y) => setContextMenu({ type: "document", document, x, y })}
        onUpload={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md"
        onChange={(event) => uploadFile(event.target.files?.[0])}
      />
      <AIActionDialog
        action={aiAction}
        documents={documents}
        selectedDocument={selectedDocument}
        selectedFolderId={selectedFolderId}
        onClose={() => setAiAction(null)}
        onGenerated={afterGeneration}
      />
      <FolderFormDialog
        busy={busy}
        state={folderDialog}
        onClose={() => setFolderDialog(null)}
        onSubmit={saveFolder}
      />
      <DeleteConfirmDialog
        busy={busy}
        state={deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={deleteSelectedItem}
      />
      <ArchiveContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onCreateFolder={(parentId) => setFolderDialog({ mode: "create", parentId })}
        onRenameFolder={(folder) => setFolderDialog({ mode: "rename", folder })}
        onDeleteFolder={(folder) => setDeleteDialog({ type: "folder", folder })}
        onDeleteDocument={(document) => setDeleteDialog({ type: "document", document })}
      />
    </SidebarProvider>
  );
}

function ArchiveWorkspace({
  busy,
  documents,
  error,
  folders,
  loading,
  searchQuery,
  searchResults,
  selectedDocument,
  selectedFolderId,
  onAction,
  onClearSearch,
  onCreateFolder,
  onDeleteDocument,
  onRunSearch,
  onSearchQueryChange,
  onSelectDocument,
  onSelectFolder,
  onShowDocumentContextMenu,
  onUpload,
}: {
  busy: boolean;
  documents: ArchiveDocument[];
  error: string | null;
  folders: FolderType[];
  loading: boolean;
  searchQuery: string;
  searchResults: SearchResult[] | null;
  selectedDocument: ArchiveDocument | null;
  selectedFolderId: string | null;
  onAction: (action: AIAction) => void;
  onClearSearch: () => void;
  onCreateFolder: () => void;
  onDeleteDocument: (document: ArchiveDocument) => void;
  onRunSearch: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectDocument: (documentId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onShowDocumentContextMenu: (document: ArchiveDocument, x: number, y: number) => void;
  onUpload: () => void;
}) {
  const folderSidebar = useSidebar();
  const [metadataOpen, setMetadataOpen] = useState(false);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const rows = searchResults
    ? searchResults.map((result) => documents.find((document) => document.id === result.document_id)).filter(Boolean)
    : documents;
  const uniqueRows = Array.from(new Map(rows.map((document) => [document!.id, document!])).values());
  const childFolders = searchResults
    ? []
    : folders
        .filter((folder) => folder.parent_id === selectedFolderId)
        .sort((left, right) => left.name.localeCompare(right.name));
  const locationLabel = selectedFolder?.path ?? "My Drive";

  function selectDocumentFromRow(documentId: string) {
    if (selectedDocument?.id === documentId) {
      setMetadataOpen((open) => !open);
      return;
    }
    onSelectDocument(documentId);
    setMetadataOpen(true);
  }

  return (
    <SidebarInset className="min-w-0 bg-[#f7f8fb]">
      <SidebarProvider
        open={metadataOpen}
        onOpenChange={setMetadataOpen}
        defaultOpen
        className="min-h-0 flex-1 bg-background"
        style={{ "--sidebar-width": "24rem" } as CSSProperties}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="flex min-h-16 flex-col gap-2 px-4 py-3 md:min-h-12 md:flex-row md:items-center md:gap-3 md:py-0">
              <form
                id="archive-search-form"
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  onRunSearch();
                }}
              >
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Toggle folder sidebar" onClick={folderSidebar.toggleSidebar}>
                  <PanelLeft className="size-4" />
                </Button>
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search documents"
                    placeholder="Search documents"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    className="h-10 bg-muted/40 pl-9 shadow-none"
                  />
                </div>
                <HeaderTooltip label="Search">
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label="Search"
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="Toggle metadata panel">
                  <MetadataSidebarTrigger className="md:hidden" />
                </HeaderTooltip>
                <div className="hidden md:flex md:gap-2">
                  <HeaderTooltip label="Search">
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Search"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    </Button>
                  </HeaderTooltip>
                </div>
              </form>
              <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                <HeaderTooltip label="Upload document">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="w-full md:w-8"
                    aria-label="Upload document"
                    onClick={onUpload}
                    disabled={busy}
                  >
                    <Upload className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="New folder">
                  <Button
                    size="icon-sm"
                    className="w-full md:w-8"
                    aria-label="New folder"
                    onClick={onCreateFolder}
                    disabled={busy}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="Toggle metadata panel">
                  <MetadataSidebarTrigger className="hidden md:inline-flex" />
                </HeaderTooltip>
              </div>
            </div>
          </header>

          <div className="min-h-[calc(100vh-49px)] bg-background">
            <ScrollArea className="lg:h-[calc(100vh-49px)]">
              <div className="space-y-4 p-4 md:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      Archive
                      <ChevronRight className="size-3.5" />
                      <span className="truncate">{locationLabel}</span>
                    </div>
                    {searchResults && (
                      <button className="mt-1 text-xs text-primary underline-offset-4 hover:underline" onClick={onClearSearch}>
                        Showing {searchResults.length} search results. Clear search
                      </button>
                    )}
                  </div>
                  {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                </div>

                {childFolders.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {childFolders.map((folder) => (
                      <FolderContentCard key={folder.id} folder={folder} onOpen={() => onSelectFolder(folder.id)} />
                    ))}
                  </div>
                )}

                <div className="overflow-hidden rounded-md border bg-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_36px] gap-3 border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px_36px]">
                    <span>Name</span>
                    <span className="hidden md:block">Modified</span>
                    <span className="hidden md:block">Size</span>
                    <span>Status</span>
                    <span className="sr-only">Actions</span>
                  </div>
                  <div className="divide-y">
                    {loading ? (
                      <div className="p-4 text-sm text-muted-foreground">Loading documents...</div>
                    ) : uniqueRows.length ? (
                      uniqueRows.map((document) => (
                        <DocumentRow
                          key={document.id}
                          document={document}
                          onDelete={() => onDeleteDocument(document)}
                          onOpen={() => window.open(api.downloadUrl(document.id), "_blank", "noreferrer")}
                          onShowContextMenu={(x, y) => onShowDocumentContextMenu(document, x, y)}
                          selected={selectedDocument?.id === document.id}
                          onSelect={() => selectDocumentFromRow(document.id)}
                        />
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        {childFolders.length ? "No documents in this folder." : "No folders or documents in this location."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
        <MetadataSidebar selected={selectedDocument} folders={folders} onAction={onAction} />
      </SidebarProvider>
    </SidebarInset>
  );
}

function HeaderTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function FolderContentCard({ folder, onOpen }: { folder: FolderType; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-3 rounded-md border bg-card px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200">
        <Folder className="size-4" />
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{folder.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{folder.path ?? "Folder"}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function FolderFormDialog({
  busy,
  state,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  state: FolderDialogState;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const title = state?.mode === "rename" ? "Rename folder" : "New folder";
  const initialName = state?.mode === "rename" ? state.folder.name : "";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.mode === "rename" ? "Update the folder name." : "Create a folder in the selected location."}
          </DialogDescription>
        </DialogHeader>
        {state && (
          <FolderFormFields
            key={state.mode === "rename" ? state.folder.id : `create-${state.parentId ?? "root"}`}
            busy={busy}
            initialName={initialName}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FolderFormFields({
  busy,
  initialName,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="folder-name">Folder name</Label>
        <Input
          id="folder-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Folder name"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteConfirmDialog({
  busy,
  state,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  state: DeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = state?.type === "folder" ? "Delete folder" : "Delete document";
  const targetName =
    state?.type === "folder"
      ? state.folder.name
      : state?.type === "document"
        ? state.document.title || state.document.original_filename
        : "";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.type === "folder" ? `Delete ${targetName} and everything inside it.` : `Delete ${targetName}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveContextMenu({
  state,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: FolderType) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onDeleteDocument: (document: ArchiveDocument) => void;
}) {
  useEffect(() => {
    if (!state) return;
    function close() {
      onClose();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, state]);

  if (!state) return null;

  return (
    <div
      className="fixed z-50 min-w-44 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: state.x, top: state.y }}
      onClick={(event) => event.stopPropagation()}
      role="menu"
    >
      {state.type === "folder" ? (
        <>
          <ContextMenuButton
            icon={FolderPlus}
            label="New subfolder"
            onClick={() => {
              onCreateFolder(state.folder.id);
              onClose();
            }}
          />
          <ContextMenuButton
            icon={FolderPen}
            label="Rename"
            onClick={() => {
              onRenameFolder(state.folder);
              onClose();
            }}
          />
          <div className="-mx-1 my-1 h-px bg-border" />
          <ContextMenuButton
            destructive
            icon={Trash2}
            label="Delete folder"
            onClick={() => {
              onDeleteFolder(state.folder);
              onClose();
            }}
          />
        </>
      ) : (
        <>
          <ContextMenuButton
            icon={MoreHorizontal}
            label="Open original"
            onClick={() => {
              window.open(api.downloadUrl(state.document.id), "_blank", "noreferrer");
              onClose();
            }}
          />
          <div className="-mx-1 my-1 h-px bg-border" />
          <ContextMenuButton
            destructive
            icon={Trash2}
            label="Delete document"
            onClick={() => {
              onDeleteDocument(state.document);
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}

function ContextMenuButton({
  destructive,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  icon: ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
      onClick={onClick}
      role="menuitem"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function DocumentRow({
  document,
  selected,
  onDelete,
  onOpen,
  onSelect,
  onShowContextMenu,
}: {
  document: ArchiveDocument;
  selected: boolean;
  onDelete: () => void;
  onOpen: () => void;
  onSelect: () => void;
  onShowContextMenu: (x: number, y: number) => void;
}) {
  const kind = documentKind(document);
  const Icon = fileIcon[kind];
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_96px_36px] items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px_36px]",
        selected && "bg-primary/10",
      )}
      onClick={onSelect}
      onContextMenu={(event) => {
        event.preventDefault();
        onShowContextMenu(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md ring-1", fileTone[kind])}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{document.title || document.original_filename}</span>
          <span className="block truncate text-xs text-muted-foreground">{document.original_filename}</span>
        </span>
      </span>
      <span className="hidden text-sm text-muted-foreground md:block">{formatDate(document.updated_at)}</span>
      <span className="hidden text-sm text-muted-foreground md:block">{formatSize(document.file_size)}</span>
      <span>
        <Badge variant={document.processing_status === "failed" ? "destructive" : "outline"}>{document.processing_status}</Badge>
      </span>
      <DocumentRowMenu
        onDelete={onDelete}
        onOpen={onOpen}
      />
    </div>
  );
}

function DocumentRowMenu({ onDelete, onOpen }: { onDelete: () => void; onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Document actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <MoreHorizontal className="size-4" />
          Open original
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
          Delete document
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MetadataSidebar({
  selected,
  folders,
  onAction,
}: {
  selected: ArchiveDocument | null;
  folders: FolderType[];
  onAction: (action: AIAction) => void;
}) {
  const [lineage, setLineage] = useState<Lineage | null>(null);
  const [lineageError, setLineageError] = useState<string | null>(null);
  const kind = selected ? documentKind(selected) : "text";
  const SelectedIcon = fileIcon[kind];
  const folder = selected ? folders.find((item) => item.id === selected.folder_id) : null;

  useEffect(() => {
    let ignore = false;
    async function loadLineage() {
      setLineage(null);
      setLineageError(null);
      if (!selected?.is_generated) return;
      try {
        const nextLineage = await api.lineage(selected.id);
        if (!ignore) setLineage(nextLineage);
      } catch (error) {
        if (!ignore) setLineageError(error instanceof Error ? error.message : "Lineage unavailable.");
      }
    }
    loadLineage();
    return () => {
      ignore = true;
    };
  }, [selected?.id, selected?.is_generated]);

  return (
    <Sidebar side="right" collapsible="offcanvas" mobileWidth="100vw" className="z-30 border-l bg-background text-foreground">
      <SidebarHeader className="h-[49px] shrink-0 flex-row items-center justify-between border-b px-4">
        <div className="text-sm font-semibold">Document metadata</div>
        <MetadataSidebarClose />
      </SidebarHeader>
      <SidebarContent className="gap-0 overflow-x-hidden bg-background">
        <ScrollArea className="h-[calc(100vh-49px)] overflow-x-hidden">
          <div className="space-y-6 p-6">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a document to inspect metadata.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-md ring-1", fileTone[kind])}>
                      <SelectedIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{selected.title || selected.original_filename}</h2>
                      <p className="truncate text-xs text-muted-foreground">{selected.mime_type}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={api.downloadUrl(selected.id)} target="_blank" rel="noreferrer" aria-label="Open original">
                      <MoreHorizontal className="size-4" />
                    </a>
                  </Button>
                </div>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Metadata</h3>
                  <dl className="space-y-3 text-sm">
                    <MetaRow icon={Folder} label="Folder" value={selected.folder_id ? (folder?.path ?? "Unknown") : "My Drive"} />
                    <MetaRow icon={CalendarDays} label="Created" value={formatDate(selected.created_at)} />
                    <MetaRow icon={Clock3} label="Modified" value={formatDate(selected.updated_at)} />
                    <MetaRow icon={Info} label="Type" value={selected.is_generated ? "Generated" : "Uploaded"} />
                    <MetaRow icon={Tag} label="Tags" value={selected.metadata_row?.tags.join(", ") || "None"} />
                  </dl>
                  {selected.metadata_row?.summary && (
                    <p className="overflow-hidden rounded-md border bg-muted/40 p-3 text-sm leading-6 break-words">
                      {selected.metadata_row.summary}
                    </p>
                  )}
                  {selected.processing_error && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      {selected.processing_error}
                    </p>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">AI actions</h3>
                  </div>
                  <div className="space-y-2">
                    {(Object.keys(actionLabels) as AIAction[]).map((action) => (
                      <Button key={action} variant="outline" size="sm" className="w-full justify-start" onClick={() => onAction(action)}>
                        <Sparkles className="size-4" />
                        {actionLabels[action]}
                      </Button>
                    ))}
                  </div>
                </section>

                {selected.is_generated && (
                  <>
                    <Separator />
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Lineage</h3>
                      {lineage ? (
                        <dl className="space-y-3 text-sm">
                          <MetaRow icon={Sparkles} label="Action" value={lineage.operation} />
                          <MetaRow icon={Bot} label="Model" value={lineage.model_name} />
                          <MetaRow icon={Info} label="Sources" value={`${lineage.source_document_ids.length}`} />
                        </dl>
                      ) : (
                        <p className="text-sm text-muted-foreground">{lineageError ?? "Loading lineage..."}</p>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}

function AIActionDialog({
  action,
  documents,
  selectedDocument,
  selectedFolderId,
  onClose,
  onGenerated,
}: {
  action: AIAction | null;
  documents: ArchiveDocument[];
  selectedDocument: ArchiveDocument | null;
  selectedFolderId: string | null;
  onClose: () => void;
  onGenerated: (document: ArchiveDocument) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [style, setStyle] = useState("");
  const [extraRefs, setExtraRefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRefs = selectedDocument
    ? [selectedDocument.id, ...extraRefs.filter((id) => id !== selectedDocument.id)]
    : extraRefs;

  function closeDialog() {
    setInstructions("");
    setStyle("");
    setExtraRefs([]);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!action || !selectedFolderId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await api.runAction(action, {
        folder_id: selectedFolderId,
        source_document_ids: selectedRefs,
        prompt: instructions,
        style: action === "rewrite-style" ? style : null,
      });
      onGenerated(result.document);
      closeDialog();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "AI action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{action ? actionLabels[action] : "AI action"}</DialogTitle>
          <DialogDescription>Generated output is saved as a new document in the selected folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Reference documents</Label>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
              {documents.map((document) => (
                <label key={document.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedRefs.includes(document.id)}
                    disabled={selectedDocument?.id === document.id}
                    onCheckedChange={(checked) => {
                      setExtraRefs((current) =>
                        checked ? [...current, document.id] : current.filter((id) => id !== document.id),
                      );
                    }}
                  />
                  <span className="min-w-0 truncate">{document.title || document.original_filename}</span>
                </label>
              ))}
            </div>
          </div>
          {action === "rewrite-style" && (
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Input id="style" value={style} onChange={(event) => setStyle(event.target.value)} placeholder="clear professional" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="instructions">Additional instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Add constraints, focus areas, or desired structure"
              className="min-h-28"
            />
          </div>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading || !selectedFolderId || !selectedRefs.length}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onShowFolderContextMenu,
  onUpload,
}: {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onRenameFolder: (folder: FolderType) => void;
  onShowFolderContextMenu: (folder: FolderType, x: number, y: number) => void;
  onUpload: () => void;
}) {
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="mt-1 h-[49px] shrink-0 justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Document Archive" className="h-12 pr-9 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Archive className="size-4" />
              </div>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate font-semibold">Document Archive</span>
                <span className="block truncate text-xs text-sidebar-foreground/60">PostgreSQL + pgvector</span>
              </span>
            </SidebarMenuButton>
            <SidebarMenuAction aria-label="Create folder" onClick={() => onCreateFolder(selectedFolderId)}>
              <Plus />
            </SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton isActive={!selectedFolderId} size="sm" tooltip="My Drive" className="h-7 text-xs" onClick={() => onSelectFolder(null)}>
                  <HardDrive className="size-3.5" />
                  <span>My Drive</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {tree.map((node) => (
                <FolderTreeItem
                  key={node.folder.id}
                  node={node}
                  selectedFolderId={selectedFolderId}
                  onCreateFolder={onCreateFolder}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFolder={onRenameFolder}
                  onSelectFolder={onSelectFolder}
                  onShowFolderContextMenu={onShowFolderContextMenu}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mx-2 h-px shrink-0 bg-sidebar-border group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8" />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Upload" className="h-auto py-2" onClick={onUpload}>
              <Upload className="size-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Upload</span>
                <span className="block truncate text-xs text-sidebar-foreground/60">Images, PDFs, text</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

type FolderTreeNode = {
  folder: FolderType;
  children: FolderTreeNode[];
  depth: number;
};

function FolderTreeItem({
  node,
  selectedFolderId,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onSelectFolder,
  onShowFolderContextMenu,
}: {
  node: FolderTreeNode;
  selectedFolderId: string | null;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onRenameFolder: (folder: FolderType) => void;
  onSelectFolder: (folderId: string | null) => void;
  onShowFolderContextMenu: (folder: FolderType, x: number, y: number) => void;
}) {
  const isActive = selectedFolderId === node.folder.id;

  return (
    <>
      <SidebarMenuItem
        onContextMenu={(event) => {
          event.preventDefault();
          onShowFolderContextMenu(node.folder, event.clientX, event.clientY);
        }}
      >
        <SidebarMenuButton
          isActive={isActive}
          size="sm"
          tooltip={node.folder.path ?? node.folder.name}
          className="h-7 text-xs"
          style={{ paddingLeft: `${0.5 + node.depth * 0.85}rem` }}
          onClick={() => onSelectFolder(node.folder.id)}
        >
          {isActive ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />}
          <span>{node.folder.name}</span>
        </SidebarMenuButton>
        <FolderRowMenu
          folder={node.folder}
          onCreateFolder={() => onCreateFolder(node.folder.id)}
          onDeleteFolder={() => onDeleteFolder(node.folder)}
          onRenameFolder={() => onRenameFolder(node.folder)}
        />
      </SidebarMenuItem>
      {node.children.map((child) => (
        <FolderTreeItem
          key={child.folder.id}
          node={child}
          selectedFolderId={selectedFolderId}
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onRenameFolder={onRenameFolder}
          onSelectFolder={onSelectFolder}
          onShowFolderContextMenu={onShowFolderContextMenu}
        />
      ))}
    </>
  );
}

function FolderRowMenu({
  folder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
}: {
  folder: FolderType;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onRenameFolder: () => void;
}) {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction aria-label={`${folder.name} actions`} onClick={(event) => event.stopPropagation()}>
          <MoreHorizontal />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"} className="w-44">
        <DropdownMenuItem onClick={onCreateFolder}>
          <FolderPlus className="size-4" />
          New subfolder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRenameFolder}>
          <FolderPen className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDeleteFolder}>
          <Trash2 className="size-4" />
          Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MetadataSidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button type="button" variant="ghost" size="icon-sm" className={className} aria-label="Toggle metadata sidebar" onClick={toggleSidebar}>
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
        if (isMobile) setOpenMobile(false);
        else setOpen(false);
      }}
    >
      <X className="size-4" />
    </Button>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <dt className="min-w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function documentKind(document: ArchiveDocument): keyof typeof fileIcon {
  if (document.mime_type.startsWith("image/")) return "image";
  if (document.mime_type === "application/pdf") return "pdf";
  return "text";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function mergeSearchResults(keywordResults: SearchResult[], semanticResults: SearchResult[]) {
  const merged = new Map<string, SearchResult>();

  for (const result of keywordResults) {
    merged.set(result.document_id, { ...result, score: result.score ?? 1 });
  }

  for (const result of semanticResults) {
    const existing = merged.get(result.document_id);
    if (!existing) {
      merged.set(result.document_id, result);
      continue;
    }
    merged.set(result.document_id, {
      ...existing,
      score: Math.max(existing.score ?? 0, result.score ?? 0),
    });
  }

  return Array.from(merged.values()).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

function buildFolderTree(folders: FolderType[]) {
  const nodes = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    nodes.set(folder.id, { folder, children: [], depth: 0 });
  }

  for (const node of nodes.values()) {
    const parent = node.folder.parent_id ? nodes.get(node.folder.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  function sortAndMark(items: FolderTreeNode[], depth: number) {
    items.sort((left, right) => left.folder.name.localeCompare(right.folder.name));
    for (const item of items) {
      item.depth = depth;
      sortAndMark(item.children, depth + 1);
    }
  }

  sortAndMark(roots, 0);
  return roots;
}

function isFolderOrDescendant(folderId: string, deletedFolder: FolderType, folders: FolderType[]) {
  if (folderId === deletedFolder.id) return true;

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  let folder = foldersById.get(folderId);

  while (folder?.parent_id) {
    if (folder.parent_id === deletedFolder.id) return true;
    folder = foldersById.get(folder.parent_id);
  }

  return false;
}

function mergeFolderIntoList(folders: FolderType[], folder: FolderType) {
  if (folders.some((item) => item.id === folder.id)) {
    return folders.map((item) => (item.id === folder.id ? folder : item));
  }
  return [...folders, folder];
}
