"use client";

import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ErrorPopupProps {
	isOpen: boolean;
	onClose: () => void;
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({ isOpen, onClose }) => {
	const errors = [
		{
			title: "Lỗi 5xx",
			description: "Lỗi này là do các bên cung cấp LLM bị lỗi",
			solutions: [
				"Dừng khoảng 5-10s rồi thử lại",
				"Đổi sang LLM khác và thử lại",
			],
		},
		{
			title: "Lỗi không thể tìm được thông tin",
			description:
				"Hệ thống không thể tìm được thông tin phù hợp với yêu cầu",
			solutions: [
				"Thử sửa lại prompt để cụ thể và rõ ràng hơn",
				"Chờ 5-10s rồi thử lại 1-2 lần",
			],
		},
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px] bg-white">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold text-center">
						Các lỗi thường gặp và cách xử lý
					</DialogTitle>
				</DialogHeader>

				<div className="mt-4 space-y-6">
					{errors.map((error, index) => (
						<div key={index}>
							<div className="mb-3">
								<h3 className="font-semibold text-red-500">
									{error.title}
								</h3>
								<p className="text-sm text-gray-600">
									{error.description}
								</p>
							</div>
							<ul className="list-disc pl-5 space-y-1.5">
								{error.solutions.map(
									(solution, solutionIndex) => (
										<li
											key={solutionIndex}
											className="text-gray-600"
										>
											{solution}
										</li>
									)
								)}
							</ul>
						</div>
					))}
				</div>

				<div className="flex justify-end mt-4">
					<Button
						onClick={onClose}
						className="bg-black hover:bg-gray-800 text-white"
					>
						Đã hiểu
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default ErrorPopup;
