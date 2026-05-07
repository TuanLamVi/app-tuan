import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AIContext {
  groupName: string;
  description: string;
  membersCount: number;
  balance: number;
  currency: string;
  tasks: Array<{ title: string; status: string; assignee?: string }>;
  announcements: Array<{ title: string; date: string }>;
}

export const generateAIResponse = async (prompt: string, context: AIContext) => {
  try {
    const systemInstruction = `Bạn là trợ lý ảo thông minh cho nhóm "${context.groupName}".
Mô tả nhóm: ${context.description}
Thông tin hiện tại của nhóm:
- Số thành viên: ${context.membersCount}
- Số dư quỹ: ${context.balance} ${context.currency}
- Công việc hiện tại: ${context.tasks.map(t => `${t.title} (${t.status})`).join(', ') || 'Chưa có'}
- Thông báo gần đây: ${context.announcements.map(a => a.title).join(', ') || 'Chưa có'}

Nhiệm vụ của bạn:
1. Hỗ trợ trả lời các câu hỏi về thông tin nhóm dựa trên dữ liệu trên.
2. Giúp soạn thảo thông báo chuyên nghiệp.
3. Gợi ý các nhiệm vụ mới dựa trên tình hình nhóm.
4. Phân tích tài chính và đưa ra lời khuyên nếu được hỏi.
5. Luôn trả lời bằng Tiếng Việt, thân thiện, lịch sự và mang tính xây dựng.
Nếu người dùng hỏi về điều gì đó không có trong dữ liệu, hãy trả lời dựa trên kiến thức chung của bạn và ghi chú rõ đó là gợi ý chung.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Không thể kết nối với trí tuệ nhân tạo.");
  }
};

export const analyzeTasks = async (tasks: any[], members: any[]) => {
  try {
    const taskData = tasks.map(t => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assignees: t.assigneeNames?.join(', ') || 'Chưa có'
    }));

    const memberData = members.map(m => m.displayName);

    const prompt = `Hãy phân tích danh sách công việc sau đây và đưa ra:
1. Báo cáo tóm tắt tiến độ (bao nhiêu xong, bao nhiêu đang làm, bao nhiêu trễ).
2. Đánh giá sự phân bổ công việc (ai đang quá tải, ai đang rảnh).
3. Đưa ra 3 lời khuyên cụ thể để đẩy nhanh tiến độ.
4. Gợi ý phân công lại hoặc giao việc mới nếu thấy cần thiết.

Danh sách công việc: ${JSON.stringify(taskData)}
Danh sách thành viên: ${memberData.join(', ')}

Trả lời bằng Tiếng Việt, chuyên nghiệp, súc tích, định dạng Markdown đẹp.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Bạn là chuyên gia quản trị dự án thông minh.",
        temperature: 0.6,
      },
    });

    return response.text || "Không thể phân tích dữ liệu lúc này.";
  } catch (error) {
    console.error("Task Analysis Error:", error);
    return "Lỗi phân tích AI: " + (error instanceof Error ? error.message : String(error));
  }
};

export const suggestTasks = async (prompt: string, members: any[]) => {
  try {
    const memberData = members.map(m => ({ id: m.uid, name: m.displayName }));

    const systemInstruction = `Bạn là chuyên gia quản trị dự án. Khi nhận được yêu cầu từ Admin, hãy chia nhỏ công việc và giao cho các thành viên phù hơp.
Dữ liệu thành viên: ${JSON.stringify(memberData)}

YÊU CẦU QUAN TRỌNG: 
- Bạn PHẢI trả về kết quả dưới dạng JSON một mảng các đối tượng Task.
- Mỗi đối tượng Task gồm: title (tiêu đề), description (mô tả chi tiết), priority ('low'|'medium'|'high'), assigneeId (ID của thành viên được chọn), assigneeName (Tên thành viên).
- Hãy phân bổ công việc công bằng dựa trên tên thành viên.
- KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON.

Ví dụ định dạng:
[
  { "title": "Mua đồ ăn", "description": "Mua thịt, rau và nước uống cho 10 người", "priority": "high", "assigneeId": "user123", "assigneeName": "Nguyễn Văn A" }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Yêu cầu từ Admin: ${prompt}`,
      config: {
        systemInstruction,
        temperature: 0.5,
        responseMimeType: "application/json"
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Suggest Tasks AI Error:", error);
    throw error;
  }
};
