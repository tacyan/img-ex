// グローバル変数
let extractedImages = [];
let originalUrl = '';

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素を確認してから処理を行う関数
    const initializeElements = () => {
        const urlForm = document.getElementById('url-form');
        const selectAllBtn = document.getElementById('select-all-btn');
        const deselectAllBtn = document.getElementById('deselect-all-btn');
        const downloadSelectedBtn = document.getElementById('download-selected-btn');
        const downloadAllBtn = document.getElementById('download-all-btn');
        const applyFilterBtn = document.getElementById('apply-filter');
        const quickFilterBtn = document.getElementById('quick-100px-filter');
        const searchModeBtn = document.getElementById('search-mode-btn');
        const filterSmall = document.getElementById('filter-small');
        const sortBy = document.getElementById('sort-by');
        const masterCheckbox = document.getElementById('master-checkbox');

        // 要素の存在チェック
        if (urlForm) {
            urlForm.addEventListener('submit', handleFormSubmit);
        } else {
            console.error('URL form element not found');
        }

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', selectAllImages);
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', deselectAllImages);
        }

        if (downloadSelectedBtn) {
            downloadSelectedBtn.addEventListener('click', downloadSelectedImages);
        }

        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', downloadAllImages);
        }

        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', applyFilters);
        }

        if (quickFilterBtn) {
            quickFilterBtn.addEventListener('click', applyQuickFilter);
        }
        
        if (searchModeBtn) {
            searchModeBtn.addEventListener('click', applySearchEngineMode);
        }

        if (filterSmall) {
            filterSmall.addEventListener('change', applyFilters);
        }

        if (sortBy) {
            sortBy.addEventListener('change', applyFilters);
        }
        
        // 全選択マスターチェックボックス
        if (masterCheckbox) {
            masterCheckbox.addEventListener('change', () => {
                toggleAllVisibleImages(masterCheckbox.checked);
            });
        }

        // フォーマットフィルターのイベントリスナーを設定
        document.querySelectorAll('input[name="format-filter"]').forEach(checkbox => {
            checkbox.addEventListener('change', applyFilters);
        });
        
        // サイトフィルターのイベントリスナーを設定
        document.querySelectorAll('input[name="site-filter"]').forEach(checkbox => {
            checkbox.addEventListener('change', applyFilters);
        });
        
        // URLからクエリパラメータを取得して自動実行
        const urlParams = new URLSearchParams(window.location.search);
        const autoUrl = urlParams.get('url');
        if (autoUrl) {
            const urlInput = document.getElementById('url-input');
            if (urlInput) {
                // デコードして表示用にする
                try {
                    // 完全な日本語表示にするためにgetDisplayUrlを使用
                    const decodedUrl = getDisplayUrl(decodeURIComponent(autoUrl));
                    urlInput.value = decodedUrl;
                } catch (e) {
                    // エラー時は通常のデコードを使用
                    urlInput.value = decodeURIComponent(autoUrl);
                }
                
                // 少し遅延させてフォームを送信
                setTimeout(() => {
                    if (urlForm) urlForm.dispatchEvent(new Event('submit'));
                }, 500);
            }
        }
    };

    // 初期化の実行
    try {
        initializeElements();
    } catch (error) {
        console.error('初期化中にエラーが発生しました:', error);
    }
});

// フォーム送信ハンドラー
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // URLを取得
    const urlInput = document.getElementById('url-input');
    if (!urlInput) {
        console.error('URL入力要素が見つかりません');
        return;
    }
    
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('URLを入力してください');
        return;
    }
    
    // URLをユーザーフレンドリーな表示にする
    try {
        const displayUrl = getDisplayUrl(url);
        if (displayUrl !== url) {
            urlInput.value = displayUrl;
            // ユーザーに日本語表示を見せるためにURLを更新
            // 実際の検索処理では、エンコードされたURLを使用する
            console.log('表示用URL:', displayUrl);
        }
    } catch (e) {
        console.warn('URL表示変換エラー:', e);
    }
    
    // 元のURLを保存（表示用でなく、実際の処理用）
    originalUrl = url;
    
    // ローディング表示
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    }
    
    try {
        // 検索エンジンURLかどうかを確認して適切に処理
        let proxyUrl = '';
        if (isSearchEngineUrl(url)) {
            // 検索エンジンURLを適切に処理（非同期処理）
            proxyUrl = await handleSearchEngineUrl(url);
        } else {
            // 通常のプロキシURLを使用
            proxyUrl = `/api/fetch?url=${encodeURIComponent(url)}`;
        }
        
        // HTMLコンテンツを取得
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // HTMLからimgタグの画像を抽出
        extractImagesFromHtml(html, url);
        
    } catch (error) {
        console.error('Error fetching URL:', error);
        alert(`エラーが発生しました: ${error.message}`);
    } finally {
        // ローディング非表示
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

// 検索エンジンURLかどうかを判定する関数
function isSearchEngineUrl(url) {
    const lowerUrl = url.toLowerCase();
    
    // 主要な検索エンジンとパターンを検出
    return (
        // Google
        (lowerUrl.includes('google.com') && (lowerUrl.includes('/search') || lowerUrl.includes('?q='))) ||
        // Yahoo
        (lowerUrl.includes('yahoo.co.jp') && (lowerUrl.includes('/search') || lowerUrl.includes('?query='))) ||
        // Bing
        (lowerUrl.includes('bing.com') && (lowerUrl.includes('/search') || lowerUrl.includes('?q='))) ||
        // Freepik - 検索クエリとパスベースの両方を対応
        (lowerUrl.includes('freepik.com') && (
            lowerUrl.includes('/search') ||  // クエリベース: /search?query=...
            lowerUrl.includes('/vectors/') || // パスベース: /vectors/...
            lowerUrl.includes('/photos/') ||
            lowerUrl.includes('/premium/') ||
            lowerUrl.includes('/ai-image/')
        )) ||
        // 一般的な検索パターン
        (lowerUrl.includes('search') && (
            lowerUrl.includes('?q=') || 
            lowerUrl.includes('?query=') || 
            lowerUrl.includes('?keyword=') ||
            lowerUrl.includes('?search=')
        ))
    );
}

// 検索エンジンURLを処理する関数
async function handleSearchEngineUrl(url) {
    console.log('検索エンジンURLを処理します:', url);
    
    try {
        // URLオブジェクトを作成
        const urlObj = new URL(url);
        const lowerUrl = url.toLowerCase();
        
        // URLの種類を識別
        const isFreepikUrl = lowerUrl.includes('freepik.com');
        const isFreepikSearchPath = isFreepikUrl && lowerUrl.includes('/search');
        const isFreepikVectorsPath = isFreepikUrl && (
            lowerUrl.includes('/vectors/') || 
            lowerUrl.includes('/photos/') || 
            lowerUrl.includes('/premium/') ||
            lowerUrl.includes('/ai-image/')
        );
        
        // Freepikの場合は専用の処理を使用
        if (isFreepikUrl && (isFreepikSearchPath || isFreepikVectorsPath)) {
            return await handleFreepikSearchUrl(url);
        }
        
        // 検索パラメータの特定（各検索エンジンで異なるパラメータ名を使用）
        let searchParam = '';
        let paramName = '';
        
        // 検索エンジン別のパラメータ名を特定
        if (url.includes('google.com')) {
            paramName = 'q';
        } else if (url.includes('yahoo.co.jp')) {
            paramName = 'p';
            if (!urlObj.searchParams.has('p')) paramName = 'query';
        } else if (url.includes('bing.com')) {
            paramName = 'q';
        } else {
            // 一般的な検索パラメータ名を試す
            const possibleParams = ['q', 'query', 'keyword', 'search', 'p'];
            for (const param of possibleParams) {
                if (urlObj.searchParams.has(param)) {
                    paramName = param;
                    break;
                }
            }
        }
        
        // 検索クエリを取得
        if (paramName) {
            searchParam = urlObj.searchParams.get(paramName) || '';
            
            if (searchParam) {
                // すでにエンコードされている場合はデコードして表示
                const decodedQuery = decodeURIComponent(searchParam);
                console.log(`検索クエリ (${paramName}): ${decodedQuery}`);
                
                // URLの表示を更新
                const urlInput = document.getElementById('url-input');
                if (urlInput) {
                    const displayUrl = getDisplayUrl(url);
                    if (displayUrl !== urlInput.value) {
                        urlInput.value = displayUrl;
                    }
                }
            }
        }
    } catch (error) {
        console.error('検索URL処理中にエラーが発生しました:', error);
    }
    
    // 通常のエンコードを使用
    return `/api/fetch?url=${encodeURIComponent(url)}`;
}

// Freepikの検索URLを処理する関数
async function handleFreepikSearchUrl(url) {
    console.log('Freepikの検索URLを処理します:', url);
    
    try {
        // URLオブジェクトを作成
        const urlObj = new URL(url);
        
        // FreepikのURL形式の検出
        const isSearchPath = url.includes('/search');
        const isVectorsPath = url.includes('/vectors/') || url.includes('/photos/') || 
                             url.includes('/premium/') || url.includes('/ai-image/');
        
        // URLパス部分から検索キーワードを取得（/vectors/鳥のイラスト のようなパターン）
        let searchKeyword = '';
        let searchType = '';
        
        if (isVectorsPath) {
            // パスからキーワードを抽出（/vectors/鳥のイラスト から鳥のイラスト を取得）
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
            if (pathSegments.length >= 2) {
                // 最初のセグメントを種類として扱う（vectors, photos など）
                searchType = pathSegments[0];
                // 2番目のセグメントをキーワードとして扱う
                searchKeyword = decodeURIComponent(pathSegments[1]);
                
                // ハッシュタグ部分を削除（#from_element=categories_trends など）
                if (searchKeyword.includes('#')) {
                    searchKeyword = searchKeyword.split('#')[0];
                }
                
                console.log(`パスから抽出 - タイプ: ${searchType}, キーワード: ${searchKeyword}`);
            }
        }
        
        // 検索パラメータを取得
        const queryParam = urlObj.searchParams.get('query') || '';
        const typeParam = urlObj.searchParams.get('type') || '';
        const formatParam = urlObj.searchParams.get('format') || '';
        const lastFilterParam = urlObj.searchParams.get('last_filter') || '';
        const lastValueParam = urlObj.searchParams.get('last_value') || '';
        
        // 追加パラメータの取得 (ページング、ソート等)
        const pageParam = urlObj.searchParams.get('page') || '';
        const sortParam = urlObj.searchParams.get('sort') || '';
        const orderParam = urlObj.searchParams.get('order') || '';
        const styleParam = urlObj.searchParams.get('style') || '';
        const colorParam = urlObj.searchParams.get('color') || '';
        
        // パラメータをデコード
        const decodedQuery = queryParam ? decodeURIComponent(queryParam) : '';
        const decodedType = typeParam ? decodeURIComponent(typeParam) : '';
        const decodedFormat = formatParam ? decodeURIComponent(formatParam) : '';
        const decodedLastFilter = lastFilterParam ? decodeURIComponent(lastFilterParam) : '';
        const decodedLastValue = lastValueParam ? decodeURIComponent(lastValueParam) : '';
        
        // 検索情報をコンソールに表示
        if (isSearchPath) {
            console.log(`検索パラメータ - クエリ: ${decodedQuery}, タイプ: ${decodedType}, フォーマット: ${decodedFormat}`);
            if (lastFilterParam) {
                console.log(`追加フィルター - ${decodedLastFilter}: ${decodedLastValue}`);
            }
            
            // 追加パラメータの表示
            if (pageParam || sortParam || orderParam || styleParam || colorParam) {
                console.log(`その他のパラメータ - ページ: ${pageParam}, ソート: ${sortParam}, 順序: ${orderParam}, スタイル: ${styleParam}, 色: ${colorParam}`);
            }
        }
        
        // URLの表示をユーザーフレンドリーに更新
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            // 表示用のURLを生成
            const displayUrl = getDisplayUrl(url);
            urlInput.value = displayUrl;
        }
        
        // 特殊な文字や空白の処理
        // Freepikでは、空白を含む検索クエリ（スペースを含む複数キーワードの組み合わせなど）が問題を引き起こす可能性がある
        let processedQuery = normalizeSearchQuery(decodedQuery);
        let processedLastValue = normalizeSearchQuery(decodedLastValue);
        
        
        // 特殊な文字や空白の処理
        // 正規化された検索クエリをログに表示
        if (processedQuery !== decodedQuery) {
            console.log(`検索クエリを正規化: '${decodedQuery}' → '${processedQuery}'`);
        }
        if (processedLastValue !== decodedLastValue) {
            console.log(`last_valueを正規化: '${decodedLastValue}' → '${processedLastValue}'`);
        }
        
        // 最終的なURLを構築
        let processedUrl;
        
        if (isSearchPath) {
            // 検索パスの場合はパラメータを適切に再エンコード
            const processedUrlObj = new URL(url);
            
            // 検索クエリの特殊処理
            if (queryParam) {
                // 空白を含む検索クエリを正しく処理
                const normalizedQuery = processedQuery.trim();
                processedUrlObj.searchParams.set('query', encodeURIComponent(normalizedQuery));
            }
            
            // 各パラメータを新しく設定し直す
            if (typeParam) {
                processedUrlObj.searchParams.set('type', encodeURIComponent(decodedType));
            }
            if (formatParam) {
                processedUrlObj.searchParams.set('format', encodeURIComponent(decodedFormat));
            }
            if (lastFilterParam) {
                processedUrlObj.searchParams.set('last_filter', encodeURIComponent(decodedLastFilter));
            }
            if (lastValueParam) {
                // 空白を含むlast_valueも正しく処理
                const normalizedLastValue = processedLastValue.trim();
                processedUrlObj.searchParams.set('last_value', encodeURIComponent(normalizedLastValue));
            }
            
            // その他のパラメータも保持
            if (pageParam) processedUrlObj.searchParams.set('page', pageParam);
            if (sortParam) processedUrlObj.searchParams.set('sort', sortParam);
            if (orderParam) processedUrlObj.searchParams.set('order', orderParam);
            if (styleParam) processedUrlObj.searchParams.set('style', styleParam);
            if (colorParam) processedUrlObj.searchParams.set('color', colorParam);
            
            processedUrl = processedUrlObj.toString();
        } else if (isVectorsPath && searchKeyword) {
            // パスベースの検索URLの場合は、そのまま使用
            processedUrl = url;
        } else {
            // その他のURLの場合はそのまま使用
            processedUrl = url;
        }
        
        console.log('処理後のURL:', processedUrl);
        
        // プロキシURLを返す
        return `/api/fetch?url=${encodeURIComponent(processedUrl)}`;
    } catch (error) {
        console.error('Freepik検索URL処理中にエラーが発生しました:', error);
    }
    
    // エラーがあった場合は通常のエンコードを使用
    return `/api/fetch?url=${encodeURIComponent(url)}`;
}

// 検索クエリを正規化する関数（空白や特殊文字を適切に処理）
function normalizeSearchQuery(query) {
    if (!query) return '';
    
    try {
        // 半角スペース、全角スペース、タブなどを単一の半角スペースに置換
        let normalized = query.replace(/[\s\u3000\t\n\r]+/g, ' ');
        
        // 前後の空白を削除
        normalized = normalized.trim();
        
        // Freepikの検索に適した形式に変換（+記号を空白に変換）
        normalized = normalized.replace(/\+/g, ' ');
        
        return normalized;
    } catch (e) {
        console.warn('クエリの正規化に失敗しました:', e);
        return query;
    }
}

// HTMLからimgタグの画像を抽出
function extractImagesFromHtml(html, baseUrl) {
    // 抽出した画像をリセット
    extractedImages = [];
    
    try {
    // DOMパーサーを使用してHTMLを解析
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
        // 特定のサイト向けの特殊処理
        const hostname = new URL(baseUrl).hostname;
        
        if (hostname.includes('google.com')) {
            // Google検索結果からの画像抽出（画像検索結果）
            extractGoogleImages(doc, baseUrl);
        } else if (hostname.includes('irasutoya.com')) {
            // いらすとやからの画像抽出
            extractIrasutoyaImages(doc, baseUrl);
        } else if (hostname.includes('bing.com')) {
            // Bing検索結果からの画像抽出
            extractBingImages(doc, baseUrl);
        } else if (hostname.includes('yahoo.co.jp')) {
            // Yahoo検索結果からの画像抽出
            extractYahooImages(doc, baseUrl);
        } else if (hostname.includes('ac-illust.com')) {
            // イラストACからの画像抽出
            extractIllustACImages(doc, baseUrl);
        } else if (hostname.includes('pixiv.net')) {
            // Pixivからの画像抽出
            extractPixivImages(doc, baseUrl);
        } else if (hostname.includes('freepik.com')) {
            // Freepikからの画像抽出
            extractFreepikImages(doc, baseUrl);
        } else {
            // 通常の画像抽出処理
            performStandardImageExtraction(doc, baseUrl);
        }
        
        // 外部スタイルシートのリンクを抽出
        const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
        const cssPromises = [];
        
        linkElements.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                try {
                    const cssUrl = resolveUrl(href, baseUrl);
                    // サーバー側のCSS解析APIを使用
                    const promise = fetchCssImages(cssUrl);
                    cssPromises.push(promise);
                } catch (error) {
                    console.warn('外部CSSの取得に失敗しました:', error);
                }
            }
        });
        
        // すべてのCSS処理を並列で行い、完了を待つ
        Promise.allSettled(cssPromises)
            .then(() => {
                console.log('すべての外部CSSの処理が完了しました');
                // フィルターを再適用
                applyFilters();
            })
            .catch(error => {
                console.error('外部CSS処理中にエラーが発生しました:', error);
            });
    } catch (error) {
        console.error('HTML解析中にエラーが発生しました:', error);
    }
    
    // 結果を表示
    displayImages();
}

// 標準的な画像抽出処理
function performStandardImageExtraction(doc, baseUrl) {
    // imgタグを取得（srcset属性も含む）
    const imgTags = doc.querySelectorAll('img');
    
    console.log(`${imgTags.length}個のimg要素を検出しました`);
    
    // 各imgタグから画像URLを抽出
    imgTags.forEach(img => {
        // 通常のsrc属性
        const src = img.getAttribute('src');
        if (src) {
            addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
        }
        
        // srcset属性（レスポンシブ画像用）
        const srcset = img.getAttribute('srcset');
        if (srcset) {
            // srcsetの各部分を解析
            const srcsetParts = srcset.split(',');
            srcsetParts.forEach(part => {
                // URLの部分を抽出（スペースで区切られた最初の部分）
                const url = part.trim().split(' ')[0];
                if (url) {
                    addImageIfNotExists(resolveUrl(url, baseUrl), baseUrl);
                }
            });
        }
        
        // data-srcやdata-original属性（遅延読み込み用）もチェック
        const dataSrc = img.getAttribute('data-src') || 
                       img.getAttribute('data-original') || 
                       img.getAttribute('data-lazy-src') ||
                       img.getAttribute('data-srcset') ||
                       img.getAttribute('data-url');
        if (dataSrc) {
            addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
        }
    });
    
    // CSSの背景画像も抽出（簡易的な実装）
    const styleElements = doc.querySelectorAll('style');
    styleElements.forEach(style => {
        if (style && style.textContent) {
            const cssText = style.textContent;
            extractImagesFromCss(cssText, baseUrl);
        }
    });
    
    // インラインスタイルの背景画像も抽出
    const elementsWithStyle = doc.querySelectorAll('[style*="background"]');
    elementsWithStyle.forEach(element => {
        if (element) {
        const styleAttr = element.getAttribute('style');
        if (styleAttr) {
            const matches = styleAttr.match(/background(-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
            if (matches && matches[2]) {
                addImageIfNotExists(resolveUrl(matches[2], baseUrl), baseUrl);
                }
            }
        }
    });
    
    // linkやaタグ内の画像っぽいリンクも抽出
    const links = doc.querySelectorAll('a[href], link[href]');
    links.forEach(link => {
        if (link) {
            const href = link.getAttribute('href');
            if (href && isImageUrl(href)) {
                addImageIfNotExists(resolveUrl(href, baseUrl), baseUrl);
            }
        }
    });
}

// Google検索結果からの画像抽出
function extractGoogleImages(doc, baseUrl) {
    console.log('Google検索結果からの画像抽出を実行します');
    
    // Google画像検索の一般的な画像コンテナを抽出
    let foundImages = false;
    let extractedCount = 0;
    
    // 画像検索結果のコンテナ (最新のセレクタを追加)
    const imageContainers = doc.querySelectorAll(
        'div.islrc img, div.isv-r img, a[href^="/imgres"] img, ' +
        '[data-src], img[data-iurl], img[data-ils], ' +
        'g-img img, .rg_i, .rg_anbg, .rg_ilmbg, ' +
        '.UwIUSe img, a.wXeWr img, .bicc img, ' +
        'div[jscontroller] img, div[data-hveid] img'
    );
    
    imageContainers.forEach(img => {
        foundImages = true;
        
        // 高解像度の画像URLを取得（複数の属性から探す）
        const src = img.getAttribute('src');
        const dataSrc = img.getAttribute('data-src');
        const dataIurl = img.getAttribute('data-iurl');
        const originalImage = img.getAttribute('data-thumbnail');
        const dataThumbnail = img.getAttribute('data-thumbnail-url');
        
        // 様々な属性をチェック
        if (dataSrc) {
            addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
            extractedCount++;
        }
        if (dataIurl) {
            addImageIfNotExists(resolveUrl(dataIurl, baseUrl), baseUrl);
            extractedCount++;
        }
        if (originalImage) {
            addImageIfNotExists(resolveUrl(originalImage, baseUrl), baseUrl);
            extractedCount++;
        }
        if (dataThumbnail) {
            addImageIfNotExists(resolveUrl(dataThumbnail, baseUrl), baseUrl);
            extractedCount++;
        }
        if (src) {
            // サムネイルを高解像度画像URLに変換
            const highResSrc = convertGoogleThumbnailToHighRes(src);
            addImageIfNotExists(resolveUrl(highResSrc || src, baseUrl), baseUrl);
            extractedCount++;
        }
        
        // google.comではJSONデータが含まれていることがある
        extractGoogleImageMetadata(img, baseUrl);
    });
    
    // HVEIDデータ属性から画像を抽出
    const elementsWithHveid = doc.querySelectorAll('[data-hveid]');
    elementsWithHveid.forEach(el => {
        const hveid = el.getAttribute('data-hveid');
        if (hveid) {
            // data-hveid近くのハイパーリンクから原画像URLを探す
            const nearbyLinks = el.querySelectorAll('a[href*="imgurl="]');
            nearbyLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const imgUrlMatch = href.match(/imgurl=([^&]+)/);
                    if (imgUrlMatch && imgUrlMatch[1]) {
                        try {
                            const decodedUrl = decodeURIComponent(imgUrlMatch[1]);
                            addImageIfNotExists(decodedUrl, baseUrl);
                            extractedCount++;
                            foundImages = true;
                        } catch (e) {
                            console.warn('URLデコードエラー:', e);
                        }
                    }
                }
            });
        }
    });
    
    // Google検索結果ページのすべてのaタグから画像URLを抽出
    const imageLinks = doc.querySelectorAll('a[href*="imgurl="]');
    imageLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
            const imgUrlMatch = href.match(/imgurl=([^&]+)/);
            if (imgUrlMatch && imgUrlMatch[1]) {
                try {
                    const decodedUrl = decodeURIComponent(imgUrlMatch[1]);
                    addImageIfNotExists(decodedUrl, baseUrl);
                    extractedCount++;
                    foundImages = true;
                } catch (e) {
                    console.warn('URLデコードエラー:', e);
                }
            }
        }
    });
    
    // 特殊なスクリプトからの画像URL抽出
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
        if (script.textContent) {
            // データURLと思われる部分を抽出
            const urlMatches = script.textContent.match(/"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp))"/g);
            if (urlMatches) {
                urlMatches.forEach(match => {
                    // 引用符を削除
                    const url = match.replace(/"/g, '');
                    addImageIfNotExists(url, baseUrl);
                    extractedCount++;
                });
            }
            
            // Google検索結果のJSONデータを抽出
            extractGoogleImageUrlsFromScript(script.textContent, baseUrl);
        }
    });
    
    // 通常の画像もスキャン
    if (!foundImages || extractedCount === 0) {
        console.log('Google検索結果に特殊な画像コンテナが見つかりませんでした。標準抽出を実行します。');
        performStandardImageExtraction(doc, baseUrl);
    } else {
        console.log(`Google検索から${extractedCount}個の画像候補を抽出しました`);
    }
}

// Google検索サムネイルを高解像度画像に変換
function convertGoogleThumbnailToHighRes(url) {
    if (!url) return null;
    
    // Google画像のサムネイルURLパターン
    if (url.includes('googleusercontent.com/img')) {
        // サムネイルURLから高解像度URLに変換
        return url.replace(/w\d+-h\d+/, 'w1000-h1000')
                 .replace(/s\d+/, 's1000');
    }
    
        return url;
}

// Google画像メタデータからURLを抽出
function extractGoogleImageMetadata(img, baseUrl) {
    // 親要素からJSONを抽出
    const parentElements = [
        img.closest('div[data-ri]'),
        img.closest('div[data-id]'),
        img.closest('[data-lfi]'),
        img.closest('[data-tbnid]'),
        img.closest('g-img'),
        img.closest('div.isv-r')
    ];
    
    parentElements.forEach(parent => {
        if (!parent) return;
        
        // 様々な属性をチェック
        const dataAttributes = [
            'data-tbnid', 'data-ri', 'data-id', 'data-lfi', 
            'data-meta', 'jsdata', 'data-lpage'
        ];
        
        dataAttributes.forEach(attr => {
            const metadata = parent.getAttribute(attr);
            if (!metadata) return;
            
            try {
                // 元画像URLを表す可能性のある属性
                const possibleUrlKeys = ['ou', 'ru', 'tu', 'imageUrl', 'thumbUrl', 'origUrl', 'imgurl', 'fullImageUrl'];
                
                // JSON形式の場合
                if (metadata.startsWith('{') && metadata.endsWith('}')) {
                    try {
                        const jsonData = JSON.parse(metadata);
                        possibleUrlKeys.forEach(key => {
                            if (jsonData[key]) {
                                addImageIfNotExists(jsonData[key], baseUrl);
                            }
                        });
                    } catch (e) {
                        // JSON解析に失敗した場合は正規表現で探す
                    }
                }
                
                // 正規表現でURLパターンを探す
                possibleUrlKeys.forEach(key => {
                    const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
                    const match = pattern.exec(metadata);
                    if (match && match[1]) {
                        const url = decodeURIComponent(match[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'));
                        addImageIfNotExists(url, baseUrl);
                    }
                });
                
                // imgrefパラメータからの抽出
                const imgrefMatch = metadata.match(/imgrefurl=([^&"]+)/i);
                if (imgrefMatch && imgrefMatch[1]) {
                    const url = decodeURIComponent(imgrefMatch[1]);
                    addImageIfNotExists(url, baseUrl);
                }
            } catch (e) {
                console.warn(`メタデータ解析エラー (${attr}):`, e);
            }
        });
    });
}

// スクリプトからGoogle画像URLを抽出
function extractGoogleImageUrlsFromScript(scriptContent, baseUrl) {
    if (!scriptContent) return;
    
    try {
        // AF_initDataCallback内のデータを探す
        const dataCallbackMatches = scriptContent.match(/AF_initDataCallback\s*\(\s*{(.+?)}\s*\)\s*;/g);
        if (dataCallbackMatches) {
            dataCallbackMatches.forEach(match => {
                // URLパターンを探す
                const urlMatches = match.match(/"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp|svg))"/g);
                if (urlMatches) {
                    urlMatches.forEach(urlMatch => {
                        const url = urlMatch.replace(/"/g, '');
                        addImageIfNotExists(url, baseUrl);
                    });
                }
                
                // データ構造内の画像URLを探す特殊なパターン
                const dataStructureMatch = match.match(/data\s*:\s*(\[.+?\])\s*}/);
                if (dataStructureMatch && dataStructureMatch[1]) {
                    // URLと思われる文字列を抽出
                    const potentialUrls = dataStructureMatch[1].match(/"(https?:\/\/[^"]{10,})"/g);
                    if (potentialUrls) {
                        potentialUrls.forEach(potentialUrl => {
                            const url = potentialUrl.replace(/"/g, '');
                            // 画像URLかどうかをチェック
                            if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) || 
                                url.includes('googleusercontent.com/img')) {
                                addImageIfNotExists(url, baseUrl);
                            }
                        });
                    }
                }
            });
        }
    } catch (e) {
        console.warn('スクリプトからの画像URL抽出エラー:', e);
    }
}

// いらすとやからの画像抽出
function extractIrasutoyaImages(doc, baseUrl) {
    console.log('いらすとやからの画像抽出を実行します');
    
    // いらすとやの記事コンテンツ内の画像
    const articleImages = doc.querySelectorAll('.entry .separator img, .entry .asset-content img, .entry-content img');
    if (articleImages.length > 0) {
        articleImages.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                // 100×100サイズのサムネイル画像（アイコン）を除外
                if (src.includes('_s.') || src.includes('_100.') || 
                    src.match(/\/s\d+\//) || src.includes('100x100')) {
                    // スキップ（データとして追加しない）
                    console.log('スキップ: 小さいサイズの画像', src);
                    return;
                }
                
                // いらすとやの画像は2種類のサイズがあるため、大きい方も取得
                const originalSrc = src.replace(/_\d+\.png$/, '.png').replace(/_\d+\.jpg$/, '.jpg');
                addImageIfNotExists(resolveUrl(originalSrc, baseUrl), baseUrl);
                addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            }
        });
    } else {
        // 一覧ページやその他のページの場合
        const thumbnails = doc.querySelectorAll('.thumb img, .boxim img');
        thumbnails.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                // 100×100サイズのサムネイル画像（アイコン）を除外
                if (src.includes('_s.') || src.includes('_100.') || 
                    src.match(/\/s\d+\//) || src.includes('100x100')) {
                    // スキップ（データとして追加しない）
                    console.log('スキップ: 小さいサイズの画像', src);
                    return;
                }
                
                // サムネイル画像パスから元の画像パスを推測
                const originalSrc = src.replace(/\/s\d+\//, '/s1600/')
                                     .replace(/_\d+\.png$/, '.png')
                                     .replace(/_\d+\.jpg$/, '.jpg');
                addImageIfNotExists(resolveUrl(originalSrc, baseUrl), baseUrl);
                addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            }
        });
        
        // 標準抽出も実行
        performStandardImageExtraction(doc, baseUrl);
    }
}

// Bing検索結果からの画像抽出
function extractBingImages(doc, baseUrl) {
    console.log('Bing検索結果からの画像抽出を実行します');
    
    // Bing画像検索の画像コンテナを抽出
    const imageContainers = doc.querySelectorAll('.imgpt img, .mimg, [class*="image"] img');
    if (imageContainers.length > 0) {
        imageContainers.forEach(img => {
            const src = img.getAttribute('src');
            const dataSrc = img.getAttribute('data-src');
            const dataSourceUrl = img.getAttribute('data-source-url');
            
            if (dataSrc) addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
            if (dataSourceUrl) addImageIfNotExists(resolveUrl(dataSourceUrl, baseUrl), baseUrl);
            if (src) addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
        });
    }
    
    // メタデータからの抽出
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
        if (script.textContent && script.textContent.includes('mediaUrl')) {
            try {
                // "mediaUrl"などのキーを持つJSONデータを探す
                const mediaUrlMatches = script.textContent.match(/"mediaUrl":\s*"([^"]+)"/g);
                if (mediaUrlMatches) {
                    mediaUrlMatches.forEach(match => {
                        const url = match.split('"mediaUrl":')[1].replace(/"/g, '').trim();
                        if (url) addImageIfNotExists(url, baseUrl);
                    });
                }
            } catch (e) {
                console.warn('スクリプト解析エラー:', e);
            }
        }
    });
    
    // 標準抽出も実行
    performStandardImageExtraction(doc, baseUrl);
}

// Yahoo検索結果からの画像抽出
function extractYahooImages(doc, baseUrl) {
    console.log('Yahoo検索結果からの画像抽出を実行します');
    
    // Yahoo画像検索の画像コンテナを抽出
    const imageContainers = doc.querySelectorAll('img.cl-img, img.sw-Thumbnail__item, .sw-ThumbnailGrid__item img');
    if (imageContainers.length > 0) {
        imageContainers.forEach(img => {
            const src = img.getAttribute('src');
            const dataSrc = img.getAttribute('data-src');
            
            if (dataSrc) addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
            if (src) addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
        });
        
        // Yahoo特有の処理（data-p属性などから高解像度画像のURLを抽出）
        const thumbnailItems = doc.querySelectorAll('[data-p]');
        thumbnailItems.forEach(item => {
            try {
                const dataP = item.getAttribute('data-p');
                if (dataP) {
                    const data = JSON.parse(dataP);
                    if (data.icUrl) addImageIfNotExists(data.icUrl, baseUrl);
                    if (data.imgUrl) addImageIfNotExists(data.imgUrl, baseUrl);
                }
            } catch (e) {
                console.warn('Yahoo画像メタデータ解析エラー:', e);
            }
        });
    }
    
    // 標準抽出も実行
    performStandardImageExtraction(doc, baseUrl);
}

// イラストACからの画像抽出
function extractIllustACImages(doc, baseUrl) {
    console.log('イラストACからの画像抽出を実行します');
    
    // イラストの取得を試みる
    let extractedCount = 0;
    
    // 検索結果ページの処理 - リンクからIDを抽出
    const searchItems = doc.querySelectorAll('.search_img_box a, .list_img_box a, .img_box a');
    searchItems.forEach(link => {
        // サムネイル画像を取得
        const img = link.querySelector('img');
        if (img) {
            const src = img.getAttribute('src');
            if (src) {
                // サムネイル画像のURL
                addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
                extractedCount++;
                
                // イラストACの元画像URL生成パターン
                try {
                    // リンクからイラストIDを取得
                    const href = link.getAttribute('href');
                    if (href) {
                        // イラストIDを抽出 (例: detail.php?id=1234567 から 1234567 を取得)
                        const idMatch = href.match(/[?&]id=(\d+)/);
                        if (idMatch && idMatch[1]) {
                            const illustId = idMatch[1];
                            
                            // IDから元画像URLを構築
                            // 例: https://ac-illust.com/main/detail.php?id=1234567
                            //   → https://ac-illust.com/main/img/1234567.jpg
                            const originalUrl = `https://ac-illust.com/main/img/${illustId}.jpg`;
                            addImageIfNotExists(originalUrl, baseUrl);
                            extractedCount++;
                            
                            // JPG以外の形式も試す (PNG)
                            const pngUrl = `https://ac-illust.com/main/img/${illustId}.png`;
                            addImageIfNotExists(pngUrl, baseUrl);
                            extractedCount++;
                        }
                    }
                } catch (e) {
                    console.warn('イラストID取得に失敗しました:', e);
                }
                
                // 従来の方法でも元画像を推測
                try {
                    let highResSrc = src;
                    
                    // /data/ → /main/ に置換
                    highResSrc = highResSrc.replace('/data/', '/main/');
                    
                    // ファイル名のサイズ修飾子を削除（_s, _m, _tなど）
                    highResSrc = highResSrc.replace(/_(s|m|t)(\.[a-zA-Z]+)$/, '$2');
                    
                    // 異なるURLの場合のみ追加
                    if (highResSrc !== src) {
                        addImageIfNotExists(resolveUrl(highResSrc, baseUrl), baseUrl);
                        extractedCount++;
                    }
                } catch (e) {
                    console.warn('高解像度画像URLの生成に失敗しました:', e);
                }
            }
        }
    });
    
    // 詳細ページの大きな画像
    const mainImages = doc.querySelectorAll('.main_img img, .img_area img, #illust_img img');
    mainImages.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            extractedCount++;
        }
        
        // data-src属性もチェック（遅延読み込み用）
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
            addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
            extractedCount++;
        }
    });
    
    // イラスト詳細ページのメタデータ
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content) {
            addImageIfNotExists(content, baseUrl);
            extractedCount++;
        }
    }
    
    // スクリプト内のJSON形式の画像データを探す
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
        if (script.textContent) {
            try {
                // JSON形式のデータを含む可能性があるスクリプトを探す
                if (script.textContent.includes('"image"') || 
                    script.textContent.includes('"url"') ||
                    script.textContent.includes('"thumbnail"')) {
                    
                    // イラストIDを探す
                    const idMatches = script.textContent.match(/id\s*:\s*['"]?(\d+)['"]?/);
                    if (idMatches && idMatches[1]) {
                        const illustId = idMatches[1];
                        const originalUrl = `https://ac-illust.com/main/img/${illustId}.jpg`;
                        addImageIfNotExists(originalUrl, baseUrl);
                        extractedCount++;
                        
                        const pngUrl = `https://ac-illust.com/main/img/${illustId}.png`;
                        addImageIfNotExists(pngUrl, baseUrl);
                        extractedCount++;
                    }
                    
                    // 画像URLと思われる部分を抽出
                    const urlMatches = script.textContent.match(/"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif))"/g);
                    if (urlMatches) {
                        urlMatches.forEach(match => {
                            const url = match.replace(/"/g, '');
                            addImageIfNotExists(url, baseUrl);
                            extractedCount++;
                        });
                    }
                }
            } catch (e) {
                console.warn('スクリプトからの画像URL抽出エラー:', e);
            }
        }
    });
    
    console.log(`イラストACから${extractedCount}個の画像候補を抽出しました`);
    
    // 抽出できなかった場合は標準抽出も実行
    if (extractedCount === 0) {
        console.log('イラストACの特殊な画像抽出に失敗したため、標準抽出を実行します');
        performStandardImageExtraction(doc, baseUrl);
    }
}

// Pixivからの画像抽出
function extractPixivImages(doc, baseUrl) {
    console.log('Pixivからの画像抽出を実行します');
    
    // Pixivの画像取得を試みる
    let extractedCount = 0;
    
    // 作品ページの大きな画像
    const mainImages = doc.querySelectorAll('.work-main-image img, ._illust_image img, ._work-renderer img');
    mainImages.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            extractedCount++;
            
            // Pixivの高解像度画像URL
            try {
                // マスター画像URLを生成（推測）
                const masterUrl = src.replace(/\/c\/\d+x\d+/, '/img-master')
                                     .replace(/\/img-master\/img\//, '/img-original/img/')
                                     .replace(/_master\d+\.jpg$/, '.jpg')
                                     .replace(/_master\d+\.png$/, '.png');
                
                if (masterUrl !== src) {
                    addImageIfNotExists(resolveUrl(masterUrl, baseUrl), baseUrl);
                    extractedCount++;
                    
                    // PNG形式も試す
                    const pngUrl = masterUrl.replace(/\.jpg$/, '.png');
                    if (pngUrl !== masterUrl) {
                        addImageIfNotExists(resolveUrl(pngUrl, baseUrl), baseUrl);
                        extractedCount++;
                    }
                }
            } catch (e) {
                console.warn('Pixiv高解像度画像URLの生成に失敗しました:', e);
            }
        }
    });
    
    // サムネイル画像（検索結果、ギャラリーなど）
    const thumbnails = doc.querySelectorAll('._thumbnail img, .image-item img, ._work-modal-image img');
    thumbnails.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            extractedCount++;
        }
    });
    
    // meta要素から画像を取得
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content) {
            addImageIfNotExists(content, baseUrl);
            extractedCount++;
        }
    }
    
    // JSONデータからの抽出（Pixivでは作品データをJSONとして埋め込むことが多い）
    const scripts = doc.querySelectorAll('script[id^="meta-preload-data"], script#js-mount-point-search-result-list, script:not([src])');
    scripts.forEach(script => {
        if (!script.textContent) return;
        
        try {
            // JSON形式のデータを含む可能性があるスクリプトを探す
            if (script.textContent.includes('"originalImageUrl"') || 
                script.textContent.includes('"urls"') ||
                script.textContent.includes('"image_urls"')) {
                
                // 有効なJSON部分を抽出
                const jsonMatches = script.textContent.match(/\{.+\}/s);
                if (jsonMatches) {
                    try {
                        const data = JSON.parse(jsonMatches[0]);
                        
                        // 様々なパスから画像URLを取得
                        const extractURLs = (obj, depth = 0) => {
                            if (depth > 5) return; // 無限ループ防止
                            
                            if (!obj || typeof obj !== 'object') return;
                            
                            for (const key in obj) {
                                if (typeof obj[key] === 'string' && 
                                    (key.includes('Url') || key.includes('url') || key === 'src') &&
                                    obj[key].match(/https?:\/\/.*\.(jpg|jpeg|png|gif)/i)) {
                                    addImageIfNotExists(obj[key], baseUrl);
                                    extractedCount++;
                                } else if (typeof obj[key] === 'object') {
                                    extractURLs(obj[key], depth + 1);
                                }
                            }
                        };
                        
                        extractURLs(data);
                    } catch (e) {
                        console.warn('JSON解析エラー:', e);
                    }
                }
                
                // JSONでない場合は正規表現で抽出
                const urlMatches = script.textContent.match(/"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif))"/g);
                if (urlMatches) {
                    urlMatches.forEach(match => {
                        const url = match.replace(/"/g, '');
                        addImageIfNotExists(url, baseUrl);
                        extractedCount++;
                    });
                }
            }
        } catch (e) {
            console.warn('スクリプトからの画像URL抽出エラー:', e);
        }
    });
    
    console.log(`Pixivから${extractedCount}個の画像候補を抽出しました`);
    
    // 抽出できなかった場合は標準抽出も実行
    if (extractedCount === 0) {
        console.log('Pixivの特殊な画像抽出に失敗したため、標準抽出を実行します');
        performStandardImageExtraction(doc, baseUrl);
    }
}

// Freepikからの画像抽出
function extractFreepikImages(doc, baseUrl) {
    console.log('Freepikからの画像抽出を実行します');
    
    let extractedCount = 0;
    
    // URLから検索クエリを抽出（日本語対応）
    try {
        const url = new URL(baseUrl);
        
        // FreepikのURL形式を検出
        const isSearchPath = baseUrl.includes('/search');
        const isVectorsPath = baseUrl.includes('/vectors/') || baseUrl.includes('/photos/') || 
                             baseUrl.includes('/premium/') || baseUrl.includes('/ai-image/');
        
        // URLパス部分から検索キーワードを取得
        if (isVectorsPath) {
            const pathSegments = url.pathname.split('/').filter(segment => segment);
            if (pathSegments.length >= 2) {
                const searchType = pathSegments[0];
                let searchKeyword = decodeURIComponent(pathSegments[1]);
                
                // ハッシュタグ部分を削除
                if (searchKeyword.includes('#')) {
                    searchKeyword = searchKeyword.split('#')[0];
                }
                
                console.log(`パス検索 - タイプ: ${searchType}, キーワード: ${searchKeyword}`);
            }
        }
        
        // クエリパラメータからの検索キーワード取得
        if (isSearchPath) {
            // 検索パラメータを取得して日本語表示
            const query = url.searchParams.get('query') || '';
            const type = url.searchParams.get('type') || '';
            const format = url.searchParams.get('format') || '';
            const lastFilter = url.searchParams.get('last_filter') || '';
            const lastValue = url.searchParams.get('last_value') || '';
            
            if (query) {
                // 日本語でログ表示
                const decodedQuery = decodeURIComponent(query);
                const decodedType = type ? decodeURIComponent(type) : '';
                const decodedFormat = format ? decodeURIComponent(format) : '';
                
                console.log(`Freepik検索クエリ: ${decodedQuery}, タイプ: ${decodedType}, フォーマット: ${decodedFormat}`);
                
                if (lastFilter) {
                    const decodedLastFilter = decodeURIComponent(lastFilter);
                    const decodedLastValue = decodeURIComponent(lastValue);
                    console.log(`追加フィルター: ${decodedLastFilter}=${decodedLastValue}`);
                }
            }
        }
    } catch (e) {
        console.warn('FreepikのURL解析エラー:', e);
    }
    
    // 1. リスト表示セクションから画像を抽出 (最も信頼性の高い方法)
    const extractImagesFromListings = () => {
        const selectors = [
            // モダン検索結果のリスト要素 (最新のDOM構造)
            '.showcase__list .showcase__item',
            '.listing-item', 
            '.listing__item',
            '.listing-grid__item',
            '.grid-item',
            '.grid-cell',
            '.card',
            '.card--resource',
            '.figure--image',
            '.figure--vector',
            // 検索結果リスト (旧レイアウト対応)
            '.resources-list .resources-list-item',
            '.resources__list .resources__item',
            '.search-results-list .search-results-item',
            // カテゴリリスト (旧レイアウト対応)
            '.category-list-item',
            '.category-item',
            // 最新の検索結果グリッド (2023年以降)
            '[data-testid="resource-card"]',
            '[data-testid="search-item"]',
            '[data-view="grid"] > div',
            // 複数キーワード検索結果のコンテナ (複数のキーワードを含む検索パターン)
            '.multiple-keywords-result-item',
            '.complex-search-result-item',
            // 特殊コンテナ
            '.related-keywords-container [class*="item"]',
            '.related-keywords-container [class*="card"]',
            // フォールバック - 汎用コンテナ
            '[data-view="list"] > div',
            '[data-view="grid"] > div',
            '[data-role="search-results"] > div > div',
            '[data-role="resource-card"]',
            // シンプルなimg検索 (最後の手段)
            'figure', 
            '.img-container'
        ];
        
        let foundItems = 0;
        
        // 各セレクタを試行
        for (const selector of selectors) {
            const items = doc.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`Freepik: ${selector} で ${items.length} 個のリスト要素を検出`);
                
                items.forEach(item => {
                    // 1. 画像要素を探す
                    const images = item.querySelectorAll('img');
                    if (images.length > 0) {
                        images.forEach(img => {
                            // 通常の画像ソース属性を処理
                            extractImageAttributes(img);
                            foundItems++;
                        });
                    }
                    
                    // 2. 背景画像スタイルを探す
                    const bgElements = item.querySelectorAll('[style*="background-image"]');
                    if (bgElements.length > 0) {
                        bgElements.forEach(el => extractBackgroundImage(el));
                        foundItems++;
                    }
                    
                    // 3. 直接スタイル属性を持つ要素を探す
                    if (item.hasAttribute('style') && item.getAttribute('style').includes('background-image')) {
                        extractBackgroundImage(item);
                        foundItems++;
                    }
                    
                    // 4. data-* 属性を持つ要素を探す
                    const dataAttributes = ['data-src', 'data-bg', 'data-image', 'data-lazy', 'data-srcset'];
                    dataAttributes.forEach(attr => {
                        const elements = item.querySelectorAll(`[${attr}]`);
                        if (elements.length > 0) {
                            elements.forEach(el => {
                                const value = el.getAttribute(attr);
                                if (value) {
                                    addImageIfNotExists(resolveUrl(value, baseUrl), baseUrl);
                                    extractedCount++;
                                    foundItems++;
                                }
                            });
                        }
                    });
                    
                    // 5. プレミアムバッジがある場合の特殊処理
                    const premiumBadge = item.querySelector('.premium-badge, .badge--premium, [class*="premium"]');
                    if (premiumBadge) {
                        // バッジがある場合、この要素内のすべての画像をより積極的に取得
                        const allElements = item.querySelectorAll('*');
                        allElements.forEach(el => {
                            if (el.tagName === 'IMG') {
                                extractImageAttributes(el);
                            } else if (el.hasAttribute('style') && el.getAttribute('style').includes('background-image')) {
                                extractBackgroundImage(el);
                            }
                        });
                    }
                });
                
                if (foundItems > 0) break; // 有効なセレクタが見つかったら終了
            }
        }
        
        return foundItems;
    };
    
    // 画像要素から属性を抽出するヘルパー関数
    const extractImageAttributes = (img) => {
        // src属性
        const src = img.getAttribute('src');
        if (src && !src.includes('data:image/')) {
            addImageIfNotExists(resolveUrl(src, baseUrl), baseUrl);
            extractedCount++;
        }
        
        // data-src属性 (遅延読み込み)
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
            addImageIfNotExists(resolveUrl(dataSrc, baseUrl), baseUrl);
            extractedCount++;
        }
        
        // data-bg属性 (背景画像)
        const dataBg = img.getAttribute('data-bg');
        if (dataBg) {
            addImageIfNotExists(resolveUrl(dataBg, baseUrl), baseUrl);
            extractedCount++;
        }
        
        // srcset属性 (レスポンシブ画像)
        const srcset = img.getAttribute('srcset');
        if (srcset) {
            srcset.split(',').forEach(part => {
                const trimmedPart = part.trim();
                const spaceIndex = trimmedPart.lastIndexOf(' ');
                if (spaceIndex !== -1) {
                    const srcsetUrl = trimmedPart.substring(0, spaceIndex);
                    addImageIfNotExists(resolveUrl(srcsetUrl, baseUrl), baseUrl);
                    extractedCount++;
                }
            });
        }
        
        // 追加の属性チェック
        ['data-original', 'data-lazy-src', 'data-url', 'data-image'].forEach(attr => {
            const value = img.getAttribute(attr);
            if (value) {
                addImageIfNotExists(resolveUrl(value, baseUrl), baseUrl);
                extractedCount++;
            }
        });
        
        // 親がaタグの場合、aタグのhref属性から画像URLを推測
        const parentLink = img.closest('a[href]');
        if (parentLink) {
            const href = parentLink.getAttribute('href');
            if (href && href.match(/\.(jpg|jpeg|png|webp)($|\?)/i)) {
                addImageIfNotExists(resolveUrl(href, baseUrl), baseUrl);
                extractedCount++;
            }
        }
    };
    
    // 背景画像を抽出するヘルパー関数
    const extractBackgroundImage = (element) => {
        if (!element) return;
        
        try {
            const style = element.getAttribute('style');
            if (style && style.includes('background-image')) {
                // URL()形式の背景画像抽出 - 複数の可能性を考慮
                const urlPattern = /background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/gi;
                let match;
                while ((match = urlPattern.exec(style)) !== null) {
                    if (match[1]) {
                        addImageIfNotExists(resolveUrl(match[1], baseUrl), baseUrl);
                        extractedCount++;
                    }
                }
            }
        } catch (e) {
            console.warn('背景画像URLの抽出に失敗しました:', e);
        }
    };
    
    // 2. JSON/スクリプトデータを解析する関数
    const extractFromScripts = () => {
        let foundInScripts = 0;
        
        // JSONデータを含むスクリプトタグを検索
        const scripts = doc.querySelectorAll('script:not([src]), script[type="application/ld+json"], script[type="text/javascript"]');
        
        scripts.forEach(script => {
            if (!script.textContent) return;
            
            try {
                const content = script.textContent;
                
                // 1. JSONデータ構造を検出（複合検索クエリに特に有効）
                if (content.includes('searchResults') || 
                    content.includes('resourcesList') ||
                    content.includes('searchData') ||
                    content.includes('__INITIAL_STATE__') ||
                    content.includes('__APOLLO_STATE__') ||
                    content.includes('window.SEARCH_RESULTS') ||
                    content.includes('window.RESOURCES')) {
                    
                    // 画像URLパターンを検出（より広範なパターン）
                    const imagePatterns = [
                        /"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp|svg))"/gi,
                        /'(https?:\/\/[^']+\.(jpg|jpeg|png|gif|webp|svg))'/gi,
                        /url\(['"]?(https?:\/\/[^'")\s]+\.(?:jpg|jpeg|png|gif|webp|svg))['"]?\)/gi,
                        /"image":"(https?:\/\/[^"]+)"/gi,
                        /"preview":"(https?:\/\/[^"]+)"/gi,
                        /"thumbnail":"(https?:\/\/[^"]+)"/gi,
                        /"src":"(https?:\/\/[^"]+)"/gi,
                        /"url":"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp|svg))"/gi
                    ];
                    
                    imagePatterns.forEach(pattern => {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            if (match[1]) {
                                addImageIfNotExists(resolveUrl(match[1], baseUrl), baseUrl);
                                extractedCount++;
                                foundInScripts++;
                            }
                        }
                    });
                    
                    // 2. window変数の初期化を探す
                    const stateDataPatterns = [
                        /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
                        /window\.__APOLLO_STATE__\s*=\s*({.*?});/s,
                        /window\.SEARCH_RESULTS\s*=\s*({.*?});/s,
                        /window\.RESOURCES\s*=\s*({.*?});/s,
                        /\.hydrate\s*\(\s*({.*?})\s*,\s*document/s
                    ];
                    
                    stateDataPatterns.forEach(pattern => {
                        const stateMatch = content.match(pattern);
                        if (stateMatch && stateMatch[1]) {
                            try {
                                // 全体をJSONとしてパースするのではなく、
                                // 内部の画像URLとなる可能性のあるプロパティを正規表現で検索
                                const stateContent = stateMatch[1];
                                imagePatterns.forEach(imgPattern => {
                                    let imgMatch;
                                    while ((imgMatch = imgPattern.exec(stateContent)) !== null) {
                                        if (imgMatch[1]) {
                                            addImageIfNotExists(resolveUrl(imgMatch[1], baseUrl), baseUrl);
                                            extractedCount++;
                                            foundInScripts++;
                                        }
                                    }
                                });
                            } catch (e) {
                                console.warn('スクリプト内部データの解析エラー:', e);
                            }
                        }
                    });
                }
                
                // 3. JSON構造全体をパースしてみる (リスク: 大量の無関係なデータ)
                try {
                    if (content.startsWith('{') && content.endsWith('}') && 
                        (content.includes('"image"') || 
                         content.includes('"url"') || 
                         content.includes('"thumbnail"'))) {
                        
                        const data = JSON.parse(content);
                        extractImagesFromObject(data);
                    }
                } catch (jsonError) {
                    // JSONパースエラーは無視 - 正規表現ベースの抽出を優先
                }
                
                // 4. クエリ結果の特殊パターン (特に複合検索の場合)
                if (content.includes('複合検索') ||
                    content.includes('複数キーワード') ||
                    // 画像URLパターンの検出（特殊なURLパターンが含まれているか確認）
                    /"previewUrl":"([^"]+)"/i.test(content) ||
                    /"thumbnailUrl":"([^"]+)"/i.test(content) ||
                    /"smallThumbnailUrl":"([^"]+)"/i.test(content) ||
                    /"largeImageUrl":"([^"]+)"/i.test(content) ||
                    /"originalImageUrl":"([^"]+)"/i.test(content)) {
                    
                    const specialPatterns = [
                        /"previewUrl":"([^"]+)"/g,
                        /"thumbnailUrl":"([^"]+)"/g,
                        /"smallThumbnailUrl":"([^"]+)"/g,
                        /"largeImageUrl":"([^"]+)"/g,
                        /"originalImageUrl":"([^"]+)"/g
                    ];
                    
                    specialPatterns.forEach(pattern => {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            if (match[1]) {
                                // バックスラッシュをエスケープ解除
                                const cleanUrl = match[1].replace(/\\/g, '');
                                addImageIfNotExists(resolveUrl(cleanUrl, baseUrl), baseUrl);
                                extractedCount++;
                                foundInScripts++;
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn('スクリプト解析エラー:', e);
            }
        });
        
        return foundInScripts;
    };
    
    // オブジェクトから再帰的に画像URLを抽出
    const extractImagesFromObject = (obj, depth = 0) => {
        if (!obj || depth > 10) return; // 深度制限
        
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach(item => extractImagesFromObject(item, depth + 1));
            } else {
                for (const key in obj) {
                    const value = obj[key];
                    
                    // URLと思われるキーを検出
                    if (['image', 'url', 'src', 'thumbnail', 'preview', 'contentUrl', 'imageUrl', 'thumbnailUrl', 'largeImageUrl'].includes(key)) {
                        if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'))) {
                            if (value.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) || 
                                value.includes('/image/') || 
                                value.includes('/images/') || 
                                value.includes('/thumb/') ||
                                value.includes('/preview/')) {
                                
                                addImageIfNotExists(resolveUrl(value, baseUrl), baseUrl);
                                extractedCount++;
                            }
                        }
                    } else if (typeof value === 'object' && value !== null) {
                        extractImagesFromObject(value, depth + 1);
                    }
                }
            }
        }
    };
    
    // 3. メタタグから画像を抽出
    const extractFromMetaTags = () => {
        let metaImagesCount = 0;
        
        // OGイメージ
        const ogImages = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]');
        ogImages.forEach(meta => {
            const content = meta.getAttribute('content');
            if (content) {
                addImageIfNotExists(resolveUrl(content, baseUrl), baseUrl);
                extractedCount++;
                metaImagesCount++;
            }
        });
        
        // ページ内のすべてのメタタグをチェック（画像関連の可能性があるもの）
        const imageRelatedMeta = doc.querySelectorAll('meta[property*="image"], meta[name*="image"], meta[content*=".jpg"], meta[content*=".png"]');
        imageRelatedMeta.forEach(meta => {
            const content = meta.getAttribute('content');
            if (content && content.match(/https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i)) {
                addImageIfNotExists(resolveUrl(content, baseUrl), baseUrl);
                extractedCount++;
                metaImagesCount++;
            }
        });
        
        return metaImagesCount;
    };
    
    // 4. 画像要素を直接取得（バックアップ方法）
    const extractDirectImages = () => {
        let directImagesCount = 0;
        
        // すべての画像要素を検出
        const allImages = doc.querySelectorAll('img');
        allImages.forEach(img => {
            extractImageAttributes(img);
            directImagesCount++;
        });
        
        // 背景画像を検出
        const bgElements = doc.querySelectorAll('[style*="background-image"]');
        bgElements.forEach(el => {
            extractBackgroundImage(el);
            directImagesCount++;
        });
        
        return directImagesCount;
    };
    
    // 5. Freepik特有のデータ属性から画像を検出（最近のFreepikサイトで利用）
    const extractFromDataAttributes = () => {
        let dataAttrImagesCount = 0;
        
        // Freepik特有のデータ属性
        const dataAttrs = [
            'data-image',
            'data-src',
            'data-srcset',
            'data-bg',
            'data-original',
            'data-preview',
            'data-thumbnail'
        ];
        
        dataAttrs.forEach(attr => {
            const elements = doc.querySelectorAll(`[${attr}]`);
            elements.forEach(el => {
                const value = el.getAttribute(attr);
                if (value && value.match(/https?:\/\//)) {
                    addImageIfNotExists(resolveUrl(value, baseUrl), baseUrl);
                    extractedCount++;
                    dataAttrImagesCount++;
                }
            });
        });
        
        // Freepikの最新のデータ属性パターン (2023年以降)
        const modernElements = doc.querySelectorAll('[data-testid*="image"], [data-testid*="resource"], [data-view], [data-role*="image"]');
        modernElements.forEach(el => {
            // 要素内の画像を探す
            const img = el.querySelector('img');
            if (img) {
                extractImageAttributes(img);
                dataAttrImagesCount++;
            }
            
            // スタイル属性を確認
            if (el.hasAttribute('style') && el.getAttribute('style').includes('background-image')) {
                extractBackgroundImage(el);
                dataAttrImagesCount++;
            }
        });
        
        return dataAttrImagesCount;
    };
    
    // 6. API関連の処理 - Freepikの内部API呼び出しからデータを抽出
    const extractFromApiCalls = () => {
        let apiImagesCount = 0;
        
        // API呼び出しを示唆するスクリプト
        const apiScripts = doc.querySelectorAll('script:not([src])');
        apiScripts.forEach(script => {
            if (!script.textContent) return;
            
            try {
                const content = script.textContent;
                
                // API呼び出しまたはエンドポイント定義を探す
                if (content.includes('/api/') || 
                    content.includes('apiUrl') || 
                    content.includes('apiEndpoint') || 
                    content.includes('fetch(') || 
                    content.includes('axios.get(')) {
                    
                    // リソースIDを抽出
                    const resourceIdMatches = content.match(/"id":"([^"]+)"/g) || 
                                              content.match(/"resourceId":"([^"]+)"/g) || 
                                              content.match(/"resource_id":"([^"]+)"/g);
                    
                    if (resourceIdMatches) {
                        resourceIdMatches.forEach(match => {
                            const idMatch = match.match(/"(?:id|resourceId|resource_id)":"([^"]+)"/);
                            if (idMatch && idMatch[1]) {
                                const id = idMatch[1];
                                
                                // FreepikのリソースID命名規則に基づいてURLを構築
                                const possibleUrls = [
                                    `https://img.freepik.com/premium-vector/${id}.jpg`,
                                    `https://img.freepik.com/free-vector/${id}.jpg`,
                                    `https://img.freepik.com/premium-photo/${id}.jpg`,
                                    `https://img.freepik.com/free-photo/${id}.jpg`
                                ];
                                
                                possibleUrls.forEach(url => {
                                    addImageIfNotExists(url, baseUrl);
                                    extractedCount++;
                                    apiImagesCount++;
                                });
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('API関連スクリプト解析エラー:', e);
            }
        });
        
        return apiImagesCount;
    };
    
    // 抽出処理を順に実行
    console.log('1. リスト要素から画像抽出を試行中...');
    let listingsCount = extractImagesFromListings();
    
    console.log('2. スクリプト/JSONから画像抽出を試行中...');
    let scriptsCount = extractFromScripts();
    
    console.log('3. メタタグから画像抽出を試行中...');
    let metaCount = extractFromMetaTags();
    
    console.log('4. データ属性から画像抽出を試行中...');
    let dataAttrCount = extractFromDataAttributes();
    
    console.log('5. API関連から画像抽出を試行中...');
    let apiCount = extractFromApiCalls();
    
    console.log('6. 直接画像要素から抽出を試行中...');
    let directCount = extractDirectImages();
    
    // 抽出結果のサマリーを表示
    console.log(`Freepik抽出結果サマリー:
    - リスト要素: ${listingsCount}個
    - スクリプト/JSON: ${scriptsCount}個
    - メタタグ: ${metaCount}個
    - データ属性: ${dataAttrCount}個
    - API関連: ${apiCount}個
    - 直接抽出: ${directCount}個
    - 合計: ${extractedCount}個の画像候補`);
    
    // 画像が見つからなかった場合は標準抽出も実行
    if (extractedCount === 0) {
        console.log('Freepikの特殊な画像抽出に失敗したため、標準抽出を実行します');
        performStandardImageExtraction(doc, baseUrl);
    }
}

// 外部CSSから画像を取得
async function fetchCssImages(cssUrl) {
    try {
        const response = await fetch(`/api/css?url=${encodeURIComponent(cssUrl)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.imageUrls && Array.isArray(data.imageUrls)) {
            // 画像URLを追加
            data.imageUrls.forEach(imageUrl => {
                addImageIfNotExists(imageUrl);
            });
            
            console.log(`CSSから${data.imageUrls.length}個の画像を抽出しました: ${cssUrl}`);
        }
    } catch (error) {
        console.error(`CSS画像の取得に失敗しました: ${cssUrl}`, error);
    }
}

// URLが画像っぽいかどうかをチェック
function isImageUrl(url) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.jpg') || 
           lowerUrl.endsWith('.jpeg') || 
           lowerUrl.endsWith('.png') || 
           lowerUrl.endsWith('.gif') || 
           lowerUrl.endsWith('.webp') || 
           lowerUrl.endsWith('.svg') ||
           lowerUrl.endsWith('.bmp');
}

// 抽出した画像を表示
function displayImages() {
    const imagesContainer = document.getElementById('images-container');
    const imageCount = document.getElementById('image-count');
    const noImages = document.getElementById('no-images');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    
    // 要素の存在チェック
    if (!imagesContainer) {
        console.error('images-container要素が見つかりません');
        return;
    }
    
    // コンテナをクリア
    imagesContainer.innerHTML = '';
    
    // 画像がない場合
    if (extractedImages.length === 0) {
        if (noImages) {
        noImages.style.display = 'block';
        }
        if (imageCount) {
        imageCount.textContent = '0';
        }
        if (downloadAllBtn) {
        downloadAllBtn.disabled = true;
        }
        if (downloadSelectedBtn) {
        downloadSelectedBtn.disabled = true;
        }
        
        // マスターチェックボックスをリセット
        const masterCheckbox = document.getElementById('master-checkbox');
        if (masterCheckbox) {
            masterCheckbox.checked = false;
            masterCheckbox.indeterminate = false;
        }
        
        return;
    }
    
    // 画像がある場合
    if (noImages) {
    noImages.style.display = 'none';
    }
    if (imageCount) {
    imageCount.textContent = extractedImages.length.toString();
    }
    if (downloadAllBtn) {
    downloadAllBtn.disabled = false;
    }
    
    // フィルターを適用
    applyFilters();
}

// クイックフィルター（100px以上の画像のみ）
function applyQuickFilter() {
    const minWidthInput = document.getElementById('min-width');
    const minHeightInput = document.getElementById('min-height');
    const filterSmall = document.getElementById('filter-small');
    
    if (minWidthInput) minWidthInput.value = '101'; // 100×100は除外するため101に設定
    if (minHeightInput) minHeightInput.value = '101'; // 100×100は除外するため101に設定
    if (filterSmall) filterSmall.checked = false;
    
    // すべてのフォーマットを選択状態にする
    document.querySelectorAll('input[name="format-filter"]').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // 並び替えを大きい順に設定
    const sortBy = document.getElementById('sort-by');
    if (sortBy) sortBy.value = 'size_desc';
    
    // コンソールにデバッグ情報
    console.log("クイックフィルター適用: 101px以上の画像のみ表示（100×100は除外）");
    
    applyFilters();
}

// 検索エンジンモードを適用
function applySearchEngineMode() {
    // 検索エンジン向けの設定
    const filterOriginal = document.getElementById('filter-original');
    const filterHighRes = document.getElementById('filter-high-res');
    const filterThumbnails = document.getElementById('filter-thumbnails');
    const minWidthInput = document.getElementById('min-width');
    const minHeightInput = document.getElementById('min-height');
    const filterSmall = document.getElementById('filter-small');
    const sortBy = document.getElementById('sort-by');
    
    // 高品質な画像のみを優先
    if (filterOriginal) filterOriginal.checked = true;
    if (filterHighRes) filterHighRes.checked = true;
    if (filterThumbnails) filterThumbnails.checked = false;
    
    // サイズ条件
    if (minWidthInput) minWidthInput.value = '300'; // 高解像度の基準を上げる
    if (minHeightInput) minHeightInput.value = '300';
    if (filterSmall) filterSmall.checked = false;
    
    // 並び替えは大きさ優先
    if (sortBy) sortBy.value = 'size_desc';
    
    // すべての形式を選択
    document.querySelectorAll('input[name="format-filter"]').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // サイト別設定
    const currentUrl = document.getElementById('url-input')?.value || '';
    
    // URLに基づいて適切なサイトを選択
    document.querySelectorAll('input[name="site-filter"]').forEach(checkbox => {
        // デフォルトですべて選択
        checkbox.checked = true;
        
        // URLに特定のドメインが含まれる場合、そのサイトだけを選択
        if (currentUrl) {
            const hostname = currentUrl.toLowerCase();
            if (hostname.includes('google.com') && checkbox.value === 'google') {
                checkbox.checked = true;
            } else if (hostname.includes('irasutoya.com') && checkbox.value === 'irasutoya') {
                checkbox.checked = true;
            } else if (hostname.includes('bing.com') && checkbox.value === 'bing') {
                checkbox.checked = true;
            } else if (hostname.includes('yahoo.co.jp') && checkbox.value === 'yahoo') {
                checkbox.checked = true;
            } else if (hostname.includes('ac-illust.com') && checkbox.value === 'illustac') {
                checkbox.checked = true;
            } else if (hostname.includes('pixiv.net') && checkbox.value === 'pixiv') {
                checkbox.checked = true;
            } else if (hostname.includes('freepik.com') && checkbox.value === 'freepik') {
                checkbox.checked = true;
            } else {
                // 特定のサイトでない場合は常に表示
                checkbox.checked = true;
            }
        }
    });
    
    console.log("検索エンジンモードを適用しました");
    applyFilters();
}

// フィルターを適用
function applyFilters() {
    const imagesContainer = document.getElementById('images-container');
    
    // 要素の存在チェック
    if (!imagesContainer) {
        console.error('images-container要素が見つかりません');
        return;
    }
    
    const showSmallCheckbox = document.getElementById('filter-small');
    const minWidthInput = document.getElementById('min-width');
    const minHeightInput = document.getElementById('min-height');
    const sortBySelect = document.getElementById('sort-by');
    const filterOriginal = document.getElementById('filter-original');
    const filterHighRes = document.getElementById('filter-high-res');
    const filterThumbnails = document.getElementById('filter-thumbnails');
    
    // 値の取得（要素が存在しない場合はデフォルト値を使用）
    const showSmall = showSmallCheckbox ? showSmallCheckbox.checked : true;
    const minWidth = minWidthInput ? (parseInt(minWidthInput.value) || 0) : 0;
    const minHeight = minHeightInput ? (parseInt(minHeightInput.value) || 0) : 0;
    const sortBy = sortBySelect ? sortBySelect.value : 'size_desc';
    const prioritizeOriginal = filterOriginal ? filterOriginal.checked : true;
    const highResOnly = filterHighRes ? filterHighRes.checked : true;
    const includeThumbnails = filterThumbnails ? filterThumbnails.checked : false;
    
    // フォーマットフィルターの値を取得
    const enabledFormats = [];
    document.querySelectorAll('input[name="format-filter"]:checked').forEach(checkbox => {
        enabledFormats.push(checkbox.value);
    });
    
    // サイトフィルターの値を取得
    const enabledSites = [];
    document.querySelectorAll('input[name="site-filter"]:checked').forEach(checkbox => {
        enabledSites.push(checkbox.value);
    });
    
    // コンテナをクリア
    imagesContainer.innerHTML = '';
    
    // 画像をソート
    const sortedImages = sortImages([...extractedImages], sortBy);
    
    // 事前フィルタリング - 既に読み込み済みの画像についてサイズフィルターを適用
    const filteredImages = sortedImages.filter(image => {
        // フォーマットフィルター
        if (!enabledFormats.includes(image.format)) {
            return false;
        }
        
        // サイトフィルター（現在のURLドメインに基づく）
        if (enabledSites.length > 0 && originalUrl) {
            const hostname = new URL(originalUrl).hostname.toLowerCase();
            let siteMatch = false;
            
            // 対応するサイトとホスト名の照合
            if (hostname.includes('google.com') && enabledSites.includes('google')) {
                siteMatch = true;
            } else if (hostname.includes('irasutoya.com') && enabledSites.includes('irasutoya')) {
                siteMatch = true;
            } else if (hostname.includes('bing.com') && enabledSites.includes('bing')) {
                siteMatch = true;
            } else if (hostname.includes('yahoo.co.jp') && enabledSites.includes('yahoo')) {
                siteMatch = true;
            } else if (hostname.includes('ac-illust.com') && enabledSites.includes('illustac')) {
                siteMatch = true;
            } else if (hostname.includes('pixiv.net') && enabledSites.includes('pixiv')) {
                siteMatch = true;
            } else if (hostname.includes('freepik.com') && enabledSites.includes('freepik')) {
                siteMatch = true;
            } else {
                // 特定のサイトでない場合は常に表示
                siteMatch = true;
            }
            
            if (!siteMatch) {
                return false;
            }
        }
        
        // 画質フィルター
        if (prioritizeOriginal && image.isOriginal === false) {
            return false;
        }
        
        if (highResOnly && image.isHighRes === false) {
            return false;
        }
        
        if (!includeThumbnails && image.isThumbnail === true) {
            return false;
        }
        
        // サイズフィルター (読み込み済みの画像のみ)
        if (image.loaded) {
            // 小さい画像の表示設定が無効かつ画像が小さい場合
            if (!showSmall && (image.width < 100 || image.height < 100)) {
                return false;
            }
            
            // 厳密に100x100のサイズの画像は常に除外
            if (image.width === 100 && image.height === 100) {
                return false;
            }
            
            // 最小サイズ未満の場合
            if (image.width < minWidth || image.height < minHeight) {
                return false;
            }
        }
        
        return true;
    });
    
    // 表示する画像をフィルタリング
    let visibleCount = 0;
    
    // バッチ処理で表示処理を行う（大量の画像を扱う場合のパフォーマンス向上）
    const batchSize = 20; // 一度に処理する画像数
    const totalBatches = Math.ceil(filteredImages.length / batchSize);
    
    console.log(`フィルター適用: ${filteredImages.length}枚の画像（全${extractedImages.length}枚中）`);
    console.log(`フィルター設定: 小さい画像表示=${showSmall}, 最小幅=${minWidth}, 最小高さ=${minHeight}`);
    
    // バッチ処理を行う関数
    const processBatch = (batchIndex) => {
        if (batchIndex >= totalBatches) {
            // すべてのバッチが処理された
            if (visibleCount === 0 && filteredImages.length > 0) {
                const noVisibleImages = document.createElement('div');
                noVisibleImages.className = 'no-images';
                noVisibleImages.textContent = 'フィルター条件に一致する画像がありません';
                imagesContainer.appendChild(noVisibleImages);
            } else {
                // 表示済み画像数を更新
                const imageCountElement = document.getElementById('image-count');
                if (imageCountElement) {
                    imageCountElement.textContent = `${visibleCount}`;
                }
            }
            
            // バッチ処理完了後にマスターチェックボックスの状態を更新
            setTimeout(() => {
                updateMasterCheckboxState();
            }, 100);
            
            return;
        }
        
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min((batchIndex + 1) * batchSize, filteredImages.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const image = filteredImages[i];
            
            // オリジナルのインデックスを取得
            const originalIndex = extractedImages.findIndex(img => img.url === image.url);
            if (originalIndex === -1) continue;
            
        // 画像要素を作成
        const imageElement = document.createElement('div');
        imageElement.className = 'image-item';
            imageElement.dataset.index = originalIndex.toString();
            imageElement.dataset.width = image.width.toString();
            imageElement.dataset.height = image.height.toString();
        
        // チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-checkbox';
        checkbox.checked = image.selected;
            checkbox.addEventListener('change', createImageCheckboxListener(checkbox, originalIndex));
        
        // 画像プレビュー
        const img = document.createElement('img');
        img.className = 'image-preview';
            img.src = `/api/image?url=${encodeURIComponent(image.url)}`;
            img.alt = `Image ${i + 1}`;
        img.loading = 'lazy';
            
            // 画像形式ラベル
            const formatLabel = document.createElement('div');
            formatLabel.className = 'image-format';
            formatLabel.textContent = image.format.toUpperCase();
        
        // 画像の読み込みが完了したら寸法を取得
        img.onload = () => {
                const { width, height } = handleImageLoad(img, imageElement, originalIndex);
                
                // フィルターを再適用 (読み込み後)
                let shouldHide = false;
                
                // 小さい画像の表示設定が無効かつ画像が小さい場合
                if (!showSmall && (width < 100 || height < 100)) {
                    shouldHide = true;
                }
                
                // 最小サイズ未満の場合
                if (width < minWidth || height < minHeight) {
                    shouldHide = true;
                }
                
                // 表示/非表示を適用
                if (shouldHide) {
                    if (imageElement && imageElement.parentNode) {
                        imageElement.parentNode.removeChild(imageElement);
                        visibleCount--;
                        
                        // カウント更新
                        const imageCountElement = document.getElementById('image-count');
                        if (imageCountElement) {
                            imageCountElement.textContent = `${visibleCount}`;
                        }
                    }
            }
        };
        
        img.onerror = () => {
                img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22Arial%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20fill%3D%22%23999%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E';
                extractedImages[originalIndex].loaded = false;
                
                try {
                    // 再試行用リンクを追加
                    const retryLink = document.createElement('a');
                    retryLink.href = '#';
                    retryLink.textContent = '再読み込み';
                    retryLink.className = 'retry-link';
                    retryLink.style.display = 'block';
                    retryLink.style.textAlign = 'center';
                    retryLink.style.margin = '5px 0';
                    retryLink.style.color = '#3b82f6';
                    retryLink.style.fontSize = '0.8rem';
                    
                    retryLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        img.src = `/api/image?url=${encodeURIComponent(image.url)}&t=${Date.now()}`; // キャッシュ回避
                    });
                    
                    // 既存のretry-linkを削除
                    if (img.parentNode) {
                        const existingRetryLink = img.parentNode.querySelector('.retry-link');
                        if (existingRetryLink) {
                            existingRetryLink.remove();
                        }
                        
                        // リンクを挿入
                        img.parentNode.insertBefore(retryLink, img.nextSibling);
                    }
                } catch (error) {
                    console.error('再試行リンクの追加中にエラーが発生しました:', error);
                }
        };
        
        // 画像情報
        const imageInfo = document.createElement('div');
        imageInfo.className = 'image-info';
        
        // URL
        const urlElement = document.createElement('div');
        urlElement.className = 'image-url';
        
        // URL表示をさらに改善（検索エンジンのクエリパラメータを日本語で表示）
        const displayUrl = getDisplayUrl(image.url);
        urlElement.textContent = displayUrl;
        urlElement.title = image.url;  // ホバー時に元のURLを表示
        
        // プレミアムコンテンツの場合はバッジを追加
        if (image.url.includes('premium') || 
            image.url.includes('getty') || 
            image.url.includes('shutterstock') || 
            image.url.includes('istockphoto') ||
            image.url.includes('adobe.com')) {
            
            const premiumBadge = document.createElement('span');
            premiumBadge.className = 'premium-badge';
            premiumBadge.textContent = 'Premium';
            premiumBadge.style.backgroundColor = '#ffc107';
            premiumBadge.style.color = '#000';
            premiumBadge.style.padding = '0 4px';
            premiumBadge.style.borderRadius = '3px';
            premiumBadge.style.fontSize = '10px';
            premiumBadge.style.marginLeft = '5px';
            
            urlElement.appendChild(premiumBadge);
        }
        
        // 寸法
        const dimensionsElement = document.createElement('div');
        dimensionsElement.className = 'image-dimensions';
        dimensionsElement.textContent = image.loaded ? `${image.width} × ${image.height}` : '読み込み中...';
        
        // 要素を組み立て
        imageInfo.appendChild(urlElement);
        imageInfo.appendChild(dimensionsElement);
        
        imageElement.appendChild(checkbox);
            imageElement.appendChild(formatLabel);
        imageElement.appendChild(img);
        imageElement.appendChild(imageInfo);
        
            // コンテナに追加し、カウントを増やす
            imagesContainer.appendChild(imageElement);
            visibleCount++;
        }
        
        // 次のバッチを非同期で処理
        setTimeout(() => {
            processBatch(batchIndex + 1);
        }, 0);
    };
    
    // 最初のバッチから処理開始
    processBatch(0);
    
    // ダウンロードボタンの状態を更新
    updateDownloadSelectedButton();

    // フィルター処理終了後にマスターチェックボックスを更新
    setTimeout(() => {
        updateMasterCheckboxState();
    }, 100);
}

// 選択した画像をダウンロードボタンの状態を更新
function updateDownloadSelectedButton() {
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    if (!downloadSelectedBtn) return;
    
    const hasSelected = extractedImages.some(image => image.selected);
    downloadSelectedBtn.disabled = !hasSelected;
}

// 画像チェックボックスのイベントリスナー
function createImageCheckboxListener(checkbox, originalIndex) {
    return () => {
        // 対応するデータを更新
        extractedImages[originalIndex].selected = checkbox.checked;
        
        // マスターチェックボックスの状態を更新
        updateMasterCheckboxState();
    
    // ダウンロードボタンの状態を更新
    updateDownloadSelectedButton();
    };
}

// すべての画像を選択
function selectAllImages() {
    extractedImages.forEach(image => {
        image.selected = true;
    });
    
    // チェックボックスを更新
    document.querySelectorAll('.image-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // マスターチェックボックスも更新
    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    }
    
    updateDownloadSelectedButton();
}

// すべての画像の選択を解除
function deselectAllImages() {
    extractedImages.forEach(image => {
        image.selected = false;
    });
    
    // チェックボックスを更新
    document.querySelectorAll('.image-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // マスターチェックボックスも更新
    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    }
    
    updateDownloadSelectedButton();
}

// 選択した画像をダウンロード
async function downloadSelectedImages() {
    const selectedImages = extractedImages.filter(image => image.selected);
    
    if (selectedImages.length === 0) {
        alert('ダウンロードする画像を選択してください');
        return;
    }
    
    if (selectedImages.length === 1) {
        // 1枚だけの場合は直接ダウンロード
        downloadSingleImage(selectedImages[0].url);
    } else {
        // 複数の場合はZIPでダウンロード
        await downloadImagesAsZip(selectedImages);
    }
}

// すべての画像をダウンロード
async function downloadAllImages() {
    if (extractedImages.length === 0) {
        alert('ダウンロードする画像がありません');
        return;
    }
    
    if (extractedImages.length === 1) {
        // 1枚だけの場合は直接ダウンロード
        downloadSingleImage(extractedImages[0].url);
    } else {
        // 複数の場合はZIPでダウンロード
        await downloadImagesAsZip(extractedImages);
    }
}

// 単一画像をダウンロード
function downloadSingleImage(url) {
    // ファイル名を取得
    const filename = getFilenameFromUrl(url);
    
    // プロキシURLを使用
    const proxyUrl = `/api/image?url=${encodeURIComponent(url)}&download=true&original=true`;
    
    // ダウンロードリンクを作成
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    
    // クリックイベントをトリガー
    a.click();
}

// 複数画像をZIPでダウンロード
async function downloadImagesAsZip(images) {
    // ローディング表示
    const loader = document.getElementById('loader');
    if (loader) {
    loader.style.display = 'flex';
    }
    
    try {
        // JSZipインスタンスを作成
        const zip = new JSZip();
        
        // 各画像をZIPに追加
        const fetchPromises = images.map(async (image, index) => {
            try {
                // プロキシを使用して画像をフェッチ（オリジナル形式で取得）
                const response = await fetch(`/api/image?url=${encodeURIComponent(image.url)}&original=true`);
                
                if (!response.ok) {
                    console.warn(`Failed to fetch image: ${image.url}`);
                    return;
                }
                
                // Blobとして取得
                const blob = await response.blob();
                
                // ファイル名を取得
                let filename = getFilenameFromUrl(image.url);
                
                // 拡張子がない場合は、Content-Typeから推測
                if (!filename.includes('.')) {
                    const contentType = response.headers.get('Content-Type');
                    const ext = getExtensionFromContentType(contentType);
                    if (ext) {
                        filename += `.${ext}`;
                    } else if (image.format && image.format !== 'other') {
                        // 画像形式情報からファイル名を設定
                        filename += `.${image.format}`;
                    }
                }
                
                // 同名ファイルがある場合はインデックスを追加
                if (zip.file(filename)) {
                    const nameParts = filename.split('.');
                    const ext = nameParts.pop();
                    const baseName = nameParts.join('.');
                    filename = `${baseName}_${index + 1}.${ext}`;
                }
                
                // ZIPに追加
                zip.file(filename, blob);
                
            } catch (error) {
                console.error(`Error processing image ${image.url}:`, error);
            }
        });
        
        // すべての画像の処理を待機
        await Promise.all(fetchPromises);
        
        // ドメイン名を取得（ZIPファイル名用）
        let domain = '';
        try {
            domain = new URL(originalUrl).hostname.replace('www.', '');
        } catch (error) {
            domain = 'images';
        }
        
        // 日時を取得
        const now = new Date();
        const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
        
        // ZIPファイル名
        const zipFilename = `${domain}_images_${dateStr}.zip`;
        
        // ZIPを生成
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // ダウンロード
        saveAs(zipBlob, zipFilename);
        
    } catch (error) {
        console.error('Error creating ZIP file:', error);
        alert(`ZIPファイルの作成中にエラーが発生しました: ${error.message}`);
    } finally {
        // ローディング非表示
        if (loader) {
        loader.style.display = 'none';
        }
    }
}

// URLからファイル名を取得
function getFilenameFromUrl(url) {
    try {
        // URLオブジェクトを作成
        const urlObj = new URL(url);
        
        // パス名を取得
        const pathname = urlObj.pathname;
        
        // パスの最後の部分を取得
        let filename = pathname.split('/').pop() || 'image';
        
        // クエリパラメータを削除
        filename = filename.split('?')[0];
        
        // ハッシュを削除
        filename = filename.split('#')[0];
        
        // ファイル名が空の場合はデフォルト名を使用
        if (!filename || filename === '') {
            filename = 'image';
        }
        
        return filename;
    } catch (error) {
        console.warn('Invalid URL for filename extraction:', url);
        return 'image';
    }
}

// URL表示用にエンコードされた日本語をデコードする
function getDisplayUrl(url) {
    try {
        // URLの各部分をデコードして読みやすくする
        const urlObj = new URL(url);
        
        // パスとクエリパラメータをデコード
        const decodedPath = decodeURIComponent(urlObj.pathname);
        const searchParams = new URLSearchParams(urlObj.search);
        
        // 各クエリパラメータをデコード
        const decodedParams = new URLSearchParams();
        for (const [key, value] of searchParams) {
            try {
                const decodedKey = decodeURIComponent(key);
                const decodedValue = decodeURIComponent(value);
                decodedParams.append(decodedKey, decodedValue);
            } catch (e) {
                // デコードできない場合はそのまま使用
                decodedParams.append(key, value);
            }
        }
        
        // デコードしたパラメータを文字列に変換（Google検索形式）
        let decodedSearch = '';
        if (decodedParams.toString()) {
            // Google検索形式のようにパラメータをデコードしたまま表示
            const pairs = [];
            for (const [key, value] of decodedParams.entries()) {
                pairs.push(`${key}=${value}`);
            }
            decodedSearch = '?' + pairs.join('&');
        }
        
        // デコードしたURLを構築
        const displayUrl = `${urlObj.protocol}//${urlObj.host}${decodedPath}${decodedSearch}${urlObj.hash}`;
        return displayUrl;
    } catch (error) {
        console.warn('URL decode error:', error);
        return url; // エラーの場合は元のURLを返す
    }
}

// Content-Typeから拡張子を取得
function getExtensionFromContentType(contentType) {
    if (!contentType) return '';
    
    const types = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff'
    };
    
    return types[contentType.toLowerCase()] || '';
}

// CSSから背景画像を抽出（簡易的な実装）
function extractImagesFromCss(cssText, baseUrl) {
    try {
        const urlRegex = /url\(['"]?([^'")]+)['"]?\)/gi;
        let match;
        
        while ((match = urlRegex.exec(cssText)) !== null) {
            const imageUrl = match[1];
            if (imageUrl && !imageUrl.startsWith('data:')) {
                addImageIfNotExists(resolveUrl(imageUrl, baseUrl), baseUrl);
            }
        }
    } catch (error) {
        console.error('CSS解析中にエラーが発生しました:', error);
    }
}

// 相対URLを絶対URLに変換
function resolveUrl(url, baseUrl) {
    // データURLの場合はそのまま返す
    if (!url) return '';
    
    if (url.startsWith('data:')) {
        return url;
    }
    
    try {
        // URLオブジェクトを使用して絶対URLに変換
        return new URL(url, baseUrl).href;
    } catch (error) {
        console.warn('Invalid URL:', url, error);
        return url;
    }
}

// 画像が既に存在しない場合のみ追加
function addImageIfNotExists(url, baseUrl) {
    // データURLや無効なURLは除外
    if (!url || url === 'undefined' || url === 'null') {
        return;
    }
    
    // 既に存在するかチェック
    const exists = extractedImages.some(img => img.url === url);
    if (!exists) {
        // 画像形式を判定
        const format = detectImageFormat(url);

        // サイズ事前推定 - URLからサイズ情報を抽出（一部のURLでサイズが含まれている場合）
        const sizeParts = extractSizeFromUrl(url);
        
        // 画像の種類を判定
        const imageType = determineImageType(url);
        
        extractedImages.push({
            url: url,
            selected: false,
            width: sizeParts.width || 0,
            height: sizeParts.height || 0,
            loaded: false,
            format: format,
            size: 0, // 画像サイズ（バイト数）
            estimatedSize: sizeParts.width && sizeParts.height ? (sizeParts.width * sizeParts.height * 4) : 0, // 推定サイズ
            isOriginal: imageType.isOriginal,
            isHighRes: imageType.isHighRes,
            isThumbnail: imageType.isThumbnail
        });
    }
}

// 画像の種類を判定する関数（オリジナル、高解像度、サムネイル）
function determineImageType(url) {
    const lowerUrl = url.toLowerCase();
    
    // デフォルト値
    const result = {
        isOriginal: true,  // デフォルトは元画像と見なす
        isHighRes: true,   // デフォルトは高解像度と見なす
        isThumbnail: false // デフォルトはサムネイルではないと見なす
    };
    
    // サムネイルを示す特徴
    const thumbnailPatterns = [
        /thumbnail/i, /thumb/i, /small/i, /icon/i, /preview/i, /tiny/i,
        /\/s\d+\//, /\/w\d+(-h\d+)?\//, /size=s\d+/, /size=w\d+/,
        /_small\./, /_thumb\./, /_icon\./, /_mini\./,
        /\d+x\d+_q\d+/  // 小さいサイズを示す次元パターン
    ];
    
    // サムネイルの判定
    for (const pattern of thumbnailPatterns) {
        if (pattern.test(lowerUrl)) {
            result.isThumbnail = true;
            result.isOriginal = false;
            
            // 非常に小さいサイズを示す場合は高解像度ではない
            if (/\/s\d{1,2}\//.test(lowerUrl) || // s10/ など
                /\/w\d{1,2}(-h\d{1,2})?\//.test(lowerUrl) || // w10/ など
                /size=s\d{1,2}/.test(lowerUrl) || // size=s10 など
                /_\d{1,2}x\d{1,2}\./.test(lowerUrl)) { // _10x10. など
                result.isHighRes = false;
            }
            
            break;
        }
    }
    
    // オリジナル画像を示す特徴
    const originalPatterns = [
        /original/i, /full/i, /large/i, /source/i, /high/i, /orig/i,
        /\/s\d{3,}\//, /\/w\d{3,}(-h\d{3,})?\//, // s1000/ など
        /size=s\d{3,}/, /size=w\d{3,}/, // size=s1000 など
        /_large\./, /_full\./, /_original\./, /_source\./,
        /\d{3,}x\d{3,}/  // 大きいサイズを示す次元パターン
    ];
    
    // オリジナル画像の判定
    for (const pattern of originalPatterns) {
        if (pattern.test(lowerUrl)) {
            result.isOriginal = true;
            result.isThumbnail = false;
            result.isHighRes = true;
            break;
        }
    }
    
    // 特定のサービスの特殊なURLパターン
    
    // Google画像
    if (lowerUrl.includes('googleusercontent.com')) {
        // Google のサムネイル
        if (/=s\d{1,2}/.test(lowerUrl) || /=w\d{1,2}(-h\d{1,2})?/.test(lowerUrl)) {
            result.isThumbnail = true;
            result.isOriginal = false;
            result.isHighRes = false;
        }
        // Google の高解像度画像
        else if (/=s\d{3,}/.test(lowerUrl) || /=w\d{3,}(-h\d{3,})?/.test(lowerUrl)) {
            result.isOriginal = true;
            result.isThumbnail = false;
            result.isHighRes = true;
        }
    }
    
    // いらすとや
    if (lowerUrl.includes('irasutoya')) {
        if (lowerUrl.includes('_s.')) {
            result.isThumbnail = true;
            result.isOriginal = false;
            result.isHighRes = false;
        } else {
            result.isOriginal = true;
            result.isThumbnail = false;
            result.isHighRes = true;
        }
    }
    
    return result;
}

// URLからサイズ情報を抽出する関数
function extractSizeFromUrl(url) {
    const result = { width: 0, height: 0 };
    
    try {
        // URLからサイズ情報を抽出するパターン
        // 例: image_800x600.jpg, thumb_w800_h600.png, 800x600/image.jpg など
        const sizePatterns = [
            /(\d+)x(\d+)/i,                     // 800x600
            /width=(\d+).*height=(\d+)/i,       // width=800&height=600
            /w=(\d+).*h=(\d+)/i,                // w=800&h=600
            /w(\d+).*h(\d+)/i,                  // w800_h600
            /width_(\d+).*height_(\d+)/i,       // width_800_height_600
            /(\d+)px.*(\d+)px/i,                // 800px_600px
        ];
        
        for (const pattern of sizePatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[2]) {
                const width = parseInt(match[1]);
                const height = parseInt(match[2]);
                
                // 妥当なサイズのみ採用（異常に大きいサイズや小さすぎるサイズは除外）
                if (width > 10 && width < 10000 && height > 10 && height < 10000) {
                    result.width = width;
                    result.height = height;
                    break;
                }
            }
        }
    } catch (error) {
        console.warn('URLからサイズ情報の抽出に失敗しました:', error);
    }
    
    return result;
}

// 画像形式を判定する関数
function detectImageFormat(url) {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
        return 'jpg';
    } else if (lowerUrl.endsWith('.png')) {
        return 'png';
    } else if (lowerUrl.endsWith('.webp')) {
        return 'webp';
    } else if (lowerUrl.endsWith('.gif')) {
        return 'gif';
    } else if (lowerUrl.endsWith('.svg')) {
        return 'svg';
    } else if (lowerUrl.endsWith('.bmp')) {
        return 'bmp';
    } else if (lowerUrl.endsWith('.tiff') || lowerUrl.endsWith('.tif')) {
        return 'tiff';
    } else if (lowerUrl.includes('.jpg?') || lowerUrl.includes('.jpeg?')) {
        return 'jpg';
    } else if (lowerUrl.includes('.png?')) {
        return 'png';
    } else if (lowerUrl.includes('.webp?')) {
        return 'webp';
    } else if (lowerUrl.includes('.gif?')) {
        return 'gif';
    } else if (lowerUrl.includes('.svg?')) {
        return 'svg';
    } else {
        return 'other';
    }
}

// 画像をソートする関数
function sortImages(images, sortBy) {
    return images.sort((a, b) => {
        // 読み込まれていない画像は後ろに配置
        if (a.loaded !== b.loaded) {
            return a.loaded ? -1 : 1;
        }
        
        switch (sortBy) {
            case 'size_desc': // サイズ（大→小）
                const aSize = a.width * a.height;
                const bSize = b.width * b.height;
                return bSize - aSize;
                
            case 'size_asc': // サイズ（小→大）
                const aSizeAsc = a.width * a.height;
                const bSizeAsc = b.width * b.height;
                return aSizeAsc - bSizeAsc;
                
            case 'width_desc': // 幅（大→小）
                return b.width - a.width;
                
            case 'height_desc': // 高さ（大→小）
                return b.height - a.height;
                
            default:
                return 0;
        }
    });
}

// 画像の読み込みが完了したら寸法を取得するイベントハンドラ
function handleImageLoad(img, imageElement, originalIndex) {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    
    // データを更新
    extractedImages[originalIndex].width = width;
    extractedImages[originalIndex].height = height;
    extractedImages[originalIndex].loaded = true;
    extractedImages[originalIndex].size = estimateImageSize(width, height, extractedImages[originalIndex].format);
    
    // 寸法情報を更新
    const dimensionsElement = imageElement.querySelector('.image-dimensions');
    if (dimensionsElement) {
        dimensionsElement.textContent = `${width} × ${height}`;
    }
    
    // データ属性を更新
    imageElement.dataset.width = width.toString();
    imageElement.dataset.height = height.toString();
    
    // 100×100サイズの画像はイラストACやいらすとやのアイコンであることが多いため非表示にする
    if (width === 100 && height === 100) {
        console.log('非表示: 100×100サイズの画像', extractedImages[originalIndex].url);
        if (imageElement && imageElement.parentNode) {
            imageElement.parentNode.removeChild(imageElement);
            
            // カウント更新
            const imageCountElement = document.getElementById('image-count');
            if (imageCountElement) {
                const currentCount = parseInt(imageCountElement.textContent) || 0;
                imageCountElement.textContent = `${currentCount - 1}`;
            }
        }
    }
    
    return { width, height };
}

// 画像サイズを推定する関数
function estimateImageSize(width, height, format) {
    if (!width || !height) return 0;
    
    // フォーマット別の圧縮比率を考慮した推定値
    let bytesPerPixel = 4; // デフォルト値（32ビット/ピクセル）
    
    switch (format) {
        case 'jpg':
        case 'jpeg':
            bytesPerPixel = 0.25; // JPEG圧縮を考慮
            break;
        case 'png':
            bytesPerPixel = 1.5; // PNG圧縮を考慮
            break;
        case 'webp':
            bytesPerPixel = 0.2; // WebP圧縮を考慮
            break;
        case 'gif':
            bytesPerPixel = 0.3; // GIF圧縮を考慮
            break;
        case 'svg':
            bytesPerPixel = 0.1; // SVGはサイズが小さい傾向
            break;
    }
    
    return Math.round(width * height * bytesPerPixel);
}

// 現在表示されている画像をすべて選択/選択解除
function toggleAllVisibleImages(isChecked) {
    // 現在表示されている画像のチェックボックスを取得
    const visibleCheckboxes = document.querySelectorAll('.image-item:not([style*="display: none"]) .image-checkbox');
    
    // 表示されている画像のチェック状態を変更
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        
        // 対応するデータも更新
        const imageItem = checkbox.closest('.image-item');
        if (imageItem) {
            const index = parseInt(imageItem.dataset.index);
            if (!isNaN(index) && extractedImages[index]) {
                extractedImages[index].selected = isChecked;
            }
        }
    });
    
    // ダウンロードボタンの状態を更新
    updateDownloadSelectedButton();
}

// マスターチェックボックスの状態を更新
function updateMasterCheckboxState() {
    const masterCheckbox = document.getElementById('master-checkbox');
    if (!masterCheckbox) return;
    
    // 現在表示されている画像のチェックボックスを取得
    const visibleCheckboxes = Array.from(
        document.querySelectorAll('.image-item:not([style*="display: none"]) .image-checkbox')
    );
    
    if (visibleCheckboxes.length === 0) {
        // 表示されている画像がない場合
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
        return;
    }
    
    // すべてのチェックボックスの状態を確認
    const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
    
    if (checkedCount === 0) {
        // 選択されていない
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (checkedCount === visibleCheckboxes.length) {
        // すべて選択されている
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        // 一部だけ選択されている
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    }
}

// 画像チェックボックスの変更をハンドリング
function handleImageCheckboxChange(checkbox, index) {
    // データを更新
    extractedImages[index].selected = checkbox.checked;
    
    // マスターチェックボックスの状態を更新
    updateMasterCheckboxState();
    
    // ダウンロードボタンの状態を更新
    updateDownloadSelectedButton();
}
