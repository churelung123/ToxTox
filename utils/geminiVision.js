// File: utils/geminiVision.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function analyzePokemonTeamImages(imageUrls) {
    try {
        const imageParts = [];

        for (const url of imageUrls) {
            console.log('[GEMINI VISION] Fetching image from URL:', url);
            const imageResponse = await fetch(url);

            if (!imageResponse.ok) {
                console.error(`[GEMINI VISION] Failed to fetch image. Status: ${imageResponse.status} for URL: ${url}`);
                continue;
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

            imageParts.push({
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType
                }
            });
        }

        if (imageParts.length === 0) {
            return '❌ Không thể tải được dữ liệu hình ảnh (Link Discord có thể đã hết hạn hoặc không hợp lệ).';
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...imageParts,
                {
                    text: `Hãy đọc chi tiết toàn bộ team Pokémon trong hình ảnh này (Không đoán theo build trên internet, trả lời đúng theo form bên dưới mà không thêm bất kỳ text nào khác, không fotmat, không giải thích, không thêm bất kỳ ký tự nào khác ngoài nội dung yêu cầu).
                    - Nếu hình ảnh là Move&More, lấy ra tên Pokémon, ability, item và danh sách các chiêu thức của từng pokemon.
                    - Nếu hình ảnh là Stats, lấy ra tên tính cách của từng pokemon dựa vào mũi tên tăng giảm của các chỉ số. Adamant	Attack	Sp. Atk
                        Bashful: tăng Sp. Atk, giảm Sp. Def
                        Bold: tăng Defense, giảm Attack
                        Brave: tăng Attack, giảm Speed
                        Calm: tăng Sp. Def, giảm Attack
                        Careful: tăng Sp. Def, giảm Sp. Atk
                        Docile: tăng Defense, giảm Defense
                        Gentle: tăng Sp. Def, giảm Defense
                        Hardy: tăng Attack, giảm Attack
                        Hasty: tăng Speed, giảm Defense
                        Impish: tăng Defense, giảm Sp. Atk
                        Jolly: tăng Speed, giảm Sp. Atk
                        Lax: tăng Defense, giảm Sp. Def
                        Lonely: tăng Attack, giảm Defense
                        Mild: tăng Sp. Atk, giảm Defense
                        Modest: tăng Sp. Atk, giảm Attack
                        Naive: tăng Speed, giảm Sp. Def
                        Naughty: tăng Attack, giảm Sp. Def
                        Quiet: tăng Sp. Atk, giảm Speed
                        Quirky: tăng Sp. Def, giảm Sp. Def
                        Rash: tăng Sp. Atk, giảm Sp. Def
                        Relaxed: tăng Defense, giảm Speed
                        Sassy: tăng Sp. Def, giảm Speed
                        Serious: tăng Speed, giảm Speed
                        Timid: tăng Speed, giảm Attack
                    In ra chỉ số theo dạng

                "Froslass-Mega @ Froslassite
                Ability: Snow Warning
                Timid Nature

                - Blizzard
                - Protect
                - Shadow Ball
                - Aurora Veil

                Sneasler @ White Herb
                Ability: Unburden
                Jolly Nature

                - Close Combat
                - Fake Out
                - Dire Claw
                - Protect

                Arcanine-Hisui @ Focus Sash
                Ability: Rock Head
                Adamant Nature

                - Flare Blitz
                - Head Smash
                - Extreme Speed
                - Protect

                Garchomp @ Life Orb
                Ability: Rough Skin
                Jolly Nature

                - Dragon Claw
                - Earthquake
                - Rock Slide
                - Protect

                Rotom-Frost @ Choice Scarf
                Ability: Levitate
                Modest Nature

                - Blizzard
                - Discharge
                - Volt Switch
                - Electroweb

                Kingambit @ Black Glasses
                Ability: Defiant
                Adamant Nature

                - Sucker Punch
                - Kowtow Cleave
                - Iron Head
                - Protect"`
                }
            ]
        });

        return response.text;
    } catch (error) {
        console.error('[GEMINI VISION ERROR]:', error);
        return '❌ Đã xảy ra lỗi trong quá trình phân tích hình ảnh team bằng AI.';
    }
}

module.exports = { analyzePokemonTeamImages };