let isAutoPlay = false;
let autoPlayTimeout;

const historyLines = [];

// 右下角按鈕區
function autoPlay() {
    isAutoPlay = !isAutoPlay;
    const autoIcon = document.getElementById("autoIcon");

    if (isAutoPlay) {
        autoIcon.src = "https://raw.githubusercontent.com/LIN0010/JS_Final_Project/main/images/open.png"; // 切到開始圖示
        showNextLine();
    } else {
        autoIcon.src = "https://raw.githubusercontent.com/LIN0010/JS_Final_Project/main/images/stop.png"; // 回到暫停圖示
        clearTimeout(autoPlayTimeout); // 關掉下一次自動執行
    }
}

function skip() {
    index = script.length - 1;

    // 先關掉特效
    if (typeof hideNarrator === "function") hideNarrator();
    if (typeof hideImage === "function") hideImage();

    // 再顯示最後一句
    showNextLine();
}

function toggleMenu() {
    const overlay = document.getElementById("menuOverlay");
    overlay.style.display = overlay.style.display === "flex" ? "none" : "flex";
}

function goHome() {
    window.location.href = "https://www.google.com/";
}

function logDialogue(name, text) {
    const historyList = document.getElementById("historyList");
    const li = document.createElement("li");
    li.innerText = `${name}：${text}`;
    historyList.appendChild(li);
}

function toggleHistory() {
    const historyOverlay = $("#historyOverlay");
    const historyList = $("#historyList");
    historyList.html("");

    historyLines.forEach(line => {
        const li = $("<li>").text(line);
        historyList.append(li);
    });

    if (historyOverlay.css("display") === "none") {
        historyOverlay.css("display", "flex").hide().fadeIn(300);
    } else {
        historyOverlay.fadeOut(300, () => {
            historyOverlay.css("display", "none");
        });
    }
}

// 跑劇情
let typing = false;
let typingTimeout;
let fullScript = {};
let script = [];
let index = 0;
let currentLine = null;
let waitingForLastClick = false;

const storyPath = document.body.dataset.story;

fetch(storyPath)
    .then(res => res.json())
    .then(data => {
        fullScript = data;
        if (fullScript.main && Array.isArray(fullScript.main)) {
            script = fullScript.main;
            index = 0;
            showNextLine();
        } else {
            console.error(`${storyPath} 裡找不到 main 段落！`);
        }
    })
    .catch(err => {
        console.error("載入 JSON 失敗：", err);
    });

function showNextLine() {
    const line = script[index];
    currentLine = line; // 記錄目前這句（給 finishTypingNow 用）

    if (line.type === "command") {
        if (line.src) {
            window[line.command](line); // 把整個 line 傳進去
        } else {
            window[line.command]();
        }
        index++;
        showNextLine();
        return;
    }

    if (waitingForLastClick) {
        document.getElementById("popup-image").style.display = "none";
        enterInteractionMode();
        waitingForLastClick = false;
        return;
    }

    if (!script || !script.length) return;

    // 如果正在打字，就一次打完
    if (typing) {
        finishTypingNow();
        return;
    }

    const nameTag = document.getElementById("nameTag");
    const dialogueText = document.getElementById("dialogueText");

    // 加到歷史紀錄
    if (line.type === "dialogue") {
        historyLines.push(`${line.speaker}：${line.text}`);
        nameTag.style.display = "block";
        nameTag.textContent = line.speaker;

        //  有特殊顏色，改變顏色
        if (line.color) {
            dialogueText.style.color = line.color;
        } else {
            dialogueText.style.color = ""; // 沒有顏色就還原
        }
        typeText(dialogueText, line.text);
    } else if (line.type === "action") {
        historyLines.push(line.text);
        nameTag.style.display = "none";
        dialogueText.innerHTML = `<span class="action-line"></span>`;
        const target = dialogueText.querySelector(".action-line");
        typeText(target, line.text);
    }

    index++;

    if (isAutoPlay && index < script.length) {
        autoPlayTimeout = setTimeout(() => {
            showNextLine();
        }, 2000);
    }
    if (index >= script.length) {
        isAutoPlay = false;
        // 直接顯示結束按鈕畫面
        document.getElementById("endOverlay").style.display = "flex";
    }
}

function typeText(element, fullText) {
    typing = true;
    element.innerHTML = "";
    let i = 0;

    function typeChar() {
        if (fullText[i] === "<") {
            const end = fullText.indexOf(">", i);
            element.innerHTML += fullText.slice(i, end + 1);
            i = end + 1;
        } else {
            element.innerHTML += fullText[i];
            i++;
        }

        if (i < fullText.length) {
            typingTimeout = setTimeout(typeChar, 30);
        } else {
            typing = false;
            if (index >= script.length) {
                waitingForLastClick = true;
            }
        }
    }

    // 呼叫自己開始打字！
    typeChar();
}

function finishTypingNow() {
    clearTimeout(typingTimeout);
    typing = false;

    const nameTag = document.getElementById("nameTag");
    const dialogueText = document.getElementById("dialogueText");

    const line = currentLine;

    if (line.type === "dialogue") {
        nameTag.style.display = "block";
        nameTag.textContent = line.speaker;
        dialogueText.innerHTML = line.text;
    } else if (line.type === "action") {
        nameTag.style.display = "none";
        dialogueText.innerHTML = `<span class="action-line">${line.text}</span>`;
    }
}

function showImage(line) {
    const overlay = $("#specialEffectOverlay");
    const img = overlay.find("img");
    img.attr("src", line.src); // 根據 JSON 給的圖片路徑切換
    overlay.fadeIn(500);
}

function hideImage(nextCommand) {
    $("#specialEffectOverlay").fadeOut(500, () => {
        if (typeof nextCommand === "function") {
            setTimeout(() => {
                nextCommand();
            }, 300); // 延遲 300ms 再執行下一個 showImage
        }
    });
}

window.hideImage = hideImage;

function showNarrator() {
    $("#narrator").slideDown(500);
}

function hideNarrator() {
    $("#narrator").slideUp(500);
}

window.showNarrator = showNarrator;
window.hideNarrator = hideNarrator;

function shakeNarrator() {
    $("#narrator").effect("shake", { distance: 10, times: 3 }, 500);
}

window.shakeNarrator = shakeNarrator;

function enterGame() {
// 進入遊戲頁面（換
    window.location.href = "https://lin0010.github.io/JS_Final_Project/L1/index.html";
}

function goHome() {
    // 退縮（回主頁）
    window.location.href = "https://lin0010.github.io/JS_Final_Project/";
}



