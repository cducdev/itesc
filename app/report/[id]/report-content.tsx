"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertTriangle, Brain } from "lucide-react";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { CitationsFooter } from "@/components/citations-footer";
import { ReportActions } from "@/components/report-actions";
import type { KnowledgeBaseReport } from "@/types";

export function ReportContent({ id }: { id: string }) {
	const router = useRouter();
	const { reports } = useKnowledgeBase();
	const [report, setReport] = useState<KnowledgeBaseReport | null>(null);

	useEffect(() => {
		const foundReport = reports.find((r) => r.id === id);
		setReport(foundReport || null);
	}, [id, reports]);

	if (!report) {
		return (
			<div className="min-h-screen bg-[#c78b8b] p-4 sm:p-8">
				<div className="max-w-4xl mx-auto">
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertTitle>Không tìm thấy báo cáo</AlertTitle>
						<AlertDescription>
							Báo cáo bạn đang tìm kiếm không tồn tại hoặc đã bị
							xoá.
						</AlertDescription>
					</Alert>
					<div className="mt-4 text-center">
						<Button
							variant="ghost"
							onClick={() => router.push("/")}
							className="gap-2 text-white hover:text-blue-400"
						>
							<ArrowLeft className="h-4 w-4" />
							Quay lại trang chủ
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#c78b8b] p-4 sm:p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={() => router.push("/")}
						className="gap-2 text-white hover:text-blue-400"
					>
						<ArrowLeft className="h-4 w-4" />
						Quay lại trang chủ
					</Button>

					<div className="flex items-center gap-2">
						<ReportActions report={report.report} />
					</div>
				</div>

				<Alert className="mb-6 bg-black/80 border-gray-800">
					<Brain className="h-4 w-4 text-blue-400" />
					<AlertTitle className="text-blue-400">
						Báo cáo từ kho kiến thức
					</AlertTitle>
					<AlertDescription className="text-white">
						Báo cáo này được lưu{" "}
						{formatDistanceToNow(report.timestamp, {
							addSuffix: true,
						})}
						cho câu hỏi: &apos;{report.query}&apos;
					</AlertDescription>
				</Alert>

				<Card className="p-6 bg-black border-gray-800">
					<div className="mb-6">
						<h1 className="text-3xl font-bold text-blue-400 mb-2">
							{report.report.title}
						</h1>
					</div>

					<div className="prose max-w-none text-white prose-h1:text-blue-400 prose-h2:text-blue-400 prose-strong:text-blue-400 prose-blockquote:text-blue-300 prose-blockquote:border-blue-400">
						<h2 className="text-blue-400">Tóm tắt</h2>

						{/* Scrollable content area */}
						<div
							className="max-h-[700px] overflow-y-auto pr-2"
							style={{ scrollbarWidth: "thin" }}
						>
							<p className="mb-6">{report.report.summary}</p>

							{report.report.sections.map((section, index) => (
								<div key={index} className="mb-6">
									<h2 className="text-blue-400">
										{section.title}
									</h2>
									<ReactMarkdown>
										{section.content}
									</ReactMarkdown>
								</div>
							))}

							{/* Citations Section */}
							<div className="text-blue-400">
								<CitationsFooter report={report.report} />
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
