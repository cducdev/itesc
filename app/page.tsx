"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	Search,
	FileText,
	UploadIcon,
	Plus,
	X,
	ChevronDown,
	Brain,
	Loader2,
} from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult, RankingResult, Status, State } from "@/types";
import ReactMarkdown from "react-markdown";
import { CONFIG } from "@/lib/config";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { KnowledgeBaseSidebar } from "@/components/knowledge-base-sidebar";
import { ReportActions } from "@/components/report-actions";
import { ModelSelect, DEFAULT_MODEL } from "@/components/model-select";
import { handleLocalFile, SUPPORTED_FILE_TYPES } from "@/lib/file-upload";
import { CitationsFooter } from "@/components/citations-footer";
import TutorialPopup from "@/components/TutorialPopup";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import Image from "next/image";

const timeFilters = [
	{ value: "all", label: "Mọi thời điểm" },
	{ value: "24h", label: "24 giờ qua" },
	{ value: "week", label: "Tuần qua" },
	{ value: "month", label: "Tháng qua" },
	{ value: "year", label: "Năm qua" },
] as const;

const MAX_SELECTIONS = CONFIG.search.maxSelectableResults;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryWithBackoff = async <T,>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	baseDelay: number = 1000
): Promise<T> => {
	let lastError: any;
	for (let i = 0; i < maxRetries; i++) {
		try {
			console.log(`Retry attempt: ${i}`);
			return await operation();
		} catch (error) {
			lastError = error;
			if (error instanceof Error && error.message.includes("429")) {
				const delay = baseDelay * Math.pow(2, i);
				console.log(`Rate limited, retrying in ${delay}ms...`);
				await sleep(delay);
				continue;
			}
			throw error;
		}
	}
	throw lastError;
};

export default function Home() {
	// Consolidated state management
	const [state, setState] = useState<State>({
		query: "",
		timeFilter: "all",
		results: [],
		selectedResults: [],
		reportPrompt: "",
		report: null,
		error: null,
		newUrl: "",
		isSourcesOpen: false,
		selectedModel: DEFAULT_MODEL,
		isAgentMode: true,
		sidebarOpen: false,
		activeTab: "search",
		status: {
			loading: false,
			generatingReport: false,
			agentStep: "idle",
			fetchStatus: {
				total: 0,
				successful: 0,
				fallback: 0,
				sourceStatuses: {},
			},
			agentInsights: [],
			searchQueries: [],
		},
		showTutorial: false,
		selectedLanguage: "en",
	});

	const { toast } = useToast();

	// Add form ref
	const formRef = useRef<HTMLFormElement>(null);

	// Memoized state update functions
	const updateState = useCallback((updates: Partial<State>) => {
		setState((prev) => ({ ...prev, ...updates }));
	}, []);

	const updateStatus = useCallback(
		(updates: Partial<Status> | ((prev: Status) => Status)) => {
			setState((prev) => {
				const newStatus =
					typeof updates === "function"
						? updates(prev.status)
						: { ...prev.status, ...updates };
				return { ...prev, status: newStatus };
			});
		},
		[]
	);

	// Memoized error handler
	const handleError = useCallback(
		(error: unknown, context: string) => {
			let message = "Đã xảy ra lỗi không mong muốn";

			if (error instanceof Error) {
				message = error.message;
			} else if (error instanceof Response) {
				// Handle Response objects from fetch
				message = `Lỗi máy chủ: ${error.status}`;
			} else if (
				typeof error === "object" &&
				error !== null &&
				"error" in error
			) {
				// Handle error objects with error message
				message = (error as { error: string }).error;
			} else if (typeof error === "string") {
				message = error;
			}

			updateState({ error: message });
			toast({
				title: context,
				description: message,
				variant: "destructive",
				duration: 5000,
			});
		},
		[toast, updateState]
	);

	// Memoized content fetcher with proper type handling
	const fetchContent = useCallback(async (url: string) => {
		try {
			const response = await fetch("/api/fetch-content", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url }),
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ error: "Không thể tải nội dung" }));
				throw new Error(
					errorData.error ||
						`Không thể tải nội dung: ${response.status}`
				);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			if (error instanceof Error && error.message.includes("429"))
				throw error;
			console.error("Content fetch error:", error);
			throw error;
		}
	}, []);

	// Memoized result selection handler
	const handleResultSelect = useCallback((resultId: string) => {
		setState((prev: State) => {
			if (prev.selectedResults.includes(resultId)) {
				return {
					...prev,
					selectedResults: prev.selectedResults.filter(
						(id) => id !== resultId
					),
					reportPrompt:
						prev.selectedResults.length <= 1
							? ""
							: prev.reportPrompt,
				};
			}
			if (prev.selectedResults.length >= MAX_SELECTIONS) return prev;

			const newSelectedResults = [...prev.selectedResults, resultId];
			let newReportPrompt = prev.reportPrompt;

			if (
				!prev.isAgentMode &&
				newSelectedResults.length === 1 &&
				!prev.reportPrompt
			) {
				const result = prev.results.find((r) => r.id === resultId);
				if (result) {
					newReportPrompt = `Analyze and summarize the key points from ${result.name}`;
				}
			}

			return {
				...prev,
				selectedResults: newSelectedResults,
				reportPrompt: newReportPrompt,
			};
		});
	}, []);

	// Memoized search handler
	const handleSearch = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!state.query.trim()) return;

			const isGeneratingReport =
				state.selectedResults.length > 0 && !state.isAgentMode;

			if (isGeneratingReport) {
				updateStatus({ generatingReport: true });
				updateState({ error: null });
				const initialFetchStatus: Status["fetchStatus"] = {
					total: state.selectedResults.length,
					successful: 0,
					fallback: 0,
					sourceStatuses: {},
				};
				updateStatus({ fetchStatus: initialFetchStatus });

				try {
					const contentResults = await Promise.all(
						state.results
							.filter((r) => state.selectedResults.includes(r.id))
							.map(async (article) => {
								// If the article already has content (e.g. from file upload), use it directly
								if (article.content) {
									updateStatus((prev: Status) => ({
										...prev,
										fetchStatus: {
											...prev.fetchStatus,
											successful:
												prev.fetchStatus.successful + 1,
											sourceStatuses: {
												...prev.fetchStatus
													.sourceStatuses,
												[article.url]:
													"fetched" as const,
											},
										},
									}));
									return {
										url: article.url,
										title: article.name,
										content: article.content,
									};
								}

								try {
									const { content } = await fetchContent(
										article.url
									);
									if (content) {
										updateStatus((prev: Status) => ({
											...prev,
											fetchStatus: {
												...prev.fetchStatus,
												successful:
													prev.fetchStatus
														.successful + 1,
												sourceStatuses: {
													...prev.fetchStatus
														.sourceStatuses,
													[article.url]:
														"fetched" as const,
												},
											},
										}));
										return {
											url: article.url,
											title: article.name,
											content,
										};
									}
								} catch (error) {
									if (
										error instanceof Error &&
										error.message.includes("429")
									)
										throw error;
									console.error(
										"Content fetch error for article:",
										article.url,
										error
									);
								}
								updateStatus((prev: Status) => ({
									...prev,
									fetchStatus: {
										...prev.fetchStatus,
										fallback: prev.fetchStatus.fallback + 1,
										sourceStatuses: {
											...prev.fetchStatus.sourceStatuses,
											[article.url]: "preview" as const,
										},
									},
								}));
								return {
									url: article.url,
									title: article.name,
									content: article.snippet,
								};
							})
					);

					const response = await retryWithBackoff(async () => {
						const res = await fetch("/api/report", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								selectedResults: contentResults.filter((r) =>
									r.content?.trim()
								),
								sources: state.results.filter((r) =>
									state.selectedResults.includes(r.id)
								),
								prompt: `${state.query}. Provide comprehensive analysis.`,
								platformModel: state.selectedModel,
							}),
						});

						if (!res.ok) {
							const errorData = await res.json().catch(() => ({
								error: "Failed to generate report",
							}));
							throw new Error(
								errorData.error ||
									`Failed to generate report: ${res.status}`
							);
						}

						return res.json();
					});

					updateState({
						report: response,
						activeTab: "report",
					});
				} catch (error) {
					handleError(error, "Report Generation Failed");
				} finally {
					updateStatus({ generatingReport: false });
				}
				return;
			}

			updateStatus({ loading: true });
			updateState({ error: null, reportPrompt: "" });

			try {
				const response = await retryWithBackoff(async () => {
					const res = await fetch("/api/search", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query: state.query,
							timeFilter: state.timeFilter,
						}),
					});

					if (!res.ok) {
						const errorData = await res
							.json()
							.catch(() => ({ error: "Search failed" }));
						throw new Error(
							errorData.error || `Search failed: ${res.status}`
						);
					}

					return res.json();
				});

				const newResults = (response.webPages?.value || []).map(
					(result: SearchResult) => ({
						...result,
						id: `search-${Date.now()}-${result.id || result.url}`,
					})
				);

				setState((prev) => ({
					...prev,
					results: [
						...prev.results.filter(
							(r) =>
								r.isCustomUrl ||
								prev.selectedResults.includes(r.id)
						),
						...newResults.filter(
							(newResult: SearchResult) =>
								!prev.results.some(
									(existing) => existing.url === newResult.url
								)
						),
					],
					error: null,
				}));
			} catch (error) {
				handleError(error, "Search Error");
			} finally {
				updateStatus({ loading: false });
			}
		},
		[
			state.query,
			state.timeFilter,
			state.selectedResults,
			state.selectedModel,
			state.results,
			state.isAgentMode,
			fetchContent,
			handleError,
			updateStatus,
			updateState,
		]
	);

	// Add effect to handle form submission after query update
	useEffect(() => {
		if (
			state.query === state.reportPrompt &&
			state.reportPrompt &&
			state.selectedResults.length > 0
		) {
			if (formRef.current) {
				formRef.current.dispatchEvent(
					new Event("submit", { cancelable: true, bubbles: true })
				);
			}
		}
	}, [state.query, state.reportPrompt, state.selectedResults.length]);

	const generateReport = useCallback(() => {
		if (!state.reportPrompt.trim() || state.status.generatingReport) return;

		updateStatus({ generatingReport: true });
		updateState({ error: null });

		fetch("/api/report", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				selectedResults: state.results.filter((r) =>
					state.selectedResults.includes(r.id)
				),
				sources: state.results.filter((r) =>
					state.selectedResults.includes(r.id)
				),
				prompt: state.reportPrompt,
				platformModel: state.selectedModel,
				language: state.selectedLanguage,
			}),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.error) {
					throw new Error(data.error);
				}
				// Đảm bảo rằng mỗi section có trường images
				const reportWithImages = {
					...data,
					sections: data.sections.map((section: any) => ({
						...section,
						images: section.images || [],
					})),
				};
				updateState({
					report: reportWithImages,
					activeTab: "report",
				});
			})
			.catch((error) => {
				handleError(error, "Report Generation Failed");
			})
			.finally(() => {
				updateStatus({ generatingReport: false });
			});
	}, [
		state.reportPrompt,
		state.status.generatingReport,
		state.results,
		state.selectedResults,
		state.selectedModel,
		state.selectedLanguage,
		updateState,
		updateStatus,
		handleError,
	]);

	// Memoized agent search handler
	const handleAgentSearch = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!state.reportPrompt.trim()) {
				toast({
					title: "Thiếu thông tin",
					description: "Vui lòng cung cấp chủ đề nghiên cứu",
					variant: "destructive",
				});
				return;
			}

			updateStatus({
				agentStep: "processing",
				agentInsights: [],
				searchQueries: [],
			});
			updateState({
				error: null,
				results: [],
				selectedResults: [],
				report: null,
			});

			try {
				// Step 1: Get optimized query and research prompt
				const {
					query,
					optimizedPrompt,
					explanation,
					suggestedStructure,
				} = await retryWithBackoff(async () => {
					const response = await fetch("/api/optimize-research", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							prompt: state.reportPrompt,
							platformModel: state.selectedModel,
						}),
					});
					if (!response.ok) {
						throw new Error(
							`Không thể tối ưu hoá nghiên cứu: ${response.status} ${response.statusText}`
						);
					}
					return response.json();
				});

				// Update the query state to show optimized query
				updateState({ query: query });

				updateStatus((prev: Status) => ({
					...prev,
					searchQueries: [query],
					agentInsights: [
						...prev.agentInsights,
						`Research strategy: ${explanation}`,
						...(Array.isArray(suggestedStructure)
							? [
									`Suggested structure: ${suggestedStructure.join(
										" → "
									)}`,
							  ]
							: []),
					],
				}));

				// Step 2: Perform search with optimized query
				updateStatus({ agentStep: "searching" });
				console.log("Performing search with optimized query:", query);

				const searchResponse = await retryWithBackoff(async () => {
					const response = await fetch("/api/search", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query,
							timeFilter: state.timeFilter,
							isTestQuery: query.toLowerCase() === "test",
						}),
					});
					if (!response.ok) {
						const errorData = await response.json().catch(() => ({
							error: "Could not parse error response",
						}));
						console.error("Search failed:", {
							status: response.status,
							query,
							error: errorData,
						});
						if (response.status === 429) {
							throw new Error("Rate limit exceeded");
						}
						if (response.status === 403) {
							throw new Error(
								"Hạn ngạch tìm kiếm đã hết. Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
							);
						}
						throw new Error("Tìm kiếm thất bại");
					}
					const searchResponse = await response.json();
					const searchResults = searchResponse.webPages;
					if (!searchResults || searchResults.length === 0) {
						console.log("AAAA");
						throw new Error(
							"Không tìm thấy kết quả. Vui lòng thử từ khoá khác."
						);
					}
					return searchResponse;
				});

				const searchResults = searchResponse.webPages?.value || [];
				if (searchResults.length === 0) {
					throw new Error(
						"Không tìm thấy kết quả. Vui lòng thử từ khoá khác."
					);
				}

				// Process results
				const timestamp = Date.now();
				const allResults = searchResults.map(
					(result: SearchResult, idx: number) => ({
						...result,
						id: `search-${timestamp}-${idx}-${result.url}`,
						score: 0,
					})
				);

				// Step 3: Analyze and rank results
				updateStatus({ agentStep: "analyzing" });
				const { rankings, analysis } = await retryWithBackoff(
					async () => {
						const response = await fetch("/api/analyze-results", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								prompt: optimizedPrompt,
								results: allResults.map((r: SearchResult) => ({
									title: r.name,
									snippet: r.snippet,
									url: r.url,
									content: r.content,
								})),
								isTestQuery: query.toLowerCase() === "test",
								platformModel: state.selectedModel,
							}),
						});
						if (!response.ok) {
							throw new Error(
								`Failed to analyze results: ${response.status} ${response.statusText}`
							);
						}
						return response.json();
					}
				);

				const rankedResults = allResults
					.map((result: SearchResult) => ({
						...result,
						score:
							rankings.find(
								(r: RankingResult) => r.url === result.url
							)?.score || 0,
					}))
					.sort(
						(a: SearchResult, b: SearchResult) =>
							(b.score || 0) - (a.score || 0)
					);

				if (rankedResults.every((r: SearchResult) => r.score === 0)) {
					throw new Error(
						"Không tìm thấy đủ nguồn đa dạng, chất lượng cao. Vui lòng thử từ khoá khác."
					);
				}

				updateStatus((prev: Status) => ({
					...prev,
					agentInsights: [
						...prev.agentInsights,
						`Analysis: ${analysis}`,
						`Found ${rankedResults.length} relevant results`,
					],
				}));

				// Select top results with diversity heuristic
				const selectedUrls = new Set<string>();
				const selected = rankedResults.filter(
					(result: SearchResult) => {
						if (
							selectedUrls.size >=
							CONFIG.search.maxSelectableResults
						)
							return false;
						const domain = new URL(result.url).hostname;
						const hasSimilar = Array.from(selectedUrls).some(
							(url) => new URL(url).hostname === domain
						);
						if (!hasSimilar && result.score && result.score > 0.5) {
							selectedUrls.add(result.url);
							return true;
						}
						return false;
					}
				);

				if (selected.length === 0) {
					throw new Error(
						"Không tìm thấy đủ nguồn đa dạng, chất lượng cao. Vui lòng thử từ khoá khác."
					);
				}

				updateState({
					results: rankedResults,
					selectedResults: selected.map((r: SearchResult) => r.id),
				});

				updateStatus((prev: Status) => ({
					...prev,
					agentInsights: [
						...prev.agentInsights,
						`Selected ${selected.length} diverse sources from ${
							new Set(
								selected.map(
									(s: SearchResult) => new URL(s.url).hostname
								)
							).size
						} unique domains`,
					],
				}));

				// Step 4: Generate report
				updateStatus({ agentStep: "generating" });
				const initialFetchStatus: Status["fetchStatus"] = {
					total: selected.length,
					successful: 0,
					fallback: 0,
					sourceStatuses: {},
				};
				updateStatus({ fetchStatus: initialFetchStatus });

				const contentResults = await Promise.all(
					selected.map(async (article: SearchResult) => {
						// If the article already has content (e.g. from file upload), use it directly
						if (article.content) {
							updateStatus((prev: Status) => ({
								...prev,
								fetchStatus: {
									...prev.fetchStatus,
									successful: prev.fetchStatus.successful + 1,
									sourceStatuses: {
										...prev.fetchStatus.sourceStatuses,
										[article.url]: "fetched" as const,
									},
								},
							}));
							return {
								url: article.url,
								title: article.name,
								content: article.content,
							};
						}

						try {
							const { content } = await fetchContent(article.url);
							if (content) {
								updateStatus((prev: Status) => ({
									...prev,
									fetchStatus: {
										...prev.fetchStatus,
										successful:
											prev.fetchStatus.successful + 1,
										sourceStatuses: {
											...prev.fetchStatus.sourceStatuses,
											[article.url]: "fetched" as const,
										},
									},
								}));
								return {
									url: article.url,
									title: article.name,
									content,
								};
							}
						} catch (error) {
							if (
								error instanceof Error &&
								error.message.includes("429")
							)
								throw error;
						}
						updateStatus((prev: Status) => ({
							...prev,
							fetchStatus: {
								...prev.fetchStatus,
								fallback: prev.fetchStatus.fallback + 1,
								sourceStatuses: {
									...prev.fetchStatus.sourceStatuses,
									[article.url]: "preview" as const,
								},
							},
						}));
						return {
							url: article.url,
							title: article.name,
							content: article.snippet,
						};
					})
				);

				const reportResponse = await retryWithBackoff(() =>
					fetch("/api/report", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							selectedResults: contentResults.filter((r) =>
								r.content?.trim()
							),
							sources: selected,
							prompt: `${optimizedPrompt}. Provide comprehensive analysis.`,
							platformModel: state.selectedModel,
							language: state.selectedLanguage,
						}),
					}).then((res) => res.json())
				);

				updateState({
					report: reportResponse,
					activeTab: "report",
				});

				updateStatus((prev: Status) => ({
					...prev,
					agentInsights: [
						...prev.agentInsights,
						`Report generated successfully`,
					],
					agentStep: "idle",
				}));
			} catch (error) {
				handleError(error, "Agent Error");
			}
		},
		[
			state.reportPrompt,
			state.timeFilter,
			generateReport,
			handleError,
			updateState,
			updateStatus,
			fetchContent,
			state.selectedModel,
			toast,
			state.selectedLanguage,
		]
	);

	// Memoized utility functions
	const handleAddCustomUrl = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (!state.newUrl.trim()) return;

			try {
				new URL(state.newUrl); // Validate URL format
				if (!state.results.some((r) => r.url === state.newUrl)) {
					const timestamp = Date.now();
					const newResult: SearchResult = {
						id: `custom-${timestamp}-${state.newUrl}`,
						url: state.newUrl,
						name: "Custom URL",
						snippet: "Custom URL added by user",
						isCustomUrl: true,
					};
					setState((prev: State) => ({
						...prev,
						results: [newResult, ...prev.results],
						newUrl: "",
					}));
				}
			} catch {
				handleError("Please enter a valid URL", "Invalid URL");
			}
		},
		[state.newUrl, state.results, handleError]
	);

	const handleRemoveResult = useCallback((resultId: string) => {
		setState((prev: State) => ({
			...prev,
			results: prev.results.filter((r) => r.id !== resultId),
			selectedResults: prev.selectedResults.filter(
				(id) => id !== resultId
			),
		}));
	}, []);

	// Add file upload handler
	const handleFileUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const result = await handleLocalFile(
				file,
				(loading) => {
					updateState({ error: null });
					updateStatus({ loading });
				},
				(error, context) => {
					toast({
						title: context,
						description:
							error instanceof Error
								? error.message
								: String(error),
						variant: "destructive",
					});
					updateState({
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			);

			if (result) {
				setState((prev: State) => ({
					...prev,
					results: [result, ...prev.results],
				}));
			}

			// Reset the file input
			e.target.value = "";
		},
		[setState, updateState, updateStatus, toast]
	);

	return (
		<div className="min-h-screen bg-[#c78b8b] p-4 sm:p-8">
			<div className="fixed inset-x-0 top-0 bg-black border-b border-gray-800 p-4 flex items-center justify-between z-50">
				<div className="flex items-center gap-2">
					<Image
						src="/apple-icon.png"
						alt="IT-ESC"
						width={32}
						height={32}
						className="h-8 w-8 rounded-full"
					/>
					<span className="text-2xl font-bold text-white">
						IT-ESC
					</span>
				</div>
				<Button
					asChild
					variant="default"
					size="sm"
					className="whitespace-nowrap bg-blue-600 hover:bg-blue-700"
				>
					<a href="/flow">Flow Page</a>
				</Button>
			</div>
			<div className="pt-20">
				<KnowledgeBaseSidebar
					open={state.sidebarOpen}
					onOpenChange={(open) => updateState({ sidebarOpen: open })}
				/>
				<main className="max-w-4xl mx-auto space-y-8">
					<div className="container mx-auto p-4 min-h-screen flex flex-col">
						<TutorialPopup
							isOpen={state.showTutorial}
							onClose={() => updateState({ showTutorial: false })}
						/>

						<div className="mb-3">
							<h1 className="mb-2 text-center text-white flex items-center justify-center gap-2">
								<Image
									src="/apple-icon.png"
									alt="IT-ESC"
									width={24}
									height={24}
									className="h-6 w-6 sm:h-8 sm:w-8 rounded-full"
								/>
								<span className="text-xl sm:text-3xl font-bold font-heading">
									IT-ESC
								</span>
							</h1>
							<div className="text-center space-y-3 mb-8">
								<p className="text-white">
									Lets research with IT-ESC
								</p>
								<div className="flex flex-wrap justify-center items-center gap-2">
									<Button
										variant="default"
										size="sm"
										onClick={() =>
											updateState({ sidebarOpen: true })
										}
										className="inline-flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-full"
									>
										<Brain className="h-4 w-4" />
										Knowledge Base
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											updateState({ showTutorial: true })
										}
										className="inline-flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-full bg-blue-600 hover:bg-blue-700 text-white"
									>
										<QuestionMarkCircledIcon className="h-4 w-4" />
										Hướng dẫn sử dụng
									</Button>
								</div>
								<div className="flex justify-center items-center">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="agent-mode"
											checked={state.isAgentMode}
											className="w-4 h-4"
											onCheckedChange={(checked) =>
												updateState({
													isAgentMode:
														checked as boolean,
												})
											}
										/>
										<label
											htmlFor="agent-mode"
											className="text-xs sm:text-sm font-medium leading-none text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											Agent Mode (Tự động tìm kiếm và tổng
											hợp báo cáo)
										</label>
									</div>
								</div>
							</div>
							{state.status.agentStep !== "idle" && (
								<div className="mb-4 p-4 bg-black rounded-lg">
									<div className="flex items-center gap-3 mb-3">
										<Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
										<h3 className="font-semibold text-blue-400">
											Agent Progress
										</h3>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-2 text-sm">
											<span className="font-medium text-blue-400">
												Bước hiện tại:
											</span>
											<span className="capitalize text-blue-400">
												{state.status.agentStep}
											</span>
										</div>

										{state.status.agentInsights.length >
											0 && (
											<Collapsible>
												<CollapsibleTrigger className="text-sm text-blue-400 hover:underline flex items-center gap-1">
													Hiển thị chi tiết nghiên cứu{" "}
													<ChevronDown className="h-4 w-4" />
												</CollapsibleTrigger>
												<CollapsibleContent className="mt-2 space-y-2 text-sm text-white">
													{state.status.agentInsights.map(
														(insight, idx) => (
															<div
																key={idx}
																className="flex gap-2"
															>
																<span className="text-white">
																	•
																</span>
																{insight}
															</div>
														)
													)}
												</CollapsibleContent>
											</Collapsible>
										)}
									</div>
								</div>
							)}
							<form
								ref={formRef}
								onSubmit={
									state.isAgentMode
										? handleAgentSearch
										: handleSearch
								}
								className="space-y-4"
							>
								{!state.isAgentMode ? (
									<>
										<div className="flex flex-col sm:flex-row gap-2">
											<div className="relative flex-1">
												<Input
													type="text"
													value={state.query}
													onChange={(e) =>
														updateState({
															query: e.target
																.value,
														})
													}
													placeholder="Nhập từ khoá tìm kiếm..."
													className="pr-8 bg-black text-white placeholder-white"
												/>
												<Search className="absolute right-2 top-2 h-5 w-5 text-white" />
											</div>

											<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
												<div className="flex gap-2 w-full sm:w-auto">
													<Select
														value={state.timeFilter}
														onValueChange={(
															value
														) =>
															updateState({
																timeFilter:
																	value,
															})
														}
													>
														<SelectTrigger className="flex-1 sm:flex-initial sm:w-[140px] bg-black text-white border-0">
															<SelectValue placeholder="Chọn khoảng thời gian" />
														</SelectTrigger>
														<SelectContent className="bg-black text-white border-0">
															{timeFilters.map(
																(filter) => (
																	<SelectItem
																		key={
																			filter.value
																		}
																		value={
																			filter.value
																		}
																		className="text-white hover:bg-gray-800"
																	>
																		{
																			filter.label
																		}
																	</SelectItem>
																)
															)}
														</SelectContent>
													</Select>

													<ModelSelect
														value={
															state.selectedModel
														}
														onValueChange={(
															value
														) =>
															updateState({
																selectedModel:
																	value,
															})
														}
														triggerClassName="flex-1 sm:flex-initial sm:w-[200px] bg-black text-white border-0"
													/>
												</div>

												<Button
													type="submit"
													disabled={
														state.status.loading
													}
													className="w-full sm:w-auto bg-black text-white hover:bg-gray-900"
												>
													{state.status.loading
														? "Đang tìm..."
														: "Tìm kiếm"}
												</Button>
											</div>
										</div>
										<div className="flex gap-2">
											<Input
												type="url"
												value={state.newUrl}
												onChange={(e) =>
													updateState({
														newUrl: e.target.value,
													})
												}
												placeholder="Thêm URL tuỳ chỉnh..."
												className="flex-1 bg-black text-white placeholder-white"
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														handleAddCustomUrl(e);
													}
												}}
											/>
											<Button
												type="button"
												variant="outline"
												onClick={handleAddCustomUrl}
												className="hidden sm:inline-flex items-center gap-2 bg-black text-white hover:bg-gray-900 border-0"
											>
												<Plus className="h-4 w-4" />
												Thêm URL
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={handleAddCustomUrl}
												className="sm:hidden bg-black text-white hover:bg-gray-900 border-0"
												size="icon"
											>
												<Plus className="h-4 w-4" />
											</Button>
											<div className="relative">
												<Input
													type="file"
													onChange={handleFileUpload}
													className="absolute inset-0 opacity-0 cursor-pointer"
													accept={
														SUPPORTED_FILE_TYPES
													}
												/>
												<Button
													type="button"
													variant="outline"
													className="hidden sm:inline-flex items-center gap-2 bg-black text-white hover:bg-gray-900 border-0"
												>
													<UploadIcon className="h-4 w-4" />
													Tải file lên
												</Button>
												<Button
													type="button"
													variant="outline"
													size="icon"
													className="sm:hidden bg-black text-white hover:bg-gray-900 border-0"
												>
													<UploadIcon className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</>
								) : (
									<div className="space-y-4 sm:space-y-6">
										<div className="relative w-full flex justify-center">
											<div className="w-full max-w-2xl relative">
												<Input
													value={
														state.query ||
														state.reportPrompt
													}
													onChange={(e) => {
														updateState({
															reportPrompt:
																e.target.value,
															query: "",
														});
													}}
													placeholder="Bạn muốn nghiên cứu về chủ đề gì? (Ví dụ: 'Tesla Q4 2024 financial performance and market impact')"
													className="pr-8 text-xl bg-black text-white placeholder-white w-full h-14"
												/>
												<Brain className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-white" />
											</div>
										</div>
										<div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-center">
											<div className="w-full sm:w-[200px]">
												<ModelSelect
													value={state.selectedModel}
													onValueChange={(value) =>
														updateState({
															selectedModel:
																value,
														})
													}
													triggerClassName="w-full sm:w-[200px] bg-black text-white border-0"
												/>
											</div>
											<Select
												value={state.selectedLanguage}
												onValueChange={(value) =>
													updateState({
														selectedLanguage:
															value as
																| "en"
																| "vi",
													})
												}
											>
												<SelectTrigger className="w-[180px] bg-black text-white">
													<SelectValue placeholder="Chọn ngôn ngữ" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="en">
														English (Ngôn ngữ phản
														hồi)
													</SelectItem>
													<SelectItem value="vi">
														Tiếng Việt (Ngôn ngữ
														phản hồi)
													</SelectItem>
												</SelectContent>
											</Select>
											<Button
												type="submit"
												disabled={
													state.status.agentStep !==
													"idle"
												}
												className="w-full sm:w-auto lg:w-[200px] bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
											>
												{state.status.agentStep !==
												"idle" ? (
													<span className="flex items-center gap-2">
														<Loader2 className="h-4 w-4 animate-spin" />
														{
															{
																processing:
																	"Đang lập kế hoạch...",
																searching:
																	"Đang tìm kiếm...",
																analyzing:
																	"Đang phân tích...",
																generating:
																	"Đang viết báo cáo...",
															}[
																state.status
																	.agentStep
															]
														}
													</span>
												) : (
													"Tìm kiếm"
												)}
											</Button>
										</div>
									</div>
								)}
							</form>
						</div>

						<Separator className="my-8" />

						{state.error && (
							<div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
								<div className="flex items-center gap-2 text-red-700">
									<div>
										<h3 className="font-semibold">Lỗi</h3>
										<p className="text-sm">{state.error}</p>
									</div>
								</div>
							</div>
						)}

						{state.results.length > 0 && (
							<Tabs
								value={state.activeTab}
								onValueChange={(value) =>
									updateState({ activeTab: value })
								}
								className="w-full"
							>
								<div className="mb-6 space-y-4">
									{state.selectedResults.length > 0 &&
										!state.isAgentMode && (
											<div className="flex flex-col sm:flex-row gap-2">
												<div className="relative flex-1">
													<Input
														value={
															state.reportPrompt
														}
														onChange={(e) =>
															updateState({
																reportPrompt:
																	e.target
																		.value,
															})
														}
														placeholder="Bạn muốn biết gì về những nguồn này? (Ví dụ: 'So sánh và phân tích các điểm chính')"
														className="pr-8 bg-black text-white placeholder-white"
													/>
													<FileText className="absolute right-2 top-2.5 h-5 w-5 text-white" />
												</div>
												<div className="flex gap-2">
													<Select
														value={
															state.selectedLanguage
														}
														onValueChange={(
															value
														) =>
															updateState({
																selectedLanguage:
																	value as
																		| "en"
																		| "vi",
															})
														}
													>
														<SelectTrigger className="w-[180px] bg-black text-white">
															<SelectValue placeholder="Chọn ngôn ngữ" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="en">
																English
															</SelectItem>
															<SelectItem value="vi">
																Tiếng Việt
															</SelectItem>
														</SelectContent>
													</Select>
													<Button
														onClick={generateReport}
														disabled={
															!state.reportPrompt.trim() ||
															state.status
																.generatingReport ||
															!state.selectedModel
														}
														type="button"
														className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
													>
														{state.status
															.generatingReport ? (
															<span className="flex items-center gap-2">
																<Loader2 className="h-4 w-4 animate-spin" />
																Đang tạo...
															</span>
														) : (
															"Tạo báo cáo"
														)}
													</Button>
												</div>
											</div>
										)}
									<div className="text-center sm:text-left">
										<p className="text-base font-medium bg-blue-600/20 inline-block px-3 py-1.5 rounded-full">
											{state.selectedResults.length === 0
												? "Chọn tối đa 3 kết quả để tạo báo cáo"
												: state.selectedModel
												? `${state.selectedResults.length} trong số ${MAX_SELECTIONS} kết quả đã được chọn`
												: "Vui lòng chọn model ở trên để tạo báo cáo"}
										</p>
										{state.status.generatingReport && (
											<p className="mt-2 text-sm text-blue-400">
												{
													state.status.fetchStatus
														.successful
												}{" "}
												đã tải,{" "}
												{
													state.status.fetchStatus
														.fallback
												}{" "}
												thất bại (trong số{" "}
												{state.status.fetchStatus.total}
												)
											</p>
										)}
									</div>
									<TabsList className="grid w-full grid-cols-2 mb-4 bg-black">
										<TabsTrigger
											value="search"
											className="text-white data-[state=active]:bg-blue-600"
										>
											Kết quả tìm kiếm
										</TabsTrigger>
										<TabsTrigger
											value="report"
											disabled={!state.report}
											className="text-white data-[state=active]:bg-blue-600"
										>
											Báo cáo
										</TabsTrigger>
									</TabsList>

									<TabsContent
										value="search"
										className="space-y-4"
									>
										{!state.isAgentMode &&
											state.results
												.filter((r) => r.isCustomUrl)
												.map((result) => (
													<Card
														key={result.id}
														className="overflow-hidden border-2 border-blue-100 bg-black"
													>
														<CardContent className="p-4 flex gap-4">
															<div className="pt-1">
																<Checkbox
																	checked={state.selectedResults.includes(
																		result.id
																	)}
																	onCheckedChange={() =>
																		handleResultSelect(
																			result.id
																		)
																	}
																	disabled={
																		!state.selectedResults.includes(
																			result.id
																		) &&
																		state
																			.selectedResults
																			.length >=
																			MAX_SELECTIONS
																	}
																/>
															</div>
															<div className="flex-1 min-w-0">
																<div className="flex justify-between items-start">
																	<a
																		href={
																			result.url
																		}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-blue-400 hover:underline"
																	>
																		<h2 className="text-xl font-semibold truncate">
																			{
																				result.name
																			}
																		</h2>
																	</a>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleRemoveResult(
																				result.id
																			)
																		}
																		className="ml-2 text-white"
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</div>
																<p className="text-green-400 text-sm truncate">
																	{result.url}
																</p>
																<p className="mt-1 text-white line-clamp-2">
																	{
																		result.snippet
																	}
																</p>
															</div>
														</CardContent>
													</Card>
												))}

										{state.results
											.filter((r) => !r.isCustomUrl)
											.map((result) => (
												<Card
													key={result.id}
													className="overflow-hidden bg-black"
												>
													<CardContent className="p-4 flex gap-4">
														<div className="pt-1">
															<Checkbox
																checked={state.selectedResults.includes(
																	result.id
																)}
																onCheckedChange={() =>
																	handleResultSelect(
																		result.id
																	)
																}
																disabled={
																	!state.selectedResults.includes(
																		result.id
																	) &&
																	state
																		.selectedResults
																		.length >=
																		MAX_SELECTIONS
																}
															/>
														</div>
														<div className="flex-1 min-w-0">
															<h2 className="text-xl font-semibold truncate text-blue-400 hover:underline">
																<a
																	href={
																		result.url
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	dangerouslySetInnerHTML={{
																		__html: result.name,
																	}}
																/>
															</h2>
															<p className="text-green-400 text-sm truncate">
																{result.url}
															</p>
															<p
																className="mt-1 text-white line-clamp-2"
																dangerouslySetInnerHTML={{
																	__html: result.snippet,
																}}
															/>
														</div>
													</CardContent>
												</Card>
											))}
									</TabsContent>

									<TabsContent value="report">
										{state.report && (
											<Card className="bg-gray-100 border-0">
												<CardContent className="p-6 space-y-4">
													<div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-start gap-4">
														<h2 className="text-2xl font-bold text-blue-400 text-center sm:text-left">
															{
																state.report
																	?.title
															}
														</h2>
														<ReportActions
															report={
																state.report
															}
															prompt={
																state.reportPrompt
															}
														/>
													</div>

													<div
														className="max-h-[800px] overflow-y-auto pr-2"
														style={{
															scrollbarWidth:
																"thin",
														}}
													>
														<p className="text-lg text-blue-400 mb-6">
															{
																state.report
																	?.summary
															}
														</p>

														{state.report?.sections?.map(
															(
																section,
																index
															) => (
																<div
																	key={index}
																	className="space-y-3 border-t border-gray-300 pt-4 mb-6"
																>
																	<h3 className="text-xl font-semibold text-blue-400">
																		{
																			section.title
																		}
																	</h3>
																	<div className="prose max-w-none text-gray-900 prose-h1:text-blue-400 prose-h3:text-blue-400 prose-strong:text-blue-400 prose-blockquote:text-blue-300 prose-blockquote:border-blue-400">
																		<ReactMarkdown>
																			{
																				section.content
																			}
																		</ReactMarkdown>
																		{section.images &&
																			section
																				.images
																				.length >
																				0 && (
																				<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
																					{section.images.map(
																						(
																							image,
																							imgIndex
																						) => (
																							<div
																								key={
																									imgIndex
																								}
																								className="relative group"
																							>
																								<img
																									src={
																										image.url
																									}
																									alt={
																										image.description
																									}
																									className="w-full h-auto rounded-lg shadow-lg transition-transform duration-200 group-hover:scale-105"
																									onError={(
																										e
																									) => {
																										const target =
																											e.target as HTMLImageElement;
																										target.parentElement?.classList.add(
																											"hidden"
																										);
																									}}
																								/>
																								<div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
																									<p className="text-sm font-medium">
																										{
																											image.description
																										}
																									</p>
																									<p className="text-xs text-gray-300 mt-1">
																										{
																											image.context
																										}
																									</p>
																									{image.source && (
																										<div className="mt-2 text-xs border-t border-gray-600 pt-2">
																											<p className="text-blue-300">
																												Nguồn:{" "}
																												{
																													image
																														.source
																														.title
																												}
																											</p>
																											<p className="text-gray-400">
																												{image
																													.source
																													.type ===
																													"article" &&
																													"Bài viết"}
																												{image
																													.source
																													.type ===
																													"document" &&
																													"Tài liệu"}
																												{image
																													.source
																													.type ===
																													"webpage" &&
																													"Trang web"}
																												{
																													" - "
																												}
																												{
																													image
																														.source
																														.location
																												}
																											</p>
																										</div>
																									)}
																								</div>
																							</div>
																						)
																					)}
																				</div>
																			)}
																	</div>
																</div>
															)
														)}

														{/* Citations Section */}
														{state.report && (
															<div className="mt-8 pt-4 border-t border-gray-800">
																<div className="text-blue-400">
																	<CitationsFooter
																		report={
																			state.report
																		}
																	/>
																</div>
															</div>
														)}
													</div>
												</CardContent>
											</Card>
										)}
									</TabsContent>
								</div>
							</Tabs>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
