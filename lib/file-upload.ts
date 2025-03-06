import { type SearchResult } from "@/types";

export async function handleLocalFile(
	file: File,
	onStatusUpdate?: (loading: boolean) => void,
	onError?: (error: unknown, context: string) => void
): Promise<SearchResult | null> {
	try {
		onStatusUpdate?.(true);

		let content = "";
		if (file.type === "text/plain" || file.name.endsWith(".txt")) {
			content = await file.text();
		} else if (
			file.type === "application/pdf" ||
			file.name.endsWith(".pdf") ||
			file.type ===
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
			file.name.endsWith(".docx")
		) {
			// Send the file to our parsing endpoint
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/parse-document", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ error: "Không thể phân tích tài liệu" }));
				throw new Error(
					errorData.error || "Không thể phân tích tài liệu"
				);
			}

			const data = await response.json();
			content = data.content;
		} else {
			throw new Error(
				"Định dạng file không được hỗ trợ. Chỉ hỗ trợ file TXT, PDF và DOCX."
			);
		}

		// Truncate content to a reasonable snippet size
		const snippet =
			content.slice(0, 500) + (content.length > 500 ? "..." : "");

		// Create a search result from the file
		const timestamp = Date.now();
		const newResult: SearchResult = {
			id: `file-${timestamp}-${file.name}`,
			url: URL.createObjectURL(file),
			name: file.name,
			snippet: snippet,
			isCustomUrl: true,
			content: content, // Store full content for report generation
		};

		return newResult;
	} catch (error) {
		onError?.(error, "File Upload Error");
		return null;
	} finally {
		onStatusUpdate?.(false);
	}
}

export const SUPPORTED_FILE_TYPES =
	".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
