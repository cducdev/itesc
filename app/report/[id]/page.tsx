import React from "react";
import { ReportContent } from "./report-content";

export default async function ReportPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const kbID = await params;
	return <ReportContent id={kbID.id} />;
}
