"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

type QueryLog = {
	id: number;
	timestamp: number;
	original_query: string;
	query: string;
	results: any;
	report: string;
	status: number;
	response_time: number;
};

export default function QueryLogs() {
	const [logs, setLogs] = useState<QueryLog[]>([]);
	const [selectedLog, setSelectedLog] = useState<QueryLog | null>(null);

	useEffect(() => {
		fetchLogs();
	}, []);

	const fetchLogs = async () => {
		try {
			const response = await fetch("/api/logs");
			const data = await response.json();
			setLogs(data);
		} catch (error) {
			console.error("Error fetching logs:", error);
		}
	};

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-2xl font-bold mb-4 text-white">Query Logs</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="space-y-4">
					{logs.map((log) => (
						<Card
							key={log.id}
							className={`cursor-pointer transition-colors ${
								selectedLog?.id === log.id
									? "bg-blue-600"
									: "bg-black"
							}`}
							onClick={() => setSelectedLog(log)}
						>
							<CardContent className="p-4">
								<div className="flex justify-between items-start mb-2">
									<div className="text-sm text-white">
										{formatDistanceToNow(log.timestamp, {
											addSuffix: true,
										})}
									</div>
									<div
										className={`text-sm ${
											log.status === 200
												? "text-green-400"
												: "text-red-400"
										}`}
									>
										Status: {log.status}
									</div>
								</div>
								<div className="space-y-2">
									<div className="text-white">
										<span className="font-semibold">
											Original Query:
										</span>
										<div className="text-sm truncate">
											{log.original_query}
										</div>
									</div>
									<div className="text-white">
										<span className="font-semibold">
											Optimized Query:
										</span>
										<div className="text-sm truncate">
											{log.query}
										</div>
									</div>
									<div className="text-white">
										<span className="font-semibold">
											Results:
										</span>
										<div className="text-sm truncate">
											{log.results
												? JSON.stringify(
														log.results
												  ).slice(0, 100) + "..."
												: "-"}
										</div>
									</div>
									<div className="text-sm text-white">
										Response time: {log.response_time}ms
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				{selectedLog && (
					<div className="bg-black rounded-lg p-4 space-y-4">
						<h2 className="text-xl font-bold text-white">
							Log Details
						</h2>
						<div className="space-y-4">
							<div>
								<h3 className="font-semibold text-white">
									Original Query
								</h3>
								<p className="text-white">
									{selectedLog.original_query}
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-white">
									Optimized Query
								</h3>
								<p className="text-white">
									{selectedLog.query}
								</p>
							</div>
							{selectedLog.results && (
								<div>
									<h3 className="font-semibold text-white">
										Results
									</h3>
									<pre className="text-sm bg-gray-900 p-4 rounded-lg overflow-auto max-h-96 text-white">
										{JSON.stringify(
											selectedLog.results,
											null,
											2
										)}
									</pre>
								</div>
							)}
							{selectedLog.report && (
								<div>
									<h3 className="font-semibold text-white">
										Report
									</h3>
									<div className="prose prose-invert">
										{selectedLog.report}
									</div>
								</div>
							)}
							<div className="text-sm text-white">
								Status: {selectedLog.status} | Response time:{" "}
								{selectedLog.response_time}ms
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
