import { NextResponse } from "next/server";
import { reportContentRatelimit } from "@/lib/redis";
import { type Article, type ModelVariant } from "@/types";
import { CONFIG } from "@/lib/config";
import { extractAndParseJSON } from "@/lib/utils";
import { generateWithModel } from "@/lib/models";
import { logQuery } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: Request) {
	try {
		const startTime = Date.now();
		const body = await request.json();
		const {
			selectedResults,
			sources,
			prompt,
			platformModel = "google-gemini-flash",
			language = "en", // Default to English if not specified
		} = body as {
			selectedResults: Article[];
			sources: any[];
			prompt: string;
			platformModel: ModelVariant;
			language: "en" | "vi";
		};

		// Only check rate limit if enabled and not using Ollama (local model)
		const platform = platformModel.split("__")[0];
		const model = platformModel.split("__")[1];
		if (CONFIG.rateLimits.enabled && platform !== "ollama") {
			const { success } = await reportContentRatelimit.limit("report");
			if (!success) {
				await logQuery({
					original_query: prompt,
					query: "",
					status: 429,
					response_time: Date.now() - startTime,
				});
				return NextResponse.json(
					{ error: "Too many requests" },
					{ status: 429 }
				);
			}
		}

		// Check if selected platform is enabled
		const platformConfig =
			CONFIG.platforms[platform as keyof typeof CONFIG.platforms];
		if (!platformConfig?.enabled) {
			await logQuery({
				original_query: prompt,
				query: "",
				status: 400,
				response_time: Date.now() - startTime,
			});
			return NextResponse.json(
				{ error: `${platform} platform is not enabled` },
				{ status: 400 }
			);
		}

		// Check if selected model exists and is enabled
		const modelConfig = (platformConfig as any).models[model];
		if (!modelConfig) {
			await logQuery({
				original_query: prompt,
				query: "",
				status: 400,
				response_time: Date.now() - startTime,
			});
			return NextResponse.json(
				{ error: `${model} model does not exist` },
				{ status: 400 }
			);
		}
		if (!modelConfig.enabled) {
			await logQuery({
				original_query: prompt,
				query: "",
				status: 400,
				response_time: Date.now() - startTime,
			});
			return NextResponse.json(
				{ error: `${model} model is disabled` },
				{ status: 400 }
			);
		}

		const generateSystemPrompt = (
			articles: Article[],
			userPrompt: string,
			language: "en" | "vi"
		) => {
			const isVietnamese = language === "vi";

			const reportStructure = isVietnamese
				? {
						title: "Tiêu đề báo cáo",
						summary: "Tóm tắt tổng quan (có thể sử dụng markdown)",
						sectionTitle: "Tiêu đề phần",
						sectionContent:
							"Nội dung phần với định dạng markdown và trích dẫn chọn lọc",
						usedSourcesComment:
							"Mảng số nguồn thực sự được trích dẫn trong báo cáo",
				  }
				: {
						title: "Report title",
						summary: "Executive summary (can include markdown)",
						sectionTitle: "Section title",
						sectionContent:
							"Section content with markdown formatting and selective citations",
						usedSourcesComment:
							"Array of source numbers that were actually cited in the report",
				  };

			return `You are a research assistant tasked with creating a comprehensive report ${
				isVietnamese ? "in Vietnamese" : "in English"
			} based on multiple sources. 
The report should specifically address this request: "${userPrompt}"

Your report should:
1. Have a clear title ${
				isVietnamese ? "in Vietnamese" : ""
			} that reflects the specific analysis requested
2. Begin with a concise executive summary ${isVietnamese ? "in Vietnamese" : ""}
3. Be organized into relevant sections based on the analysis requested
4. Use markdown formatting for emphasis, lists, and structure
5. Use citations ONLY when necessary for specific claims, statistics, direct quotes, or important facts
6. Maintain objectivity while addressing the specific aspects requested in the prompt
7. Compare and contrast the information from sources, noting areas of consensus or points of contention
8. Showcase key insights, important data, or innovative ideas
9. Include relevant images from the sources when they add value to the report

Here are the source articles to analyze (numbered for citation purposes):

${articles
	.map(
		(article, index) => `
[${index + 1}] Title: ${article.title}
URL: ${article.url}
Content: ${article.content}
${article.images ? `Images: ${JSON.stringify(article.images)}` : ""}
---
`
	)
	.join("\n")}

Format the report as a JSON object with the following structure:
{
  "title": "${reportStructure.title}",
  "summary": "${reportStructure.summary}",
  "sections": [
    {
      "title": "${reportStructure.sectionTitle}",
      "content": "${reportStructure.sectionContent}",
      "images": [
        {
          "url": "image_url",
          "description": "Brief description of the image",
          "context": "Where this image fits in the section"
        }
      ]
    }
  ],
  "usedSources": [1, 2] // ${reportStructure.usedSourcesComment}
}

Use markdown formatting in the content to improve readability:
- Use **bold** for emphasis
- Use bullet points and numbered lists where appropriate
- Use headings and subheadings with # syntax
- Include code blocks if relevant
- Use > for quotations
- Use --- for horizontal rules where appropriate
- Include images using markdown syntax: ![description](image_url)

CITATION GUIDELINES:
1. Only use citations when truly necessary - specifically for:
   - Direct quotes from sources
   - Specific statistics, figures, or data points
   - Non-obvious facts or claims that need verification
   - Controversial statements
   
2. DO NOT use citations for:
   - General knowledge
   - Your own analysis or synthesis of information
   - Widely accepted facts
   - Every sentence or paragraph

3. When needed, use superscript citation numbers in square brackets [¹], [²], etc. at the end of the relevant sentence
   
4. The citation numbers correspond directly to the source numbers provided in the list
   
5. Be judicious and selective with citations - a well-written report should flow naturally with citations only where they truly add credibility

6. You DO NOT need to cite every source provided. Only cite the sources that contain information directly relevant to the report. Track which sources you actually cite and include their numbers in the "usedSources" array in the output JSON.

7. It's completely fine if some sources aren't cited at all - this means they weren't needed for the specific analysis requested.

${
	isVietnamese
		? "IMPORTANT: The entire report content must be in Vietnamese, including all sections, summaries, and analysis."
		: ""
}`;
		};

		const systemPrompt = generateSystemPrompt(
			selectedResults,
			prompt,
			language
		);

		// console.log('Sending prompt to model:', systemPrompt)
		console.log("Model:", model);

		try {
			const response = await generateWithModel(
				systemPrompt,
				platformModel
			);

			if (!response) {
				await logQuery({
					original_query: prompt,
					query: "",
					status: 500,
					response_time: Date.now() - startTime,
				});
				throw new Error("No response from model");
			}

			try {
				const reportData = extractAndParseJSON(response);
				// Add sources to the report data
				reportData.sources = sources;
				console.log("Parsed report data:", reportData);

				await logQuery({
					original_query: String(prompt || ""),
					query: reportData.title,
					results: reportData,
					report: JSON.stringify(reportData),
					status: 200,
					response_time: Date.now() - startTime,
				});

				return NextResponse.json(reportData);
			} catch (parseError) {
				console.error("JSON parsing error:", parseError);
				await logQuery({
					original_query: prompt,
					query: "",
					status: 500,
					response_time: Date.now() - startTime,
				});
				return NextResponse.json(
					{ error: "Failed to parse report format" },
					{ status: 500 }
				);
			}
		} catch (error) {
			console.error("Model generation error:", error);
			await logQuery({
				original_query: prompt,
				query: "",
				status: 500,
				response_time: Date.now() - startTime,
			});
			return NextResponse.json(
				{ error: "Failed to generate report content" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Report generation error:", error);
		const startTime = Date.now();
		await logQuery({
			original_query: String(prompt || ""),
			query: "",
			status: 500,
			response_time: Date.now() - startTime,
		});
		return NextResponse.json(
			{ error: "Failed to generate report" },
			{ status: 500 }
		);
	}
}
