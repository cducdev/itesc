import { useState, useRef } from "react";
import { Download, Upload, Info, Database } from "lucide-react";
import type { FlowProject } from "@/hooks/use-flow-projects";
import type { StorageInfo } from "@/hooks/use-flow-projects";
import { Button } from "@/components/ui/button";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface ProjectActionsProps {
	exportProjects: () => void;
	importProjects: (projects: FlowProject[]) => void;
	storageInfo: StorageInfo;
	refreshStorageInfo: () => void;
}

export function ProjectActions({
	exportProjects,
	importProjects,
	storageInfo,
	refreshStorageInfo,
}: ProjectActionsProps) {
	const [isStorageInfoOpen, setIsStorageInfoOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { toast } = useToast();

	const handleExport = () => {
		try {
			exportProjects();
			toast({
				title: "Projects exported",
				description: "Your projects have been exported successfully.",
			});
		} catch (error) {
			console.error("Export error:", error);
			toast({
				title: "Export failed",
				description: "There was an error exporting your projects.",
				variant: "destructive",
			});
		}
	};

	const handleImportClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const jsonData = event.target?.result as string;
				const projects = JSON.parse(jsonData) as FlowProject[];
				importProjects(projects);
				toast({
					title: "Projects imported",
					description:
						"Your projects have been imported successfully.",
				});
				refreshStorageInfo();
			} catch (error) {
				console.error("Import error:", error);
				toast({
					title: "Import failed",
					description: "The file format is invalid or corrupted.",
					variant: "destructive",
				});
			}
		};

		reader.readAsText(file);

		// Reset the input so the same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const getStorageStatusColor = (size: number, limit: number) => {
		const percent = (size / limit) * 100;
		if (percent < 50) return "bg-green-500";
		if (percent < 80) return "bg-yellow-500";
		return "bg-red-500";
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	return (
		<>
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleFileChange}
				accept=".json"
				className="hidden"
			/>

			<TooltipProvider>
				<DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-9 w-9"
								>
									<Database className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent>
							<p>Project Data & Storage</p>
						</TooltipContent>
					</Tooltip>

					<DropdownMenuContent align="end" className="w-56">
						<div className="px-2 py-1.5 text-sm font-medium text-gray-500">
							Storage & Backup
						</div>
						<DropdownMenuSeparator />

						<div className="px-3 py-2">
							<div className="text-xs text-gray-500 mb-1 flex justify-between">
								<span>Storage Usage</span>
								<span>
									{formatBytes(storageInfo.totalSize)} /{" "}
									{formatBytes(storageInfo.limit)}
								</span>
							</div>
							<div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
								<div
									className={`h-full ${getStorageStatusColor(
										storageInfo.totalSize,
										storageInfo.limit
									)}`}
									style={{
										width: `${Math.min(
											100,
											(storageInfo.totalSize /
												storageInfo.limit) *
												100
										)}%`,
									}}
								/>
							</div>
						</div>

						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={handleExport}
							className="gap-2"
						>
							<Download className="h-4 w-4" />
							<div>
								<div className="text-sm">Export Projects</div>
								<div className="text-xs text-gray-500">
									Backup your projects as JSON
								</div>
							</div>
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleImportClick}
							className="gap-2"
						>
							<Upload className="h-4 w-4" />
							<div>
								<div className="text-sm">Import Projects</div>
								<div className="text-xs text-gray-500">
									Restore from backup
								</div>
							</div>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => setIsStorageInfoOpen(true)}
							className="gap-2"
						>
							<Info className="h-4 w-4" />
							<div className="text-sm">Storage Details</div>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</TooltipProvider>

			<Dialog
				open={isStorageInfoOpen}
				onOpenChange={setIsStorageInfoOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Storage Information</DialogTitle>
						<DialogDescription>
							Your research projects are stored in your
							browser&apos;s localStorage
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-4">
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Total Size:</span>
								<span>
									{formatBytes(storageInfo.totalSize)}
								</span>
							</div>
							<div className="flex justify-between text-sm mb-1">
								<span>Project Count:</span>
								<span>{storageInfo.projectCount}</span>
							</div>
							<div className="flex justify-between text-sm mb-1">
								<span>Storage Limit:</span>
								<span>{formatBytes(storageInfo.limit)}</span>
							</div>
						</div>

						<div className="text-sm space-y-2">
							<p>
								<strong>Note:</strong> localStorage has a limit
								of approximately 5MB per domain. Data is stored
								only in this browser and will be lost if you
								clear browser data.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button onClick={() => setIsStorageInfoOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
