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
  Upload,
  X,
} from "lucide-react";

import { api, type ArchiveDocument, type Folder as FolderType, type Lineage, type SearchResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    if (!folderId && !selectedFolderId && nextFolders[0]) {
      setSelectedFolderId(nextFolders[0].id);
    }
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
        const nextFolders = await api.folders();
        const folderId = nextFolders[0]?.id ?? null;
        const nextDocuments = await api.documents(folderId);
        if (!ignore) {
          setFolders(nextFolders);
          setSelectedFolderId(folderId);
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

  async function createFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    try {
      setBusy(true);
      const folder = await api.createFolder(name.trim(), selectedFolderId);
      await refresh(folder.id);
      setSelectedFolderId(folder.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create folder.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File | null | undefined) {
    if (!file || !selectedFolderId) return;
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
        onCreateFolder={createFolder}
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
        onCreateFolder={createFolder}
        onRunSearch={runSearch}
        onSearchQueryChange={setSearchQuery}
        onSelectDocument={setSelectedDocumentId}
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
  onRunSearch,
  onSearchQueryChange,
  onSelectDocument,
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
  onRunSearch: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectDocument: (documentId: string) => void;
  onUpload: () => void;
}) {
  const folderSidebar = useSidebar();
  const [metadataOpen, setMetadataOpen] = useState(true);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const rows = searchResults
    ? searchResults.map((result) => documents.find((document) => document.id === result.document_id)).filter(Boolean)
    : documents;
  const uniqueRows = Array.from(new Map(rows.map((document) => [document!.id, document!])).values());

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
            <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:min-h-12 md:flex-row md:items-center md:py-0">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Toggle folder sidebar" onClick={folderSidebar.toggleSidebar}>
                <PanelLeft className="size-4" />
              </Button>
              <form
                className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  onRunSearch();
                }}
              >
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
                <div className="flex gap-2">
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
              <div className="flex items-center gap-2">
                <HeaderTooltip label="Upload document">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Upload document"
                    onClick={onUpload}
                    disabled={!selectedFolderId || busy}
                  >
                    <Upload className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="New folder">
                  <Button
                    size="icon-sm"
                    aria-label="New folder"
                    onClick={onCreateFolder}
                    disabled={busy}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="Toggle metadata panel">
                  <MetadataSidebarTrigger />
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
                      <span className="truncate">{selectedFolder?.path ?? "All folders"}</span>
                    </div>
                    {searchResults && (
                      <button className="mt-1 text-xs text-primary underline-offset-4 hover:underline" onClick={onClearSearch}>
                        Showing {searchResults.length} search results. Clear search
                      </button>
                    )}
                  </div>
                  {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                </div>

                <div className="overflow-hidden rounded-md border bg-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px]">
                    <span>Name</span>
                    <span className="hidden md:block">Modified</span>
                    <span className="hidden md:block">Size</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y">
                    {loading ? (
                      <div className="p-4 text-sm text-muted-foreground">Loading documents...</div>
                    ) : uniqueRows.length ? (
                      uniqueRows.map((document) => (
                        <DocumentRow
                          key={document.id}
                          document={document}
                          selected={selectedDocument?.id === document.id}
                          onSelect={() => selectDocumentFromRow(document.id)}
                        />
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">No documents in this folder.</div>
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

function DocumentRow({ document, selected, onSelect }: { document: ArchiveDocument; selected: boolean; onSelect: () => void }) {
  const kind = documentKind(document);
  const Icon = fileIcon[kind];
  return (
    <button
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px]",
        selected && "bg-primary/10",
      )}
      onClick={onSelect}
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
    </button>
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
    <Sidebar side="right" collapsible="offcanvas" className="z-30 border-l bg-background text-foreground">
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
                    <MetaRow icon={Folder} label="Folder" value={folder?.path ?? "Unknown"} />
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
  onUpload,
}: {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
}) {
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
            <SidebarMenuAction aria-label="Create folder" onClick={onCreateFolder}>
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
                <SidebarMenuButton isActive={!selectedFolderId} size="sm" tooltip="All folders" className="h-7 text-xs" onClick={() => onSelectFolder(null)}>
                  <HardDrive className="size-3.5" />
                  <span>All folders</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {folders.map((folder) => (
                <SidebarMenuItem key={folder.id}>
                  <SidebarMenuButton
                    isActive={selectedFolderId === folder.id}
                    size="sm"
                    tooltip={folder.path ?? folder.name}
                    className="h-7 text-xs"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    {selectedFolderId === folder.id ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />}
                    <span>{folder.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
