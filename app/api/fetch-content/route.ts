import { NextResponse } from "next/server";
import { fetchContentRatelimit } from "@/lib/redis";
import { CONFIG } from "@/lib/config";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { url } = body;

		if (!url) {
			return NextResponse.json(
				{ error: "URL is required" },
				{ status: 400 }
			);
		}

		// Only check rate limit if enabled
		if (CONFIG.rateLimits.enabled) {
			const { success } = await fetchContentRatelimit.limit(url);
			if (!success) {
				return NextResponse.json(
					{ error: "Too many requests" },
					{ status: 429 }
				);
			}
		}

		console.log("Fetching content for URL:", url);

		try {
			const response = await fetch(
				`https://r.jina.ai/${encodeURIComponent(url)}`
			);

			if (!response.ok) {
				console.warn(
					`Failed to fetch content for ${url}:`,
					response.status
				);
				return NextResponse.json(
					{ error: "Failed to fetch content" },
					{ status: response.status }
				);
			}

			const content = await response.text();

			// Analyze images in the content
			try {
				const imageAnalysisResponse = await fetch(
					`${
						process.env.NEXT_PUBLIC_BASE_URL ||
						"http://localhost:3000"
					}/api/analyze-images`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ content, url }),
					}
				);

				if (imageAnalysisResponse.ok) {
					const imageAnalysis = await imageAnalysisResponse.json();
					console.log("Images:", imageAnalysis.images);
					return NextResponse.json({
						content,
						images: imageAnalysis.images || [],
					});
				}
			} catch (error) {
				console.warn("Failed to analyze images:", error);
			}

			return NextResponse.json({ content });
		} catch (error) {
			console.warn(`Error fetching content for ${url}:`, error);
			return NextResponse.json(
				{ error: "Failed to fetch content" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Content fetching error:", error);
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
}
