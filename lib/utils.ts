import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function escapeJsonString(str: string): string {
	if (typeof str !== "string") return str;

	return str
		.replace(/\\/g, "\\\\") // Escape backslashes first
		.replace(/"/g, '\\"') // Escape double quotes
		.replace(/\n/g, "\\n") // Escape newlines
		.replace(/\r/g, "\\r") // Escape carriage returns
		.replace(/\t/g, "\\t") // Escape tabs
		.replace(/\f/g, "\\f") // Escape form feeds
		.replace(/[\x00-\x1F]/g, function (ch) {
			// Escape control characters
			return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
		});
}

export function extractAndParseJSON(response: string) {
	// console.log(response);
	//tariff between us and canada

	function cleanJson(jsonStr: string): string {
		// Pre-process to handle any invalid escape sequences
		jsonStr = jsonStr.replace(/\\([^"\\\/bfnrtu])/g, "$1");

		let inString = false;
		let escaped = false;
		let result = "";
		let buffer = "";

		for (let i = 0; i < jsonStr.length; i++) {
			const char = jsonStr[i];

			if (escaped) {
				if ('bfnrt\\"/'.indexOf(char) !== -1) {
					buffer += "\\" + char;
				} else if (char === "u") {
					// Handle unicode escapes
					const unicodeStr = jsonStr.slice(i + 1, i + 5);
					if (/^[0-9a-fA-F]{4}$/.test(unicodeStr)) {
						buffer += "\\u" + unicodeStr;
						i += 4;
					} else {
						buffer += char;
					}
				} else {
					buffer += char;
				}
				escaped = false;
				continue;
			}

			if (char === "\\") {
				escaped = true;
				continue;
			}

			if (char === '"' && !escaped) {
				if (inString) {
					// End of string - add escaped content
					result += '"' + buffer + '"';
					buffer = "";
				} else {
					// Start of string
					result += '"';
				}
				inString = !inString;
				continue;
			}

			if (inString) {
				buffer += char;
			} else {
				result += char;
			}
		}

		// Add any remaining buffer
		if (buffer) {
			result += buffer;
		}

		// Clean up the result
		return result
			.replace(/\|\n/g, "\\n")
			.replace(/:\s*[>|](\s*\n|\s*$)/g, ": ")
			.replace(/^\s*>/gm, "")
			.replace(/,(\s*[}\]])/g, "$1")
			.replace(/\n\s*\n/g, "\\n")
			.replace(/:\s*"[\s\n]+/g, ':"')
			.replace(/[\s\n]+"/g, '"')
			.replace(/""+/g, '"')
			.replace(/\\\\/g, "\\") // Fix double escapes
			.replace(/\\"/g, '\\"'); // Ensure quotes are properly escaped
	}

	// First attempt: Try to parse the entire response as JSON
	try {
		console.log(
			"Attempt 1 - Full parse, input:",
			response.slice(0, 100) + "..."
		);
		const result = JSON.parse(response);
		console.log("Attempt 1 succeeded");
		return result;
	} catch (e) {
		console.log("Attempt 1 failed:", e);
	}

	// Second attempt: Look for JSON within code blocks
	const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
	const codeBlockMatch = response.match(codeBlockRegex);

	if (codeBlockMatch) {
		try {
			console.log(
				"Attempt 2 - Code block found, content:",
				codeBlockMatch[1].slice(0, 100) + "..."
			);
			const cleanedJson = cleanJson(codeBlockMatch[1]);
			console.log(
				"Attempt 2 - Cleaned JSON:",
				cleanedJson.slice(0, 100) + "..."
			);
			const result = JSON.parse(cleanedJson);
			console.log("Attempt 2 succeeded");
			return result;
		} catch (e) {
			console.log("Attempt 2 failed:", e);
		}
	} else {
		console.log("Attempt 2 - No code block found");
	}

	// Third attempt: Find the outermost matching braces
	console.log("Attempt 3 - Starting bracket matching");
	let bracketCount = 0;
	let startIndex = -1;
	let endIndex = -1;
	let inString = false;
	let escapeNext = false;
	let foundStart = false;

	for (let i = 0; i < response.length; i++) {
		// Handle string boundaries and escaped characters
		if (response[i] === '"' && !escapeNext) {
			inString = !inString;
		} else if (response[i] === "\\" && !escapeNext) {
			escapeNext = true;
			continue;
		}

		escapeNext = false;

		// Only count braces when not in a string
		if (!inString) {
			if (response[i] === "{") {
				if (bracketCount === 0) {
					startIndex = i;
					foundStart = true;
					console.log("Attempt 3 - Found opening brace at index:", i);
				}
				bracketCount++;
			} else if (response[i] === "}") {
				bracketCount--;
				if (bracketCount === 0 && foundStart) {
					endIndex = i + 1;
					console.log(
						"Attempt 3 - Found matching closing brace at index:",
						i
					);
					// Try parsing this JSON substring with cleanup
					try {
						const jsonCandidate = cleanJson(
							response.substring(startIndex, endIndex)
						);
						console.log(
							"Attempt 3 - Trying to parse substring:",
							jsonCandidate.slice(0, 100) + "..."
						);
						const result = JSON.parse(jsonCandidate);
						console.log("Attempt 3 succeeded");
						return result;
					} catch (e) {
						console.log(
							"Attempt 3 - Parse failed for this substring:",
							e
						);
						foundStart = false; // Reset to keep looking
						continue;
					}
				}
			}
		}
	}

	console.log("All attempts failed - Final bracket count:", bracketCount);
	throw new Error("No valid JSON found in response");
}
