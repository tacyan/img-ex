/**
 * @file server.js
 * @description 画像抽出ツールのバックエンドサーバー
 * CORSの問題を回避し、Webページの取得と画像のプロキシを提供する
 * Vercelにデプロイするための設定も含む
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// タイムアウトと最大コンテンツサイズの設定
const REQUEST_TIMEOUT = 30000; // 30秒
const MAX_CONTENT_LENGTH = 50 * 1024 * 1024; // 50MB

// 静的ファイルを提供
app.use(express.static(path.join(__dirname, '/')));

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error('サーバーエラー:', err);
    res.status(500).json({
        error: 'サーバーでエラーが発生しました',
        message: err.message || 'Unknown error'
    });
});

// URLからWebページを取得するAPI
app.get('/api/fetch', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URLが指定されていません' });
    }
    
    try {
        console.log(`Fetching URL: ${url}`);
        
        // ユーザーエージェントを設定してブラウザとして振る舞う
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
                'Referer': url,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            maxRedirects: 10,
            timeout: REQUEST_TIMEOUT,
            responseType: 'text',
            maxContentLength: MAX_CONTENT_LENGTH,
            validateStatus: status => status < 500 // 5xx以外のステータスコードは許容
        });
        
        // 200以外のステータスコードの場合は警告
        if (response.status !== 200) {
            console.warn(`非200レスポンス: ${response.status} for ${url}`);
        }
        
        // レスポンスをそのまま返す
        res.set('Content-Type', 'text/html');
        res.send(response.data);
    } catch (error) {
        console.error('Error fetching URL:', error.message);
        
        // エラーの詳細情報
        const errorDetails = {
            error: 'URLの取得に失敗しました',
            url: url,
            message: error.message
        };
        
        // タイムアウトエラーの場合
        if (error.code === 'ECONNABORTED') {
            errorDetails.reason = 'リクエストがタイムアウトしました';
        }
        
        // ネットワークエラーの場合
        if (error.code === 'ENOTFOUND') {
            errorDetails.reason = 'ホストが見つかりませんでした';
        }
        
        res.status(500).json(errorDetails);
    }
});

// 画像をプロキシするAPI
app.get('/api/image', async (req, res) => {
    const url = req.query.url;
    const download = req.query.download === 'true';
    const preserveOriginal = req.query.original === 'true';
    
    if (!url) {
        return res.status(400).json({ error: '画像URLが指定されていません' });
    }
    
    try {
        // リクエストヘッダーを設定
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': new URL(url).origin,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Cache-Control': 'no-cache'
        };

        // WebPを避けてオリジナル形式を取得したい場合はAcceptヘッダーを調整
        if (preserveOriginal) {
            // オリジナル形式優先のヘッダーを設定
            headers['Accept'] = 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5';
            headers['Accept-Encoding'] = 'identity'; // 圧縮なし
        } else {
            headers['Accept-Encoding'] = 'gzip, deflate, br';
        }
        
        // 画像をバイナリデータとして取得
        const response = await axios.get(url, {
            headers: headers,
            responseType: 'arraybuffer',
            timeout: REQUEST_TIMEOUT,
            maxRedirects: 10,
            maxContentLength: MAX_CONTENT_LENGTH,
            validateStatus: status => status < 500
        });
        
        // 200以外のステータスコードの場合はエラー画像を返す
        if (response.status !== 200) {
            console.warn(`画像取得失敗: ${response.status} for ${url}`);
            return sendErrorImage(res);
        }
        
        // Content-Typeを設定
        const contentType = response.headers['content-type'];
        
        // コンテンツタイプが画像でない場合はエラー
        if (contentType && !contentType.toLowerCase().startsWith('image/')) {
            console.warn(`画像以外のコンテンツタイプ: ${contentType} for ${url}`);
            return sendErrorImage(res);
        }
        
        res.set('Content-Type', contentType || 'image/jpeg');
        
        // ダウンロード指定がある場合、ファイル名を設定
        if (download) {
            // URLからファイル名と拡張子を取得
            let filename = getFilenameFromUrl(url, contentType);
            
            res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        }
        
        // 画像データを返す
        res.send(Buffer.from(response.data, 'binary'));
    } catch (error) {
        console.error('Error fetching image:', error.message);
        sendErrorImage(res);
    }
});

// URLから適切なファイル名を取得する関数
function getFilenameFromUrl(url, contentType) {
    try {
        // URLからファイル名を取得
        let filename = url.split('/').pop().split('?')[0].split('#')[0];
        
        if (!filename || filename === '') {
            filename = 'image';
        }
        
        // 拡張子を確認
        const hasExtension = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(filename);
        
        // 拡張子がない場合はContent-Typeから追加
        if (!hasExtension && contentType) {
            const extensions = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/svg+xml': 'svg',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff'
            };
            
            const ext = extensions[contentType.toLowerCase()] || 'jpg';
            filename += `.${ext}`;
        }
        
        return filename;
    } catch (error) {
        console.warn('ファイル名の生成に失敗しました:', error);
        return 'image.jpg';
    }
}

// エラー画像を送信する関数
function sendErrorImage(res) {
    res.set('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#f0f0f0"/>
        <text x="50%" y="45%" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#999">Image</text>
        <text x="50%" y="60%" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#999">Not Available</text>
    </svg>`);
}

// CSSファイルを取得してパースするAPI（オプション機能）
app.get('/api/css', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'CSS URLが指定されていません' });
    }
    
    try {
        // CSSファイルを取得
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/css,*/*;q=0.1',
                'Referer': new URL(url).origin
            },
            timeout: REQUEST_TIMEOUT,
            responseType: 'text',
            maxContentLength: MAX_CONTENT_LENGTH
        });
        
        // CSSをパースして画像URLを抽出
        const cssText = response.data;
        const imageUrls = extractImagesFromCss(cssText, url);
        
        res.json({ imageUrls });
    } catch (error) {
        console.error('Error fetching CSS:', error.message);
        res.status(500).json({ error: 'CSSの取得に失敗しました', message: error.message });
    }
});

// CSSから画像URLを抽出する関数
function extractImagesFromCss(cssText, baseUrl) {
    const imageUrls = [];
    const urlRegex = /url\(['"]?([^'")]+)['"]?\)/gi;
    let match;
    
    while ((match = urlRegex.exec(cssText)) !== null) {
        const imageUrl = match[1];
        if (imageUrl && !imageUrl.startsWith('data:')) {
            try {
                const absoluteUrl = new URL(imageUrl, baseUrl).href;
                if (!imageUrls.includes(absoluteUrl)) {
                    imageUrls.push(absoluteUrl);
                }
            } catch (error) {
                console.warn('Invalid URL:', imageUrl);
            }
        }
    }
    
    return imageUrls;
}

// インデックスページを提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 通常の起動方法（ローカル開発用）
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Vercelのサーバーレス関数用にエクスポート
module.exports = app; 
