import type { Project, ProfileModel } from "@/types/project";
import { fetchWithTimeout } from "@/lib/fetch";

const API_BASE = "/api/projects";

interface ProjectRow {
  id: string;
  user_id: string;
  profile: ProfileModel;
  snapshot: Project["snapshot"];
  ai_diagnosis: Project["aiDiagnosis"];
  token_metrics: Project["tokenMetrics"];
  checklist: Project["checklist"];
  created_at: string;
  updated_at: string;
}

function mapRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    profile: row.profile,
    snapshot: row.snapshot ?? undefined,
    aiDiagnosis: row.ai_diagnosis ?? undefined,
    tokenMetrics: row.token_metrics ?? undefined,
    checklist: row.checklist ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function getUserProjects(wallet: string): Promise<Project[]> {
  try {
    const resp = await fetchWithTimeout(
      `${API_BASE}/list?wallet=${encodeURIComponent(wallet)}`
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.projects || []).map(mapRowToProject);
  } catch (err) {
    console.warn("[projectService] getUserProjects failed:", err);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const resp = await fetchWithTimeout(
      `${API_BASE}/get?id=${encodeURIComponent(id)}`
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.project ? mapRowToProject(json.project) : null;
  } catch (err) {
    console.warn("[projectService] getProject failed:", err);
    return null;
  }
}

export async function createProject(
  wallet: string,
  profile: ProfileModel,
  snapshot?: Project["snapshot"],
  aiDiagnosis?: Project["aiDiagnosis"]
): Promise<Project> {
  const resp = await fetchWithTimeout(`${API_BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, profile, snapshot, aiDiagnosis }),
  });
  if (!resp.ok) throw new Error(`Create project failed: ${resp.status}`);
  const json = await resp.json();
  return mapRowToProject(json.project);
}

export async function deleteProject(id: string, wallet: string): Promise<void> {
  const resp = await fetchWithTimeout(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, wallet }),
  });
  if (!resp.ok) throw new Error(`Delete project failed: ${resp.status}`);
}

export async function updateProject(
  id: string,
  wallet: string,
  updates: Record<string, unknown>
): Promise<Project> {
  const resp = await fetchWithTimeout(`${API_BASE}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, wallet, updates }),
  });
  if (!resp.ok) throw new Error(`Update project failed: ${resp.status}`);
  const json = await resp.json();
  return mapRowToProject(json.project);
}
