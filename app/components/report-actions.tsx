import { type Report } from "@/types";

interface ReportActionsProps {
	report: Report;
}

const handleDownload = ({ report }: ReportActionsProps) => {
	if (!report) return;

	const content = `# ${report.title}

${report.summary}

${report.sections
	.map(
		(section) => `## ${section.title}

${section.content}
`
	)
	.join("\n")}

## References

${report.sources
	.map((source, index) => `${index + 1}. ${source.name} - ${source.url}`)
	.join("\n")}
`;

	const blob = new Blob([content], { type: "text/markdown" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${report.title.toLowerCase().replace(/\s+/g, "-")}.md`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};

export { handleDownload };
