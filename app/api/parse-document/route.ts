import { NextResponse } from "next/server";
import { parseOfficeAsync } from "officeparser";
import pdf from "pdf-parse";
import mammoth from "mammoth";

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 }
			);
		}

		try {
			// Convert the file to a Buffer
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			let content = "";
			let images: Array<{
				url: string;
				description: string;
				context: string;
				source?: {
					type: "article" | "document" | "webpage";
					title: string;
					location: string;
					url: string;
				};
			}> = [];

			if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
				// Parse PDF
				const pdfData = await pdf(buffer);
				content = pdfData.text;

				// Extract images from PDF
				// Note: This is a simplified version. You might want to use a more robust PDF image extraction library
				const imageRegex = /data:image\/[^;]+;base64,[^"']+/g;
				const matches = content.match(imageRegex) || [];
				images = matches.map((imageData, index) => ({
					url: imageData,
					description: `Hình ảnh ${index + 1} từ tài liệu PDF`,
					context: "Trích xuất từ tài liệu PDF",
					source: {
						type: "document",
						title: file.name,
						location: `Trang ${Math.floor(index / 2) + 1}`, // Rough estimate of page number
						url: URL.createObjectURL(file),
					},
				}));
			} else if (
				file.type ===
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
				file.name.endsWith(".docx")
			) {
				// Parse DOCX
				const result = await mammoth.extractRawText({ arrayBuffer });
				content = result.value;

				// Extract images from DOCX
				const imageResult = await mammoth.convertToHtml({
					arrayBuffer,
				});
				const imageMatches =
					imageResult.value.match(
						/<img[^>]+src="data:image\/[^;]+;base64,[^"]+"/g
					) || [];
				images = imageMatches.map((imgTag, index) => {
					const srcMatch = imgTag.match(/src="([^"]+)"/);
					const src = srcMatch ? srcMatch[1] : "";

					// Try to find the context around the image
					const paragraphsBefore = content
						.split("\n")
						.slice(Math.max(0, index - 2), index + 1)
						.join(" ");
					const estimatedSection =
						paragraphsBefore.length > 100
							? paragraphsBefore.slice(-100)
							: paragraphsBefore;

					return {
						url: src,
						description: `Hình ảnh ${index + 1} từ tài liệu DOCX`,
						context: estimatedSection,
						source: {
							type: "document",
							title: file.name,
							location: `Phần ${estimatedSection.slice(
								0,
								50
							)}...`,
							url: URL.createObjectURL(file),
						},
					};
				});
			} else {
				// For other document types, use officeparser
				content = await parseOfficeAsync(buffer, {
					outputErrorToConsole: false,
					newlineDelimiter: "\n",
					ignoreNotes: false,
					putNotesAtLast: false,
				});
			}

			// Clean up content by removing any remaining image data
			content = content.replace(/data:image\/[^;]+;base64,[^"']+/g, "");

			return NextResponse.json({
				content,
				images,
			});
		} catch (error) {
			console.error("Content extraction error:", error);
			return NextResponse.json(
				{ error: "Failed to extract content from document" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Document parsing error:", error);
		return NextResponse.json(
			{ error: "Failed to parse document" },
			{ status: 500 }
		);
	}
}
