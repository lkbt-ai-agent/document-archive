"use client";

import {
  Archive,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileText,
  FileType,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPen,
  FolderPlus,
  HardDrive,
  Info,
  Languages,
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
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiNetworkError, api, type ArchiveDocument, type Folder as FolderType, type Lineage, type RagSearchResponse, type SearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type AIAction = "summarize" | "draft" | "report" | "rewrite-style" | "merge-documents";
type SearchMode = "keyword" | "semantic" | "rag";
type FolderDialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "rename"; folder: FolderType }
  | null;
type FolderMoveDialogState = { folder: FolderType } | null;
type DocumentMoveDialogState = { document: ArchiveDocument } | null;
type DeleteDialogState =
  | { type: "folder"; folder: FolderType }
  | { type: "document"; document: ArchiveDocument }
  | null;
type ContextMenuState =
  | { type: "folder"; folder: FolderType; x: number; y: number }
  | { type: "document"; document: ArchiveDocument; x: number; y: number }
  | null;

const actionLabels: Record<AIAction, string> = {
  summarize: "요약",
  draft: "초안 작성",
  report: "보고서 작성",
  "rewrite-style": "문체 변경",
  "merge-documents": "문서 병합",
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
  const [searchDocuments, setSearchDocuments] = useState<ArchiveDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [ragResponse, setRagResponse] = useState<RagSearchResponse | null>(null);
  const [ragElapsedSeconds, setRagElapsedSeconds] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<AIAction | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [folderMoveDialog, setFolderMoveDialog] = useState<FolderMoveDialogState>(null);
  const [documentMoveDialog, setDocumentMoveDialog] = useState<DocumentMoveDialogState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [uploadToast, setUploadToast] = useState<{ documentName: string; elapsedSeconds: number } | null>(null);
  const [generationToast, setGenerationToast] = useState<{ documentName: string; elapsedSeconds: number } | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Record<string, { documentName: string; startedAt: number }>>({});
  const [pendingGenerations, setPendingGenerations] = useState<Record<string, { documentName: string; startedAt: number }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDocument = useMemo(
    () => {
      const visibleDocuments = uniqueDocuments(searchResults ? [...searchDocuments, ...documents] : documents);
      return visibleDocuments.find((document) => document.id === selectedDocumentId) ?? visibleDocuments[0] ?? null;
    },
    [documents, searchDocuments, searchResults, selectedDocumentId],
  );

  const hasProcessingDocuments = useMemo(
    () => documents.some((document) => document.processing_status === "pending" || document.processing_status === "processing"),
    [documents],
  );

  const refresh = useCallback(async (folderId = selectedFolderId, preferredDocumentId?: string) => {
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
  }, [selectedFolderId, selectedDocumentId]);

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
        if (!ignore) setError(loadError instanceof Error ? loadError.message : "아카이브를 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hasProcessingDocuments) {
      return;
    }

    let ignore = false;
    const intervalId = window.setInterval(async () => {
      try {
        const nextDocuments = await api.documents(selectedFolderId);
        if (ignore) return;
        setDocuments(nextDocuments);
        if (selectedDocumentId && !nextDocuments.some((document) => document.id === selectedDocumentId)) {
          setSelectedDocumentId(nextDocuments[0]?.id ?? null);
        }
      } catch (pollError) {
        if (pollError instanceof ApiNetworkError) return;
        if (!ignore) setError(pollError instanceof Error ? pollError.message : "문서 처리 상태를 갱신하지 못했습니다.");
      }
    }, 3000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [hasProcessingDocuments, selectedFolderId, selectedDocumentId]);

  useEffect(() => {
    const pendingIds = Array.from(new Set([...Object.keys(pendingUploads), ...Object.keys(pendingGenerations)]));
    if (!pendingIds.length) return;

    let ignore = false;
    async function pollPendingDocuments() {
      try {
        const pendingDocuments = await Promise.all(pendingIds.map((documentId) => api.document(documentId)));
        if (ignore) return;
        for (const document of pendingDocuments) {
          if (document.processing_status === "processing" || document.processing_status === "pending") {
            continue;
          }
          setDocuments((current) =>
            document.folder_id === selectedFolderId ? mergeDocumentIntoList(current, document) : current,
          );
          if (document.processing_status === "ready") {
            const pendingUpload = pendingUploads[document.id];
            if (pendingUpload) {
              setUploadToast({
                documentName: documentDisplayName(document),
                elapsedSeconds: document.upload_elapsed_seconds ?? (performance.now() - pendingUpload.startedAt) / 1000,
              });
            }
            const pendingGeneration = pendingGenerations[document.id];
            if (pendingGeneration) {
              setGenerationToast({
                documentName: documentDisplayName(document),
                elapsedSeconds: document.upload_elapsed_seconds ?? (performance.now() - pendingGeneration.startedAt) / 1000,
              });
            }
          } else if (document.processing_status === "failed") {
            setError(`${documentDisplayName(document)} 처리에 실패했습니다.`);
          }
          setPendingUploads((current) => removeRecordKey(current, document.id));
          setPendingGenerations((current) => removeRecordKey(current, document.id));
        }
      } catch (pollError) {
        if (pollError instanceof ApiNetworkError) return;
        if (!ignore) setError(pollError instanceof Error ? pollError.message : "작업 완료 상태를 확인하지 못했습니다.");
      }
    }

    pollPendingDocuments();
    const intervalId = window.setInterval(pollPendingDocuments, 3000);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [pendingUploads, pendingGenerations, selectedFolderId]);

  async function selectFolder(folderId: string | null, preferredDocumentId?: string) {
    setSelectedFolderId(folderId);
    setSearchResults(null);
    setRagResponse(null);
    setRagElapsedSeconds(null);
    setSearchMode(null);
    setSearchDocuments([]);
    setError(null);
    try {
      setBusy(true);
      const nextDocuments = await api.documents(folderId);
      setDocuments(nextDocuments);
      setSelectedDocumentId(
        preferredDocumentId && nextDocuments.some((document) => document.id === preferredDocumentId)
          ? preferredDocumentId
          : nextDocuments[0]?.id ?? null,
      );
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "문서를 불러오지 못했습니다.");
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
        setFolders((current) => mergeFolderIntoList(current, folder));
      } else {
        const folder = await api.updateFolder(folderDialog.folder.id, { name: name.trim() });
        await refresh(selectedFolderId);
        setFolders((current) => mergeFolderIntoList(current, folder));
        setSelectedFolderId(folder.id);
      }
      setFolderDialog(null);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "폴더를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function moveFolder(folder: FolderType, parentId: string | null) {
    try {
      setBusy(true);
      setError(null);
      const movedFolder = await api.updateFolder(folder.id, { parent_id: parentId });
      const nextSelectedFolderId = selectedFolderId;
      await refresh(nextSelectedFolderId);
      setFolders((current) => mergeFolderIntoList(current, movedFolder));
      setSelectedFolderId(nextSelectedFolderId);
      setFolderMoveDialog(null);
      setSearchResults(null);
      setRagResponse(null);
      setRagElapsedSeconds(null);
      setSearchMode(null);
      setSearchDocuments([]);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "폴더를 이동하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function moveDocument(document: ArchiveDocument, folderId: string | null) {
    try {
      setBusy(true);
      setError(null);
      const movedDocument = await api.updateDocument(document.id, { folder_id: folderId });
      const [nextFolders, nextDocuments] = await Promise.all([api.folders(), api.documents(selectedFolderId)]);
      setFolders(nextFolders);
      setDocuments(nextDocuments);
      setSelectedDocumentId((currentSelectedDocumentId) => {
        if (movedDocument.folder_id === selectedFolderId) return movedDocument.id;
        if (currentSelectedDocumentId === movedDocument.id) return nextDocuments[0]?.id ?? null;
        return currentSelectedDocumentId && nextDocuments.some((item) => item.id === currentSelectedDocumentId)
          ? currentSelectedDocumentId
          : nextDocuments[0]?.id ?? null;
      });
      setDocumentMoveDialog(null);
      setSearchResults(null);
      setRagResponse(null);
      setRagElapsedSeconds(null);
      setSearchMode(null);
      setSearchDocuments([]);
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : "문서를 이동하지 못했습니다.");
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
          selectedFolderId && isFolderOrDescendantOf(selectedFolderId, deleteDialog.folder.id, folders) ? null : selectedFolderId;
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
      setRagResponse(null);
      setRagElapsedSeconds(null);
      setSearchMode(null);
      setSearchDocuments([]);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File | null | undefined) {
    if (!file) return;
    const uploadStartedAt = performance.now();
    try {
      setBusy(true);
      setError(null);
      const document = await api.uploadDocument(selectedFolderId, file);
      setPendingUploads((current) => ({
        ...current,
        [document.id]: { documentName: documentDisplayName(document), startedAt: uploadStartedAt },
      }));
      await refresh(selectedFolderId, document.id);
      setSearchResults(null);
      setRagResponse(null);
      setRagElapsedSeconds(null);
      setSearchMode(null);
      setSearchDocuments([]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "업로드하지 못했습니다.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runSearch(mode: SearchMode) {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setRagResponse(null);
      setRagElapsedSeconds(null);
      setSearchMode(null);
      setSearchDocuments([]);
      return;
    }
    const searchStartedAt = performance.now();
    try {
      setBusy(true);
      setError(null);
      const nextRagResponse = mode === "rag" ? await api.ragSearch(searchQuery.trim(), selectedFolderId) : null;
      const results = nextRagResponse
        ? nextRagResponse.citations
        : mode === "keyword"
          ? await api.keywordSearch(searchQuery.trim(), selectedFolderId)
          : await api.semanticSearch(searchQuery.trim(), selectedFolderId);
      const resultDocumentIds = Array.from(new Set(results.map((result) => result.document_id)));
      const loadedDocumentsById = new Map(documents.map((document) => [document.id, document]));
      const missingDocumentIds = resultDocumentIds.filter((documentId) => !loadedDocumentsById.has(documentId));
      const fetchedDocuments = missingDocumentIds.length
        ? await Promise.all(missingDocumentIds.map((documentId) => api.document(documentId)))
        : [];
      setSearchResults(results);
      setRagResponse(nextRagResponse);
      setRagElapsedSeconds(nextRagResponse ? (performance.now() - searchStartedAt) / 1000 : null);
      setSearchMode(mode);
      setSearchDocuments(uniqueDocuments([...resultDocumentIds.map((documentId) => loadedDocumentsById.get(documentId)).filter(isDocument), ...fetchedDocuments]));
      const first = results[0]?.document_id;
      if (first) setSelectedDocumentId(first);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "검색하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function afterGeneration(document: ArchiveDocument) {
    setPendingGenerations((current) => ({
      ...current,
      [document.id]: { documentName: documentDisplayName(document), startedAt: performance.now() },
    }));
    await refresh(selectedFolderId, document.id);
    setSearchResults(null);
    setRagResponse(null);
    setRagElapsedSeconds(null);
    setSearchMode(null);
    setSearchDocuments([]);
  }

  async function recoverAfterInterruptedGeneration() {
    await refresh(selectedFolderId);
    setSearchResults(null);
    setRagResponse(null);
    setRagElapsedSeconds(null);
    setSearchMode(null);
    setSearchDocuments([]);
  }

  useEffect(() => {
    async function refreshVisiblePage() {
      if (document.visibilityState !== "visible") return;
      try {
        await refresh(selectedFolderId);
      } catch (resumeError) {
        if (!(resumeError instanceof ApiNetworkError)) {
          setError(resumeError instanceof Error ? resumeError.message : "아카이브를 다시 동기화하지 못했습니다.");
        }
      }
    }

    window.addEventListener("pageshow", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);
    return () => {
      window.removeEventListener("pageshow", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [refresh, selectedFolderId]);

  return (
    <ToastProvider swipeDirection="right">
      <SidebarProvider defaultOpen>
        <ArchiveSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={selectFolder}
          onCreateFolder={(parentId) => setFolderDialog({ mode: "create", parentId })}
          onDeleteFolder={(folder) => setDeleteDialog({ type: "folder", folder })}
          onMoveFolder={(folder) => setFolderMoveDialog({ folder })}
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
          searchDocuments={searchDocuments}
          searchMode={searchMode}
          searchQuery={searchQuery}
          searchResults={searchResults}
          ragResponse={ragResponse}
          ragElapsedSeconds={ragElapsedSeconds}
          selectedDocument={selectedDocument}
          selectedFolderId={selectedFolderId}
          onAction={setAiAction}
          onClearSearch={() => {
            setSearchQuery("");
            setSearchResults(null);
            setRagResponse(null);
            setRagElapsedSeconds(null);
            setSearchMode(null);
            setSearchDocuments([]);
          }}
          onCreateFolder={(parentId) => setFolderDialog({ mode: "create", parentId })}
          onDeleteFolder={(folder) => setDeleteDialog({ type: "folder", folder })}
          onDeleteDocument={(document) => setDeleteDialog({ type: "document", document })}
          onMoveDocument={(document) => setDocumentMoveDialog({ document })}
          onMoveFolder={(folder) => setFolderMoveDialog({ folder })}
          onRenameFolder={(folder) => setFolderDialog({ mode: "rename", folder })}
          onRunSearch={runSearch}
          onSearchQueryChange={setSearchQuery}
          onSelectDocument={setSelectedDocumentId}
          onSelectFolder={selectFolder}
          onGoToDocumentFolder={(document) => selectFolder(document.folder_id, document.id)}
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
          onInterrupted={recoverAfterInterruptedGeneration}
        />
        <FolderFormDialog
          busy={busy}
          state={folderDialog}
          onClose={() => setFolderDialog(null)}
          onSubmit={saveFolder}
        />
        <MoveFolderDialog
          busy={busy}
          folders={folders}
          state={folderMoveDialog}
          onClose={() => setFolderMoveDialog(null)}
          onSubmit={moveFolder}
        />
        <MoveDocumentDialog
          busy={busy}
          folders={folders}
          state={documentMoveDialog}
          onClose={() => setDocumentMoveDialog(null)}
          onSubmit={moveDocument}
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
          onMoveFolder={(folder) => setFolderMoveDialog({ folder })}
          onMoveDocument={(document) => setDocumentMoveDialog({ document })}
          onRenameFolder={(folder) => setFolderDialog({ mode: "rename", folder })}
          onDeleteFolder={(folder) => setDeleteDialog({ type: "folder", folder })}
          onDeleteDocument={(document) => setDeleteDialog({ type: "document", document })}
        />
      </SidebarProvider>
      <Toast open={Boolean(uploadToast)} onOpenChange={(open) => !open && setUploadToast(null)}>
        <ToastTitle>업로드 완료</ToastTitle>
        <ToastDescription>
          {uploadToast
            ? `${uploadToast.documentName} 업로드가 ${formatElapsedSeconds(uploadToast.elapsedSeconds)}초 만에 완료되었습니다.`
            : ""}
        </ToastDescription>
      </Toast>
      <Toast open={Boolean(generationToast)} onOpenChange={(open) => !open && setGenerationToast(null)}>
        <ToastTitle>생성 완료</ToastTitle>
        <ToastDescription>
          {generationToast
            ? `${generationToast.documentName} 생성이 ${formatElapsedSeconds(generationToast.elapsedSeconds)}초 만에 완료되었습니다.`
            : ""}
        </ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

function ArchiveWorkspace({
  busy,
  documents,
  error,
  folders,
  loading,
  searchDocuments,
  searchMode,
  searchQuery,
  searchResults,
  ragResponse,
  ragElapsedSeconds,
  selectedDocument,
  selectedFolderId,
  onAction,
  onClearSearch,
  onCreateFolder,
  onDeleteFolder,
  onDeleteDocument,
  onMoveDocument,
  onMoveFolder,
  onRenameFolder,
  onRunSearch,
  onSearchQueryChange,
  onGoToDocumentFolder,
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
  searchDocuments: ArchiveDocument[];
  searchMode: SearchMode | null;
  searchQuery: string;
  searchResults: SearchResult[] | null;
  ragResponse: RagSearchResponse | null;
  ragElapsedSeconds: number | null;
  selectedDocument: ArchiveDocument | null;
  selectedFolderId: string | null;
  onAction: (action: AIAction) => void;
  onClearSearch: () => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onDeleteDocument: (document: ArchiveDocument) => void;
  onMoveDocument: (document: ArchiveDocument) => void;
  onMoveFolder: (folder: FolderType) => void;
  onRenameFolder: (folder: FolderType) => void;
  onRunSearch: (mode: SearchMode) => void;
  onSearchQueryChange: (query: string) => void;
  onGoToDocumentFolder: (document: ArchiveDocument) => void;
  onSelectDocument: (documentId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onShowDocumentContextMenu: (document: ArchiveDocument, x: number, y: number) => void;
  onUpload: () => void;
}) {
  const folderSidebar = useSidebar();
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataMobileOpen, setMetadataMobileOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const rows = searchResults
    ? searchResults.map((result) => searchDocuments.find((document) => document.id === result.document_id)).filter(isDocument)
    : documents;
  const uniqueRows = uniqueDocuments(rows);
  const searchResultsByDocumentId = searchResultsByDocument(searchResults);
  const childFolders = searchResults
    ? []
    : folders
        .filter((folder) => folder.parent_id === selectedFolderId)
        .sort((left, right) => left.name.localeCompare(right.name));
  const locationLabel = selectedFolder?.path ?? "내 드라이브";

  function selectDocumentFromRow(documentId: string) {
    if (selectedDocument?.id === documentId) {
      if (folderSidebar.isMobile) {
        setMetadataOpen(true);
        setMetadataMobileOpen(true);
        return;
      }
      setMetadataOpen((open) => !open);
      return;
    }
    onSelectDocument(documentId);
    setMetadataOpen(true);
    setMetadataMobileOpen(true);
  }

  function runSearch(mode: SearchMode) {
    setSearchMenuOpen(false);
    onRunSearch(mode);
  }

  return (
    <SidebarInset className="min-w-0 bg-[#f7f8fb]">
      <SidebarProvider
        open={metadataOpen}
        onOpenChange={setMetadataOpen}
        openMobile={metadataMobileOpen}
        onOpenMobileChange={setMetadataMobileOpen}
        defaultOpen
        className="min-h-0 flex-1 bg-background"
        style={{ "--sidebar-width": "min(24rem, 100vw)" } as CSSProperties}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="flex min-h-16 flex-col gap-2 px-4 py-3 md:min-h-12 md:flex-row md:items-center md:gap-3 md:py-0">
              <form
                id="archive-search-form"
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearchMenuOpen(true);
                }}
              >
                <Button type="button" variant="ghost" size="icon-sm" aria-label="폴더 사이드바 열기/닫기" onClick={folderSidebar.toggleSidebar}>
                  <PanelLeft className="size-4" />
                </Button>
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="문서 검색"
                    placeholder="문서 검색"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    className="h-10 bg-muted/40 pl-9 shadow-none"
                  />
                </div>
                <DropdownMenu open={searchMenuOpen} onOpenChange={setSearchMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 px-2 md:px-3" aria-label="검색 방식 선택">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      검색...
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem disabled={busy} onSelect={() => runSearch("keyword")}>
                      <Search className="size-4" />
                      키워드
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onSelect={() => runSearch("semantic")}>
                      <Sparkles className="size-4" />
                      의미
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onSelect={() => runSearch("rag")}>
                      <Bot className="size-4" />
                      RAG 답변
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <HeaderTooltip label="메타데이터 패널 열기/닫기">
                  <MetadataSidebarTrigger className="md:hidden" />
                </HeaderTooltip>
              </form>
              <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                <HeaderTooltip label="문서 업로드">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="w-full md:w-8"
                    aria-label="문서 업로드"
                    onClick={onUpload}
                    disabled={busy}
                  >
                    <Upload className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="새 폴더">
                  <Button
                    size="icon-sm"
                    className="w-full md:w-8"
                    aria-label="새 폴더"
                    onClick={() => onCreateFolder(selectedFolderId)}
                    disabled={busy}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </HeaderTooltip>
                <HeaderTooltip label="메타데이터 패널 열기/닫기">
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
                      아카이브
                      <ChevronRight className="size-3.5" />
                      <span className="truncate">{locationLabel}</span>
                    </div>
                    {searchResults && (
                      <button className="mt-1 text-xs text-primary underline-offset-4 hover:underline" onClick={onClearSearch}>
                        {formatSearchMode(searchMode)} 결과 {searchResults.length}개 표시 중. 검색 지우기
                      </button>
                    )}
                  </div>
                  {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                </div>

                {childFolders.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {childFolders.map((folder) => (
                      <FolderContentCard
                        key={folder.id}
                        folder={folder}
                        onCreateFolder={() => onCreateFolder(folder.id)}
                        onDeleteFolder={() => onDeleteFolder(folder)}
                        onMoveFolder={() => onMoveFolder(folder)}
                        onOpen={() => onSelectFolder(folder.id)}
                        onRenameFolder={() => onRenameFolder(folder)}
                      />
                    ))}
                  </div>
                )}

                {ragResponse && (
                  <RagAnswerPanel
                    response={ragResponse}
                    elapsedSeconds={ragElapsedSeconds}
                    onSelectCitation={(documentId) => selectDocumentFromRow(documentId)}
                  />
                )}

                <div className="overflow-hidden rounded-md border bg-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_36px] gap-3 border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px_36px]">
                    <span>이름</span>
                    <span className="hidden md:block">수정일</span>
                    <span className="hidden md:block">크기</span>
                    <span>상태</span>
                    <span className="sr-only">작업</span>
                  </div>
                  <div className="divide-y">
                    {loading ? (
                      <div className="p-4 text-sm text-muted-foreground">문서를 불러오는 중...</div>
                    ) : uniqueRows.length ? (
                      uniqueRows.map((document) => (
                        <DocumentResultRow
                          key={document.id}
                          document={document}
                          result={searchResultsByDocumentId.get(document.id) ?? null}
                          searchMode={searchMode}
                          onDelete={() => onDeleteDocument(document)}
                          onGoToFolder={() => onGoToDocumentFolder(document)}
                          onMove={() => onMoveDocument(document)}
                          onOpen={() => window.open(api.viewUrl(document.id), "_blank", "noreferrer")}
                          onShowContextMenu={(x, y) => onShowDocumentContextMenu(document, x, y)}
                          selected={selectedDocument?.id === document.id}
                          onSelect={() => selectDocumentFromRow(document.id)}
                        />
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        {ragResponse ? "인용할 문서 조각이 없습니다." : childFolders.length ? "이 폴더에 문서가 없습니다." : "이 위치에 폴더나 문서가 없습니다."}
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

function RagAnswerPanel({
  response,
  elapsedSeconds,
  onSelectCitation,
}: {
  response: RagSearchResponse;
  elapsedSeconds: number | null;
  onSelectCitation: (documentId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700 ring-1 ring-violet-200">
            <Bot className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">RAG 답변</h2>
            <p className="truncate text-xs text-muted-foreground">
              인용 {response.citations.length}개
              {elapsedSeconds !== null ? ` · 총 답변 소요 시간 ${formatElapsedSeconds(elapsedSeconds)}초` : ""}
            </p>
          </div>
        </div>
        <Badge variant="secondary">Generated</Badge>
      </div>
      <div className="space-y-4 p-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{response.answer}</p>
        {response.citations.length > 0 && (
          <div className="grid gap-2 lg:grid-cols-2">
            {response.citations.map((citation, index) => (
              <button
                key={citation.chunk_id}
                type="button"
                className="min-w-0 rounded-md border bg-muted/30 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelectCitation(citation.document_id)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    [{index + 1}] {citation.title || citation.corrected_filename || "Untitled"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatSimilarityScore(citation.score)}</span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{citation.content}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
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

function FolderContentCard({
  folder,
  onCreateFolder,
  onDeleteFolder,
  onMoveFolder,
  onOpen,
  onRenameFolder,
}: {
  folder: FolderType;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onMoveFolder: () => void;
  onOpen: () => void;
  onRenameFolder: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-3 py-3 transition-colors hover:bg-accent">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <Folder className="size-4" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{folder.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{folder.path ?? "폴더"}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <FolderCardMenu
        folder={folder}
        onCreateFolder={onCreateFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveFolder={onMoveFolder}
        onRenameFolder={onRenameFolder}
      />
    </div>
  );
}

function FolderCardMenu({
  folder,
  onCreateFolder,
  onDeleteFolder,
  onMoveFolder,
  onRenameFolder,
}: {
  folder: FolderType;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onMoveFolder: () => void;
  onRenameFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`${folder.name} 작업`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <FolderActionItems
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
          onRenameFolder={onRenameFolder}
        />
      </DropdownMenuContent>
    </DropdownMenu>
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
  const title = state?.mode === "rename" ? "폴더 이름 변경" : "새 폴더";
  const initialName = state?.mode === "rename" ? state.folder.name : "";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.mode === "rename" ? "폴더 이름을 수정합니다." : "선택한 위치에 폴더를 만듭니다."}
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
        <Label htmlFor="folder-name">폴더 이름</Label>
        <Input
          id="folder-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="폴더 이름"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

function MoveFolderDialog({
  busy,
  folders,
  state,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  folders: FolderType[];
  state: FolderMoveDialogState;
  onClose: () => void;
  onSubmit: (folder: FolderType, parentId: string | null) => void;
}) {
  const movingFolder = state?.folder ?? null;

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>폴더 이동</DialogTitle>
          <DialogDescription>
            {movingFolder ? `${movingFolder.name} 폴더를 이동할 위치를 선택합니다.` : "폴더를 이동할 위치를 선택합니다."}
          </DialogDescription>
        </DialogHeader>
        {movingFolder && (
          <MoveFolderFields
            key={`${movingFolder.id}-${movingFolder.parent_id ?? "root"}`}
            busy={busy}
            folders={folders}
            movingFolder={movingFolder}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveFolderFields({
  busy,
  folders,
  movingFolder,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  folders: FolderType[];
  movingFolder: FolderType;
  onClose: () => void;
  onSubmit: (folder: FolderType, parentId: string | null) => void;
}) {
  const [targetParentId, setTargetParentId] = useState<string | null>(movingFolder.parent_id);
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const isSameParent = targetParentId === movingFolder.parent_id;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <MoveTargetButton
          active={targetParentId === null}
          disabled={false}
          icon={HardDrive}
          label="내 드라이브"
          description="최상위 위치"
          onClick={() => setTargetParentId(null)}
        />
        <ScrollArea className="min-h-0 flex-1 rounded-md border">
          <div className="p-0.5">
            {tree.map((node) => (
              <MoveFolderTreeItem
                key={node.folder.id}
                node={node}
                movingFolderId={movingFolder.id}
                folders={folders}
                targetParentId={targetParentId}
                onSelect={setTargetParentId}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button type="button" disabled={busy || isSameParent} onClick={() => onSubmit(movingFolder, targetParentId)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderInput className="size-4" />}
          이동
        </Button>
      </DialogFooter>
    </div>
  );
}

function MoveFolderTreeItem({
  folders,
  movingFolderId,
  node,
  targetParentId,
  onSelect,
}: {
  folders: FolderType[];
  movingFolderId: string;
  node: FolderTreeNode;
  targetParentId: string | null;
  onSelect: (folderId: string) => void;
}) {
  const disabled = isFolderOrDescendantOf(node.folder.id, movingFolderId, folders);

  return (
    <>
      <MoveTargetButton
        active={targetParentId === node.folder.id}
        disabled={disabled}
        icon={Folder}
        label={node.folder.name}
        description={disabled ? "선택할 수 없음" : (node.folder.path ?? node.folder.name)}
        style={{ paddingLeft: `${0.75 + node.depth * 0.85}rem` }}
        onClick={() => onSelect(node.folder.id)}
      />
      {node.children.map((child) => (
        <MoveFolderTreeItem
          key={child.folder.id}
          node={child}
          movingFolderId={movingFolderId}
          folders={folders}
          targetParentId={targetParentId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function MoveDocumentDialog({
  busy,
  folders,
  state,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  folders: FolderType[];
  state: DocumentMoveDialogState;
  onClose: () => void;
  onSubmit: (document: ArchiveDocument, folderId: string | null) => void;
}) {
  const movingDocument = state?.document ?? null;

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>문서 이동</DialogTitle>
          <DialogDescription>
            {movingDocument ? `${documentDisplayName(movingDocument)} 문서를 이동할 위치를 선택합니다.` : "문서를 이동할 위치를 선택합니다."}
          </DialogDescription>
        </DialogHeader>
        {movingDocument && (
          <MoveDocumentFields
            key={`${movingDocument.id}-${movingDocument.folder_id ?? "root"}`}
            busy={busy}
            folders={folders}
            movingDocument={movingDocument}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveDocumentFields({
  busy,
  folders,
  movingDocument,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  folders: FolderType[];
  movingDocument: ArchiveDocument;
  onClose: () => void;
  onSubmit: (document: ArchiveDocument, folderId: string | null) => void;
}) {
  const [targetFolderId, setTargetFolderId] = useState<string | null>(movingDocument.folder_id);
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const isSameFolder = targetFolderId === movingDocument.folder_id;
  const isProcessing = isProcessingDocument(movingDocument);

  return (
    <div className="space-y-4">
      {isProcessing && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          처리 중인 문서는 이동할 수 없습니다.
        </p>
      )}
      <div className="space-y-1">
        <MoveTargetButton
          active={targetFolderId === null}
          disabled={false}
          icon={HardDrive}
          label="내 드라이브"
          description="최상위 위치"
          onClick={() => setTargetFolderId(null)}
        />
        <ScrollArea className="max-h-[min(420px,60vh)] rounded-md border">
          <div className="p-0.5">
            {tree.map((node) => (
              <MoveDocumentTreeItem
                key={node.folder.id}
                node={node}
                targetFolderId={targetFolderId}
                onSelect={setTargetFolderId}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button type="button" disabled={busy || isSameFolder || isProcessing} onClick={() => onSubmit(movingDocument, targetFolderId)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderInput className="size-4" />}
          이동
        </Button>
      </DialogFooter>
    </div>
  );
}

function MoveDocumentTreeItem({
  node,
  targetFolderId,
  onSelect,
}: {
  node: FolderTreeNode;
  targetFolderId: string | null;
  onSelect: (folderId: string) => void;
}) {
  return (
    <>
      <MoveTargetButton
        active={targetFolderId === node.folder.id}
        disabled={false}
        icon={Folder}
        label={node.folder.name}
        description={node.folder.path ?? node.folder.name}
        style={{ paddingLeft: `${0.75 + node.depth * 0.85}rem` }}
        onClick={() => onSelect(node.folder.id)}
      />
      {node.children.map((child) => (
        <MoveDocumentTreeItem
          key={child.folder.id}
          node={child}
          targetFolderId={targetFolderId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function MoveTargetButton({
  active,
  description,
  disabled,
  icon: Icon,
  label,
  onClick,
  style,
}: {
  active: boolean;
  description: string;
  disabled: boolean;
  icon: ElementType;
  label: string;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(
        "flex h-8 w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
      )}
      style={style}
      onClick={onClick}
      title={`${label} · ${description}`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="hidden max-w-28 shrink-0 truncate text-xs text-muted-foreground sm:block">{description}</span>
      {active && <Check className="size-3.5 shrink-0" />}
    </button>
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
  const title = state?.type === "folder" ? "폴더 삭제" : "문서 삭제";
  const targetName =
    state?.type === "folder"
      ? state.folder.name
      : state?.type === "document"
        ? documentDisplayName(state.document)
        : "";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.type === "folder" ? `${targetName} 폴더와 내부 항목을 모두 삭제합니다.` : `${targetName} 문서를 삭제합니다.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            삭제
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
  onMoveFolder,
  onMoveDocument,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onCreateFolder: (parentId: string | null) => void;
  onMoveFolder: (folder: FolderType) => void;
  onMoveDocument: (document: ArchiveDocument) => void;
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
            label="새 하위 폴더"
            onClick={() => {
              onCreateFolder(state.folder.id);
              onClose();
            }}
          />
          <ContextMenuButton
            icon={FolderPen}
            label="이름 변경"
            onClick={() => {
              onRenameFolder(state.folder);
              onClose();
            }}
          />
          <ContextMenuButton
            icon={FolderInput}
            label="폴더 이동"
            onClick={() => {
              onMoveFolder(state.folder);
              onClose();
            }}
          />
          <div className="-mx-1 my-1 h-px bg-border" />
          <ContextMenuButton
            destructive
            icon={Trash2}
            label="폴더 삭제"
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
            label="원본 열기"
            onClick={() => {
              window.open(api.viewUrl(state.document.id), "_blank", "noreferrer");
              onClose();
            }}
          />
          <ContextMenuButton
            disabled={isProcessingDocument(state.document)}
            icon={FolderInput}
            label="문서 이동"
            onClick={() => {
              onMoveDocument(state.document);
              onClose();
            }}
          />
          <div className="-mx-1 my-1 h-px bg-border" />
          <ContextMenuButton
            destructive
            icon={Trash2}
            label="문서 삭제"
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
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  disabled?: boolean;
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
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-inherit",
      )}
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function DocumentResultRow({
  document,
  result,
  searchMode,
  selected,
  onDelete,
  onGoToFolder,
  onMove,
  onOpen,
  onSelect,
  onShowContextMenu,
}: {
  document: ArchiveDocument;
  result: SearchResult | null;
  searchMode: SearchMode | null;
  selected: boolean;
  onDelete: () => void;
  onGoToFolder: () => void;
  onMove: () => void;
  onOpen: () => void;
  onSelect: () => void;
  onShowContextMenu: (x: number, y: number) => void;
}) {
  if (searchMode !== "semantic" || !result) {
    return (
      <DocumentRow
        document={document}
        selected={selected}
        onDelete={onDelete}
        onGoToFolder={onGoToFolder}
        onMove={onMove}
        onOpen={onOpen}
        onSelect={onSelect}
        onShowContextMenu={onShowContextMenu}
      />
    );
  }

  return (
    <Collapsible defaultOpen={selected} className={cn("group", selected && "bg-primary/10")}>
      <div
        role="button"
        tabIndex={0}
        className="grid grid-cols-[minmax(0,1fr)_96px_36px] items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1.6fr)_120px_110px_112px_36px]"
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
        <DocumentRowContent document={document} />
        <span className="hidden text-sm text-muted-foreground md:block">{formatDate(document.updated_at)}</span>
        <span className="hidden text-sm text-muted-foreground md:block">{formatSize(document.file_size)}</span>
        <span className="flex items-center gap-2">
          <Badge variant={document.processing_status === "failed" ? "destructive" : "outline"}>
            {formatProcessingStatus(document.processing_status)}
          </Badge>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="의미 검색 메타데이터 열기"
              onClick={(event) => event.stopPropagation()}
            >
              <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
        </span>
        <div className="flex items-center justify-end">
          <DocumentRowMenu
            document={document}
            onDelete={onDelete}
            onGoToFolder={onGoToFolder}
            onMove={onMove}
            onOpen={onOpen}
          />
        </div>
      </div>
      <CollapsibleContent>
        <button
          type="button"
          className="grid w-full gap-3 border-t bg-muted/30 px-4 py-3 text-left md:grid-cols-[160px_minmax(0,1fr)]"
          onClick={onSelect}
          onContextMenu={(event) => {
            event.preventDefault();
            onShowContextMenu(event.clientX, event.clientY);
          }}
        >
          <div className="space-y-2">
            <Badge variant="secondary">Semantic</Badge>
            <div className="text-xs text-muted-foreground">유사도 {formatSimilarityScore(result.score)}</div>
            <div className="text-xs text-muted-foreground">근거 조각 {shortId(result.chunk_id)}</div>
          </div>
          <div className="min-w-0 space-y-2">
            <div className="text-xs font-medium uppercase text-muted-foreground">RAG Context</div>
            <p className="line-clamp-3 text-sm leading-6 text-foreground">{result.content}</p>
            <p className="text-xs text-muted-foreground">
              이 문서 조각이 질의와 의미적으로 가까워 검색 컨텍스트로 선택되었습니다.
            </p>
          </div>
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentRow({
  document,
  selected,
  onDelete,
  onGoToFolder,
  onMove,
  onOpen,
  onSelect,
  onShowContextMenu,
}: {
  document: ArchiveDocument;
  selected: boolean;
  onDelete: () => void;
  onGoToFolder: () => void;
  onMove: () => void;
  onOpen: () => void;
  onSelect: () => void;
  onShowContextMenu: (x: number, y: number) => void;
}) {
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
      <DocumentRowContent document={document} />
      <span className="hidden text-sm text-muted-foreground md:block">{formatDate(document.updated_at)}</span>
      <span className="hidden text-sm text-muted-foreground md:block">{formatSize(document.file_size)}</span>
      <span>
        <Badge variant={document.processing_status === "failed" ? "destructive" : "outline"}>
          {formatProcessingStatus(document.processing_status)}
        </Badge>
      </span>
      <DocumentRowMenu
        document={document}
        onDelete={onDelete}
        onGoToFolder={onGoToFolder}
        onMove={onMove}
        onOpen={onOpen}
      />
    </div>
  );
}

function DocumentRowContent({ document }: { document: ArchiveDocument }) {
  const kind = documentKind(document);
  const Icon = fileIcon[kind];

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md ring-1", fileTone[kind])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{documentDisplayName(document)}</span>
        <span className="block truncate text-xs text-muted-foreground">{document.original_filename}</span>
      </span>
    </span>
  );
}

function DocumentRowMenu({
  document,
  onDelete,
  onGoToFolder,
  onMove,
  onOpen,
}: {
  document: ArchiveDocument;
  onDelete: () => void;
  onGoToFolder: () => void;
  onMove: () => void;
  onOpen: () => void;
}) {
  const isProcessing = isProcessingDocument(document);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="문서 작업"
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
          원본 열기
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onGoToFolder();
          }}
        >
          <FolderOpen className="size-4" />
          위치 열기
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isProcessing}
          onClick={(event) => {
            event.stopPropagation();
            onMove();
          }}
        >
          <FolderInput className="size-4" />
          문서 이동
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
          문서 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OriginalFileMenu({ documentId }: { documentId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="원본 파일 작업">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <a href={api.downloadUrl(documentId)} target="_blank" rel="noreferrer">
            <Download className="size-4" />
            다운로드
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={api.viewUrl(documentId)} target="_blank" rel="noreferrer">
            <Eye className="size-4" />
            원본 보기
          </a>
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
  const lineageElapsedSeconds =
    typeof lineage?.generation_params.elapsed_seconds === "number" ? lineage.generation_params.elapsed_seconds : null;
  const elapsedSeconds = selected?.upload_elapsed_seconds ?? (selected?.is_generated ? lineageElapsedSeconds : null);

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
        if (!ignore) setLineageError(error instanceof Error ? error.message : "계보 정보를 사용할 수 없습니다.");
      }
    }
    loadLineage();
    return () => {
      ignore = true;
    };
  }, [selected?.id, selected?.is_generated]);

  return (
    <Sidebar side="right" collapsible="offcanvas" mobileWidth="100vw" className="z-30 max-w-[100vw] overflow-hidden border-l bg-background text-foreground">
      <SidebarHeader className="h-[49px] min-w-0 shrink-0 flex-row items-center justify-between border-b px-4">
        <div className="min-w-0 truncate text-sm font-semibold">문서 메타데이터</div>
        <MetadataSidebarClose />
      </SidebarHeader>
      <SidebarContent className="min-h-0 min-w-0 gap-0 overflow-hidden bg-background">
        <ScrollArea className="h-[calc(100vh-49px)] min-h-0 min-w-0 overflow-hidden">
          <div className="min-w-0 max-w-full space-y-6 overflow-hidden p-4 sm:p-6">
            {!selected ? (
              <p className="text-sm text-muted-foreground">메타데이터를 확인할 문서를 선택하세요.</p>
            ) : (
              <>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-md ring-1", fileTone[kind])}>
                      <SelectedIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 break-all text-sm font-semibold [overflow-wrap:anywhere]">{documentDisplayName(selected)}</h2>
                      <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere] sm:truncate">{selected.mime_type}</p>
                    </div>
                  </div>
                  <OriginalFileMenu documentId={selected.id} />
                </div>

                <Separator />

                <section className="min-w-0 space-y-3 overflow-hidden">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">파일 정보</h3>
                  <dl className="min-w-0 space-y-3 text-sm">
                    <MetaRow icon={Folder} label="폴더" value={selected.folder_id ? (folder?.path ?? "알 수 없음") : "내 드라이브"} />
                    <MetaRow icon={FileText} label="제목" value={selected.title || "없음"} />
                    {selected.corrected_filename && selected.corrected_filename !== selected.title && (
                      <MetaRow icon={Sparkles} label="AI 보정명" value={selected.corrected_filename} />
                    )}
                    <MetaRow icon={FileText} label="원본 파일명" value={selected.original_filename} />
                    <MetaRow icon={FileType} label="MIME" value={selected.mime_type} />
                    <MetaRow icon={HardDrive} label="크기" value={`${formatSize(selected.file_size)} (${selected.file_size.toLocaleString("ko-KR")} bytes)`} />
                    <MetaRow icon={Info} label="소스" value={selected.source_type} />
                    <MetaRow
                      icon={Clock3}
                      label={selected.is_generated ? "작업 소요" : "업로드 소요"}
                      value={elapsedSeconds === null ? "없음" : `${formatElapsedSeconds(elapsedSeconds)}초`}
                    />
                    <MetaRow icon={CalendarDays} label="생성일" value={formatDate(selected.created_at)} />
                    <MetaRow icon={Clock3} label="수정일" value={formatDate(selected.updated_at)} />
                  </dl>
                  {selected.processing_error && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words [overflow-wrap:anywhere]">
                      {selected.processing_error}
                    </p>
                  )}
                </section>

                <Separator />

                <section className="min-w-0 space-y-3 overflow-hidden">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">AI 메타데이터</h3>
                  <dl className="min-w-0 space-y-3 text-sm">
                    <MetaRow icon={Tag} label="태그" value={selected.metadata_row?.tags.join(", ") || "없음"} />
                    <MetaRow icon={Languages} label="언어" value={selected.metadata_row?.language || "없음"} />
                    <MetaRow icon={FileType} label="문서 유형" value={selected.metadata_row?.document_type || "없음"} />
                    <MetaRow icon={Users} label="인물" value={formatList(selected.metadata_row?.people)} />
                    <MetaRow icon={Building2} label="기관" value={formatList(selected.metadata_row?.organizations)} />
                    <MetaRow icon={CalendarDays} label="주요 날짜" value={formatList(selected.metadata_row?.key_dates)} />
                    <MetaRow icon={Bot} label="모델" value={selected.metadata_row?.model_name || "없음"} />
                    <MetaRow icon={Bot} label="모델 버전" value={selected.metadata_row?.model_version || "없음"} />
                    <MetaRow icon={Clock3} label="추출 시각" value={selected.metadata_row ? formatDate(selected.metadata_row.generated_at) : "없음"} />
                  </dl>
                  {selected.metadata_row?.summary && (
                    <p className="min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 text-sm leading-6 [overflow-wrap:anywhere]">
                      {selected.metadata_row.summary}
                    </p>
                  )}
                </section>

                <Separator />

                <section className="min-w-0 space-y-3 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">AI 작업</h3>
                  </div>
                  <div className="space-y-2">
                    {(Object.keys(actionLabels) as AIAction[]).map((action) => (
                      <Button key={action} variant="outline" size="sm" className="w-full min-w-0 justify-start" onClick={() => onAction(action)}>
                        <Sparkles className="size-4" />
                        <span className="truncate">{actionLabels[action]}</span>
                      </Button>
                    ))}
                  </div>
                </section>

                {selected.is_generated && (
                  <>
                    <Separator />
                    <section className="min-w-0 space-y-3 overflow-hidden">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">계보</h3>
                      {lineage ? (
                        <dl className="min-w-0 space-y-3 text-sm">
                          <MetaRow icon={Sparkles} label="작업" value={formatAction(lineage.operation)} />
                          <MetaRow icon={Bot} label="모델" value={lineage.model_name} />
                          <MetaRow icon={Info} label="원본" value={formatLineageSources(lineage)} />
                          <MetaRow icon={FileText} label="프롬프트" value={lineage.prompt || "없음"} />
                        </dl>
                      ) : (
                        <p className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{lineageError ?? "계보를 불러오는 중..."}</p>
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
  onInterrupted,
}: {
  action: AIAction | null;
  documents: ArchiveDocument[];
  selectedDocument: ArchiveDocument | null;
  selectedFolderId: string | null;
  onClose: () => void;
  onGenerated: (document: ArchiveDocument) => void | Promise<void>;
  onInterrupted: () => void | Promise<void>;
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
      await onGenerated(result.document);
      closeDialog();
    } catch (submitError) {
      if (submitError instanceof ApiNetworkError) {
        await onInterrupted();
        setError("브라우저 연결이 끊겨 서버 상태를 다시 확인했습니다. 생성 중인 문서는 목록에서 진행 상태가 표시됩니다.");
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "AI 작업을 실행하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{action ? actionLabels[action] : "AI 작업"}</DialogTitle>
          <DialogDescription>생성 결과는 선택한 폴더에 새 문서로 저장됩니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>참조 문서</Label>
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
                  <span className="min-w-0 truncate">{documentDisplayName(document)}</span>
                </label>
              ))}
            </div>
          </div>
          {action === "rewrite-style" && (
            <div className="space-y-2">
              <Label htmlFor="style">문체</Label>
              <Input id="style" value={style} onChange={(event) => setStyle(event.target.value)} placeholder="명확하고 전문적인 문체" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="instructions">추가 지시사항</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="제약 조건, 중점 영역, 원하는 구조를 입력하세요"
              className="min-h-28"
            />
          </div>
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={loading}>
            취소
          </Button>
          <Button onClick={submit} disabled={loading || !selectedFolderId || !selectedRefs.length}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            실행
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
  onMoveFolder,
  onRenameFolder,
  onShowFolderContextMenu,
  onUpload,
}: {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onMoveFolder: (folder: FolderType) => void;
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
            <SidebarMenuButton size="lg" tooltip="문서 아카이브" className="h-12 pr-9 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Archive className="size-4" />
              </div>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate font-semibold">문서 아카이브</span>
                <span className="block truncate text-xs text-sidebar-foreground/60">PostgreSQL + pgvector</span>
              </span>
            </SidebarMenuButton>
            <SidebarMenuAction aria-label="폴더 만들기" onClick={() => onCreateFolder(selectedFolderId)}>
              <Plus />
            </SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>폴더</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton isActive={!selectedFolderId} size="sm" tooltip="내 드라이브" className="h-7 text-xs" onClick={() => onSelectFolder(null)}>
                  <HardDrive className="size-3.5" />
                  <span>내 드라이브</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {tree.map((node) => (
                <FolderTreeItem
                  key={node.folder.id}
                  node={node}
                  selectedFolderId={selectedFolderId}
                  onCreateFolder={onCreateFolder}
                  onDeleteFolder={onDeleteFolder}
                  onMoveFolder={onMoveFolder}
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
            <SidebarMenuButton tooltip="업로드" className="h-auto py-2" onClick={onUpload}>
              <Upload className="size-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">업로드</span>
                <span className="block truncate text-xs text-sidebar-foreground/60">이미지, PDF, 텍스트</span>
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
  onMoveFolder,
  onRenameFolder,
  onSelectFolder,
  onShowFolderContextMenu,
}: {
  node: FolderTreeNode;
  selectedFolderId: string | null;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onMoveFolder: (folder: FolderType) => void;
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
          onMoveFolder={() => onMoveFolder(node.folder)}
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
          onMoveFolder={onMoveFolder}
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
  onMoveFolder,
  onRenameFolder,
}: {
  folder: FolderType;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onMoveFolder: () => void;
  onRenameFolder: () => void;
}) {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction aria-label={`${folder.name} 작업`} onClick={(event) => event.stopPropagation()}>
          <MoreHorizontal />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"} className="w-44">
        <FolderActionItems
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
          onRenameFolder={onRenameFolder}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderActionItems({
  onCreateFolder,
  onDeleteFolder,
  onMoveFolder,
  onRenameFolder,
}: {
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onMoveFolder: () => void;
  onRenameFolder: () => void;
}) {
  return (
    <>
      <DropdownMenuItem onClick={onCreateFolder}>
        <FolderPlus className="size-4" />
        새 하위 폴더
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onRenameFolder}>
        <FolderPen className="size-4" />
        이름 변경
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onMoveFolder}>
        <FolderInput className="size-4" />
        폴더 이동
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={onDeleteFolder}>
        <Trash2 className="size-4" />
        폴더 삭제
      </DropdownMenuItem>
    </>
  );
}

function MetadataSidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button type="button" variant="ghost" size="icon-sm" className={className} aria-label="메타데이터 사이드바 열기/닫기" onClick={toggleSidebar}>
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
      aria-label="메타데이터 사이드바 닫기"
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
    <div className="grid min-w-0 max-w-full grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 overflow-hidden sm:grid-cols-[1rem_5rem_minmax(0,1fr)] sm:gap-y-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <dt className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere] sm:col-auto">{label}</dt>
      <dd className="col-start-2 min-w-0 max-w-full whitespace-pre-wrap break-all font-medium [overflow-wrap:anywhere] sm:col-start-auto">
        {value}
      </dd>
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
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatElapsedSeconds(seconds: number) {
  return Math.max(0.1, seconds).toFixed(1);
}

function formatList(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "없음";
}

function documentDisplayName(document: ArchiveDocument) {
  return document.corrected_filename || document.title || document.original_filename;
}

function isProcessingDocument(document: ArchiveDocument) {
  return document.processing_status === "pending" || document.processing_status === "processing";
}

function formatSimilarityScore(score: number | null) {
  if (score === null) return "사용 불가";
  return `${Math.round(score * 100)}%`;
}

function formatSearchMode(mode: SearchMode | null) {
  if (mode === "semantic") return "의미 검색";
  if (mode === "rag") return "RAG 답변";
  return "키워드 검색";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatAction(action: string) {
  return actionLabels[action as AIAction] ?? action;
}

function formatLineageSources(lineage: Lineage) {
  if (lineage.source_documents.length) {
    return lineage.source_documents
      .map((document, index) => `${index + 1}. ${document.corrected_filename || document.title || document.original_filename || shortId(document.id)}`)
      .join("\n");
  }
  return lineage.source_document_ids.length
    ? lineage.source_document_ids.map((documentId, index) => `${index + 1}. ${shortId(documentId)}`).join("\n")
    : "없음";
}

function formatProcessingStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "대기 중",
    processing: "처리 중",
    completed: "완료",
    failed: "실패",
    ready: "준비됨",
  };

  return labels[status] ?? status;
}

function searchResultsByDocument(results: SearchResult[] | null) {
  const byDocumentId = new Map<string, SearchResult>();
  for (const result of results ?? []) {
    if (!byDocumentId.has(result.document_id)) byDocumentId.set(result.document_id, result);
  }
  return byDocumentId;
}

function isDocument(document: ArchiveDocument | undefined): document is ArchiveDocument {
  return Boolean(document);
}

function uniqueDocuments(documents: ArchiveDocument[]) {
  return Array.from(new Map(documents.map((document) => [document.id, document])).values());
}

function mergeDocumentIntoList(documents: ArchiveDocument[], document: ArchiveDocument) {
  const exists = documents.some((item) => item.id === document.id);
  return uniqueDocuments(exists ? documents.map((item) => (item.id === document.id ? document : item)) : [document, ...documents]);
}

function removeRecordKey<T>(record: Record<string, T>, key: string) {
  if (!(key in record)) return record;
  const rest = { ...record };
  delete rest[key];
  return rest;
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

function isFolderOrDescendantOf(folderId: string, ancestorFolderId: string, folders: FolderType[]) {
  if (folderId === ancestorFolderId) return true;

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  let folder = foldersById.get(folderId);

  while (folder?.parent_id) {
    if (folder.parent_id === ancestorFolderId) return true;
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
