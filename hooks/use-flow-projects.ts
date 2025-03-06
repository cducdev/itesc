import { useState, useEffect, useCallback } from "react";
import type { Node, Edge, Viewport } from "@xyflow/react";

const isClient = typeof window !== "undefined";
const LOCAL_STORAGE_KEY = "IT-ESC-flow-projects";
const CURRENT_PROJECT_KEY = "IT-ESC-current-project";

export interface FlowProject {
	id: string;
	name: string;
	nodes: Node[];
	edges: Edge[];
	query: string;
	selectedReports: string[];
	viewport?: Viewport;
	createdAt: number;
	updatedAt: number;
}

export interface StorageInfo {
	totalSize: number;
	projectCount: number;
	limit: number;
}

// Helper function to safely parse JSON
const safeJSONParse = (str: string | null, fallback: any = null) => {
	if (!str) return fallback;
	try {
		return JSON.parse(str);
	} catch (e) {
		console.error("Error parsing JSON:", e);
		return fallback;
	}
};

export const useFlowProjects = () => {
	const [projects, setProjects] = useState<FlowProject[]>([]);
	const [currentProject, setCurrentProject] = useState<FlowProject | null>(
		null
	);
	const [storageInfo, setStorageInfo] = useState<StorageInfo>({
		totalSize: 0,
		projectCount: 0,
		limit: 5 * 1024 * 1024, // 5MB limit
	});

	// Load projects from localStorage on mount
	useEffect(() => {
		if (!isClient) return;

		const savedProjects = safeJSONParse(
			localStorage.getItem(LOCAL_STORAGE_KEY),
			[]
		);
		const currentProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);

		setProjects(savedProjects);
		if (currentProjectId) {
			const current = savedProjects.find(
				(p: FlowProject) => p.id === currentProjectId
			);
			if (current) setCurrentProject(current);
		}
	}, []);

	// Save projects to localStorage whenever they change
	useEffect(() => {
		if (!isClient) return;
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
	}, [projects]);

	// Save current project ID to localStorage whenever it changes
	useEffect(() => {
		if (!isClient) return;
		if (currentProject) {
			localStorage.setItem(CURRENT_PROJECT_KEY, currentProject.id);
		} else {
			localStorage.removeItem(CURRENT_PROJECT_KEY);
		}
	}, [currentProject]);

	// Calculate storage info
	const refreshStorageInfo = useCallback(() => {
		if (!isClient) return;

		const projectsStr = JSON.stringify(projects);
		setStorageInfo({
			totalSize: new Blob([projectsStr]).size,
			projectCount: projects.length,
			limit: 5 * 1024 * 1024,
		});
	}, [projects]);

	useEffect(() => {
		refreshStorageInfo();
	}, [refreshStorageInfo]);

	// Project management functions
	const createProject = useCallback((name: string): FlowProject => {
		const newProject: FlowProject = {
			id: `project-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`,
			name,
			nodes: [],
			edges: [],
			query: "",
			selectedReports: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setProjects((prev) => [...prev, newProject]);
		setCurrentProject(newProject);
		return newProject;
	}, []);

	const updateCurrentProject = useCallback(
		(updates: Partial<FlowProject>) => {
			if (!currentProject) return;

			const updatedProject = {
				...currentProject,
				...updates,
				updatedAt: Date.now(),
			};

			setProjects((prev) =>
				prev.map((p) =>
					p.id === currentProject.id ? updatedProject : p
				)
			);
			setCurrentProject(updatedProject);
		},
		[currentProject]
	);

	const deleteProject = useCallback(
		(id: string) => {
			setProjects((prev) => prev.filter((p) => p.id !== id));
			if (currentProject?.id === id) {
				setCurrentProject(null);
			}
		},
		[currentProject]
	);

	// Export/Import functions
	const exportProjects = useCallback(() => {
		const data = JSON.stringify(projects);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `flow-projects-${new Date().toISOString()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [projects]);

	const importProjects = useCallback((importedProjects: FlowProject[]) => {
		setProjects((prev) => {
			const merged = [...prev];
			importedProjects.forEach((imported) => {
				const existingIndex = merged.findIndex(
					(p) => p.id === imported.id
				);
				if (existingIndex >= 0) {
					merged[existingIndex] = imported;
				} else {
					merged.push(imported);
				}
			});
			return merged;
		});
	}, []);

	// Simple save function that directly updates localStorage
	const simpleSave = useCallback(
		(
			nodes: Node[],
			edges: Edge[],
			query: string,
			selectedReports: string[] = []
		) => {
			if (!currentProject || !isClient) return;

			const updatedProject = {
				...currentProject,
				nodes,
				edges,
				query,
				selectedReports,
				updatedAt: Date.now(),
			};

			localStorage.setItem(
				LOCAL_STORAGE_KEY,
				JSON.stringify(
					projects.map((p) =>
						p.id === currentProject.id ? updatedProject : p
					)
				)
			);

			setCurrentProject(updatedProject);
		},
		[currentProject, projects]
	);

	// Save current state to project
	const saveCurrentState = useCallback(
		(
			nodes: Node[],
			edges: Edge[],
			query: string,
			selectedReports: string[] = []
		) => {
			if (!currentProject) return;

			updateCurrentProject({
				nodes,
				edges,
				query,
				selectedReports,
			});
		},
		[currentProject, updateCurrentProject]
	);

	return {
		projects,
		currentProject,
		setCurrentProject,
		createProject,
		updateCurrentProject,
		deleteProject,
		exportProjects,
		importProjects,
		storageInfo,
		refreshStorageInfo,
		simpleSave,
		saveCurrentState,
	};
};
