const XHS_EXPLORE_URL = "https://www.xiaohongshu.com/explore";

chrome.action.onClicked.addListener(async (tab) => {
    // 获取当前活动的标签页
    let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 如果当前标签页是小红书探索页
    if (currentTab && currentTab.url && currentTab.url.startsWith(XHS_EXPLORE_URL)) {
        console.log("Current tab is Xiaohongshu Explore page. Checking login status...");

        // 在当前标签页执行脚本检查登录按钮
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: () => {
                    // 检查两种可能的登录按钮
                    const loginButton1 = document.querySelector("button > span.text[data-v-a05e68f8]");
                    const loginButton2 = document.querySelector("#app > div:nth-child(1) > div > div.login-container > div.right > div.input-container.mt-20px > form > button");
                    return loginButton1 || loginButton2;
                }
            });

            // executeScript 返回一个数组，我们需要第一个结果
            if (results && results.length > 0) {
                 const isLoggedIn = !results[0].result; // 如果按钮不存在，则认为已登录
                 const statusMessage = isLoggedIn ? "用户已登录。" : "用户未登录（找到登录按钮）。";
                 console.log(statusMessage);
                 // 可选：发送消息到 content script 显示状态，或使用 chrome.notifications
                 // chrome.notifications.create({ ... });
                  // 简单地用 alert 提示，或者发送消息给 content script 更新 UI
                 chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: (msg) => alert(msg), // 使用 alert 简单提示
                    args: [statusMessage]
                 });
            } else {
                 console.log("无法获取登录状态检查结果。");
            }
        } catch (err) {
            console.error(`Error executing script: ${err}`);
            // 可能由于页面未完全加载或权限问题导致脚本无法注入
            chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: (msg) => alert(msg),
                args: [`检查登录状态时出错: ${err.message}`]
             });
        }
    } else {
        // 如果当前标签页不是小红书探索页，或者没有 URL (例如新标签页)
        console.log("Navigating to Xiaohongshu Explore page...");
        // 尝试在当前标签页导航，如果失败（比如当前是特殊页面如 chrome://），则创建新标签页
         try {
             if (currentTab && currentTab.id) {
                await chrome.tabs.update(currentTab.id, { url: XHS_EXPLORE_URL });
             } else {
                await chrome.tabs.create({ url: XHS_EXPLORE_URL });
             }
        } catch (error) {
             console.error(`Failed to navigate: ${error}. Opening in new tab.`);
             await chrome.tabs.create({ url: XHS_EXPLORE_URL });
        }
    }
});

// 这个函数将在内容脚本的上下文中执行
function checkForLoginButton() {
    // 查找页面右上角的登录按钮
    // 注意：这个选择器可能需要根据小红书的实际页面结构进行调整
    const loginButton = document.querySelector("button > span.text[data-v-a05e68f8]"); // 尝试更具体的选择器
    // 或者之前的选择器（如果更稳定）: const loginButton = document.querySelector("#login-btn");
    console.log("Login button found:", loginButton);
    return !!loginButton; // 返回按钮是否存在 (true or false)
} 