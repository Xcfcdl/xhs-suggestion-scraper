// ==UserScript==
// @name         小红书下拉词获取器 (Xiaohongshu Suggestion Scraper)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  在小红书探索页面获取搜索下拉建议词
// @author       Dony (GitHub: @Xcfcdl, Email: dony.chi@outlook.com)
// @match        https://www.xiaohongshu.com/explore*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @homepageURL  https://github.com/Xcfcdl
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置 ---
    const INPUT_DELAY = 150; // 模拟输入的字符间延迟 (ms)
    const SUGGESTION_WAIT_TIMEOUT = 3000; // 等待建议出现的最长时间 (ms)
    const KEYWORD_PROCESS_DELAY = 1000; // 处理下一个关键词前的延迟 (ms)

    // --- 存储 ---
    let allSuggestions = new Set();
    let isRunning = false;

    // --- UI 创建 ---
    function createUI() {
        const container = document.createElement('div');
        container.id = 'xhs-sug-scraper-container';
        container.style.position = 'fixed';
        container.style.top = '100px';
        container.style.right = '20px';
        container.style.width = '350px';
        container.style.maxHeight = '80vh';
        container.style.backgroundColor = 'white';
        container.style.border = '1px solid #dbdbdb';
        container.style.borderRadius = '8px';
        container.style.zIndex = '9999';
        container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        container.style.display = GM_getValue('containerVisible', true) ? 'block' : 'none'; // 读取保存的状态
        container.style.fontFamily = 'sans-serif';
        container.style.fontSize = '14px';
        container.style.color = '#333';
        container.style.overflow = 'hidden'; // 防止子元素溢出圆角

        const header = document.createElement('div');
        header.style.padding = '10px 15px';
        header.style.backgroundColor = '#f7f7f7';
        header.style.borderBottom = '1px solid #eee';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.cursor = 'move'; // Make header draggable

        const title = document.createElement('span');
        title.textContent = '小红书下拉词获取器';
        title.style.fontWeight = 'bold';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = '隐藏';
        toggleButton.style.padding = '3px 8px';
        toggleButton.style.border = '1px solid #ccc';
        toggleButton.style.borderRadius = '4px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.backgroundColor = '#fff';

        header.appendChild(title);
        header.appendChild(toggleButton);
        container.appendChild(header);

        const content = document.createElement('div');
        content.style.padding = '15px';
        content.style.maxHeight = 'calc(80vh - 150px)'; // Adjust based on other elements' height
        content.style.overflowY = 'auto';

        const inputLabel = document.createElement('label');
        inputLabel.textContent = '输入关键词 (每行一个):';
        inputLabel.style.display = 'block';
        inputLabel.style.marginBottom = '5px';
        inputLabel.style.fontWeight = '500';

        const keywordInput = document.createElement('textarea');
        keywordInput.id = 'xhs-keyword-input';
        keywordInput.rows = 5;
        keywordInput.style.width = 'calc(100% - 12px)'; // Account for padding/border
        keywordInput.style.marginBottom = '10px';
        keywordInput.style.padding = '5px';
        keywordInput.style.border = '1px solid #ccc';
        keywordInput.style.borderRadius = '4px';
        keywordInput.placeholder = '例如：\n如何快速入睡\n减肥食谱';

        const runButton = document.createElement('button');
        runButton.id = 'xhs-run-button';
        runButton.textContent = '🚀 开始运行';
        runButton.style.padding = '8px 15px';
        runButton.style.border = 'none';
        runButton.style.borderRadius = '4px';
        runButton.style.backgroundColor = '#ff2741'; // 小红书红
        runButton.style.color = 'white';
        runButton.style.cursor = 'pointer';
        runButton.style.fontWeight = 'bold';
        runButton.style.marginRight = '10px';

        const stopButton = document.createElement('button');
        stopButton.id = 'xhs-stop-button';
        stopButton.textContent = '⏹️ 停止';
        stopButton.style.padding = '8px 15px';
        stopButton.style.border = '1px solid #ccc';
        stopButton.style.borderRadius = '4px';
        stopButton.style.backgroundColor = '#eee';
        stopButton.style.color = '#333';
        stopButton.style.cursor = 'pointer';
        stopButton.style.display = 'none'; // Initially hidden

        const statusDiv = document.createElement('div');
        statusDiv.id = 'xhs-status';
        statusDiv.style.marginTop = '10px';
        statusDiv.style.fontSize = '13px';
        statusDiv.style.color = '#666';
        statusDiv.textContent = '状态：待机';

        const resultLabel = document.createElement('label');
        resultLabel.textContent = '获取结果:';
        resultLabel.style.display = 'block';
        resultLabel.style.marginTop = '15px';
        resultLabel.style.marginBottom = '5px';
        resultLabel.style.fontWeight = '500';

        const resultOutput = document.createElement('textarea');
        resultOutput.id = 'xhs-result-output';
        resultOutput.rows = 8;
        resultOutput.readOnly = true;
        resultOutput.style.width = 'calc(100% - 12px)';
        resultOutput.style.marginTop = '5px';
        resultOutput.style.padding = '5px';
        resultOutput.style.border = '1px solid #ccc';
        resultOutput.style.borderRadius = '4px';
        resultOutput.style.backgroundColor = '#f9f9f9';
        resultOutput.placeholder = '这里将显示获取到的下拉词...';

        const exportButton = document.createElement('button');
        exportButton.id = 'xhs-export-button';
        exportButton.textContent = '导出 TXT';
        exportButton.style.padding = '5px 10px';
        exportButton.style.border = '1px solid #ccc';
        exportButton.style.borderRadius = '4px';
        exportButton.style.backgroundColor = '#fff';
        exportButton.style.cursor = 'pointer';
        exportButton.style.marginTop = '10px';


        content.appendChild(inputLabel);
        content.appendChild(keywordInput);
        content.appendChild(runButton);
        content.appendChild(stopButton);
        content.appendChild(statusDiv);
        content.appendChild(resultLabel);
        content.appendChild(resultOutput);
        content.appendChild(exportButton);

        container.appendChild(content);
        document.body.appendChild(container);

        // --- 事件监听 ---
        toggleButton.addEventListener('click', () => {
            const isVisible = container.style.display !== 'none';
            container.style.display = isVisible ? 'none' : 'block';
            toggleButton.textContent = isVisible ? '显示' : '隐藏';
            GM_setValue('containerVisible', !isVisible); // 保存状态
        });

        runButton.addEventListener('click', runScraping);
        stopButton.addEventListener('click', stopScraping);
        exportButton.addEventListener('click', exportResults);

        // --- 拖动功能 ---
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            // Ignore clicks on buttons inside the header
            if (e.target === toggleButton) return;
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            container.style.cursor = 'grabbing'; // Change cursor while dragging
            // Prevent text selection during drag
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            // Calculate new position but keep within viewport boundaries
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // Ensure the container stays within the viewport
            const containerRect = container.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            newX = Math.max(0, Math.min(newX, viewportWidth - containerRect.width));
            newY = Math.max(0, Math.min(newY, viewportHeight - containerRect.height));


            container.style.left = `${newX}px`;
            container.style.top = `${newY}px`;
            container.style.right = 'auto'; // Override initial 'right' positioning
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'move'; // Restore cursor
            }
        });

        // Ensure initial state of toggle button text is correct
        if (container.style.display === 'none') {
             toggleButton.textContent = '显示';
        }
    }

    // --- 核心逻辑 ---

    // 模拟输入并触发事件
    function simulateInput(element, text) {
        return new Promise(async (resolve) => {
            element.focus();
            element.value = ''; // 清空现有内容
             // 触发一次 input 事件以清空建议（如果需要）
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(50); // 短暂延迟

            for (let i = 0; i < text.length; i++) {
                element.value += text[i];
                // 触发 input 事件，这通常是触发建议列表的原因
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await delay(INPUT_DELAY);
            }
            resolve();
        });
    }

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 更新状态显示
    function updateStatus(message) {
        const statusDiv = document.getElementById('xhs-status');
        if (statusDiv) {
            statusDiv.textContent = `状态：${message}`;
        }
        console.log(`[XHS Scraper] ${message}`);
    }

     // 更新结果显示
    function updateResultsDisplay() {
        const resultOutput = document.getElementById('xhs-result-output');
        if (resultOutput) {
            resultOutput.value = Array.from(allSuggestions).join('\n');
        }
    }

    // 停止运行
    function stopScraping() {
        isRunning = false;
        updateStatus("已手动停止");
        toggleButtons(false); // 显示运行按钮，隐藏停止按钮
    }

    // 切换运行/停止按钮的可见性
    function toggleButtons(running) {
         const runButton = document.getElementById('xhs-run-button');
         const stopButton = document.getElementById('xhs-stop-button');
         const keywordInput = document.getElementById('xhs-keyword-input');
         const exportButton = document.getElementById('xhs-export-button');

         if (runButton && stopButton && keywordInput && exportButton) {
             runButton.style.display = running ? 'none' : 'inline-block';
             stopButton.style.display = running ? 'inline-block' : 'none';
             keywordInput.disabled = running;
             exportButton.disabled = running; // Disable export while running
             runButton.disabled = running;
         }
    }


    // 运行爬取过程
    async function runScraping() {
        if (isRunning) {
            updateStatus("已经在运行中...");
            return;
        }
        isRunning = true;
        toggleButtons(true); // 隐藏运行按钮，显示停止按钮

        const keywordInput = document.getElementById('xhs-keyword-input');
        const resultOutput = document.getElementById('xhs-result-output');
        const searchInput = document.querySelector("#search-input");

        if (!keywordInput || !resultOutput || !searchInput) {
            updateStatus("错误：无法找到必要的页面元素！");
            isRunning = false;
            toggleButtons(false);
            return;
        }

        const keywords = keywordInput.value.split('\n').map(k => k.trim()).filter(k => k); // 获取并清理关键词
        if (keywords.length === 0) {
            updateStatus("请输入至少一个关键词");
            isRunning = false;
            toggleButtons(false);
            return;
        }

        allSuggestions.clear(); // 开始新任务前清空旧结果
        resultOutput.value = ''; // 清空显示区域
        updateStatus(`准备处理 ${keywords.length} 个关键词...`);
        await delay(500);

        for (let i = 0; i < keywords.length; i++) {
             if (!isRunning) { // Check if stopped
                 updateStatus("运行已停止");
                 break;
             }
            const keyword = keywords[i];
            updateStatus(`(${i + 1}/${keywords.length}) 处理中: "${keyword}"`);

            try {
                await simulateInput(searchInput, keyword);

                // 等待建议容器出现
                let suggestionContainer = null;
                const startTime = Date.now();
                while (Date.now() - startTime < SUGGESTION_WAIT_TIMEOUT) {
                     // 注意：小红书的建议容器选择器可能随更新变化，需要检查确认
                    suggestionContainer = document.querySelector('.sug-container-wrapper .sug-container .sug-box'); // 更精确的选择器
                    if (suggestionContainer && suggestionContainer.offsetParent !== null) { // 确保元素可见
                        // 再稍微等待一下，确保内容加载完成
                        await delay(300);
                        break;
                    }
                    await delay(100); // 轮询间隔
                }


                if (suggestionContainer && suggestionContainer.offsetParent !== null) {
                    const suggestionItems = suggestionContainer.querySelectorAll('.sug-item');
                    if (suggestionItems.length > 0) {
                         updateStatus(`(${i + 1}/${keywords.length}) 找到 ${suggestionItems.length} 条建议 for "${keyword}"`);
                         suggestionItems.forEach(item => {
                             // 提取文本，合并所有 span 的内容
                            let suggestionText = '';
                            const spans = item.querySelectorAll('span');
                            spans.forEach(span => {
                                suggestionText += span.textContent;
                            });
                            suggestionText = suggestionText.trim();
                             if (suggestionText) {
                                 allSuggestions.add(suggestionText);
                             }
                         });
                        updateResultsDisplay(); // 更新显示
                    } else {
                       updateStatus(`(${i + 1}/${keywords.length}) 未找到建议 for "${keyword}"`);
                    }

                } else {
                    updateStatus(`(${i + 1}/${keywords.length}) 等待建议超时 for "${keyword}"`);
                }

            } catch (error) {
                updateStatus(`(${i + 1}/${keywords.length}) 处理 "${keyword}" 时出错: ${error.message}`);
                console.error(`[XHS Scraper] Error processing ${keyword}:`, error);
            }

             // 在处理下一个关键词前等待
            if (i < keywords.length - 1 && isRunning) {
                 updateStatus(`(${i + 1}/${keywords.length}) 等待 ${KEYWORD_PROCESS_DELAY / 1000} 秒...`);
                 await delay(KEYWORD_PROCESS_DELAY);
             }
        }

        // 清空搜索框内容
        try {
            searchInput.value = '';
             searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        } catch(e) {
             console.warn("[XHS Scraper] Failed to clear search input after run:", e);
        }


        if (isRunning) { // Only update status if not stopped manually
           updateStatus(`完成！共获取 ${allSuggestions.size} 条不重复建议。`);
        }
        isRunning = false;
        toggleButtons(false); // 恢复按钮状态
    }

    // 导出结果
    function exportResults() {
        const resultOutput = document.getElementById('xhs-result-output');
        if (!resultOutput || resultOutput.value.trim() === '') {
            alert('没有结果可以导出。');
            return;
        }

        const textToSave = resultOutput.value;
        const blob = new Blob([textToSave], {type: "text/plain;charset=utf-8"});
        const defaultFileName = `xiaohongshu_suggestions_${new Date().toISOString().slice(0,10)}.txt`;

        try {
             saveAs(blob, defaultFileName); // 使用 FileSaver.js
             updateStatus("结果已导出为 TXT 文件");
        } catch (e) {
            console.error("[XHS Scraper] Export failed:", e);
            alert("导出失败，请检查控制台错误信息。确保浏览器允许下载文件。");
            updateStatus("导出失败");
        }
    }

    // --- 初始化 ---
    // 使用 GM_addStyle 添加 CSS 样式，避免与页面样式冲突
    GM_addStyle(`
        #xhs-sug-scraper-container button:hover {
            opacity: 0.9;
        }
        #xhs-run-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
         #xhs-stop-button:hover {
             background-color: #ddd;
         }
         #xhs-export-button:hover {
            background-color: #f0f0f0;
         }
         #xhs-sug-scraper-container textarea:focus,
         #xhs-sug-scraper-container input:focus {
            outline: none;
            border-color: #ff2741;
            box-shadow: 0 0 0 2px rgba(255, 39, 65, 0.2);
         }
         /* Auto-scroll for result textarea */
         #xhs-result-output {
            overflow-y: scroll;
         }
    `);

    // 等待页面加载完成再创建 UI
    window.addEventListener('load', createUI, false);

})();
