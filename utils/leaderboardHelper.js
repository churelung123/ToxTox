// File: utils/leaderboardHelper.js
const { pool } = require('./database');

async function generateLeaderboardPage(page = 1) {
    try {
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        // Lấy tổng số lượng thí sinh
        const countRes = await pool.query('SELECT COUNT(*) FROM players');
        const totalPlayers = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalPlayers / pageSize) || 1;

        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;

        // Lấy danh sách thí sinh phân trang
        const res = await pool.query(`
            SELECT discord_id, in_game_name, wins, losses, team_sheet_url 
            FROM players 
            ORDER BY wins DESC, losses ASC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        const players = res.rows;
        const components = [];

        if (players.length === 0) {
            // Trường hợp không có dữ liệu, tạo một Action Row chứa text hoặc thông báo đơn giản
        } else {
            // Với mỗi thí sinh, ta tạo một Action Row (type: 1) chứa thông tin hoặc kết hợp nút bấm
            // Lưu ý: Discord Action Row chứa tối đa 5 nút hoặc các component tương thích. 
            // Để hiển thị tên thí sinh và nút xem Team Sheet trên cùng một hàng theo chuẩn Action Row,
            // ta có thể dùng Button kiểu Link (Style 5) kèm nhãn là tên thí sinh/thứ hạng.
            
            let currentRow = {
                type: 1, // Action Row bắt buộc ở cấp root
                components: []
            };

            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || 'User';
                const label = `${rankEmoji} #${globalIndex}: ${playerName} (${p.wins}T/${p.losses}B)`;

                // Thêm button link vào hàng hiện tại (mỗi hàng tối đa 5 nút)
                if (currentRow.components.length >= 5) {
                    components.push(currentRow);
                    currentRow = { type: 1, components: [] };
                }

                currentRow.components.push({
                    type: 2, // Button component
                    style: 5, // Link style
                    label: label.substring(0, 80), // Giới hạn ký tự label của Discord button là 80
                    url: p.team_sheet_url || 'https://discord.com'
                });
            });

            if (currentRow.components.length > 0) {
                components.push(currentRow);
            }
        }

        // Thêm hàng nút điều hướng trang (Pagination Row) ở cuối
        const paginationRow = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_1`,
                    label: '⏪ Đầu',
                    disabled: page === 1
                },
                {
                    type: 2,
                    style: 1,
                    custom_id: `bxh_page_${page - 1}`,
                    label: '◀️ Trước',
                    disabled: page <= 1
                },
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_info`,
                    label: `Trang ${page}/${totalPages}`,
                    disabled: true
                },
                {
                    type: 2,
                    style: 1,
                    custom_id: `bxh_page_${page + 1}`,
                    label: 'Sau ▶️',
                    disabled: page >= totalPages
                },
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_${totalPages}`,
                    label: 'Cuối ⏩',
                    disabled: page === totalPages
                }
            ]
        };

        components.push(paginationRow);

        // Trả về nội dung dạng text thông báo kèm các hàng nút bấm trực quan
        return {
            content: `### 🏆 BẢNG XẾP HẠNG GIẢI ĐẤU (Trang ${page}/${totalPages})\n*Bấm vào các nút bên dưới để xem trực tiếp Team Sheet của từng thí sinh:*`,
            components: components
        };
    } catch (err) {
        console.error('[LEADERBOARD ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardPage };