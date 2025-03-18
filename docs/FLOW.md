# Tài liệu Luồng Hoạt động của Ứng dụng Open Deep Research

## 1. Tổng quan

Open Deep Research là một trợ lý nghiên cứu mã nguồn mở mạnh mẽ, tạo ra các báo cáo toàn diện dựa trên kết quả tìm kiếm web với sự hỗ trợ của AI. Ứng dụng này nổi bật với khả năng tích hợp linh hoạt với nhiều nền tảng AI khác nhau.

## 2. Kiến trúc Ứng dụng

### 2.1 Công nghệ Core

-   **Framework**: Next.js với TypeScript
-   **UI**: Tailwind CSS
-   **State Management**: React Hooks
-   **Database**: Local Storage (cho Knowledge Base)

### 2.2 Cấu trúc Thư mục

```
/
├── app/                    # Next.js app router
│   ├── api/               # API endpoints
│   ├── components/        # UI components cho pages
│   ├── flow/             # Components cho tính năng Flow
│   ├── logs/             # Components cho logging
│   └── report/           # Components cho reporting
├── components/            # Shared components
├── lib/                   # Utilities và configurations
├── hooks/                # Custom React hooks
├── types/                # TypeScript definitions
└── public/               # Static assets
```

## 3. Luồng Hoạt động Chính

### 3.1 Quy trình Tìm kiếm và Tạo Báo cáo

1. **Tìm kiếm Web**

    - Sử dụng Google Custom Search hoặc Bing Search API
    - Có thể cấu hình số lượng kết quả và bộ lọc
    - Rate limiting để đảm bảo ổn định

2. **Trích xuất Nội dung**

    - Sử dụng JinaAI để xử lý nội dung từ các URL
    - Hỗ trợ nhiều định dạng (web, PDF, DOCX)
    - Lọc và làm sạch dữ liệu

3. **Tạo Báo cáo**
    - Tích hợp với nhiều mô hình AI (Gemini, GPT-4, Claude, v.v.)
    - Tùy chỉnh prompts theo nhu cầu
    - Xuất báo cáo đa định dạng

### 3.2 Tính năng Flow

1. **Deep Research Trees**

    - Tạo cây nghiên cứu với các query liên quan
    - Phân tích đệ quy các chủ đề

2. **Report Consolidation**
    - Kết hợp nhiều báo cáo thành một
    - Tạo tổng quan toàn diện

### 3.3 Knowledge Base

-   Lưu trữ báo cáo trong local storage
-   Truy cập nhanh các nghiên cứu trước
-   Tìm kiếm và phân loại báo cáo

## 4. Tích hợp AI

### 4.1 Nền tảng Được Hỗ trợ

-   Google (Gemini)
-   OpenAI (GPT)
-   Anthropic (Claude)
-   DeepSeek
-   OpenRouter

### 4.2 Cấu hình Model

-   Tùy chỉnh theo nền tảng
-   Kiểm soát rate limits
-   Lựa chọn model phù hợp

## 5. Bảo mật và Hiệu suất

### 5.1 Rate Limiting

-   Kiểm soát số lượng request
-   Cấu hình theo loại operation
-   Tùy chọn bật/tắt

### 5.2 API Security

-   Quản lý API keys an toàn
-   Môi trường biến được mã hóa
-   Safe search options

## 6. Tùy chỉnh và Mở rộng

### 6.1 Configuration

-   Cấu hình trong `lib/config.ts`
-   Tùy chỉnh search providers
-   Điều chỉnh rate limits

### 6.2 Mở rộng

-   Thêm models AI mới
-   Tùy chỉnh prompts
-   Tích hợp providers mới

## 7. Best Practices

### 7.1 Sử dụng

-   Bắt đầu với queries rõ ràng
-   Sử dụng filters phù hợp
-   Tận dụng Knowledge Base

### 7.2 Phát triển

-   Tuân thủ TypeScript
-   Tối ưu performance
-   Kiểm tra rate limits
