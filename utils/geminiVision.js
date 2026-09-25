// File: utils/geminiVision.js
const { GoogleGenAI } = require('@google/genai');

// Khởi tạo Gemini client sử dụng biến môi trường GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function analyzePokemonTeamImage(imageUrl) {
    try {
        // Tải hình ảnh từ URL (ví dụ URL đính kèm của Discord) dưới dạng buffer
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Không thể tải hình ảnh từ URL (${imageResponse.status})`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Chuyển đổi buffer thành chuỗi base64 để truyền cho Gemini
        const base64Image = buffer.toString('base64');
        
        // Lấy định dạng mimeType của ảnh (mặc định là image/jpeg nếu không có)
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Gọi Gemini 2.5 Flash để đọc và phân tích ảnh
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: mimeType
                    }
                },
                {
                    text: `Hãy đọc chi tiết toàn bộ team Pokémon trong hình ảnh này (bao gồm: Tên Pokémon, Ability, Item và danh sách các chiêu thức/Moves của từng con). Không phân tích gì thêm`
                }
            ]
        });

        return response.text;
    } catch (error) {
        console.error('[GEMINI VISION ERROR]:', error);
        return '❌ Đã xảy ra lỗi trong quá trình phân tích hình ảnh team bằng AI.';
    }
}

module.exports = { analyzePokemonTeamImage };