document.addEventListener('DOMContentLoaded', function() {
    const codeEditor = document.getElementById('code-editor');
    const highlightLayer = document.querySelector('#highlight-layer code');
    const lineNumbers = document.getElementById('line-numbers');
    const output = document.getElementById('output');
    const runBtn = document.getElementById('run-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const clearOutputBtn = document.getElementById('clear-output-btn');
    const copyBtn = document.getElementById('copy-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const codeTitle = document.getElementById('code-title');
    const saveStatus = document.getElementById('save-status');
    const resizer = document.getElementById('resizer');
    const clearConsoleBtn = document.getElementById('clear-console-btn');
    const userInfo = document.getElementById('user-info');
    const authButtons = document.getElementById('auth-buttons');
    const usernameDisplay = document.getElementById('username-display');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const profileBtn = document.getElementById('profile-btn');
    const logoutBtn = document.getElementById('logout-btn');
    let editorHistory = [];
    let historyIndex = -1;
    let isEditorDirty = false;
    let currentCodeId = null;
    let lastSavedContent = '';
    let currentUser = null;
    let authToken = localStorage.getItem('auth_token');
    const hljs = window.hljs;
    const API_BASE = '/api';

    async function checkAuth() {
        if (!authToken) {
            showLoggedOutState();
            return false;
        }
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const data = await response.json();
            if (data.success) {
                currentUser = data.data.user;
                showLoggedInState();
                return true;
            } else {
                authToken = null;
                localStorage.removeItem('auth_token');
                showLoggedOutState();
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            showLoggedOutState();
            return false;
        }
    }

    function showLoggedInState() {
        if (userInfo && authButtons && usernameDisplay) {
            usernameDisplay.textContent = currentUser.username;
            userInfo.classList.remove('hidden');
            authButtons.classList.add('hidden');
        }
    }

    function showLoggedOutState() {
        if (userInfo && authButtons) {
            userInfo.classList.add('hidden');
            authButtons.classList.remove('hidden');
        }
        currentUser = null;
    }

    function logout() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('auth_token');
        showLoggedOutState();
        showNotification('Logout realizado com sucesso!');
        currentCodeId = null;
        lastSavedContent = '';
        updateSaveStatus('unsaved');
    }

    function updateHighlighting() {
        if (!highlightLayer || !codeEditor || !hljs) return;
        highlightLayer.textContent = codeEditor.value;
        hljs.highlightElement(highlightLayer);
    }

    function updateLineNumbers() {
        if (!lineNumbers || !codeEditor) return;
        const lines = codeEditor.value.split('\n');
        let lineNumbersHTML = '';
        for (let i = 0; i < lines.length; i++) {
            lineNumbersHTML += (i + 1) + '\n';
        }
        lineNumbers.textContent = lineNumbersHTML;
    }

    function runCode() {
        clearOutput();
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        try {
            console.log = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        try {
                            return JSON.stringify(arg, null, 2);
                        } catch (e) {
                            return String(arg);
                        }
                    }
                    return String(arg);
                }).join(' ');
                appendToOutput(message, 'log');
                originalLog.apply(console, arguments);
            };
            console.error = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'error');
                originalError.apply(console, arguments);
            };
            console.warn = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'warn');
                originalWarn.apply(console, arguments);
            };
            console.info = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'info');
                originalInfo.apply(console, arguments);
            };
            if (!codeEditor) return;
            const code = codeEditor.value;
            if (currentCodeId) {
                registerCodeRun(currentCodeId);
            }
            const result = (function() {
                try {
                    return eval(code);
                } catch (error) {
                    throw error;
                }
            })();
            if (result !== undefined) {
                let resultStr;
                if (typeof result === 'object' && result !== null) {
                    try {
                        resultStr = JSON.stringify(result, null, 2);
                    } catch (e) {
                        resultStr = String(result);
                    }
                } else {
                    resultStr = String(result);
                }
                appendToOutput('=> ' + resultStr, 'result');
            }
        } catch (error) {
            appendToOutput('Error: ' + error.message, 'error');
            console.error('Code execution error:', error);
        } finally {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        }
    }

    async function registerCodeRun(codeId) {
        try {
            await fetch(`${API_BASE}/codes/${codeId}/run`, {
                method: 'POST',
                headers: authToken ? {
                    'Authorization': `Bearer ${authToken}`
                } : {}
            });
        } catch (error) {
            console.error('Erro ao registrar execução:', error);
        }
    }

    function appendToOutput(message, type = 'log') {
        if (!output) return;
        const line = document.createElement('div');
        line.className = 'output-line ' + type;
        line.textContent = message;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    function clearOutput() {
        if (!output) return;
        output.innerHTML = '';
    }

    function saveToHistory() {
        if (!codeEditor) return;
        if (historyIndex < editorHistory.length - 1) {
            editorHistory = editorHistory.slice(0, historyIndex + 1);
        }
        editorHistory.push(codeEditor.value);
        historyIndex = editorHistory.length - 1;
        if (editorHistory.length > 100) {
            editorHistory.shift();
            historyIndex--;
        }
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            if (codeEditor) {
                codeEditor.value = editorHistory[historyIndex];
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            }
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyIndex < editorHistory.length - 1) {
            historyIndex++;
            if (codeEditor) {
                codeEditor.value = editorHistory[historyIndex];
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            }
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        if (!undoBtn || !redoBtn) return;
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= editorHistory.length - 1;
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    function copyCode() {
        if (!codeEditor) return;
        codeEditor.select();
        codeEditor.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            showNotification('Código copiado para a área de transferência!');
        } catch (err) {
            console.error('Falha ao copiar código:', err);
            showNotification('Falha ao copiar código', 'error');
        }
    }

    function toggleFullscreen() {
        const editorContainer = document.querySelector('.editor-container');
        if (!document.fullscreenElement) {
            if (editorContainer && editorContainer.requestFullscreen) {
                editorContainer.requestFullscreen().catch(err => {
                    console.error(`Erro ao ativar tela cheia: ${err.message}`);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    function selectAll() {
        if (!codeEditor) return;
        codeEditor.select();
        codeEditor.setSelectionRange(0, codeEditor.value.length);
    }

    function markEditorDirty() {
        if (!codeEditor) return;
        if (lastSavedContent !== codeEditor.value) {
            isEditorDirty = true;
            updateSaveStatus('unsaved');
        } else {
            isEditorDirty = false;
            updateSaveStatus('saved');
        }
        clearTimeout(window.historySaveTimeout);
        window.historySaveTimeout = setTimeout(saveToHistory, 500);
    }

    function updateSaveStatus(status) {
        if (!saveStatus) return;
        switch (status) {
            case 'saved':
                saveStatus.textContent = 'Salvo';
                saveStatus.style.color = '#888';
                break;
            case 'unsaved':
                saveStatus.textContent = 'Não salvo';
                saveStatus.style.color = '#e74c3c';
                break;
            case 'saving':
                saveStatus.textContent = 'Salvando...';
                saveStatus.style.color = '#f39c12';
                break;
        }
    }

    async function saveCode() {
        if (!currentUser) {
            showLoginModal();
            return;
        }
        if (!codeEditor || !codeTitle) return;
        const title = codeTitle.value || 'Untitled.js';
        const content = codeEditor.value;
        updateSaveStatus('saving');
        try {
            if (currentCodeId) {
                const response = await fetch(`${API_BASE}/codes/${currentCodeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        description: 'Código criado no JS Editor'
                    })
                });
                const data = await response.json();
                if (data.success) {
                    lastSavedContent = content;
                    isEditorDirty = false;
                    updateSaveStatus('saved');
                    showNotification('Código atualizado com sucesso!');
                } else {
                    updateSaveStatus('unsaved');
                    showNotification('Erro ao atualizar código: ' + data.message, 'error');
                }
            } else {
                const response = await fetch(`${API_BASE}/codes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        description: 'Código criado no JS Editor',
                        isPublic: false
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentCodeId = data.data.code._id;
                    lastSavedContent = content;
                    isEditorDirty = false;
                    updateSaveStatus('saved');
                    showNotification('Código salvo com sucesso!');
                } else {
                    updateSaveStatus('unsaved');
                    showNotification('Erro ao salvar código: ' + data.message, 'error');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar código:', error);
            updateSaveStatus('unsaved');
            showNotification('Erro ao salvar código. Tente novamente.', 'error');
        }
    }

    async function showShareModal() {
        if (!currentUser) {
            showLoginModal();
            return;
        }
        if (!currentCodeId) {
            showNotification('Salve o código primeiro para compartilhar', 'error');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/codes/${currentCodeId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    allowEditing: false,
                    expiresIn: 30
                })
            });
            const data = await response.json();
            if (data.success) {
                const shareModal = document.getElementById('share-modal');
                const shareLink = document.getElementById('share-link');
                const shareSuccess = document.getElementById('share-success');
                if (shareModal && shareLink && shareSuccess) {
                    shareLink.value = data.data.shareUrl;
                    shareSuccess.textContent = 'Link de compartilhamento gerado com sucesso!';
                    shareSuccess.style.color = 'var(--success-color)';
                    shareModal.style.display = 'block';
                }
                showNotification('Link de compartilhamento gerado!');
            } else {
                showNotification('Erro ao gerar link: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao compartilhar código:', error);
            showNotification('Erro ao compartilhar código', 'error');
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        notification.style.backgroundColor = type === 'error' ? 'var(--error-color)' : 'rgba(0, 0, 0, 0.8)';
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

    function showLoginModal() {
        showNotification('Faça login para salvar e compartilhar códigos', 'error');
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'block';
        }
    }

    let isResizing = false;
    let lastX, lastY;
    if (resizer) {
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            lastX = e.clientX;
            lastY = e.clientY;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        });
    }

    function handleResize(e) {
        if (!isResizing) return;
        const codeContainer = document.querySelector('.code-container');
        const outputContainer = document.querySelector('.output-container');
        const editorWorkspace = document.querySelector('.editor-workspace');
        if (!codeContainer || !outputContainer || !editorWorkspace) return;
        if (window.innerWidth > 768) {
            const deltaX = e.clientX - lastX;
            const workspaceRect = editorWorkspace.getBoundingClientRect();
            const codeRect = codeContainer.getBoundingClientRect();
            const newCodeWidth = codeRect.width + deltaX;
            const minWidth = 200;
            const maxWidth = workspaceRect.width - minWidth - 10;
            if (newCodeWidth >= minWidth && newCodeWidth <= maxWidth) {
                const newCodePercentage = (newCodeWidth / workspaceRect.width) * 100;
                const newOutputPercentage = 100 - newCodePercentage - 1;
                codeContainer.style.flex = `0 0 ${newCodePercentage}%`;
                outputContainer.style.width = `${newOutputPercentage}%`;
                lastX = e.clientX;
            }
        } else {
            const deltaY = e.clientY - lastY;
            const workspaceRect = editorWorkspace.getBoundingClientRect();
            const codeRect = codeContainer.getBoundingClientRect();
            const newCodeHeight = codeRect.height + deltaY;
            const minHeight = 150;
            const maxHeight = workspaceRect.height - minHeight - 10;
            if (newCodeHeight >= minHeight && newCodeHeight <= maxHeight) {
                const newOutputHeight = workspaceRect.height - newCodeHeight - 10;
                codeContainer.style.height = `${newCodeHeight}px`;
                outputContainer.style.height = `${newOutputHeight}px`;
                lastY = e.clientY;
            }
        }
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }

    function setupModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    modal.style.display = 'none';
                };
            }
            window.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        setupAuthModals();
    }

    function setupAuthModals() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                const errorDiv = document.getElementById('login-error');
                try {
                    const response = await fetch(`${API_BASE}/auth/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            identifier: username,
                            password: password
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        authToken = data.data.token;
                        localStorage.setItem('auth_token', authToken);
                        currentUser = data.data.user;
                        showLoggedInState();
                        document.getElementById('login-modal').style.display = 'none';
                        showNotification('Login realizado com sucesso!');
                        loginForm.reset();
                        if (errorDiv) errorDiv.textContent = '';
                    } else {
                        if (errorDiv) errorDiv.textContent = data.message || 'Erro no login';
                    }
                } catch (error) {
                    console.error('Erro no login:', error);
                    if (errorDiv) errorDiv.textContent = 'Erro de conexão. Tente novamente.';
                }
            });
        }
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const confirmPassword = document.getElementById('register-confirm-password').value;
                const errorDiv = document.getElementById('register-error');
                if (password !== confirmPassword) {
                    if (errorDiv) errorDiv.textContent = 'As senhas não coincidem';
                    return;
                }
                try {
                    const response = await fetch(`${API_BASE}/auth/register`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username,
                            email,
                            password
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        authToken = data.data.token;
                        localStorage.setItem('auth_token', authToken);
                        currentUser = data.data.user;
                        showLoggedInState();
                        document.getElementById('register-modal').style.display = 'none';
                        showNotification('Conta criada com sucesso!');
                        registerForm.reset();
                        if (errorDiv) errorDiv.textContent = '';
                    } else {
                        if (errorDiv) {
                            errorDiv.textContent = data.message || 'Erro no registro';
                        }
                    }
                } catch (error) {
                    console.error('Erro no registro:', error);
                    if (errorDiv) errorDiv.textContent = 'Erro de conexão. Tente novamente.';
                }
            });
        }
    }

    function init() {
        checkAuth();
        if (codeEditor && lineNumbers && highlightLayer) {
            highlightLayer.style.background = "transparent";
            updateLineNumbers();
            updateHighlighting();
            saveToHistory();
            codeEditor.addEventListener('input', function() {
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            });
            codeEditor.addEventListener('scroll', function() {
                if (highlightLayer && highlightLayer.parentElement) {
                    highlightLayer.parentElement.scrollTop = codeEditor.scrollTop;
                    highlightLayer.parentElement.scrollLeft = codeEditor.scrollLeft;
                }
                if (lineNumbers) {
                    lineNumbers.scrollTop = codeEditor.scrollTop;
                }
            });
            codeEditor.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 4;
                    updateHighlighting();
                    updateLineNumbers();
                    markEditorDirty();
                }
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case 'z':
                            e.preventDefault();
                            undo();
                            break;
                        case 'y':
                            e.preventDefault();
                            redo();
                            break;
                        case 's':
                            e.preventDefault();
                            saveCode();
                            break;
                        case 'a':
                            e.preventDefault();
                            selectAll();
                            break;
                    }
                }
                if (e.key === 'F9') {
                    e.preventDefault();
                    runCode();
                }
                if (e.key === 'F11') {
                    e.preventDefault();
                    toggleFullscreen();
                }
            });
        }
        if (runBtn) runBtn.addEventListener('click', runCode);
        if (undoBtn) undoBtn.addEventListener('click', undo);
        if (redoBtn) redoBtn.addEventListener('click', redo);
        if (clearOutputBtn) clearOutputBtn.addEventListener('click', clearOutput);
        if (copyBtn) copyBtn.addEventListener('click', copyCode);
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
        if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll);
        if (saveBtn) saveBtn.addEventListener('click', saveCode);
        if (shareBtn) shareBtn.addEventListener('click', showShareModal);
        if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', clearOutput);
        if (loginBtn) loginBtn.addEventListener('click', () => {
            document.getElementById('login-modal').style.display = 'block';
        });
        if (registerBtn) registerBtn.addEventListener('click', () => {
            document.getElementById('register-modal').style.display = 'block';
        });
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
        if (codeTitle) {
            codeTitle.addEventListener('change', function() {
                markEditorDirty();
            });
        }
        setupModals();
        if (codeEditor) {
            codeEditor.focus();
        }
    }

    init();
});
