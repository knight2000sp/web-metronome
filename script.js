const APP_VERSION = 'v0.7.1'; // ★ リリースの際、ここの番号を手動で変更します


// === 1. DOM要素の取得 ===
const bpmSlider = document.getElementById('bpm-slider');
const bpmValueSpan = document.getElementById('bpm-value');
const startStopBtn = document.getElementById('start-stop-btn');
const voiceBtn = document.getElementById('voice-btn');
const voiceFeedback = document.getElementById('voice-feedback'); // フィードバック欄

const modeNone = document.getElementById('mode-none'); 
const modeBeat = document.getElementById('mode-beat');
const modeDivision = document.getElementById('mode-division');
const beatControls = document.getElementById('beat-controls');
const divisionControls = document.getElementById('division-controls');
const beatsSelect = document.getElementById('beats-select');
const divisionsSelect = document.getElementById('divisions-select');

// (バージョン番号をHTMLに書き込む)
const versionSpan = document.getElementById('app-version');
if (versionSpan) {
    versionSpan.textContent = APP_VERSION;
}


// === 2. メトロノームの状態 ===
let bpm = 120;
let isRunning = false;
let audioContext = null;

let tickBufferA = null; // 音A (弱拍)
let tickBufferB = null; // 音B (強拍)

let timerId = null; 
let nextNoteTime = 0.0;
const lookahead = 25.0; 
const scheduleAheadTime = 0.1; 

let currentMode = 'none'; // 初期値
let beatsPerMeasure = 4; 
let divisionsPerBeat = 1; 
let beatCounter = 0; 


// === 3. 音声ファイルの読み込み ===
async function loadTickSound(context, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`音声ファイルの読み込みに失敗: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(error);
        alert(`音声ファイル「${url}」の読み込みに失敗しました。ファイルが同じフォルダにあるか確認してください。`);
        return null;
    }
}
async function setupAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!tickBufferA || !tickBufferB) {
        console.log('音声ファイルを読み込んでいます...');
        [tickBufferA, tickBufferB] = await Promise.all([
            loadTickSound(audioContext, 'tick_normal.wav'), // 音A (弱拍)
            loadTickSound(audioContext, 'tick_accent.wav')  // 音B (強拍)
        ]);
        if (!tickBufferA || !tickBufferB) {
            alert("音声ファイルの読み込みに失敗しました。");
            return false;
        }
        console.log('両方の音声ファイルの準備ができました。');
    }
    return true;
}


// === 4. 音声再生関数 (2種類) ===
function playTickA(time) {
    if (!audioContext || !tickBufferA) return;
    const source = audioContext.createBufferSource();
    source.buffer = tickBufferA;
    source.connect(audioContext.destination);
    source.start(time);
}
function playTickB(time) {
    if (!audioContext || !tickBufferB) return;
    const source = audioContext.createBufferSource();
    source.buffer = tickBufferB;
    source.connect(audioContext.destination);
    source.start(time);
}


// === 5. メトロノームの心臓部 (スケジューラ) ===
function scheduleNote(time) {
    if (currentMode === 'none') {
        playTickA(time); // 常に音A
        beatCounter = 0;
    } else if (currentMode === 'beat') {
        if (beatCounter === 0) {
            playTickB(time); // 1拍目
        } else {
            playTickA(time); // それ以外
        }
        beatCounter = (beatCounter + 1) % beatsPerMeasure;
    } else { // 'division'
        if (beatCounter === 0) {
            playTickB(time); // 拍の先頭
        } else {
            playTickA(time); // それ以外
        }
        beatCounter = (beatCounter + 1) % divisionsPerBeat;
    }
}

function scheduler() {
    if (!isRunning) {
        clearTimeout(timerId);
        timerId = null;
        return;
    }
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
        scheduleNote(nextNoteTime);
        const beatIntervalSeconds = 60.0 / bpm; 

        if (currentMode === 'beat' || currentMode === 'none') {
            nextNoteTime += beatIntervalSeconds;
        } else { // 'division'
            const divisionIntervalSeconds = beatIntervalSeconds / divisionsPerBeat;
            nextNoteTime += divisionIntervalSeconds;
        }
    }
    timerId = setTimeout(scheduler, lookahead);
}


// === 6. コントロール関数 (スタート/ストップ, BPM更新) ===
async function startStop() {
    if (!isRunning) {
        const ready = await setupAudio();
        if (!ready) { 
            audioContext = null; 
            return; 
        }
    }
    if (isRunning) {
        isRunning = false;
        startStopBtn.textContent = 'スタート';
        startStopBtn.classList.remove('running');
    } else {
        isRunning = true;
        startStopBtn.textContent = 'ストップ';
        startStopBtn.classList.add('running');
        beatCounter = 0; 
        nextNoteTime = audioContext.currentTime + 0.1; 
        scheduler(); 
    }
}
function updateBPM() {
    bpm = bpmSlider.value;
    bpmValueSpan.textContent = bpm;
}


// === 7. イベントリスナー ===
startStopBtn.addEventListener('click', startStop);
bpmSlider.addEventListener('input', updateBPM);

modeNone.addEventListener('change', () => {
    currentMode = 'none';
    beatControls.style.display = 'none'; 
    divisionControls.style.display = 'none'; 
    beatCounter = 0; 
});
modeBeat.addEventListener('change', () => {
    currentMode = 'beat';
    beatControls.style.display = 'block'; 
    divisionControls.style.display = 'none'; 
    beatCounter = 0; 
});
modeDivision.addEventListener('change', () => {
    currentMode = 'division';
    beatControls.style.display = 'none'; 
    divisionControls.style.display = 'block'; 
    beatCounter = 0; 
});
beatsSelect.addEventListener('change', (e) => {
    beatsPerMeasure = parseInt(e.target.value, 10);
    beatCounter = 0; 
});
divisionsSelect.addEventListener('change', (e) => {
    divisionsPerBeat = parseInt(e.target.value, 10);
    beatCounter = 0; 
});

beatsPerMeasure = parseInt(beatsSelect.value, 10);
divisionsPerBeat = parseInt(divisionsSelect.value, 10);


// === 8. 音声認識 ===

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isVoiceControlActive = false;
let voiceState = 'bpm'; 
let voiceStateTimer = null; 

// (かな/漢数字をアラビア数字に変換する関数)
function normalizeNumber(command) {
    let normalized = command;
    normalized = normalized.replace(/いち|一/g, '1');
    normalized = normalized.replace(/に|荷|二|にい|二位/g, '2');
    normalized = normalized.replace(/さん|三/g, '3');
    normalized = normalized.replace(/よん|四/g, '4');
    normalized = normalized.replace(/ご|五/g, '5');
    normalized = normalized.replace(/ろく|六/g, '6');
    normalized = normalized.replace(/なな|しち|七/g, '7');
    normalized = normalized.replace(/はち|八/g, '8');
    normalized = normalized.replace(/きゅう|く|九/g, '9');
    normalized = normalized.replace(/じゅう|十/g, '10');
    normalized = normalized.replace(/ぜろ|れい|ゼロ|零/g, '0');
    return normalized;
}

/**
 * 音声入力の状態を初期（BPM）に戻す
 */
function resetVoiceState() {
    console.log("-> 音声入力: BPM (初期状態)");
    voiceState = 'bpm';
    if (voiceStateTimer) {
        clearTimeout(voiceStateTimer);
        voiceStateTimer = null;
    }
    if (isVoiceControlActive && voiceFeedback) {
        voiceFeedback.textContent = 'BPMの数値をどうぞ';
    }
}

/**
 * 3秒後に初期状態に戻るタイマーを起動する
 */
function startVoiceStateTimer() {
    if (voiceStateTimer) {
        clearTimeout(voiceStateTimer);
    }
    voiceStateTimer = setTimeout(() => {
        console.log("3秒経過。初期状態に戻ります。");
        if (voiceFeedback) voiceFeedback.textContent = '時間切れです。BPMの数値をどうぞ';
        resetVoiceState();
    }, 3000); // 3秒
}

/**
 * 状態: BPM（初期状態）の処理
 */
function handleBpmState(command) {
    
    // (キーワードコマンドを先に処理)
    if (command.includes('アクセントなし') || command.includes('なし')) {
        console.log("-> モード: アクセントなし");
        modeNone.checked = true;
        modeNone.dispatchEvent(new Event('change'));
        if (voiceFeedback) voiceFeedback.textContent = 'アクセントなしモード';
        return;
    }
    if (command.includes('ひょうし') || command.includes('拍子') || command.includes('表紙')) {
        console.log("-> 音声入力: 拍子 (N) を待機中...");
        voiceState = 'awaiting_beat';
        if (voiceFeedback) voiceFeedback.textContent = '拍子(N)の数値をどうぞ (3秒以内)';
        startVoiceStateTimer(); 
        return;
    }
    if (command.includes('ぶんかつ') || command.includes('分割')) {
        console.log("-> 音声入力: 分割 (M) を待機中...");
        voiceState = 'awaiting_division';
        if (voiceFeedback) voiceFeedback.textContent = '分割(M)の数値をどうぞ (3秒以内)';
        startVoiceStateTimer(); 
        return;
    }

    const normalizedCommand = normalizeNumber(command);

    // (BPM数値コマンド)
    const match = normalizedCommand.match(/(\d+)/);
    if (match) {
        const number = parseInt(match[1], 10);
        if (number >= 40 && number <= 240) {
            console.log(`BPMを ${number} に設定します`);
            bpmSlider.value = number;
            updateBPM();
            if (voiceFeedback) voiceFeedback.textContent = `BPM ${number} に設定`;
        } else {
            console.log(`BPM値 ${number} は無効です (40-240)`);
            if (voiceFeedback) voiceFeedback.textContent = `無効なBPMです (40-240)`;
        }
    }
}

/**
 * 状態: 拍子(N) の数値待ちの処理
 */
function handleBeatState(command) {
    const normalizedCommand = normalizeNumber(command);
    let success = false; 
    const match = normalizedCommand.match(/(\d+)/); 
    if (match) {
        const number = parseInt(match[1], 10);
        if (number >= 1 && number <= 9) {
            console.log(`拍子 (N) を ${number} に設定します`);
            modeBeat.checked = true;
            modeBeat.dispatchEvent(new Event('change'));
            beatsSelect.value = number;
            beatsSelect.dispatchEvent(new Event('change'));
            if (voiceFeedback) voiceFeedback.textContent = `拍子(N) を ${number} に設定`;
            success = true;
        } else {
            console.log(`拍子(N)の値 ${number} は無効です (1-9)`);
            if (voiceFeedback) voiceFeedback.textContent = `無効な拍子です (1-9)`;
        }
    } else {
        console.log("拍子(N)の数値 (1-9) が認識できませんでした。");
        if (voiceFeedback) voiceFeedback.textContent = '数値が認識できませんでした';
    }
    
    resetVoiceState(); 

    if (success && voiceFeedback) {
        setTimeout(() => {
             if (voiceState === 'bpm') voiceFeedback.textContent = 'BPMの数値をどうぞ';
        }, 1500); 
    }
}

/**
 * 状態: 分割(M) の数値待ちの処理
 */
function handleDivisionState(command) {
    const normalizedCommand = normalizeNumber(command);
    let success = false;
    const match = normalizedCommand.match(/(\d+)/);
    if (match) {
        const number = parseInt(match[1], 10);
        if (number >= 1 && number <= 6) {
            console.log(`分割 (M) を ${number} に設定します`);
            modeDivision.checked = true;
            modeDivision.dispatchEvent(new Event('change'));
            divisionsSelect.value = number;
            divisionsSelect.dispatchEvent(new Event('change'));
            if (voiceFeedback) voiceFeedback.textContent = `分割(M) を ${number} に設定`;
            success = true;
        } else {
            console.log(`分割(M)の値 ${number} は無効です (1-6)`);
            if (voiceFeedback) voiceFeedback.textContent = `無効な分割です (1-6)`;
        }
    } else {
        console.log("分割(M)の数値 (1-6) が認識できませんでした。");
        if (voiceFeedback) voiceFeedback.textContent = '数値が認識できませんでした';
    }

    resetVoiceState(); 

    if (success && voiceFeedback) {
        setTimeout(() => {
            if (voiceState === 'bpm') voiceFeedback.textContent = 'BPMの数値をどうぞ';
        }, 1500); 
    }
}


/**
 * メインの音声コマンド処理（状態に応じて振り分ける）
 * ▼▼▼ ここを修正 ▼▼▼
 */
function handleVoiceCommand(command) {
    // --- 優先コマンド (状態に関わらず実行) ---

    // (メトロノーム開始)
    if (command.includes('スタート') && !isRunning) {
        startStop();
        if (voiceFeedback) voiceFeedback.textContent = 'メトロノームを開始';
        return;
    }
    // (メトロノーム停止)
    if ((command.includes('ストップ') || command.includes('とめて')) && isRunning) {
        startStop();
        if (voiceFeedback) voiceFeedback.textContent = 'メトロノームを停止';
        return;
    }

    // ★★★ 【新機能】音声コントロール自体を停止 ★★★
    // 「音声停止」「コントロール停止」「マイクオフ」などで音声認識をオフにする
    if ((command.includes('音声停止') || command.includes('コントロール停止') || command.includes('マイクオフ')) && isVoiceControlActive) {
        console.log("-> 音声コントロールを停止します");
        
        recognition.stop(); // 認識を停止
        isVoiceControlActive = false; // アクティブフラグを倒す
        
        // ボタンの見た目を元に戻す
        voiceBtn.textContent = '音声コントロール 🎙️';
        voiceBtn.classList.remove('running');
        
        // 状態をリセットし、フィードバックを更新
        resetVoiceState(); 
        if (voiceFeedback) voiceFeedback.textContent = '音声コントロールを停止しました';

        // 少し待ってからフィードバックを完全に消す
        setTimeout(() => {
            // 停止したままなら（＝ユーザーがボタンを押して再開してないなら）
            if (voiceFeedback && !isVoiceControlActive) {
                voiceFeedback.textContent = ''; // フィードバックをクリア
            }
        }, 2000); // 2秒後に消す
        
        return; // これ以上処理しない
    }
    // ★★★ ここまで追加 ★II


    // --- 状態依存コマンド (BPM, 拍子, 分割) ---
    switch (voiceState) {
        case 'bpm':
            handleBpmState(command);
            break;
        case 'awaiting_beat':
            handleBeatState(command);
            break;
        case 'awaiting_division':
            handleDivisionState(command);
            break;
    }
}


// --- 音声認識の初期化と実行 ---
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript.trim();
        console.log('認識された音声:', transcript);
        handleVoiceCommand(transcript);
    };

    recognition.onend = () => {
        // isVoiceControlActive が true の場合のみ再開
        // (音声停止コマンドで false になっていれば、再開しない)
        if (isVoiceControlActive) {
            try {
                recognition.start();
            } catch(e) {
                console.warn("認識の再開に失敗:", e);
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
    };

    voiceBtn.addEventListener('click', () => {
        if (isVoiceControlActive) {
            // --- 停止 ---
            recognition.stop();
            isVoiceControlActive = false;
            voiceBtn.textContent = '音声コントロール 🎙️';
            voiceBtn.classList.remove('running');
            resetVoiceState(); 
            if (voiceFeedback) voiceFeedback.textContent = ''; 
        } else {
            // --- 開始 ---
            try {
                recognition.start(); 
                isVoiceControlActive = true;
                voiceBtn.textContent = '音声停止 🛑';
                voiceBtn.classList.add('running');
                resetVoiceState(); // 開始時にリセット＆フィードバック表示
            } catch (error) {
                console.error('音声認識の開始に失敗:', error);
                alert('音声認識の開始に失敗しました。');
            }
        }
    });

} else {
    // --- 非対応ブラウザ ---
    console.warn('このブラウザは Web Speech API に対応していません。');
    voiceBtn.textContent = '非対応ブラウザ';
    voiceBtn.disabled = true;
    if (voiceFeedback) voiceFeedback.textContent = 'このブラウザは音声操作非対応です';
}
