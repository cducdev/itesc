# Flow Hoạt Động Chi Tiết Các Chức Năng

## 1. Chức năng Tìm kiếm Web

### Luồng xử lý:

```mermaid
graph TD
    A[Người dùng nhập query] --> B[Kiểm tra rate limit]
    B --> C{Chọn Search Provider}
    C -->|Google| D[Google Custom Search API]
    C -->|Bing| E[Bing Search API]
    D --> F[Lọc kết quả theo thời gian]
    E --> F
    F --> G[Hiển thị danh sách kết quả]
    G --> H[Người dùng chọn kết quả]
```

### Chi tiết các bước:

1. **Nhập Query**

    - Validate input
    - Kiểm tra độ dài query
    - Làm sạch query

2. **Rate Limiting**

    - Kiểm tra quota
    - Đếm số request/phút
    - Xử lý hàng đợi nếu cần

3. **Tìm kiếm**
    - Gọi API tương ứng
    - Xử lý lỗi và retry
    - Cache kết quả

## 2. Chức năng Trích xuất Nội dung

### Luồng xử lý:

```mermaid
graph TD
    A[Nhận URL/File] --> B[Phân tích loại nội dung]
    B --> C{Loại nội dung}
    C -->|Web| D[JinaAI Web Extractor]
    C -->|PDF| E[PDF Parser]
    C -->|DOCX| F[DOCX Parser]
    D --> G[Làm sạch nội dung]
    E --> G
    F --> G
    G --> H[Lưu cache]
```

### Chi tiết các bước:

1. **Phân tích nội dung**

    - Kiểm tra định dạng
    - Validate URL/file
    - Chuẩn bị parser

2. **Xử lý nội dung**
    - Extract text
    - Xử lý metadata
    - Loại bỏ noise

## 3. Chức năng Tạo Báo cáo

### Luồng xử lý:

```mermaid
graph TD
    A[Nhận nội dung đã xử lý] --> B[Chọn AI Model]
    B --> C[Chuẩn bị prompt]
    C --> D[Gọi AI API]
    D --> E[Xử lý response]
    E --> F[Format báo cáo]
    F --> G[Lưu vào Knowledge Base]
```

### Chi tiết các bước:

1. **Chọn Model**

    - Kiểm tra availability
    - Validate API key
    - Chọn prompt template

2. **Xử lý AI**
    - Gửi request
    - Xử lý streaming
    - Handle errors

## 4. Chức năng Flow Research

### Luồng xử lý:

```mermaid
graph TD
    A[Query gốc] --> B[Tạo báo cáo gốc]
    B --> C[Phân tích chủ đề con]
    C --> D[Tạo queries phụ]
    D --> E[Thực hiện research đệ quy]
    E --> F[Tổng hợp báo cáo]
```

### Chi tiết các bước:

1. **Research Tree**

    - Xây dựng cấu trúc cây
    - Tracking dependencies
    - Quản lý depth

2. **Consolidation**
    - Merge reports
    - Remove duplicates
    - Create summary

## 5. Chức năng Knowledge Base

### Luồng xử lý:

```mermaid
graph TD
    A[Báo cáo mới] --> B[Serialize data]
    B --> C[Lưu vào LocalStorage]
    C --> D[Index cho tìm kiếm]
    D --> E[Cập nhật UI]
```

### Chi tiết các bước:

1. **Lưu trữ**

    - Format data
    - Compress nếu cần
    - Manage storage limit

2. **Truy xuất**
    - Search functionality
    - Filter options
    - Sort results

## 6. Chức năng Export

### Luồng xử lý:

```mermaid
graph TD
    A[Chọn báo cáo] --> B[Chọn format]
    B --> C{Loại format}
    C -->|PDF| D[PDF Generator]
    C -->|DOCX| E[DOCX Generator]
    C -->|TXT| F[Text Generator]
    D --> G[Download file]
    E --> G
    F --> G
```

### Chi tiết các bước:

1. **Format Selection**

    - Validate format
    - Prepare templates
    - Configure options

2. **Generation**
    - Apply styling
    - Add metadata
    - Create download link
