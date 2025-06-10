const arena = document.getElementById('arena');
const input = document.getElementById('typing-input');
const healthBar = document.getElementById('health-bar');
const enemyTimers = new Map(); // 用來記錄每個勇者的倒數炸彈
const typedWords = {}; // 用 dict（物件）存

let health = 5;
let gameMode = 'normal';
let words = [];
let spawnInterval = 5000; // 預設 5000ms
let enemyMoveDuration = 3; // 單位：秒，預設 3 秒
let supplyNeedleEnabled = false;
let supplyTimer;
let gameRunning = false; // 遊戲運行狀態

function getRandomStartPos() {
    const dirs = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];

    const arenaRect = document.getElementById('arena').getBoundingClientRect();
    const centerX = arenaRect.width / 2;
    const centerY = arenaRect.height / 2;

    let startX, startY;
    switch (dir) {
        case 'top':
            startX = centerX;
            startY = -60;
            break;
        case 'bottom':
            startX = centerX;
            startY = arenaRect.height + 60;
            break;
        case 'left':
            startX = -60;
            startY = centerY;
            break;
        case 'right':
            startX = arenaRect.width + 60;
            startY = centerY;
            break;
        case 'top-left':
            startX = -60;
            startY = -60;
            break;
        case 'top-right':
            startX = arenaRect.width + 60;
            startY = -60;
            break;
        case 'bottom-left':
            startX = -60;
            startY = arenaRect.height + 60;
            break;
        case 'bottom-right':
            startX = arenaRect.width + 60;
            startY = arenaRect.height + 60;
            break;
    }

    return { startX, startY, centerX, centerY };
}

function animateToCenter(element, moveDuration, goblinRadiusPx) {
    // 先把 arena 的絕對座標抓一次
    const arenaRect = arena.getBoundingClientRect();
    const arenaCX = arenaRect.width / 2;
    const arenaCY = arenaRect.height / 2;

    // === 1. 給元素一個「起跑點」 ===
    const { startX, startY } = getRandomStartPos();
    element.style.left = `${startX}px`; // 直接用左上角，不用減 radius
    element.style.top = `${startY}px`;

    // === 2. 先放進 DOM，才能量到真實尺寸 ===
    arena.appendChild(element);

    // 現在才能精準量出「包含標籤後」的整體框
    const elemRect = element.getBoundingClientRect();
    const elemCX = elemRect.left - arenaRect.left + elemRect.width / 2;
    const elemCY = elemRect.top - arenaRect.top + elemRect.height / 2;
    const elemRadius = elemRect.width / 2; // 假設是正圓

    // === 3. 計算要移動多少 ===
    const dx = arenaCX - elemCX;
    const dy = arenaCY - elemCY;

    element.style.transition = `transform ${moveDuration}ms linear`;

    // 用 rAF 確保瀏覽器先套完初始樣式
    requestAnimationFrame(() => {
        element.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    // === 4. 算「兩圓外切」的撞擊時間 ===
    const dist = Math.hypot(dx, dy); // 其實就是移動距離
    const hitDist = elemRadius + goblinRadiusPx; // 相切距離
    const hitRatio = (dist - hitDist) / dist;
    return moveDuration * hitRatio;
}

// 血量顯示相關
const maxHealth = 5; // 總血量
updateHealthBar(); // 先畫滿 5 顆愛心

function updateHealthBar() {
    healthBar.textContent = '❤️'.repeat(health) + '🤍'.repeat(maxHealth - health);
    // 觸發閃爍效果
    healthBar.classList.add('health-bar-flash');
    setTimeout(() => {
        healthBar.classList.remove('health-bar-flash');
    }, 300); // 閃爍 300ms
}

// 扣血 、 結束判定 
function loseHealth() {
    if (health <= 0) return; // 已經 Game Over 就別再扣
    health--;
    updateHealthBar();

    if (health <= 0) {
        gameOver();
    }
}

function startGame(mode) {
    gameMode = mode;

    // 立即更新剩餘單字顯示
    updateRemainingWords();

    // 隱藏 start 畫面
    document.getElementById("startOverlay").style.display = "none";

    // 啟動遊戲邏輯
    gameRunning = true;
    startSpawning();
    startSupplyNeedle(); // 生成補給針
}

function gameOver() {
    clearInterval(spawnTimer);
    clearInterval(supplyTimer);
    input.disabled = true;

    const correctCount = Object.values(typedWords).filter(w => w.success).length;

    let allWordsCleared = true;
    for (const word of words.map(w => w.en)) {
        if (!typedWords[word]) {
            allWordsCleared = false;
            break;
        }
    }

    const heartsLeft = health;

    // 更新結束畫面文字
    const title = document.getElementById("endTitle");
    const count = document.getElementById("endCount");

    if (allWordsCleared && heartsLeft <= 5) {
        title.textContent = "挑戰成功！";
    } else {
        title.textContent = "挑戰失敗";
    }
    count.textContent = `總打對次數：${correctCount}`;

    // 顯示結束畫面
    document.getElementById("endOverlay").style.display = "flex";
}

// 讀取外部 JSON 單字檔
fetch('t2.json')
    .then(response => {
        if (!response.ok) throw new Error('Failed to load word list');
        return response.json();
    })
    .then(data => {
        words = data.words || [];
        if (words.length === 0) {
            alert('Warning: 單詞庫為空的，請重新載入');
            words = [{ en: 'test', zh: '測試' }]; // 預設單字
        }
        updateRemainingWords();
    })
    .catch(error => {
        console.error('讀取單字庫失敗:', error);
        alert('無法載入單字表，將使用預設單詞庫');
        words = [{ en: 'test', zh: '測試' }]; // 預設單字
        updateRemainingWords();
    });

// 開始產生勇者
function startSpawning() {
    spawnTimer = setInterval(spawnEnemy, spawnInterval);
}

// 隨機生成勇者
function spawnEnemy() {
	if (!arena) {
        console.error('Arena element not found');
        return;
    }
    // 先只選出「還沒被打對」的單字
    const remainingWords = words.filter(w => !typedWords[w.en]?.success);
    if (remainingWords.length === 0) return; // 全部打對就不生成勇者

    // 同時上限 5 隻
    if (document.querySelectorAll('.enemy').length >= 5) return;

    // 隨機選一個還沒被打對的單字
    const wordObj = remainingWords[Math.floor(Math.random() * remainingWords.length)];
    const enemy = document.createElement('div');
    enemy.classList.add('enemy');
    enemy.dataset.word = wordObj.en;

    // 英文單字標籤
    const wordTag = document.createElement('span');
    wordTag.classList.add('enemy-word');
    if (gameMode === 'masked') {
        wordTag.textContent = '*'.repeat(wordObj.en.length);
    } else {
        wordTag.textContent = wordObj.en;
    }

    enemy.appendChild(wordTag);

    // 中文翻譯標籤
    const translationTag = document.createElement('span');
    translationTag.classList.add('enemy-translation');
    translationTag.textContent = wordObj.zh;
    enemy.appendChild(translationTag);

    const moveDuration = enemyMoveDuration * 1000;
    const hitTime = animateToCenter(enemy, moveDuration, 40); // 40 = 哥布林半徑
    const hitTimer = setTimeout(() => {
        if (document.body.contains(enemy)) {
            enemy.remove();
            wordTag.remove();
			// 記錄碰撞次數
            const word = enemy.dataset.word;
			if (!typedWords[word]) {
                typedWords[word] = {
                    attemptCount: 0,
                    successCount: 0,
                    success: false,
                    collisionCount: 0,
                    timestamp: Date.now(),
                    zh: wordObj.zh
                };
            }
            typedWords[word].collisionCount++;
            loseHealth();
        }
    }, hitTime);
    enemyTimers.set(enemy, hitTimer);
    input.focus();
}

function spawnSupplyNeedle() {
	if (!arena) {
        console.error('Arena element not found');
        return;
    }
    if (!supplyNeedleEnabled) return;
    const moveDuration = Math.floor(Math.random() * 4000) + 1000;// 單位 ms

    const supply = document.createElement('div');
    supply.classList.add('supply-needle'); // 另外給個 class，好看！

    const hitTime = animateToCenter(supply, moveDuration, 40);
    const hitTimer = setTimeout(() => {
        if (document.body.contains(supply)) {
            supply.remove();
            // 撞到哥布林時，補血（如果還有空位）
            if (health < maxHealth) {
                health++;
                updateHealthBar();
            }
        }
    }, hitTime);

    enemyTimers.set(supply, hitTimer);
}

function startSupplyNeedle() {
    supplyTimer = setInterval(spawnSupplyNeedle, 10000); // 每 10 秒嘗試生成一次
}

// 勇者成功進攻，扣血
input.addEventListener('input', debounce(() => {
    const typedWord = input.value.trim();
    if (!typedWord) return; // 忽略空輸入

    // 只處理單字庫中的單字
    if (!words.some(w => w.en === typedWord)) {
        // 不自動清空，讓使用者自己清掉錯字
        input.focus();
        return;
    }

    // 初始化 typedWords 記錄
    if (!typedWords[typedWord]) {
        typedWords[typedWord] = {
            attemptCount: 0,
            successCount: 0,
            success: false,
            collisionCount: 0,
            timestamp: Date.now(),
            zh: words.find(w => w.en === typedWord).zh
        };
    }
    typedWords[typedWord].attemptCount++;

    let matched = false;
    const enemies = document.querySelectorAll('.enemy');
    enemies.forEach((enemy) => {
        if (enemy.dataset.word === typedWord) {
            clearTimeout(enemyTimers.get(enemy));
            enemyTimers.delete(enemy);
            enemy.remove();
            typedWords[typedWord].success = true;
            typedWords[typedWord].successCount++;
            matched = true;
            updateRemainingWords();
            input.value = '';
            input.focus();
            const allWordsCleared = words.every(w => typedWords[w.en]?.success);
            if (allWordsCleared) {
                gameOver();
            }
        }
    });

    if (!matched) {
        // 不再自動清空錯字
        input.focus();
    }
}, 100));

function updateRemainingWords() {
	const remainingCount = words.filter(w => !typedWords[w.en]?.success).length;
    document.getElementById("remainingWords").textContent = `剩餘單字：${remainingCount}`;
}

function restartGame() {
    // 重置變數
    health = maxHealth;
    updateHealthBar();

    // 清空 typedWords 記錄
    for (const key in typedWords) {
        delete typedWords[key];
    }

    // 移除所有勇者
    document.querySelectorAll('.enemy').forEach(enemy => {
        clearTimeout(enemyTimers.get(enemy));
        enemyTimers.delete(enemy);
        enemy.remove();
    });

    // 隱藏結束畫面
    document.getElementById("endOverlay").style.display = "none";

    // 重新更新剩餘單字
    updateRemainingWords();

    // 重新啟動遊戲
    gameRunning = true;
    startSpawning();
    startSupplyNeedle();
    input.disabled = false;
    input.value = '';
    input.focus();
}

function goBack() {
    // 重新整理頁面（重新開始）
    window.location.reload();
}

function viewWords() {
    // 顯示複習畫面
    document.getElementById("reviewOverlay").style.display = "flex";

    // 獲取 DOM 元素
    const correctList = document.getElementById("correctWordsList");
    const wrongList = document.getElementById("wrongWordsList");
    const errorCountList = document.getElementById("errorCountList");

    // 清空清單
    correctList.innerHTML = "";
    wrongList.innerHTML = "";
    if (errorCountList) errorCountList.innerHTML = "";

    // 檢查單字庫是否為空
    if (words.length === 0) {
        const li = document.createElement("li");
        li.textContent = "無單字可顯示";
        wrongList.appendChild(li);
        return;
    }

    // 分類正確和錯誤單字，並顯示碰撞次數
    words.forEach(wordObj => {
        const word = wordObj.en;

        // 已打對（最終答對）
        if (typedWords[word]?.success) {
            const li = document.createElement("li");
            li.textContent = `${word} - ${wordObj.zh}`;
            correctList.appendChild(li);
        } else {
            // 沒打對（最終未答對）
            const li = document.createElement("li");
            li.textContent = `${word} - ${wordObj.zh}`;
            wrongList.appendChild(li);
        }

        // 顯示碰撞次數（如果有）
        if (errorCountList && typedWords[word]?.collisionCount > 0) {
            const li = document.createElement("li");
            li.textContent = `${word} - ${wordObj.zh} (${typedWords[word].collisionCount})`;
            errorCountList.appendChild(li);
        }
    });
}

function closeReview() {
    document.getElementById("reviewOverlay").style.display = "none";
}

function openSettings() {
    // 顯示「設定視窗」或切換設定面板
    document.getElementById("settingsOverlay").style.display = "flex";
}

function closeSettings() {
    document.getElementById("settingsOverlay").style.display = "none";
}

function saveSettings() {
    const selectedSpeed = document.getElementById("speedSelect").value;
    spawnInterval = parseInt(selectedSpeed, 10);

    const selectedEnemySpeed = document.getElementById("enemySpeedSelect").value;
    enemyMoveDuration = parseInt(selectedEnemySpeed, 10);

    supplyNeedleEnabled = document.getElementById("enableSupplyNeedle").checked;

    const fileInput = document.getElementById("customWordsFile");
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.words && Array.isArray(data.words)) {
                    words = data.words;
                    alert("成功載入自訂單字表！");
                } else {
                    alert("單字表格式錯誤！");
                }
            } catch (err) {
                alert("讀取檔案失敗！");
            }
            // 檔案處理完成後才關閉設定視窗
            document.getElementById("settingsOverlay").style.display = "none";
            document.getElementById("startOverlay").style.display = "flex";
        };
        reader.readAsText(file);
    } else {
        // 無檔案上傳，直接關閉設定視窗
        document.getElementById("settingsOverlay").style.display = "none";
        document.getElementById("startOverlay").style.display = "flex";
    }
}

function goHome() {
    // 退縮（回主頁）
    window.location.href = "https://lin0010.github.io/JS_Final_Project/";
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}
