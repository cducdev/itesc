import { NextResponse } from "next/server";
import { reportContentRatelimit } from "@/lib/redis";
import { CONFIG } from "@/lib/config";
import { extractAndParseJSON } from "@/lib/utils";
import { generateWithModel } from "@/lib/models";
import { type ModelVariant } from "@/types";
import { logQuery } from "@/lib/db";

export async function POST(request: Request) {
	try {
		const startTime = Date.now();
		const { prompt, platformModel = "google__gemini-flash" } =
			(await request.json()) as {
				prompt: string;
				platformModel: ModelVariant;
			};

		if (!prompt) {
			return NextResponse.json(
				{ error: "Prompt is required" },
				{ status: 400 }
			);
		}

		// Return test results for test queries
		if (prompt.toLowerCase() === "test") {
			const testResponse = {
				query: "test",
				optimizedPrompt:
					"Analyze and compare different research methodologies, focusing on scientific rigor, peer review processes, and validation techniques",
				explanation: "Test optimization strategy",
				suggestedStructure: [
					"Test Structure 1",
					"Test Structure 2",
					"Test Structure 3",
				],
			};

			await logQuery({
				original_query: prompt,
				query: testResponse.query,
				results: testResponse,
				status: 200,
				response_time: Date.now() - startTime,
			});

			return NextResponse.json(testResponse);
		}

		// Only check rate limit if enabled and not using Ollama (local model)
		const platform = platformModel.split("__")[0];
		const model = platformModel.split("__")[1];
		if (CONFIG.rateLimits.enabled && platform !== "ollama") {
			const { success } = await reportContentRatelimit.limit(
				"agentOptimizations"
			);
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
		console.log(platform as keyof typeof CONFIG.platforms);
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

		const systemPrompt = `Research Assistant: Optimize this topic into a search query.
Topic: "${prompt}"

Tasks:
1. Create ONE optimized search query
2. Generate research prompt
3. Suggest structure

Query requirements:
- Core aspects covered
- Technical terms & synonyms
- High-quality focus
- Concise but comprehensive

IMPORTANT: Return ONLY valid JSON with this structure:
{
  "query": "optimized search query",
  "optimizedPrompt": "research prompt",
  "explanation": "brief strategy",
  "suggestedStructure": [
    "aspect 1",
    "aspect 2",
    "aspect 3"
  ]
}

RULES:
1. NO text outside JSON
2. NO markdown blocks
3. NO explanations
4. MUST be valid JSON`;

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
				const parsedResponse = extractAndParseJSON(response);
				await logQuery({
					original_query: prompt,
					query: parsedResponse.query,
					results: parsedResponse,
					status: 200,
					response_time: Date.now() - startTime,
				});

				return NextResponse.json(parsedResponse);
			} catch (parseError) {
				console.error("Failed to parse optimization:", parseError);
				await logQuery({
					original_query: prompt,
					query: "",
					status: 500,
					response_time: Date.now() - startTime,
				});
				return NextResponse.json(
					{ error: "Failed to optimize research" },
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
				{ error: "Failed to generate optimization" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Research optimization failed:", error);
		return NextResponse.json(
			{ error: "Failed to optimize research" },
			{ status: 500 }
		);
	}
}
