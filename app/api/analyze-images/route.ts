import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { generateWithModel } from "@/lib/models";
import { reportContentRatelimit } from "@/lib/redis";

// Hàm kiểm tra URL hợp lệ
function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

// Hàm kiểm tra ảnh có tải được không
async function checkImageUrl(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: "HEAD",
			headers: {
				Accept: "image/*",
			},
		});
		return response.status === 200;
	} catch {
		return false;
	}
}

export async function POST(request: Request) {
	try {
		const { content, url } = await request.json();
		const platformModel = "google__gemini-flash";

		console.log("Analyse image model: ", platformModel);

		if (CONFIG.rateLimits.enabled) {
			const { success } = await reportContentRatelimit.limit(
				"imageAnalysis"
			);
			if (!success) {
				return NextResponse.json(
					{ error: "Too many requests" },
					{ status: 429 }
				);
			}
		}

		if (!content) {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		const systemPrompt = `You are an image analysis assistant. Analyze the following content and extract relevant images that would be suitable for a research report.

Content: ${content}
Source URL: ${url}

Your task is to:
1. Identify any image URLs in the content (MAKE SURE IT IS A VALID URL STARTING WITH http:// or https://)
2. Analyze each image's relevance to the content
3. Determine if the image would be valuable in a research report
4. Provide a brief description of why each image is relevant
5. Extract and include detailed source information:
   - For articles: Include the article title and section where the image appears
   - For documents: Include the page number or section where the image appears
   - For websites: Include the specific webpage section or context

Return the analysis in the following JSON format:
{
  "images": [
    {
      "url": "image_url",
      "description": "Brief description of the image and its relevance",
      "relevance_score": 0.8,
      "context": "Brief context about where this image appears in the content",
      "source": {
        "type": "article|document|webpage",
        "title": "Title of the source",
        "location": "Page number, section, or specific location in the source",
        "url": "URL of the source"
      }
    }
  ]
}

Only include images that:
- Are directly relevant to the content
- Have a relevance score above 0.6
- Are from reliable sources
- Would add value to a research report
- Have valid URLs starting with http:// or https://

Exclude:
- Decorative images
- Low quality images
- Irrelevant images
- Images from unreliable sources
- Images with invalid URLs`;

		try {
			const response = await generateWithModel(
				systemPrompt,
				platformModel
			);

			if (!response) {
				throw new Error("No response from model");
			}

			const analysis = JSON.parse(response);

			// Kiểm tra và lọc bỏ những ảnh không hợp lệ
			if (analysis.images) {
				const validatedImages = await Promise.all(
					analysis.images
						.filter((img: any) => {
							if (!img?.url || typeof img.url !== "string")
								return false;
							const trimmedUrl = img.url.trim();
							return trimmedUrl && isValidUrl(trimmedUrl);
						})
						.map(async (img: any) => {
							try {
								const isValid = await checkImageUrl(
									img.url.trim()
								);
								return isValid ? img : null;
							} catch (error) {
								console.warn(
									`Failed to validate image URL: ${img.url}`,
									error
								);
								return null;
							}
						})
				);
				// console.log("Before:", analysis.images);
				analysis.images = validatedImages.filter(
					(img): img is NonNullable<typeof img> => img !== null
				);
				// console.log("After:", analysis.images);
			}

			return NextResponse.json(analysis);
		} catch (error) {
			console.error("Image analysis error:", error);
			return NextResponse.json(
				{ error: "Failed to analyze images" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Request error:", error);
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
}
