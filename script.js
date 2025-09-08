// Global variables
let isProcessing = false;
let conversations = []; // [{id, title, messages:[{role, content, ts}]}]
let activeConversationId = null;

// Send message function
async function sendMessage() {
    if (isProcessing) return;
    
    const userInput = document.getElementById('userInput');
    const responseText = document.getElementById('responseText');
    const message = userInput.value.trim();
    
    if (!message) {
        alert('Please enter a message');
        return;
    }
    
    // Stop any ongoing speech before sending
    stopVoice();

    // Set loading state
    isProcessing = true;
    setLoadingState(true);
    if (responseText) responseText.innerHTML = '<div class="loading"></div> Thinking...';
    
    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        if (responseText) responseText.textContent = data.response;
        
        // Clear input
        userInput.value = '';
        
        // Speak the response
        speakText(data.response);

        // Persist in conversation history
        appendMessage({ role: 'user', content: message });
        appendMessage({ role: 'assistant', content: data.response });
        
    } catch (error) {
        if (responseText) responseText.textContent = '⚠️ Error: ' + error.message;
    } finally {
        isProcessing = false;
        setLoadingState(false);
    }
}

// Text-to-speech function
function speakText(text) {
    // Remove warning symbols and clean text for speech
    const cleanText = text.replace(/⚠️/g, '').trim();
    
    if (cleanText && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        // Use a pleasant voice if available
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Google') || 
            voice.name.includes('Microsoft') ||
            voice.lang.startsWith('en')
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        // Stop any current speech first
        try { if (speechSynthesis.speaking) speechSynthesis.cancel(); } catch (e) {}
        speechSynthesis.speak(utterance);
    }
}

// Voice input function  
function voiceInput() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        alert('Speech recognition not supported in this browser');
        return;
    }
    
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();
    document.getElementById('statusBadge').textContent = 'Listening…';

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById("userInput").value = transcript;
        sendMessage();
    };

    recognition.onerror = function(event) {
        alert("Voice input error: " + event.error);
        document.getElementById('statusBadge').textContent = 'Ready';
    };
    
    recognition.onend = function() {
        if (document.getElementById('statusBadge').textContent === 'Listening…') {
            document.getElementById('statusBadge').textContent = 'Ready';
        }
    }
}

// Set loading state function
function setLoadingState(isLoading) {
    const sendBtn = document.getElementById('sendBtn');
    const speakBtn = document.getElementById('speakBtn');
    const status = document.getElementById('statusBadge');
    
    if (isLoading) {
        sendBtn.classList.add('disabled');
        speakBtn.classList.add('disabled');
        sendBtn.textContent = 'Sending…';
        status.textContent = 'Thinking…';
        status.style.background = '#ed8936';
    } else {
        sendBtn.classList.remove('disabled');
        speakBtn.classList.remove('disabled');
        sendBtn.textContent = 'Send';
        status.textContent = 'Ready';
        status.style.background = '#48bb78';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('userInput');
    
    // Submit on Enter
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !isProcessing) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Focus on input
    input.focus();
    
    // Load voices for speech synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        speechSynthesis.addEventListener('voiceschanged', function() {
            speechSynthesis.getVoices();
        });
    }

    // Initialize conversations UI
    loadConversations();
    renderHistory();
    ensureActiveConversation();

    // Globe removed; background image remains
});

// Stop speech synthesis
function stopVoice() {
    if (!('speechSynthesis' in window)) return;
    try {
        if (speechSynthesis.speaking || speechSynthesis.pending) {
            speechSynthesis.cancel();
        }
    } catch (e) {
        console.error('Stop voice failed:', e);
    }
}

// Conversation helpers
function uid() { return Math.random().toString(36).slice(2, 10); }

function loadConversations() {
    try {
        const raw = localStorage.getItem('conversations');
        conversations = raw ? JSON.parse(raw) : [];
    } catch { conversations = []; }
}

function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

function ensureActiveConversation() {
    if (!activeConversationId) {
        if (conversations.length === 0) {
            const created = { id: uid(), title: 'New chat', messages: [] };
            conversations.unshift(created);
            activeConversationId = created.id;
            saveConversations();
        } else {
            activeConversationId = conversations[0].id;
        }
    }
    renderMessages();
}

function setActiveConversation(id) {
    activeConversationId = id;
    renderHistory();
    renderMessages();
}

function newConversation() {
    const created = { id: uid(), title: 'New chat', messages: [] };
    conversations.unshift(created);
    activeConversationId = created.id;
    saveConversations();
    renderHistory();
    renderMessages();
    document.getElementById('userInput').focus();
}

function appendMessage(msg) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    conv.messages.push({ ...msg, ts: Date.now() });
    if (conv.title === 'New chat' && conv.messages.length === 1 && msg.role === 'user') {
        const text = msg.content.trim();
        conv.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    }
    saveConversations();
    renderMessages();
    renderHistory();
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    container.innerHTML = '';
    if (!conv) return;
    for (const m of conv.messages) {
        const item = document.createElement('div');
        item.className = 'message ' + (m.role === 'user' ? 'user' : 'assistant');
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = m.content;
        item.appendChild(bubble);
        container.appendChild(item);
    }
    container.scrollTop = container.scrollHeight;
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    const q = (document.getElementById('historySearch')?.value || '').toLowerCase();
    list.innerHTML = '';
    for (const conv of conversations) {
        const hay = (conv.title + ' ' + conv.messages.map(m=>m.content).join(' ')).toLowerCase();
        if (q && !hay.includes(q)) continue;
        const li = document.createElement('li');
        li.textContent = conv.title;
        if (conv.id === activeConversationId) li.classList.add('active');
        li.onclick = () => setActiveConversation(conv.id);
        list.appendChild(li);
    }
}

function filterHistory() { renderHistory(); }

// 3D Globe background using Three.js
function initGlobe() {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('globeCanvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.z = 3.2;

    const resize = () => {
        const { clientWidth: w, clientHeight: h } = canvas;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    // Glowing sphere (stylized globe)
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x2563eb, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.85 });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Faint atmosphere
    const glowGeo = new THREE.SphereGeometry(1.05, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // Lights
    const dirLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    dirLight.position.set(5, 2, 3);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x3b82f6, 0.4));

    // Animation loop
    const animate = () => {
        globe.rotation.y += 0.0025;
        glow.rotation.y += 0.0025;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };
    animate();
}