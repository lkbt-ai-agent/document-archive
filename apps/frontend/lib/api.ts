export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://127.0.0.1:8000";

const API_V1 = `${API_BASE_URL}/api/v1`;

export type Folder = {
  id: string;
  parent_id: string | null;
  name: string;
  path: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentMetadata = {
  summary: string | null;
  tags: string[];
  language: string | null;
  document_type: string | null;
  people: string[];
  organizations: string[];
  key_dates: string[];
  model_name: string;
  model_version: string | null;
  generated_at: string;
};

export type ArchiveDocument = {
  id: string;
  folder_id: string | null;
  title: string | null;
  corrected_filename: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number;
  checksum_sha256: string;
  storage_bucket: string | null;
  storage_object_key: string;
  is_generated: boolean;
  source_type: string;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  metadata_row: DocumentMetadata | null;
};

export type SearchResult = {
  chunk_id: string;
  document_id: string;
  title: string | null;
  corrected_filename: string | null;
  content: string;
  score: number | null;
};

export type Lineage = {
  id: string;
  generated_document_id: string;
  source_document_ids: string[];
  source_chunk_ids: string[];
  operation: string;
  prompt: string;
  model_name: string;
  provider_name: string;
  generation_params: Record<string, unknown>;
  workflow_dna: Record<string, unknown>;
  created_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_V1}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `요청 실패: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  folders: () => request<Folder[]>("/folders"),
  createFolder: (name: string, parentId: string | null) =>
    request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify({ name, parent_id: parentId }),
    }),
  updateFolder: (folderId: string, payload: { name?: string; parent_id?: string | null }) =>
    request<Folder>(`/folders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteFolder: (folderId: string) =>
    request<void>(`/folders/${folderId}`, {
      method: "DELETE",
    }),
  documents: (folderId?: string | null) => {
    const query = folderId ? `?folder_id=${folderId}` : "?root_only=true";
    return request<ArchiveDocument[]>(`/documents${query}`);
  },
  document: (documentId: string) => request<ArchiveDocument>(`/documents/${documentId}`),
  deleteDocument: (documentId: string) =>
    request<void>(`/documents/${documentId}`, {
      method: "DELETE",
    }),
  uploadDocument: (folderId: string | null, file: File) => {
    const form = new FormData();
    if (folderId) form.append("folder_id", folderId);
    form.append("file", file);
    return request<ArchiveDocument>("/documents/upload", {
      method: "POST",
      body: form,
    });
  },
  keywordSearch: (query: string, folderId?: string | null) =>
    request<SearchResult[]>("/search/keyword", {
      method: "POST",
      body: JSON.stringify({ query, folder_id: folderId, root_only: false, limit: 25 }),
    }),
  semanticSearch: (query: string, folderId?: string | null) =>
    request<SearchResult[]>("/search/semantic", {
      method: "POST",
      body: JSON.stringify({ query, folder_id: folderId, root_only: false, limit: 25 }),
    }),
  runAction: (
    action: "summarize" | "draft" | "report" | "rewrite-style" | "merge-documents",
    payload: {
      folder_id: string;
      source_document_ids: string[];
      prompt: string;
      style?: string | null;
    },
  ) =>
    request<{ document: ArchiveDocument; output: string }>(`/ai-actions/${action}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  lineage: (documentId: string) => request<Lineage>(`/ai-actions/${documentId}/lineage`),
  downloadUrl: (documentId: string) => `${API_V1}/documents/${documentId}/download`,
  viewUrl: (documentId: string) => `${API_V1}/documents/${documentId}/view`,
};
