"use client";

import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TutorialPopupProps {
	isOpen: boolean;
	onClose: () => void;
}

const TutorialPopup: React.FC<TutorialPopupProps> = ({ isOpen, onClose }) => {
	const features = [
		{
			title: "Agent Mode",
			description: "Tự động tìm kiếm và tổng hợp báo cáo",
			steps: [
				"Nhập chủ đề nghiên cứu vào ô tìm kiếm",
				"Hệ thống tự động tìm kiếm nguồn",
				"Hệ thống phân tích và tổng hợp thông tin",
				"Hiển thị kết quả dưới dạng báo cáo",
			],
		},
		{
			title: "Tùy chọn nguồn",
			description: "Tổng hợp báo cáo từ các nguồn bạn chọn",
			steps: [
				'Tắt Agent Mode bằng cách bỏ chọn ở checkbox "Agent Mode"',
				"Nhập chủ đề nghiên cứu vào ô tìm kiếm",
				"Hệ thống sẽ tìm kiếm và hiển thị danh sách các nguồn tin liên quan",
				"Chọn các nguồn bạn muốn sử dụng để tổng hợp báo cáo",
				"Nếu có nguồn riêng, bạn có thể:",
				'- Thêm URL vào ô "URL tuỳ chỉnh"',
				"- Tải lên file của bạn",
				'Nhấn "Tạo báo cáo" để bắt đầu tổng hợp từ các nguồn đã chọn',
			],
		},
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px] bg-white">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold text-center">
						Hướng dẫn sử dụng
					</DialogTitle>
				</DialogHeader>

				<div className="mt-4 space-y-6">
					{features.map((feature, index) => (
						<div key={index}>
							<div className="mb-3">
								<h3 className="font-semibold">
									{feature.title}
								</h3>
								<p className="text-sm text-gray-600">
									{feature.description}
								</p>
							</div>
							<ol className="list-decimal pl-5 space-y-1.5">
								{feature.steps.map((step, stepIndex) => (
									<li
										key={stepIndex}
										className={
											step.startsWith("-")
												? "list-none text-gray-500 ml-4 text-sm"
												: "text-gray-600"
										}
									>
										{step}
									</li>
								))}
							</ol>
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

export default TutorialPopup;
