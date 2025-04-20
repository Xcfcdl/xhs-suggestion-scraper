'use strict';

// --- 配置 ---\n
const INPUT_DELAY = 150; // 模拟输入的字符间延迟 (ms)\n
const SUGGESTION_WAIT_TIMEOUT = 3000; // 等待建议出现的最长时间 (ms)\n
const KEYWORD_PROCESS_DELAY = 1000; // 处理下一个关键词前的延迟 (ms)\n

// --- 存储 ---\n
let allSuggestions = new Set();
let isRunning = false;
let isPaused = false; // New state for pausing
let currentKeywordIndex = 0; // New state for tracking progress
let containerVisible = true; // Default visibility
let uiCreated = false; // Flag to track UI creation
let observer = null; // Reference to the MutationObserver

// --- UI 元素引用 ---
let container, toggleButton, keywordInput, runButton, stopButton, resumeButton, resetButton, statusDiv, resultOutput, exportButton, headerDiv, showButton;

// --- UI 创建 ---\n
function createUI() {
    // 防止重复创建
    if (document.getElementById('xhs-sug-scraper-container')) {
        console.log('[XHS Scraper] UI already exists.');
        return;
    }
    console.log('[XHS Scraper Debug] createUI called.');
    container = document.createElement('div');
    container.id = 'xhs-sug-scraper-container';
    // Visibility is set after checking storage

    headerDiv = document.createElement('div');
    headerDiv.className = 'xhs-header'; // Use class for CSS targeting

    const title = document.createElement('span');
    title.textContent = '小红书下拉词获取器';

    toggleButton = document.createElement('button');
    // Text content set after checking storage

    headerDiv.appendChild(title);
    headerDiv.appendChild(toggleButton);
    container.appendChild(headerDiv);

    const content = document.createElement('div');
    content.className = 'xhs-content'; // Use class

    const inputLabel = document.createElement('label');
    inputLabel.textContent = '输入关键词 (每行一个):';
    inputLabel.htmlFor = 'xhs-keyword-input'; // Accessibility

    keywordInput = document.createElement('textarea');
    keywordInput.id = 'xhs-keyword-input';
    keywordInput.rows = 3;
    keywordInput.placeholder = '例如：\n如何快速\n推荐\n有没有';

    runButton = document.createElement('button');
    runButton.id = 'xhs-run-button';
    runButton.textContent = '🚀 开始运行';

    stopButton = document.createElement('button');
    stopButton.id = 'xhs-stop-button';
    stopButton.textContent = '⏸️ 暂停';
    stopButton.style.display = 'none'; // Initially hidden

    resumeButton = document.createElement('button');
    resumeButton.id = 'xhs-resume-button';
    resumeButton.textContent = '▶️ 继续';
    resumeButton.style.display = 'none'; // Initially hidden
    resumeButton.style.marginRight = '10px';

    resetButton = document.createElement('button');
    resetButton.id = 'xhs-reset-button';
    resetButton.textContent = '🔄 重置';
    resetButton.style.display = 'none'; // Initially hidden
    resetButton.style.backgroundColor = '#eee'; // Style similar to old stop button
    resetButton.style.color = '#333';
    resetButton.style.border = '1px solid var(--border-color)';

    statusDiv = document.createElement('div');
    statusDiv.id = 'xhs-status';
    statusDiv.textContent = '状态：待机';

    const resultLabel = document.createElement('label');
    resultLabel.textContent = '获取结果:';
    resultLabel.htmlFor = 'xhs-result-output'; // Accessibility

    resultOutput = document.createElement('textarea');
    resultOutput.id = 'xhs-result-output';
    resultOutput.rows = 8;
    resultOutput.readOnly = true;
    resultOutput.placeholder = '这里将显示获取到的下拉词...';

    exportButton = document.createElement('button');
    exportButton.id = 'xhs-export-button';
    exportButton.textContent = '导出 TXT';


    content.appendChild(inputLabel);
    content.appendChild(keywordInput);
    content.appendChild(runButton);
    content.appendChild(stopButton);
    content.appendChild(resumeButton);
    content.appendChild(resetButton);
    content.appendChild(statusDiv);
    content.appendChild(resultLabel);
    content.appendChild(resultOutput);
    content.appendChild(exportButton);

    container.appendChild(content);
    document.body.appendChild(container);
    console.log('[XHS Scraper Debug] Container appended to body.');

    // --- 事件监听 ---\n
    toggleButton.addEventListener('click', toggleContainerVisibility);
    runButton.addEventListener('click', startScraping);
    stopButton.addEventListener('click', pauseScraping);
    resumeButton.addEventListener('click', resumeScraping);
    resetButton.addEventListener('click', resetScraping);
    exportButton.addEventListener('click', exportResults);
    keywordInput.addEventListener('input', handleKeywordInputChange);

    // --- 拖动功能 ---\n
    makeDraggable(container, headerDiv);

    // --- 创建 "显示" 按钮 ---
    showButton = document.createElement('button');
    showButton.id = 'xhs-show-button';
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = '显示面板';
    img.style.width = '32px'; // Adjust size as needed
    img.style.height = '32px';
    showButton.appendChild(img);
    showButton.addEventListener('click', toggleContainerVisibility);
    showButton.style.display = 'none'; // Initially hidden
    document.body.appendChild(showButton);

    // --- 加载并应用存储的状态 ---
    loadAndApplyState();

    uiCreated = true; // Set flag after successful creation

    // UI 创建成功后，可以断开观察者
    if (observer) {
        observer.disconnect();
        console.log('[XHS Scraper] MutationObserver disconnected.');
    }
}

function makeDraggable(element, handle) {
    let isDragging = false;
    let offsetX, offsetY;

    handle.addEventListener('mousedown', (e) => {
        // Ignore clicks on buttons inside the handle
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        element.style.cursor = 'grabbing';
        handle.style.cursor = 'grabbing'; // Also change handle cursor
        // Prevent text selection during drag
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        const elementRect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        newX = Math.max(0, Math.min(newX, viewportWidth - elementRect.width));
        newY = Math.max(0, Math.min(newY, viewportHeight - elementRect.height));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        element.style.right = 'auto'; // Override initial 'right' positioning if needed
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'default'; // Restore element cursor
            handle.style.cursor = 'move';   // Restore handle cursor
        }
    });
}

function loadAndApplyState() {
     chrome.storage.local.get(['containerVisible', 'savedSuggestions'], (result) => {
        console.log('[XHS Scraper Debug] Loaded containerVisible from storage:', result.containerVisible);
        containerVisible = result.containerVisible !== undefined ? result.containerVisible : true;
        setContainerVisibility(containerVisible);

        // Load saved suggestions
        if (result.savedSuggestions && Array.isArray(result.savedSuggestions)) {
            allSuggestions = new Set(result.savedSuggestions);
            updateResultsDisplay();
            console.log(`[XHS Scraper] Loaded ${allSuggestions.size} suggestions from storage.`);
            updateStatus(`已加载 ${allSuggestions.size} 条历史结果。状态：待机`);
        } else {
            updateStatus('状态：待机');
        }
    });
}

function setContainerVisibility(visible) {
    if (container && showButton) { // Check if both exist
        container.style.display = visible ? 'block' : 'none';
        showButton.style.display = visible ? 'none' : 'block';
    }
    containerVisible = visible; // Update state variable
}

function toggleContainerVisibility() {
    const newState = !containerVisible;
    setContainerVisibility(newState);
    // Save the new state
    chrome.storage.local.set({ containerVisible: newState }, () => {
        console.log(`[XHS Scraper] Container visibility saved: ${newState}`);
    });
}


// --- 核心逻辑 (与油猴脚本类似，稍作修改) ---

// 模拟输入并触发事件
function simulateInput(element, text) {
    return new Promise(async (resolve) => {
        element.focus();
        element.value = ''; // 清空现有内容
        // 触发一次 input 事件以清空建议（如果需要）
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await delay(50); // 短暂延迟

        for (let i = 0; i < text.length; i++) {
            element.value += text[i];
            // 触发 input 事件，这通常是触发建议列表的原因
            element.dispatchEvent(new Event('input', { bubbles: true, composed: true })); // composed: true might help cross shadow DOM boundaries if necessary
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
    if (statusDiv) {
        statusDiv.textContent = `状态：${message}`;
    }
    console.log(`[XHS Scraper] ${message}`);
}

 // 更新结果显示
function updateResultsDisplay() {
    if (resultOutput) {
        resultOutput.value = Array.from(allSuggestions).join('\n');
        // Scroll to bottom
        resultOutput.scrollTop = resultOutput.scrollHeight;
    }
}

// 保存建议到存储
function saveSuggestions() {
    const suggestionsArray = Array.from(allSuggestions);
    chrome.storage.local.set({ savedSuggestions: suggestionsArray }, () => {
        // console.log('[XHS Scraper] Suggestions saved to storage.');
    });
}

// --- 修改按钮/状态切换逻辑 ---

// 重命名 stopScraping 为 pauseScraping
function pauseScraping() {
    if (!isRunning) return;
    isPaused = true;
    // isRunning remains true
    updateStatus("已暂停");
    toggleButtons(true, true); // Running = true, Paused = true
}

// 新增 resumeScraping
function resumeScraping() {
    if (!isRunning || !isPaused) return;
    isPaused = false;
    updateStatus("继续运行...");
    toggleButtons(true, false); // Running = true, Paused = false
    processKeywordsLoop(); // Call the loop function directly
}

// 新增 resetScraping
function resetScraping(triggeredByInputChange = false) { // Accept optional flag
    isRunning = false;
    isPaused = false;
    currentKeywordIndex = 0;
    allSuggestions.clear();
    saveSuggestions(); // Save empty set
    updateResultsDisplay();
    // Set status message based on trigger
    if (triggeredByInputChange) {
        updateStatus("关键词已更改，状态已重置。请重新开始。");
    } else {
        updateStatus("已重置，状态：待机");
    }
    toggleButtons(false, false); // Running = false, Paused = false
}

// 新增 handleKeywordInputChange
function handleKeywordInputChange() {
    // Reset only if not actively running (i.e., idle or paused)
    if (!isRunning || isPaused) {
        // Small delay to avoid resetting on every single keystroke if typing fast,
        // although resetting on input change is usually fine.
        // Consider adding a debounce function here if needed, but for now, direct reset is simpler.
        console.log('[XHS Scraper] Keyword input changed while not actively running. Resetting state.');
        resetScraping(true); // Pass flag to indicate source
    }
    // If it IS actively running, the input is disabled anyway, so this shouldn't trigger.
}

// 更新 toggleButtons 以处理暂停状态
function toggleButtons(running, paused) {
     if (runButton && stopButton && resumeButton && resetButton && keywordInput && exportButton) {
         keywordInput.disabled = running;
         exportButton.disabled = running && !paused; // Disable export only when actively running

         if (!running) { // Idle state
             runButton.style.display = 'inline-block';
             stopButton.style.display = 'none';
             resumeButton.style.display = 'none';
             resetButton.style.display = 'none';
         } else if (paused) { // Paused state
             runButton.style.display = 'none';
             stopButton.style.display = 'none';
             resumeButton.style.display = 'inline-block';
             resetButton.style.display = 'inline-block';
         } else { // Running state
             runButton.style.display = 'none';
             stopButton.style.display = 'inline-block';
             resumeButton.style.display = 'none';
             resetButton.style.display = 'none';
         }
     }
}

// 重命名 runScraping 为 startScraping，并调用新的循环函数
async function startScraping() {
    if (isRunning) {
        updateStatus("已经在运行中或已暂停...");
        return;
    }
    isRunning = true;
    isPaused = false;
    // currentKeywordIndex = 0; // Reset index only on explicit reset or natural completion
    // Decide whether to clear results on start? For now, we append.
    // If you want to clear results every time you press Start:
    // allSuggestions.clear();
    // updateResultsDisplay();

    toggleButtons(true, false); // Running = true, Paused = false

    const searchInput = document.querySelector("#search-input");

    if (!keywordInput || !resultOutput || !searchInput || !statusDiv) {
        updateStatus("错误：无法找到必要的页面或插件元素！");
        isRunning = false;
        toggleButtons(false, false);
        return;
    }

    const keywords = keywordInput.value.split('\n').map(k => k.trim()).filter(k => k);
    if (keywords.length === 0) {
        updateStatus("请输入至少一个关键词");
        isRunning = false;
        toggleButtons(false, false);
        return;
    }
    if (currentKeywordIndex >= keywords.length) {
        currentKeywordIndex = 0; // Start from beginning if previously completed
        allSuggestions.clear(); // Clear results if starting over after completion
        updateResultsDisplay();
        updateStatus("列表已完成，重新开始...");
    }

    updateStatus(`准备处理 ${keywords.length - currentKeywordIndex} 个关键词 (从第 ${currentKeywordIndex + 1} 个开始)...`);
    await delay(500);

    processKeywordsLoop(); // Start the processing loop
}

// 新的循环处理函数
async function processKeywordsLoop() {
    const keywords = keywordInput.value.split('\n').map(k => k.trim()).filter(k => k);
    const searchInput = document.querySelector("#search-input");

    if (!searchInput) {
        updateStatus("错误：无法找到搜索框！");
        isRunning = false;
        isPaused = false;
        toggleButtons(false, false);
        return;
    }

    // Loop starting from currentKeywordIndex
    for (let i = currentKeywordIndex; i < keywords.length; i++) {
         if (!isRunning) { // Stopped by reset
             updateStatus("运行已重置");
             break;
         }
         if (isPaused) { // Check if paused
             currentKeywordIndex = i; // Save the index of the next keyword to process
             updateStatus(`已暂停，下一个将处理: "${keywords[i]}"`);
             break;
         }

        currentKeywordIndex = i; // Update index *before* processing
        const keyword = keywords[i];
        updateStatus(`(${i + 1}/${keywords.length}) 处理中: "${keyword}"`);

        try {
            await simulateInput(searchInput, keyword);

            let suggestionContainer = null;
            const startTime = Date.now();
            while (Date.now() - startTime < SUGGESTION_WAIT_TIMEOUT) {
                suggestionContainer = document.querySelector('.sug-container-wrapper .sug-container .sug-box');
                if (suggestionContainer && suggestionContainer.offsetParent !== null) {
                     await delay(300);
                    break;
                }
                await delay(100);
            }

            let suggestionsFoundThisRound = 0;
            if (suggestionContainer && suggestionContainer.offsetParent !== null) {
                const suggestionItems = suggestionContainer.querySelectorAll('.sug-item');
                if (suggestionItems.length > 0) {
                     suggestionItems.forEach(item => {
                        let suggestionText = '';
                        const spans = item.querySelectorAll('span');
                        spans.forEach(span => {
                            suggestionText += span.textContent;
                        });
                        suggestionText = suggestionText.trim();
                         if (suggestionText && !allSuggestions.has(suggestionText)) {
                             allSuggestions.add(suggestionText);
                             suggestionsFoundThisRound++;
                         }
                     });
                     if (suggestionsFoundThisRound > 0) {
                        updateResultsDisplay();
                        saveSuggestions(); // Save after finding new suggestions
                        updateStatus(`(${i + 1}/${keywords.length}) 新增 ${suggestionsFoundThisRound} 条建议 for "${keyword}"`);
                     } else {
                         updateStatus(`(${i + 1}/${keywords.length}) 未找到新建议 for "${keyword}"`);
                     }
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
        // --- End of keyword processing logic ---

        currentKeywordIndex = i + 1; // Move to next index for the next iteration or pause

        if (i < keywords.length - 1 && isRunning && !isPaused) {
             updateStatus(`(${i + 1}/${keywords.length}) 等待 ${KEYWORD_PROCESS_DELAY / 1000} 秒...`);
             await delay(KEYWORD_PROCESS_DELAY);
         }
    }

    // Loop finished (or was stopped/paused)
    if (isRunning && !isPaused) { // Natural completion
        // Clear search input only on natural completion
        try {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        } catch(e) {
            console.warn("[XHS Scraper] Failed to clear search input after run:", e);
        }
        updateStatus(`完成！共获取 ${allSuggestions.size} 条不重复建议。`);
        isRunning = false;
        currentKeywordIndex = 0; // Reset index for next run
        toggleButtons(false, false);
    } else if (!isRunning) {
         // Already handled by reset logic
    } else if (isPaused) {
         // Status already updated in the loop when pausing
    }
}

// 导出结果 (Chrome Extension way)
function exportResults() {
    if (!resultOutput || resultOutput.value.trim() === '') {
        alert('没有结果可以导出。');
        return;
    }

    const textToSave = resultOutput.value;
    const blob = new Blob([textToSave], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const defaultFileName = `xiaohongshu_suggestions_${new Date().toISOString().slice(0,10)}.txt`;

    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a); // Append anchor to body
        a.click(); // Simulate click to trigger download
        document.body.removeChild(a); // Clean up anchor
        URL.revokeObjectURL(url); // Release object URL
        updateStatus("结果已导出为 TXT 文件");
    } catch (e) {
        console.error("[XHS Scraper] Export failed:", e);
        alert("导出失败，请检查控制台错误信息。");
        updateStatus("导出失败");
        // Clean up URL if download failed
        if (url) {
            URL.revokeObjectURL(url);
        }
    }
}

// --- 初始化逻辑修改 ---

function initScraper() {
    // 检查目标元素（搜索框）和 UI 是否已创建
    const searchInput = document.querySelector("#search-input");
    if (searchInput && !uiCreated) {
        console.log('[XHS Scraper] Search input found on initial check. Creating UI.');
        createUI();
    } else if (!uiCreated) {
        console.log('[XHS Scraper] Search input not found initially. Setting up MutationObserver.');
        // 如果目标元素还没出现，设置 MutationObserver 监听 DOM 变化
        observer = new MutationObserver((mutationsList, obs) => {
            // 优化：只在有节点添加时检查
            let found = false;
            for(const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 检查新添加的节点或其子节点是否包含 #search-input
                    if (document.querySelector("#search-input")) {
                        found = true;
                        break;
                    }
                }
                 // 也检查属性变化，以防搜索框是通过改变现有元素的属性出现的
                 else if (mutation.type === 'attributes') {
                    if (document.querySelector("#search-input")) {
                        found = true;
                        break;
                    }
                }
            }

            if (found && !uiCreated) {
                console.log('[XHS Scraper] Search input detected via MutationObserver. Creating UI.');
                createUI(); // 创建 UI，内部会 disconnect observer
                // obs.disconnect(); // createUI now disconnects
            }
        });

        // 配置观察选项：监听子节点变化和整个子树
        const config = { childList: true, subtree: true, attributes: true };

        // 开始观察 document.body
        observer.observe(document.body, config);
    } else if (uiCreated) {
         console.log('[XHS Scraper] UI already created, skipping init.');
    }
}

// --- 启动初始化 ---
// 不再依赖 DOMContentLoaded 或 load，直接尝试初始化
// 脚本注入时 DOM 可能已经部分或完全加载
initScraper();

// 保留一个备用方案，以防脚本注入过早
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScraper);
} else {
    // 如果 DOM 已加载，再次尝试确保初始化运行
    // initScraper 内部有防止重复执行的逻辑
     setTimeout(initScraper, 0); // Use setTimeout to ensure it runs after current stack
}
